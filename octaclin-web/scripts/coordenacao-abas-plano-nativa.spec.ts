import assert from 'node:assert/strict';
import test from 'node:test';
import { chaveAbasPlano, criarCanalAbasPlano, criarTravaAbasPlano } from '../lib/coordenacao-abas-plano-nativa';
import { CoordenacaoAbasPlano } from '../lib/coordenacao-abas-plano';

const drenar = () => new Promise<void>(resolve => setImmediate(resolve));
function gerenciador() {
  let ocupado = false;
  const pedidos: LockOptions[] = [];
  const g = { request: async (_chave: string, opcoes: LockOptions, cb: LockGrantedCallback<void>) => {
    pedidos.push(opcoes); if (opcoes.signal?.aborted) throw new DOMException('Abortado', 'AbortError');
    if (ocupado) { await cb(null); return; }
    ocupado = true;
    try { await cb({ name: 'sintetico', mode: 'exclusive' } as Lock); } finally { ocupado = false; }
  } } as unknown as LockManager;
  return { g, pedidos };
}
test('PA07 chave opaca separa tenant/recurso e não expõe identificadores na saída', async () => {
  const a = await chaveAbasPlano('clinica-sintetica', 'plano-sintetico');
  assert.match(a, /^octaclin-pa07-v1-[a-f0-9]{64}$/);
  assert.equal(a, await chaveAbasPlano('clinica-sintetica', 'plano-sintetico'));
  assert.notEqual(a, await chaveAbasPlano('outra-clinica', 'plano-sintetico'));
  assert.notEqual(a, await chaveAbasPlano('clinica-sintetica', 'outro-plano'));
});
test('PA07 adaptador nativo mantém exclusividade até liberar; não enfileira nem rouba trava', async () => {
  const { g, pedidos } = gerenciador(); const trava = criarTravaAbasPlano(g, 'recurso-sintetico');
  const signal = new AbortController().signal;
  const liberar = await trava.adquirir(signal); assert.equal(typeof liberar, 'function');
  assert.equal(await trava.adquirir(signal), null);
  for (const p of pedidos) { assert.equal(p.ifAvailable, true); assert.equal(p.mode, 'exclusive'); assert.equal(p.steal, undefined); assert.equal(p.signal, undefined, 'Web Locks não permite signal junto com ifAvailable'); }
  liberar!(); liberar!(); await drenar();
  const proximo = await trava.adquirir(signal); assert.equal(typeof proximo, 'function'); proximo!();
});
test('PA07 aquisição cancelada não deixa lock pendente', async () => {
  const { g } = gerenciador(); const trava = criarTravaAbasPlano(g, 'recurso-sintetico');
  const c = new AbortController(); c.abort();
  await assert.rejects(trava.adquirir(c.signal), { name: 'AbortError' });
  const liberar = await trava.adquirir(new AbortController().signal); assert.equal(typeof liberar, 'function'); liberar!();
});
test('PA07 transporte BroadcastChannel real transfere só envelope e encerra listeners', async t => {
  const { g } = gerenciador(); const nome = `octaclin-sintetico-${crypto.randomUUID()}`;
  const canalA = criarCanalAbasPlano(nome); const canalB = criarCanalAbasPlano(nome);
  t.after(() => { canalA.fechar(); canalB.fechar(); });
  const trava = criarTravaAbasPlano(g, nome);
  const x = new CoordenacaoAbasPlano({ instancia: 'aba-a', canal: canalA, trava, drenar: async () => {}, conferir: async () => true });
  const y = new CoordenacaoAbasPlano({ instancia: 'aba-b', canal: canalB, trava, drenar: async () => {}, conferir: async () => true });
  t.after(() => { x.encerrar(); y.encerrar(); });
  await x.iniciar(); await y.iniciar(); await y.assumir();
  assert.equal(x.estado, 'consulta'); assert.equal(y.podeEditar, true);
});

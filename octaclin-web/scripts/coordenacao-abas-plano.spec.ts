import assert from 'node:assert/strict';
import test from 'node:test';
import { CoordenacaoAbasPlano, type CanalAbasPlano, type TravaAbasPlano } from '../lib/coordenacao-abas-plano';

const drenar = () => new Promise<void>(resolve => setImmediate(resolve));
function adiar<T>() { let resolver!: (v: T) => void; const promessa = new Promise<T>(r => { resolver = r; }); return { promessa, resolver }; }
function ambiente() {
  let ocupada = false;
  const ouvintes = new Map<string, (m: unknown) => void>();
  const mensagens: unknown[] = [];
  const trava: TravaAbasPlano = { adquirir: async signal => {
    if (ocupada || signal.aborted) return null;
    ocupada = true;
    let liberada = false;
    return () => { if (!liberada) { liberada = true; ocupada = false; } };
  } };
  function aba(id: string, opcoes: { conferir?: (s: AbortSignal) => Promise<boolean>; drenar?: () => Promise<void>; trava?: boolean; canal?: boolean } = {}) {
    let conferir = 0; let suspender = 0;
    const canal: CanalAbasPlano = {
      enviar: m => { mensagens.push(m); for (const [destino, fn] of ouvintes) if (destino !== id) queueMicrotask(() => fn(m)); },
      ouvir: fn => { ouvintes.set(id, fn); return () => { ouvintes.delete(id); }; },
      fechar: () => { ouvintes.delete(id); }
    };
    const c = new CoordenacaoAbasPlano({
      instancia: id, trava: opcoes.trava === false ? undefined : trava,
      canal: opcoes.canal === false ? undefined : canal,
      conferir: async s => { conferir++; return opcoes.conferir ? opcoes.conferir(s) : true; },
      drenar: async () => { suspender++; await opcoes.drenar?.(); }
    });
    return { c, conferencias: () => conferir, suspensoes: () => suspender };
  }
  return { aba, mensagens, enviar: (id: string, m: unknown) => ouvintes.get(id)?.(m), ouvintes };
}

test('PA07 duas abas disputam a mesma trava; só uma edita, ambas leem sem escrita', async () => {
  const a = ambiente(); const x = a.aba('aba-a'); const y = a.aba('aba-b');
  await Promise.all([x.c.iniciar(), y.c.iniciar()]);
  assert.equal(x.c.podeEditar, true); assert.equal(y.c.estado, 'consulta');
  assert.equal(x.conferencias(), 1); assert.equal(y.conferencias(), 0);
  x.c.encerrar(); y.c.encerrar(); assert.equal(a.ouvintes.size, 0);
});
test('PA07 retomada pausa origem, aguarda envio e só então adquire e reconfere', async () => {
  const a = ambiente(); const envio = adiar<void>();
  const x = a.aba('aba-a', { drenar: () => envio.promessa }); const y = a.aba('aba-b');
  await x.c.iniciar(); await y.c.iniciar();
  const assumir = y.c.assumir(); await drenar();
  assert.equal(x.c.estado, 'transferindo'); assert.equal(x.c.podeEditar, false);
  assert.equal(y.c.podeEditar, false); assert.equal(y.conferencias(), 0);
  envio.resolver(); await assumir;
  assert.equal(x.c.estado, 'consulta'); assert.equal(y.c.podeEditar, true);
  assert.equal(y.conferencias(), 1); assert.equal(x.suspensoes(), 1);
  for (const m of a.mensagens) assert.deepEqual(Object.keys(m as object).sort(), ['de', 'pedido', 'tipo', 'v', ...('para' in (m as object) ? ['para'] : [])].sort());
  x.c.encerrar(); y.c.encerrar();
});
test('PA07 duas retomadas concorrentes não criam dois donos', async () => {
  const a = ambiente(); const x = a.aba('aba-a'); const y = a.aba('aba-b'); const z = a.aba('aba-c');
  await x.c.iniciar(); await y.c.iniciar(); await z.c.iniciar();
  const py = y.c.assumir(); const pz = z.c.assumir(); await drenar();
  assert.equal([x,y,z].filter(x => x.c.podeEditar).length, 1);
  x.c.encerrar(); y.c.encerrar(); z.c.encerrar(); await Promise.all([py,pz]);
});
test('PA07 reconferência recusada nunca habilita edição; novo aceite não ocorre automaticamente', async () => {
  const a = ambiente(); const x = a.aba('aba-a', { conferir: async () => false });
  await x.c.iniciar(); assert.equal(x.c.podeEditar, false); assert.equal(x.c.estado, 'reconferir');
  assert.equal(x.conferencias(), 1); x.c.encerrar();
});
test('PA07 encerramento durante leitura ignora ACK tardio e libera trava sem esperar rede', async () => {
  const a = ambiente(); const leitura = adiar<boolean>(); const x = a.aba('aba-a', { conferir: () => leitura.promessa });
  const iniciar = x.c.iniciar(); await drenar(); x.c.encerrar();
  const y = a.aba('aba-b'); await y.c.iniciar(); assert.equal(y.c.podeEditar, true);
  leitura.resolver(true); await iniciar; assert.equal(x.c.podeEditar, false);
  y.c.encerrar();
});
test('PA07 mensagens inválidas ou não solicitadas não concedem posse nem suspendem edição', async () => {
  const a = ambiente(); const x = a.aba('aba-a'); await x.c.iniciar();
  for (const m of [null, {}, { v: 2, tipo: 'solicitar', de: 'aba-b', pedido: 'p' },
    { v: 1, tipo: 'liberado', de: 'aba-b', para: 'aba-a', pedido: 'p' },
    { v: 1, tipo: 'solicitar', de: 'aba-b', pedido: 'p', documento: 'nao permitido' },
    { v: 1, tipo: 'solicitar', de: 'aba-b', pedido: 'x'.repeat(200) }]) a.enviar('aba-a', m);
  await drenar(); assert.equal(x.c.podeEditar, true); assert.equal(x.suspensoes(), 0); x.c.encerrar();
});
test('PA07 sem APIs não afirma exclusividade e ainda exige leitura autorizada', async () => {
  const a = ambiente(); const x = a.aba('aba-a', { trava: false, canal: false });
  await x.c.iniciar(); assert.equal(x.c.estado, 'indisponivel'); assert.equal(x.c.podeEditar, true);
  assert.equal(x.conferencias(), 1); x.c.encerrar();
  const y = a.aba('aba-b', { trava: false, conferir: async () => { throw new Error('Sem acesso'); } });
  await y.c.iniciar(); assert.equal(y.c.podeEditar, false); y.c.encerrar();
});
test('PA07 timeout não rouba lock e ABA de mensagem antiga não retoma edição', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const a = ambiente(); const x = a.aba('aba-a', { canal: false }); const y = a.aba('aba-b');
  await x.c.iniciar(); await y.c.iniciar(); const p = y.c.assumir(); await drenar();
  t.mock.timers.tick(8_000); await p;
  assert.equal(x.c.podeEditar, true); assert.equal(y.c.podeEditar, false);
  const pedido = a.mensagens[0] as { pedido: string };
  a.enviar('aba-b', { v: 1, tipo: 'liberado', de: 'aba-a', para: 'aba-b', pedido: pedido.pedido });
  await drenar(); assert.equal(y.c.podeEditar, false); x.c.encerrar(); y.c.encerrar();
});
test('PA07 revalidação de foco suspende antes de leitura e não preserva permissão revogada', async () => {
  const a = ambiente(); let permitir = true;
  const x = a.aba('aba-a', { conferir: async () => permitir });
  await x.c.iniciar(); permitir = false; const p = x.c.revalidar();
  assert.equal(x.c.podeEditar, false); await p; assert.equal(x.c.estado, 'reconferir'); x.c.encerrar();
});

test('PA07 retomada repetida durante conferência não invalida a aquisição em andamento', async () => {
  const a = ambiente(); const leitura = adiar<boolean>();
  const x = a.aba('aba-a', { conferir: () => leitura.promessa });
  const inicio = x.c.iniciar(); await drenar(); const repetida = x.c.assumir();
  leitura.resolver(true); await inicio;
  assert.equal(x.c.podeEditar, true); assert.equal(x.conferencias(), 1);
  x.c.encerrar(); await repetida;
});
test('PA07 pedido antigo repetido após devolver posse não suspende novamente a origem', async () => {
  const a = ambiente(); const x = a.aba('aba-a'); const y = a.aba('aba-b');
  await x.c.iniciar(); await y.c.iniciar(); await y.c.assumir();
  const antigo = a.mensagens[0]; await x.c.assumir();
  assert.equal(x.c.podeEditar, true); a.enviar('aba-a', antigo); await drenar();
  assert.equal(x.c.podeEditar, true); x.c.encerrar(); y.c.encerrar();
});

test('PA07 restauração BFCache começa em consulta e exige retomada explícita', async () => {
  let conferencias = 0;
  const opcoes = { instancia: 'restaurada', conferir: async () => { conferencias++; return true; }, drenar: async () => {}, iniciarEmConsulta: true };
  const c = new CoordenacaoAbasPlano(opcoes);
  await c.iniciar(); assert.equal(c.estado, 'consulta'); assert.equal(c.podeEditar, false); assert.equal(conferencias, 0);
  await c.assumir(); assert.equal(c.podeEditar, true); assert.equal(conferencias, 1); c.encerrar();
});

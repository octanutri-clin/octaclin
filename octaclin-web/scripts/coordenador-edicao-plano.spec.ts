import assert from 'node:assert/strict';
import test from 'node:test';
import { CoordenadorEdicaoPlano, INTERVALO_AUTOSAVE_PLANO } from '../lib/coordenador-edicao-plano';
function preparar() {
  let tarefa: (() => void) | undefined;
  let cancelamentos = 0;
  const chamadas: Array<{ documento: { texto: string }; revisao: number; resolver: (v: { id: string; rascunhoRevisao: number }) => void; rejeitar: (e: unknown) => void }> = [];
  const c = new CoordenadorEdicaoPlano({
    documentoInicial: { texto: 'A' }, precondicao: { rascunhoIdEsperado: 'geracao', rascunhoRevisaoEsperada: 3 },
    agendar: (fn, intervalo) => { assert.equal(intervalo, 60_000); tarefa = fn; return () => { tarefa = undefined; cancelamentos++; }; },
    enviar: (documento, precondicao) => new Promise((resolver, rejeitar) => chamadas.push({ documento, revisao: precondicao.rascunhoRevisaoEsperada, resolver, rejeitar }))
  });
  return { c, chamadas, tick: () => tarefa?.(), cancelamentos: () => cancelamentos };
}
const drenar = () => new Promise<void>(r => setImmediate(r));
test('PA06 ciclo fixo sem envio inicial, sem debounce e sem PUT sem alteração', async () => {
  const { c, chamadas, tick, cancelamentos } = preparar();
  assert.equal(INTERVALO_AUTOSAVE_PLANO, 60_000);
  c.iniciar(); c.iniciar(); tick(); assert.equal(chamadas.length, 0);
  c.alterar({ texto: 'B' }); assert.equal(chamadas.length, 0);
  tick(); assert.equal(chamadas.length, 1); assert.equal(c.estado.status, 'salvando');
  chamadas[0].resolver({ id: 'geracao', rascunhoRevisao: 4 }); await drenar();
  assert.equal(c.estado.alterado, false); assert.equal(c.estado.status, 'salvo');
  tick(); assert.equal(chamadas.length, 1); c.encerrar(); assert.equal(cancelamentos(), 1);
});
test('PA06 ACK A não apaga edição B, fila tem somente último snapshot e manual compartilha serialização', async () => {
  const { c, chamadas, tick } = preparar(); c.iniciar();
  c.alterar({ texto: 'B' }); tick(); c.alterar({ texto: 'C' });
  const manual = c.salvarManual(); c.alterar({ texto: 'D' }); tick();
  assert.equal(chamadas.length, 1);
  chamadas[0].resolver({ id: 'geracao', rascunhoRevisao: 4 }); await drenar();
  assert.equal(chamadas.length, 2); assert.deepEqual(chamadas[1].documento, { texto: 'D' });
  assert.equal(chamadas[1].revisao, 4); assert.equal(c.estado.alterado, true);
  chamadas[1].resolver({ id: 'geracao', rascunhoRevisao: 5 }); assert.equal(await manual, true);
  assert.equal(c.estado.alterado, false); c.encerrar();
});
test('PA06 edição durante request permanece dirty até próximo ciclo se não solicitada', async () => {
  const { c, chamadas, tick } = preparar(); c.iniciar(); c.alterar({ texto: 'B' }); tick(); c.alterar({ texto: 'C' });
  chamadas[0].resolver({ id: 'geracao', rascunhoRevisao: 4 }); await drenar();
  assert.equal(chamadas.length, 1); assert.equal(c.estado.status, 'alterado'); assert.equal(c.estado.alterado, true);
  tick(); assert.equal(chamadas.length, 2); c.encerrar();
});
for (const [codigo, estado] of [[409, 'conflito'], [401, 'acesso-negado'], [403, 'acesso-negado'], [404, 'acesso-negado'], [422, 'erro'], [500, 'incerto'], [undefined, 'incerto']] as const) {
  test(`PA06 falha ${codigo} pausa ciclos sem retry e conserva edição`, async () => {
    const { c, chamadas, tick } = preparar(); c.iniciar(); c.alterar({ texto: 'B' }); tick();
    chamadas[0].rejeitar(codigo ? { status: codigo } : new Error('Rede sintética')); await drenar();
    assert.equal(c.estado.status, estado); assert.equal(c.estado.alterado, true);
    tick(); tick(); assert.equal(chamadas.length, 1);
    if (estado !== 'erro') { assert.equal(await c.salvarManual(), false); assert.equal(chamadas.length, 1); }
    c.encerrar();
  });
}
test('PA06 off/IME/cópia suspendem; encerrar não faz flush e ignora ACK tardio', async () => {
  const { c, chamadas, tick } = preparar(); c.iniciar(); c.alterar({ texto: 'B' });
  c.configurar({ habilitado: false }); tick(); assert.equal(chamadas.length, 0);
  c.configurar({ habilitado: true, suspenso: true }); tick(); assert.equal(await c.salvarManual(), false);
  c.configurar({ suspenso: false }); tick(); assert.equal(chamadas.length, 1);
  c.encerrar(); chamadas[0].resolver({ id: 'geracao', rascunhoRevisao: 4 }); await drenar();
  assert.equal(c.estado.precondicao.rascunhoRevisaoEsperada, 3); assert.equal(c.estado.alterado, true);
});
test('PA06 resposta de outra geração bloqueia reconciliação; snapshots não têm alias', async () => {
  const { c, chamadas, tick } = preparar(); c.iniciar(); const d = { texto: 'B' }; c.alterar(d); d.texto = 'MUTADO'; tick();
  assert.equal(chamadas[0].documento.texto, 'B');
  chamadas[0].resolver({ id: 'outra-geracao', rascunhoRevisao: 4 }); await drenar();
  assert.equal(c.estado.status, 'incerto'); assert.equal(c.estado.precondicao.rascunhoRevisaoEsperada, 3); c.encerrar();
});

test('PA06 relógio real simulado: 59999 não envia, 60000 envia, digitação não adia 120000', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const chamadas: number[] = [];
  const c = new CoordenadorEdicaoPlano({ documentoInicial: '', precondicao: { rascunhoIdEsperado: 'g', rascunhoRevisaoEsperada: 0 }, enviar: async (_d, p) => { chamadas.push(p.rascunhoRevisaoEsperada); return { id: 'g', rascunhoRevisao: p.rascunhoRevisaoEsperada + 1 }; } });
  c.iniciar(); c.alterar('B'); t.mock.timers.tick(59999); assert.equal(chamadas.length, 0);
  t.mock.timers.tick(1); await drenar(); assert.deepEqual(chamadas, [0]);
  t.mock.timers.tick(59999); c.alterar('C'); t.mock.timers.tick(1); await drenar();
  assert.deepEqual(chamadas, [0, 1]); c.encerrar();
});
test('PA06 alteração revertida durante request ainda atende save manual mais recente', async () => {
  const { c, chamadas, tick } = preparar(); c.iniciar(); c.alterar({ texto: 'B' }); tick();
  c.alterar({ texto: 'A' }); const manual = c.salvarManual();
  chamadas[0].resolver({ id: 'geracao', rascunhoRevisao: 4 }); await drenar();
  assert.equal(chamadas.length, 2); assert.equal(chamadas[1].documento.texto, 'A');
  chamadas[1].resolver({ id: 'geracao', rascunhoRevisao: 5 }); assert.equal(await manual, true); c.encerrar();
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { comEsperaDeColdStart, ehStatusColdStart, metodoIdempotente } from '../lib/server/cold-start-bff';

const SEM_ESPERA = [0, 0, 0, 0];

function respostas(sequencia: number[]) {
  let indice = 0;
  const chamadas = { total: 0 };
  const executar = async () => {
    chamadas.total += 1;
    const status = sequencia[Math.min(indice, sequencia.length - 1)];
    indice += 1;
    return new Response('corpo', { status });
  };
  return { executar, chamadas };
}

test('trata 502/503/504 como cold start e o resto como resposta da aplicacao', () => {
  assert.equal(ehStatusColdStart(502), true);
  assert.equal(ehStatusColdStart(503), true);
  assert.equal(ehStatusColdStart(504), true);
  assert.equal(ehStatusColdStart(401), false);
  assert.equal(ehStatusColdStart(500), false);
});

test('so considera GET e HEAD idempotentes', () => {
  assert.equal(metodoIdempotente(undefined), true);
  assert.equal(metodoIdempotente({ method: 'get' }), true);
  assert.equal(metodoIdempotente({ method: 'HEAD' }), true);
  assert.equal(metodoIdempotente({ method: 'POST' }), false);
  assert.equal(metodoIdempotente({ method: 'PATCH' }), false);
  assert.equal(metodoIdempotente({ method: 'DELETE' }), false);
});

test('espera o backend acordar e devolve a resposta boa', async () => {
  const { executar, chamadas } = respostas([502, 502, 200]);
  const resposta = await comEsperaDeColdStart(executar, true, SEM_ESPERA);

  assert.equal(resposta.status, 200);
  assert.equal(chamadas.total, 3);
});

test('NAO repete metodo que muda estado: repetir POST duplicaria pagamento', async () => {
  const { executar, chamadas } = respostas([502, 200]);
  const resposta = await comEsperaDeColdStart(executar, false, SEM_ESPERA);

  assert.equal(chamadas.total, 1);
  assert.equal(resposta.status, 502);
});

test('nao repete resposta da aplicacao, mesmo de erro', async () => {
  const { executar, chamadas } = respostas([401, 200]);
  const resposta = await comEsperaDeColdStart(executar, true, SEM_ESPERA);

  assert.equal(chamadas.total, 1);
  assert.equal(resposta.status, 401);
});

test('desiste depois das esperas configuradas em vez de tentar para sempre', async () => {
  const { executar, chamadas } = respostas([503]);
  const resposta = await comEsperaDeColdStart(executar, true, SEM_ESPERA);

  assert.equal(resposta.status, 503);
  assert.equal(chamadas.total, SEM_ESPERA.length + 1);
});

test('trata conexao recusada como servico subindo e propaga o erro se nunca subir', async () => {
  let chamadas = 0;
  const sempreFalha = async () => {
    chamadas += 1;
    throw new Error('ECONNREFUSED');
  };

  await assert.rejects(() => comEsperaDeColdStart(sempreFalha, true, SEM_ESPERA), /ECONNREFUSED/);
  assert.equal(chamadas, SEM_ESPERA.length + 1);

  let tentativa = 0;
  const falhaDepoisSobe = async () => {
    tentativa += 1;
    if (tentativa === 1) throw new Error('ECONNREFUSED');
    return new Response('ok', { status: 200 });
  };

  const resposta = await comEsperaDeColdStart(falhaDepoisSobe, true, SEM_ESPERA);
  assert.equal(resposta.status, 200);
});

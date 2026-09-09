import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { executarProbesSeguranca } from './e2e-seguranca-dinamica.mjs';

const ambiente = {
  E2E_WEB_URL: 'http://127.0.0.1:3000',
  E2E_API_URL: 'http://127.0.0.1:3001',
  E2E_CONFIRMAR_REMOTO: 'SIM',
  DAST_FUZZ_CONFIRMAR_EXECUCAO: 'DAST-FUZZ-STAGING-DESCARTAVEL',
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_RUN_ID: '12345',
  META_WHATSAPP_APP_SECRET: 'app-secret-sintetico-com-32-bytes-minimo',
  META_WHATSAPP_WEBHOOK_RECEIVE_TOKEN: 'receive-token-sintetico',
};

function respostaJson(status, corpo = {}) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function criarFetchControlado() {
  const chamadas = [];
  let ativas = 0;
  let maxAtivas = 0;
  let webhookValido = 0;
  let tentativasRateLimit = 0;

  const fetchImpl = async (urlBruta, init = {}) => {
    ativas += 1;
    maxAtivas = Math.max(maxAtivas, ativas);
    try {
      await Promise.resolve();
      const url = new URL(urlBruta);
      const metodo = init.method ?? 'GET';
      const corpo = typeof init.body === 'string' ? init.body : '';
      const headers = new Headers(init.headers);
      chamadas.push({ url: url.toString(), metodo, corpoBytes: Buffer.byteLength(corpo) });

      if (url.pathname === '/health/pronto') return respostaJson(200, { status: 'ok' });
      if (url.pathname === '/pacientes' && !headers.has('authorization') && metodo === 'GET') {
        return respostaJson(401);
      }
      if (url.pathname === '/pacientes' && headers.get('authorization') === 'Bearer token-invalido') {
        return respostaJson(401);
      }
      if (url.pathname === '/auth/login') {
        if (corpo === '{') return respostaJson(400);
        if (Buffer.byteLength(corpo) > 102_400) return respostaJson(413);
        const dados = JSON.parse(corpo);
        if (dados.email.startsWith('rate-limit.')) {
          tentativasRateLimit += 1;
          return respostaJson(tentativasRateLimit === 6 ? 429 : 401);
        }
        if (dados.email === 'admin.alfa@octaclin.test') return respostaJson(200, { accessToken: 'token-alfa-secreto' });
        if (dados.email === 'admin.beta@octaclin.test') return respostaJson(200, { accessToken: 'token-beta-secreto' });
        if (dados.email === 'profissional.alfa@octaclin.test') return respostaJson(200, { accessToken: 'token-profissional-secreto' });
      }
      if (url.pathname === '/operacoes/resumo') return respostaJson(403);
      if (url.pathname === '/pacientes' && metodo === 'POST') {
        return corpo.includes('tenantId')
          ? respostaJson(400)
          : respostaJson(201, { id: '23130000-0000-4000-8000-000000000001' });
      }
      if (url.pathname === '/pacientes/nao-e-uuid') return respostaJson(400);
      if (url.pathname === '/pacientes' && url.searchParams.has('busca')) return respostaJson(200, { itens: [], total: 0 });
      if (url.pathname.endsWith('/evolucoes-fotograficas/uploads')) return respostaJson(400);
      if (url.pathname === '/pacientes/23130000-0000-4000-8000-000000000001') {
        return respostaJson(headers.get('authorization') === 'Bearer token-beta-secreto' ? 404 : 200);
      }
      if (url.pathname === '/comunicacoes/webhooks/whatsapp') {
        if (!headers.get('content-type')?.startsWith('application/json')) return respostaJson(415);
        const assinatura = createHmac('sha256', ambiente.META_WHATSAPP_APP_SECRET).update(corpo).digest('hex');
        if (headers.get('x-hub-signature-256') !== `sha256=${assinatura}`) return respostaJson(403);
        webhookValido += 1;
        return respostaJson(200, webhookValido === 2 ? { recebido: true, duplicado: true } : { recebido: true });
      }
      throw new Error(`Chamada nao prevista no teste: ${metodo} ${url.pathname}${url.search}`);
    } finally {
      ativas -= 1;
    }
  };

  return { fetchImpl, chamadas, get maxAtivas() { return maxAtivas; } };
}

test('executa plano serial, limitado e produz somente evidencia sanitizada', async () => {
  const controlado = criarFetchControlado();
  const resumo = await executarProbesSeguranca({
    ambiente,
    fetchImpl: controlado.fetchImpl,
  });

  assert.equal(resumo.aprovado, true);
  assert.equal(resumo.requisicoes, 26);
  assert.equal(controlado.chamadas.length, 26);
  assert.equal(controlado.maxAtivas, 1);
  assert(controlado.chamadas.every(({ url }) => new URL(url).origin === ambiente.E2E_API_URL));
  assert.deepEqual(new Set(resumo.cobertura), new Set([
    'auth',
    'autorizacao_bfla',
    'autorizacao_bola',
    'limites',
    'mass_assignment',
    'parser',
    'rate_limit',
    'upload',
    'webhook',
  ]));

  const evidencia = JSON.stringify(resumo);
  for (const segredo of [
    'token-alfa-secreto',
    'token-beta-secreto',
    'token-profissional-secreto',
    ambiente.META_WHATSAPP_APP_SECRET,
    ambiente.META_WHATSAPP_WEBHOOK_RECEIVE_TOKEN,
  ]) {
    assert.equal(evidencia.includes(segredo), false);
  }
  assert.equal(Object.hasOwn(resumo, 'respostas'), false);
});

test('interrompe no primeiro status inesperado sem incluir corpo da resposta no erro', async () => {
  const fetchImpl = async () => respostaJson(500, { accessToken: 'nao-vazar', detalhe: 'corpo-sensivel' });
  await assert.rejects(
    executarProbesSeguranca({ ambiente, fetchImpl }),
    (erro) => {
      assert.match(erro.message, /HTTP 500/);
      assert.doesNotMatch(erro.message, /nao-vazar|corpo-sensivel/);
      return true;
    },
  );
});

test('omite URL e detalhes quando o transporte falha', async () => {
  const fetchImpl = async (url) => {
    throw new Error(`falha interna ao chamar ${url}?token=nao-vazar`);
  };
  await assert.rejects(
    executarProbesSeguranca({ ambiente, fetchImpl }),
    (erro) => {
      assert.match(erro.message, /falha de transporte/);
      assert.doesNotMatch(erro.message, /127\.0\.0\.1|nao-vazar/);
      return true;
    },
  );
});

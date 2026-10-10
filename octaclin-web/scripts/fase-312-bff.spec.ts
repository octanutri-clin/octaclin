import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import type { NextRequest } from 'next/server';
import { GET as getDocumentos, POST as postDocumentos } from '../app/api/pacientes/[id]/documentos/route';
import { POST as postPrevia } from '../app/api/pacientes/[id]/documentos/previa/route';
import { GET as getModelos, PATCH as patchModelos } from '../app/api/cliente/modelos-documento/route';
import { salvarSessaoBff } from '../lib/server/sessao-bff';

const { __clearCookies } = nextHeaders as typeof nextHeaders & { __clearCookies: () => void };
const PACIENTE_ID = '10000000-0000-4000-8000-000000000001';
const PEDIDO = JSON.stringify({ tipo: 'encaminhamento', encaminhamento: { destinoServico: 'Serviço sintético', motivoEncaminhamento: 'Motivo sintético.' } });

async function sessao(permissoes: string[]) {
  await salvarSessaoBff({ apiUrl: 'http://backend.octaclin.local', tenantSlug: 'clinica-sintetica', email: 'user@example.test' }, {
    accessToken: 'token-sintetico', refreshToken: 'refresh-sintetico', tipoToken: 'Bearer',
    expiraEmSegundos: 3600, permissoes, papel: 'Professional'
  });
}

function resposta(status = 200, body: unknown = { ok: true }) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function request(body = ''): NextRequest {
  return new Request('http://localhost/api', { method: 'POST', body }) as NextRequest;
}

function getRequest(): NextRequest {
  return new Request('http://localhost/api', { method: 'GET' }) as NextRequest;
}

function restaurarFetch(original: typeof global.fetch | undefined) {
  if (original) global.fetch = original;
  else Reflect.deleteProperty(globalThis, 'fetch');
}

test('prévia e emissão exigem permissão antes do backend e não armazenam respostas', async () => {
  const original = global.fetch;
  const chamadas: Array<{ url: string; method?: string; body?: string }> = [];
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), method: init?.method, body: init?.body as string | undefined });
    return resposta();
  }) as typeof global.fetch;
  const props = { params: Promise.resolve({ id: PACIENTE_ID }) };
  try {
    __clearCookies();
    assert.equal((await postPrevia(request(PEDIDO), props)).status, 401);
    await sessao(['pacientes.ler']);
    assert.equal((await postPrevia(request(PEDIDO), props)).status, 403);
    assert.equal((await postDocumentos(request(PEDIDO), props)).status, 403);
    assert.equal(chamadas.length, 0);

    await sessao(['pacientes.gerenciar', 'pacientes.ler']);
    const previa = await postPrevia(request(PEDIDO), props);
    assert.equal(previa.status, 200);
    assert.equal(previa.headers.get('Cache-Control'), 'private, no-store');
    const emitido = await postDocumentos(request(PEDIDO), props);
    assert.equal(emitido.status, 200);
    assert.equal(emitido.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(chamadas.map(({ url, method, body }) => ({ url, method, body })), [
      { url: `http://backend.octaclin.local/pacientes/${PACIENTE_ID}/documentos/previa`, method: 'POST', body: PEDIDO },
      { url: `http://backend.octaclin.local/pacientes/${PACIENTE_ID}/documentos`, method: 'POST', body: PEDIDO }
    ]);
  } finally { restaurarFetch(original); __clearCookies(); }
});

test('documentos e modelos aplicam permissão de leitura/gestão e no-store nos erros', async () => {
  const original = global.fetch;
  global.fetch = (async () => resposta(409, { mensagem: 'Prévia desatualizada.' })) as typeof global.fetch;
  const props = { params: Promise.resolve({ id: PACIENTE_ID }) };
  try {
    await sessao(['pacientes.ler', 'cliente.configuracoes.gerenciar']);
    const lista = await getDocumentos(getRequest(), props);
    assert.equal(lista.status, 409);
    assert.equal(lista.headers.get('Cache-Control'), 'private, no-store');
    const negada = await postDocumentos(request(PEDIDO), props);
    assert.equal(negada.status, 403);
    assert.equal(negada.headers.get('Cache-Control'), 'private, no-store');
    const modelos = await getModelos();
    assert.equal(modelos.status, 409);
    assert.equal(modelos.headers.get('Cache-Control'), 'private, no-store');
    assert.equal((await patchModelos(request('{}')).catch(() => null))?.status, 409);
  } finally { restaurarFetch(original); __clearCookies(); }
});

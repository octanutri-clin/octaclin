import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { GET as getCliente, POST as postCliente } from '../app/api/cliente/kit-inicial/route';
import { GET as getTenant, POST as postTenant } from '../app/api/operacoes/tenants/[id]/kit-inicial/route';
import { GET as getCatalogos } from '../app/api/operacoes/catalogos-alimentares/disponibilidade/route';
import { salvarSessaoBff } from '../lib/server/sessao-bff';

const { __clearCookies } = nextHeaders as typeof nextHeaders & { __clearCookies: () => void };
const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const ITENS = JSON.stringify({ confirmacao: true, versao: 2, itens: ['material:registro-habitos'] });

async function sessao(permissoes: string[], expiraEmSegundos = 3600) {
  await salvarSessaoBff({ apiUrl: 'http://backend.octaclin.local', tenantSlug: 'clinica-sintetica', email: 'admin@example.test' }, {
    accessToken: 'token-sintetico', refreshToken: 'refresh-sintetico', tipoToken: 'Bearer',
    expiraEmSegundos, permissoes, papel: permissoes.includes('operacoes.tenants.gerenciar') ? 'SuperAdmin' : 'Client'
  });
}

function resposta(status = 200, body: unknown = { ok: true }) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function restaurarFetch(original: typeof global.fetch | undefined) {
  if (original) global.fetch = original;
  else Reflect.deleteProperty(globalThis, 'fetch');
}

test('BFFs recusam sessão ausente e sessão sem permissão antes de chamar o backend', async () => {
  const original = global.fetch;
  let chamadas = 0;
  global.fetch = (async () => { chamadas += 1; return resposta(); }) as typeof global.fetch;
  try {
    __clearCookies();
    assert.equal((await getCliente()).status, 401);
    assert.equal((await postCliente(new Request('http://localhost/api/cliente/kit-inicial', { method: 'POST', body: ITENS }))).status, 401);
    assert.equal((await getCatalogos()).status, 401);
    await sessao([]);
    assert.equal((await getCliente()).status, 403);
    assert.equal((await getCatalogos()).status, 403);
    assert.equal(chamadas, 0);
  } finally { restaurarFetch(original); __clearCookies(); }
});

test('BFF administrativo valida UUID e repassa alvo, sessão e no-store', async () => {
  const original = global.fetch;
  const chamadas: Array<{ url: string; method?: string; authorization: string | null; body?: string }> = [];
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), method: init?.method, authorization: new Headers(init?.headers).get('Authorization'), body: init?.body as string | undefined });
    return resposta(200, { estado: 'parcial' });
  }) as typeof global.fetch;
  try {
    await sessao(['operacoes.tenants.gerenciar']);
    assert.equal((await getTenant(new Request('http://localhost'), { params: Promise.resolve({ id: 'invalido' }) })).status, 400);
    assert.equal(chamadas.length, 0);
    const get = await getTenant(new Request('http://localhost'), { params: Promise.resolve({ id: TENANT_ID }) });
    assert.equal(get.status, 200);
    assert.equal(get.headers.get('Cache-Control'), 'private, no-store');
    const post = await postTenant(new Request('http://localhost', { method: 'POST', body: ITENS }), { params: Promise.resolve({ id: TENANT_ID }) });
    assert.equal(post.status, 200);
    const catalogos = await getCatalogos();
    assert.equal(catalogos.status, 200);
    assert.equal(catalogos.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(chamadas.map((item) => `${item.method ?? 'GET'} ${item.url}`), [
      `GET http://backend.octaclin.local/operacoes/tenants/${TENANT_ID}/kit-inicial`,
      `POST http://backend.octaclin.local/operacoes/tenants/${TENANT_ID}/kit-inicial`,
      'GET http://backend.octaclin.local/operacoes/catalogos-alimentares/disponibilidade'
    ]);
    assert.equal(chamadas[1].authorization, 'Bearer token-sintetico');
    assert.equal(chamadas[1].body, ITENS);
  } finally { restaurarFetch(original); __clearCookies(); }
});

test('BFF do Client permite somente o contrato da própria clínica e preserva no-store', async () => {
  const original = global.fetch;
  const chamadas: Array<{ url: string; method?: string; body?: string }> = [];
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), method: init?.method, body: init?.body as string | undefined });
    return resposta(200, { estado: 'parcial' });
  }) as typeof global.fetch;
  try {
    await sessao(['cliente.configuracoes.gerenciar']);
    const get = await getCliente();
    const post = await postCliente(new Request('http://localhost/api/cliente/kit-inicial', { method: 'POST', body: ITENS }));
    assert.equal(get.status, 200);
    assert.equal(post.status, 200);
    assert.equal(get.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(chamadas, [
      { url: 'http://backend.octaclin.local/cliente/kit-inicial', method: undefined, body: undefined },
      { url: 'http://backend.octaclin.local/cliente/kit-inicial', method: 'POST', body: ITENS }
    ]);
  } finally { restaurarFetch(original); __clearCookies(); }
});

test('BFF encaminha conflito e transforma falha de transporte em resposta sanitizada', async () => {
  const original = global.fetch;
  try {
    await sessao(['cliente.configuracoes.gerenciar']);
    global.fetch = (async () => resposta(409, { message: 'Estado incompatível.' })) as typeof global.fetch;
    const conflito = await postCliente(new Request('http://localhost/api/cliente/kit-inicial', { method: 'POST', body: ITENS }));
    assert.equal(conflito.status, 409);
    assert.equal(conflito.headers.get('Cache-Control'), 'private, no-store');

    global.fetch = (async () => { throw new Error('detalhe interno de conexão'); }) as typeof global.fetch;
    const falha = await postCliente(new Request('http://localhost/api/cliente/kit-inicial', { method: 'POST', body: ITENS }));
    assert.equal(falha.status, 502);
    assert.doesNotMatch(await falha.text(), /detalhe interno/);
  } finally { restaurarFetch(original); __clearCookies(); }
});

test('BFF invalida uma sessão expirada quando o refresh falha', async () => {
  const original = global.fetch;
  try {
    await sessao(['operacoes.tenants.gerenciar'], -1);
    global.fetch = (async () => resposta(401, { message: 'refresh expirado' })) as typeof global.fetch;
    const resultado = await getCatalogos();
    assert.equal(resultado.status, 401);
  } finally { restaurarFetch(original); __clearCookies(); }
});

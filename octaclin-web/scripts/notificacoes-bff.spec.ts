import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { GET as obter, PUT as salvar } from '../app/api/notificacoes/preferencias/route';
import { POST as gerar } from '../app/api/notificacoes/resumos/gerar/route';

const { __clearCookies, __setCookies } = nextHeaders as typeof nextHeaders & {
  __clearCookies: () => void;
  __setCookies: (cookies: Record<string, string>) => void;
};
const cookiesValidos = {
  octaclin_access_token: 'fake-access', octaclin_refresh_token: 'fake-refresh',
  octaclin_api_url: encodeURIComponent('http://backend.octaclin.local'),
  octaclin_tenant_slug: encodeURIComponent('clinica-sintetica'),
  octaclin_email: encodeURIComponent('pro@example.test'),
  octaclin_access_expira_em: '2030-08-13T15:00:00.000Z',
  octaclin_papel: encodeURIComponent('Professional'),
  octaclin_permissoes: encodeURIComponent(JSON.stringify(['console.acessar']))
};
const originalFetch = global.fetch;

test.afterEach(() => {
  if (originalFetch) global.fetch = originalFetch;
  else Reflect.deleteProperty(globalThis, 'fetch');
  __clearCookies();
});

test('preferencias exige sessao e permissao antes de acessar backend', async () => {
  let chamadas = 0;
  global.fetch = (async () => { chamadas += 1; throw new Error('inesperado'); }) as typeof fetch;
  __clearCookies();
  assert.equal((await obter()).status, 401);
  __setCookies({ ...cookiesValidos, octaclin_permissoes: encodeURIComponent('[]') });
  assert.equal((await obter()).status, 403);
  assert.equal(chamadas, 0);
});

test('GET e PUT de preferencias encaminham a rota autenticada e impedem cache', async () => {
  __setCookies(cookiesValidos);
  const chamadas: Array<{ url: string; init?: RequestInit }> = [];
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), init });
    return Response.json({ emailResumo: false });
  }) as typeof fetch;

  const get = await obter();
  const put = await salvar(new Request('http://localhost/api/notificacoes/preferencias', {
    method: 'PUT', body: '{"timezone":"America/Sao_Paulo"}'
  }));
  assert.equal(get.status, 200);
  assert.equal(get.headers.get('Cache-Control'), 'no-store');
  assert.equal(put.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(chamadas.map(({ url }) => new URL(url).pathname), ['/notificacoes/preferencias', '/notificacoes/preferencias']);
  assert.equal(chamadas[1].init?.method, 'PUT');
  assert.equal(chamadas[1].init?.body, '{"timezone":"America/Sao_Paulo"}');
});

test('geracao de resumo aceita somente POST e encaminha corpo vazio', async () => {
  __setCookies(cookiesValidos);
  let chamada: { url: string; init?: RequestInit } | undefined;
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    chamada = { url: String(url), init };
    return Response.json({ gerado: false });
  }) as typeof fetch;
  const resposta = await gerar();
  assert.equal(resposta.headers.get('Cache-Control'), 'no-store');
  assert.equal(new URL(chamada!.url).pathname, '/notificacoes/resumos/gerar');
  assert.equal(chamada!.init?.method, 'POST');
  assert.equal(chamada!.init?.body, '{}');
});

test('falha do backend nao expoe erro interno e nunca autoriza cache', async () => {
  __setCookies(cookiesValidos);
  global.fetch = (async () => { throw new Error('detalhe interno nao deve chegar ao cliente'); }) as typeof fetch;
  const resposta = await obter();
  assert.equal(resposta.status, 502);
  assert.equal(resposta.headers.get('Cache-Control'), 'no-store');
  assert.doesNotMatch(await resposta.text(), /detalhe interno/);
});

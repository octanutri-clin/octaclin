import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { POST as instalar } from '../app/api/comunicacoes/templates/iniciais/route';
import { PUT as editar } from '../app/api/comunicacoes/templates/[id]/route';

const { __clearCookies, __setCookies } = nextHeaders as typeof nextHeaders & {
  __clearCookies: () => void;
  __setCookies: (cookies: Record<string, string>) => void;
};

function cookiesSessao(permissoes: string[]) {
  return {
    octaclin_access_token: 'access-token-sintetico',
    octaclin_refresh_token: 'refresh-token-sintetico',
    octaclin_api_url: encodeURIComponent('http://backend.octaclin.local'),
    octaclin_tenant_slug: encodeURIComponent('clinica-sintetica'),
    octaclin_email: encodeURIComponent('operador@example.test'),
    octaclin_access_expira_em: '2030-08-08T15:00:00.000Z',
    octaclin_permissoes: encodeURIComponent(JSON.stringify(permissoes))
  };
}

test('instalação e edição recusam sessão ausente e permissão ausente sem consultar backend', async () => {
  const original = global.fetch;
  let chamado = false;
  global.fetch = (async () => { chamado = true; throw new Error('backend nao deveria ser chamado'); }) as typeof global.fetch;
  try {
    __clearCookies();
    assert.equal((await instalar()).status, 401);
    __setCookies(cookiesSessao(['comunicacoes.mensagens.ler']));
    assert.equal((await instalar()).status, 403);
    assert.equal((await editar(new Request('http://localhost', { method: 'PUT', body: '{}' }) as never,
      { params: Promise.resolve({ id: 'template-1' }) })).status, 403);
    assert.equal(chamado, false);
  } finally {
    if (original) global.fetch = original;
    else Reflect.deleteProperty(globalThis, 'fetch');
  }
});

test('edição encaminha somente o id codificado e o corpo com método PUT', async () => {
  __setCookies(cookiesSessao(['comunicacoes.templates.gerenciar']));
  const original = global.fetch;
  let caminho = '';
  let metodo = '';
  global.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    caminho = String(entrada);
    metodo = init?.method ?? 'GET';
    return new Response('{"id":"template-1"}', { status: 200 });
  }) as typeof global.fetch;
  try {
    const resposta = await editar(new Request('http://localhost', { method: 'PUT', body: '{"nome":"Exemplo"}' }) as never,
      { params: Promise.resolve({ id: 'template/1' }) });
    assert.equal(resposta.status, 200);
    assert.equal(caminho, 'http://backend.octaclin.local/comunicacoes/templates/template%2F1');
    assert.equal(metodo, 'PUT');
  } finally {
    if (original) global.fetch = original;
    else Reflect.deleteProperty(globalThis, 'fetch');
  }
});

test('instalação autorizada encaminha POST sem dados de tenant do cliente', async () => {
  __setCookies(cookiesSessao(['comunicacoes.templates.gerenciar']));
  const original = global.fetch;
  let caminho = '';
  let metodo = '';
  let corpo: BodyInit | null | undefined;
  global.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    caminho = String(entrada);
    metodo = init?.method ?? 'GET';
    corpo = init?.body;
    return new Response('{"quantidadeCriada":3}', { status: 200 });
  }) as typeof global.fetch;
  try {
    const resposta = await instalar();
    assert.equal(resposta.status, 200);
    assert.equal(caminho, 'http://backend.octaclin.local/comunicacoes/templates/iniciais');
    assert.equal(metodo, 'POST');
    assert.equal(corpo, undefined);
  } finally {
    if (original) global.fetch = original;
    else Reflect.deleteProperty(globalThis, 'fetch');
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { GET as listarItens, POST as criarItem } from '../app/api/biblioteca-condutas/route';
import { GET as obterItem, DELETE as arquivarItem } from '../app/api/biblioteca-condutas/[itemId]/route';

const { __clearCookies, __setCookies } = nextHeaders as typeof nextHeaders & {
  __clearCookies: () => void;
  __setCookies: (cookies: Record<string, string>) => void;
};

function cookiesSessaoValida(permissoes: string[]) {
  return {
    octaclin_access_token: 'access-token-valido',
    octaclin_refresh_token: 'refresh-token-valido',
    octaclin_api_url: encodeURIComponent('http://backend.octaclin.local'),
    octaclin_tenant_slug: encodeURIComponent('octaclin-admin'),
    octaclin_email: encodeURIComponent('profissional@octaclin.local'),
    octaclin_access_expira_em: '2030-08-08T15:00:00.000Z',
    octaclin_permissoes: encodeURIComponent(JSON.stringify(permissoes))
  };
}

function restaurarFetch(original: typeof global.fetch | undefined) {
  if (original) global.fetch = original;
  else Reflect.deleteProperty(globalThis, 'fetch');
}

test('BFF recusa listagem sem sessao antes de consultar o backend', async () => {
  __clearCookies();
  const original = global.fetch;
  let chamado = false;
  global.fetch = (async () => {
    chamado = true;
    throw new Error('nao deveria consultar o backend');
  }) as typeof global.fetch;

  try {
    const resposta = await listarItens(new Request('http://localhost/api/biblioteca-condutas'));
    assert.equal(resposta.status, 401);
    assert.equal(chamado, false);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF encaminha listagem so com os parametros da allowlist', async () => {
  __setCookies(cookiesSessaoValida(['pacientes.ler']));
  const original = global.fetch;
  let url = '';
  global.fetch = (async (entrada: RequestInfo | URL) => {
    url = String(entrada);
    return new Response('{"itens":[],"total":0,"pagina":1,"limite":25}', { status: 200 });
  }) as typeof global.fetch;

  try {
    await listarItens(
      new Request('http://localhost/api/biblioteca-condutas?pagina=2&limite=10&tipo=meta&criadoPorUsuarioId=alheio')
    );
    // `criadoPorUsuarioId` e descartado: nao ha filtro por autor na API real.
    assert.equal(url, 'http://backend.octaclin.local/biblioteca-condutas?pagina=2&limite=10&tipo=meta');
  } finally {
    restaurarFetch(original);
  }
});

test('BFF recusa criacao de item sem permissao de gerenciar, sem chamar o backend', async () => {
  __setCookies(cookiesSessaoValida(['pacientes.ler']));
  const original = global.fetch;
  let chamou = false;
  global.fetch = (async () => {
    chamou = true;
    throw new Error('nao deveria consultar o backend');
  }) as typeof global.fetch;

  try {
    const resposta = await criarItem(
      new Request('http://localhost/api/biblioteca-condutas', { method: 'POST', body: '{}' })
    );
    assert.equal(resposta.status, 403);
    assert.equal(chamou, false);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF codifica o itemId no caminho para obter e arquivar', async () => {
  __setCookies(cookiesSessaoValida(['pacientes.ler', 'pacientes.gerenciar']));
  const original = global.fetch;
  const urls: string[] = [];
  const metodos: string[] = [];
  global.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    urls.push(String(entrada));
    metodos.push(init?.method ?? 'GET');
    return new Response('{}', { status: 200 });
  }) as typeof global.fetch;

  try {
    await obterItem(new Request('http://localhost'), { params: Promise.resolve({ itemId: 'item/1' }) });
    await arquivarItem(new Request('http://localhost'), { params: Promise.resolve({ itemId: 'item/1' }) });
    assert.equal(urls[0], 'http://backend.octaclin.local/biblioteca-condutas/item%2F1');
    assert.equal(urls[1], 'http://backend.octaclin.local/biblioteca-condutas/item%2F1');
    assert.equal(metodos[1], 'DELETE');
  } finally {
    restaurarFetch(original);
  }
});

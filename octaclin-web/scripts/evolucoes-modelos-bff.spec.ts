import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { GET as listarModelos, POST as criarModelo } from '../app/api/evolucoes/modelos/route';
import { GET as obterModelo, DELETE as arquivarModelo } from '../app/api/evolucoes/modelos/[modeloId]/route';

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
    const resposta = await listarModelos(new Request('http://localhost/api/evolucoes/modelos'));
    assert.equal(resposta.status, 401);
    assert.equal(chamado, false);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF encaminha listagem de modelos so com os parametros da allowlist', async () => {
  __setCookies(cookiesSessaoValida(['pacientes.ler']));
  const original = global.fetch;
  let url = '';
  global.fetch = (async (entrada: RequestInfo | URL) => {
    url = String(entrada);
    return new Response('{"itens":[],"total":0,"pagina":1,"limite":25}', { status: 200 });
  }) as typeof global.fetch;

  try {
    await listarModelos(
      new Request('http://localhost/api/evolucoes/modelos?pagina=2&limite=10&origem=clinica&profissionalId=alheio')
    );
    // `profissionalId` e descartado: deixar o cliente escolher de quem sao os
    // modelos pessoais listados seria contornar o escopo do backend.
    assert.equal(url, 'http://backend.octaclin.local/evolucoes/modelos?pagina=2&limite=10&origem=clinica');
  } finally {
    restaurarFetch(original);
  }
});

test('BFF recusa criacao de modelo sem permissao de gerenciar, sem chamar o backend', async () => {
  __setCookies(cookiesSessaoValida(['pacientes.ler']));
  const original = global.fetch;
  let chamou = false;
  global.fetch = (async () => {
    chamou = true;
    throw new Error('nao deveria consultar o backend');
  }) as typeof global.fetch;

  try {
    const resposta = await criarModelo(
      new Request('http://localhost/api/evolucoes/modelos', { method: 'POST', body: '{}' })
    );
    assert.equal(resposta.status, 403);
    assert.equal(chamou, false);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF codifica o modeloId no caminho para obter e arquivar', async () => {
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
    await obterModelo(new Request('http://localhost'), { params: Promise.resolve({ modeloId: 'modelo/1' }) });
    await arquivarModelo(new Request('http://localhost'), { params: Promise.resolve({ modeloId: 'modelo/1' }) });
    assert.equal(urls[0], 'http://backend.octaclin.local/evolucoes/modelos/modelo%2F1');
    assert.equal(urls[1], 'http://backend.octaclin.local/evolucoes/modelos/modelo%2F1');
    assert.equal(metodos[1], 'DELETE');
  } finally {
    restaurarFetch(original);
  }
});

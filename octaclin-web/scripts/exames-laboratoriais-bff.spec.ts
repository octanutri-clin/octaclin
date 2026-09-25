import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { GET, POST } from '../app/api/pacientes/[id]/exames-laboratoriais/route';
import { GET as listarCatalogo, POST as criarCatalogo } from '../app/api/exames/marcadores/route';
import { DELETE as arquivarCatalogo } from '../app/api/exames/marcadores/[itemId]/route';

const { __clearCookies, __setCookies } = nextHeaders as typeof nextHeaders & {
  __clearCookies: () => void;
  __setCookies: (cookies: Record<string, string>) => void;
};

function cookiesSessaoValida(permissoes = ['pacientes.ler', 'pacientes.gerenciar']) {
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

test('BFF de exames recusa sessao ausente sem consultar backend', async () => {
  __clearCookies();
  const original = global.fetch;
  let chamado = false;
  global.fetch = (async () => {
    chamado = true;
    throw new Error('nao deveria consultar o backend');
  }) as typeof global.fetch;

  try {
    const resposta = await GET(new Request('http://localhost/api/exames') as never, { params: Promise.resolve({ id: 'paciente-1' }) });
    assert.equal(resposta.status, 401);
    assert.equal(chamado, false);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF de exames encaminha listagem e criacao para o paciente codificado', async () => {
  __setCookies(cookiesSessaoValida());
  const original = global.fetch;
  const chamadas: Array<{ url: string; metodo: string; corpo?: string }> = [];
  global.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(entrada), metodo: init?.method ?? 'GET', corpo: init?.body?.toString() });
    return Response.json({ ok: true }, { status: 201 });
  }) as typeof global.fetch;

  try {
    const corpo = JSON.stringify({ coletadaEm: '2026-08-12', marcadores: [{ nome: 'Ferritina', valor: '42' }] });
    const listagem = await GET(new Request('http://localhost/api/exames') as never, { params: Promise.resolve({ id: 'paciente/1' }) });
    const criacao = await POST(new Request('http://localhost/api/exames', { method: 'POST', body: corpo }) as never, { params: Promise.resolve({ id: 'paciente/1' }) });

    assert.equal(listagem.status, 201);
    assert.equal(criacao.status, 201);
    assert.deepEqual(chamadas, [
      { url: 'http://backend.octaclin.local/pacientes/paciente%2F1/exames-laboratoriais', metodo: 'GET', corpo: undefined },
      { url: 'http://backend.octaclin.local/pacientes/paciente%2F1/exames-laboratoriais', metodo: 'POST', corpo }
    ]);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF de exames preserva erro de validacao do backend', async () => {
  __setCookies(cookiesSessaoValida());
  const original = global.fetch;
  global.fetch = (async () => Response.json({ message: 'marcadores invalidos' }, { status: 400 })) as typeof global.fetch;

  try {
    const resposta = await POST(new Request('http://localhost/api/exames', { method: 'POST', body: '{}' }) as never, { params: Promise.resolve({ id: 'paciente-1' }) });
    assert.equal(resposta.status, 400);
    assert.deepEqual(await resposta.json(), { message: 'marcadores invalidos' });
  } finally {
    restaurarFetch(original);
  }
});

test('BFF do catalogo exige permissao antes de criar e limita parametros da listagem', async () => {
  __setCookies(cookiesSessaoValida(['pacientes.ler']));
  const original = global.fetch;
  const chamadas: string[] = [];
  global.fetch = (async (entrada: RequestInfo | URL) => {
    chamadas.push(String(entrada));
    return Response.json({ itens: [], total: 0, pagina: 1, limite: 25 });
  }) as typeof global.fetch;
  try {
    const corpoNaoAutorizado = { text: () => { throw new Error('Corpo lido antes da autorizacao'); } } as unknown as Request;
    const negada = await criarCatalogo(corpoNaoAutorizado);
    assert.equal(negada.status, 403);
    assert.equal(chamadas.length, 0);
    await listarCatalogo(new Request('http://localhost/api/exames/marcadores?pagina=2&limite=10&tenantId=outro'));
    assert.deepEqual(chamadas, ['http://backend.octaclin.local/exames/marcadores?pagina=2&limite=10']);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF do catalogo codifica o ID antes de arquivar', async () => {
  __setCookies(cookiesSessaoValida());
  const original = global.fetch;
  const chamadas: Array<{ url: string; metodo: string }> = [];
  global.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    chamadas.push({ url: String(entrada), metodo: init?.method ?? 'GET' });
    return Response.json({ id: 'item-1' });
  }) as typeof global.fetch;
  try {
    const resposta = await arquivarCatalogo(new Request('http://localhost/api/exames/marcadores/item'), {
      params: Promise.resolve({ itemId: 'item/1' })
    });
    assert.equal(resposta.status, 200);
    assert.deepEqual(chamadas, [{ url: 'http://backend.octaclin.local/exames/marcadores/item%2F1', metodo: 'DELETE' }]);
  } finally {
    restaurarFetch(original);
  }
});

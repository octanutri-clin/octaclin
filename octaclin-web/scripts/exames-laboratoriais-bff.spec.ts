import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { GET, POST } from '../app/api/pacientes/[id]/exames-laboratoriais/route';

const { __clearCookies, __setCookies } = nextHeaders as typeof nextHeaders & {
  __clearCookies: () => void;
  __setCookies: (cookies: Record<string, string>) => void;
};

function cookiesSessaoValida() {
  return {
    octaclin_access_token: 'access-token-valido',
    octaclin_refresh_token: 'refresh-token-valido',
    octaclin_api_url: encodeURIComponent('http://backend.octaclin.local'),
    octaclin_tenant_slug: encodeURIComponent('octaclin-admin'),
    octaclin_email: encodeURIComponent('profissional@octaclin.local'),
    octaclin_access_expira_em: '2030-08-08T15:00:00.000Z'
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

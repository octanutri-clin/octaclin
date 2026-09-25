import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { NextRequest } from 'next/server';
import { GET } from '../app/api/cliente/painel-operacao/route';

const { __clearCookies, __setCookies } = nextHeaders as typeof nextHeaders & {
  __clearCookies: () => void;
  __setCookies: (cookies: Record<string, string>) => void;
};

function sessao(permissoes: string[]) {
  return {
    octaclin_access_token: 'token-sintetico',
    octaclin_refresh_token: 'refresh-sintetico',
    octaclin_api_url: encodeURIComponent('http://backend.octaclin.local'),
    octaclin_tenant_slug: encodeURIComponent('tenant-sintetico'),
    octaclin_email: encodeURIComponent('gestor@exemplo-invalido.test'),
    octaclin_access_expira_em: '2030-08-08T15:00:00.000Z',
    octaclin_permissoes: encodeURIComponent(JSON.stringify(permissoes))
  };
}

test('nega sessao ausente e permissao ausente sem consultar o backend', async () => {
  const anterior = global.fetch;
  let chamadas = 0;
  global.fetch = (async () => { chamadas++; return Response.json({}); }) as typeof global.fetch;
  try {
    __clearCookies();
    assert.equal((await GET(new NextRequest('http://localhost/api/cliente/painel-operacao'))).status, 401);
    __setCookies(sessao([]));
    assert.equal((await GET(new NextRequest('http://localhost/api/cliente/painel-operacao'))).status, 403);
    assert.equal(chamadas, 0);
  } finally { global.fetch = anterior; }
});

test('valida mes e encaminha apenas o filtro permitido', async () => {
  const anterior = global.fetch;
  const chamadas: string[] = [];
  global.fetch = (async (entrada: string | URL | Request) => {
    chamadas.push(String(entrada));
    return Response.json({ mes: '2026-09' });
  }) as typeof global.fetch;
  try {
    __setCookies(sessao(['cliente.acessar']));
    assert.equal((await GET(new NextRequest('http://localhost/api/cliente/painel-operacao?mes=2026-13'))).status, 400);
    assert.equal((await GET(new NextRequest('http://localhost/api/cliente/painel-operacao?mes=2026-09&tenantId=outro'))).status, 200);
    assert.deepEqual(chamadas, ['http://backend.octaclin.local/cliente/painel-operacao?mes=2026-09']);
  } finally { global.fetch = anterior; }
});

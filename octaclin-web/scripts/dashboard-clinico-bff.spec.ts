import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { NextRequest } from 'next/server';
import { GET as obterResumo } from '../app/api/dashboard/clinico/route';

const { __clearCookies, __setCookies } = nextHeaders as typeof nextHeaders & { __clearCookies: () => void; __setCookies: (cookies: Record<string, string>) => void };

function cookiesSessao(papel: string, permissoes: string[]) {
  return {
    octaclin_access_token: 'access-token-valido', octaclin_refresh_token: 'refresh-token-valido',
    octaclin_api_url: encodeURIComponent('http://backend.octaclin.local'), octaclin_tenant_slug: encodeURIComponent('clinica-carla'),
    octaclin_email: encodeURIComponent('usuario@octaclin.local'), octaclin_access_expira_em: '2030-07-27T15:00:00.000Z',
    octaclin_papel: encodeURIComponent(papel), octaclin_permissoes: encodeURIComponent(JSON.stringify(permissoes))
  };
}

function restaurarFetch(original: typeof global.fetch | undefined) { if (original) global.fetch = original; else Reflect.deleteProperty(globalThis, 'fetch'); }

test('BFF clinico recusa sessao ausente e colaborador antes do backend', async () => {
  const original = global.fetch; let chamadas = 0;
  global.fetch = (async () => { chamadas += 1; throw new Error('nao deve chamar'); }) as typeof global.fetch;
  try {
    __clearCookies();
    assert.equal((await obterResumo(new NextRequest('http://localhost/api/dashboard/clinico'))).status, 401);
    __setCookies(cookiesSessao('Collaborator', ['dashboard.ler']));
    assert.equal((await obterResumo(new NextRequest('http://localhost/api/dashboard/clinico'))).status, 403);
    assert.equal(chamadas, 0);
  } finally { restaurarFetch(original); }
});

test('BFF clinico fixa escopo do Professional e permite contexto apenas ao SuperAdmin', async () => {
  const original = global.fetch; const urls: string[] = [];
  global.fetch = (async (url: string | URL | Request) => { urls.push(String(url)); return new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } }); }) as typeof global.fetch;
  try {
    __setCookies(cookiesSessao('Professional', ['dashboard.ler']));
    assert.equal((await obterResumo(new NextRequest('http://localhost/api/dashboard/clinico?periodo=hoje&profissionalId=profissional-2'))).status, 200);
    assert.match(urls[0], /periodo=hoje/); assert.doesNotMatch(urls[0], /profissionalId=/);
    __setCookies(cookiesSessao('SuperAdmin', ['dashboard.ler']));
    assert.equal((await obterResumo(new NextRequest('http://localhost/api/dashboard/clinico?periodo=sete_dias&profissionalId=profissional-2'))).status, 200);
    assert.match(urls[1], /profissionalId=profissional-2/);
  } finally { restaurarFetch(original); }
});

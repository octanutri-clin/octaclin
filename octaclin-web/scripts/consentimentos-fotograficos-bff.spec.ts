import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { GET, POST as registrar } from '../app/api/pacientes/[id]/evolucoes-fotograficas/consentimentos/route';
import { POST as revogar } from '../app/api/pacientes/[id]/evolucoes-fotograficas/consentimentos/[consentimentoId]/revogacao/route';

const { __clearCookies, __setCookies } = nextHeaders as typeof nextHeaders & { __clearCookies: () => void; __setCookies: (cookies: Record<string, string>) => void; };

function sessao() {
  return { octaclin_access_token: 'access-token-valido', octaclin_refresh_token: 'refresh-token-valido', octaclin_api_url: encodeURIComponent('http://backend.octaclin.local'), octaclin_tenant_slug: encodeURIComponent('octaclin-admin'), octaclin_email: encodeURIComponent('profissional@octaclin.local'), octaclin_access_expira_em: '2030-08-08T15:00:00.000Z' };
}

function restaurarFetch(original: typeof global.fetch | undefined) { if (original) global.fetch = original; else Reflect.deleteProperty(globalThis, 'fetch'); }

test('BFF fotografico recusa sessao ausente sem backend', async () => {
  __clearCookies();
  const original = global.fetch; let chamado = false;
  global.fetch = (async () => { chamado = true; throw new Error('nao deveria chamar'); }) as typeof global.fetch;
  try {
    const resposta = await GET(new Request('http://localhost/api/fotos') as never, { params: Promise.resolve({ id: 'paciente-1' }) });
    assert.equal(resposta.status, 401); assert.equal(chamado, false);
  } finally { restaurarFetch(original); }
});

test('BFF fotografico encaminha registro e revogacao com identificadores codificados', async () => {
  __setCookies(sessao());
  const original = global.fetch; const chamadas: Array<[string, string, string | undefined]> = [];
  global.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => { chamadas.push([String(entrada), init?.method ?? 'GET', init?.body?.toString()]); return Response.json({ ok: true }); }) as typeof global.fetch;
  try {
    const corpo = JSON.stringify({ versao: 'foto-v1', retencaoAte: '2030-01-01' });
    await registrar(new Request('http://localhost/api/fotos', { method: 'POST', body: corpo }) as never, { params: Promise.resolve({ id: 'paciente/1' }) });
    await revogar(new Request('http://localhost/api/fotos', { method: 'POST' }) as never, { params: Promise.resolve({ id: 'paciente/1', consentimentoId: 'consentimento/1' }) });
    assert.deepEqual(chamadas, [
      ['http://backend.octaclin.local/pacientes/paciente%2F1/evolucoes-fotograficas/consentimentos', 'POST', corpo],
      ['http://backend.octaclin.local/pacientes/paciente%2F1/evolucoes-fotograficas/consentimentos/consentimento%2F1/revogacao', 'POST', undefined]
    ]);
  } finally { restaurarFetch(original); }
});

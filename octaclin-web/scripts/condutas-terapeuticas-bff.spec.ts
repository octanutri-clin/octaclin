import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { GET, POST as criar } from '../app/api/pacientes/[id]/condutas-terapeuticas/route';
import { POST as publicar, PUT as atualizarRascunho } from '../app/api/pacientes/[id]/condutas-terapeuticas/[condutaId]/[acao]/route';

const { __clearCookies, __setCookies } = nextHeaders as typeof nextHeaders & { __clearCookies: () => void; __setCookies: (cookies: Record<string, string>) => void; };
function sessao() { return { octaclin_access_token: 'access-token', octaclin_refresh_token: 'refresh-token', octaclin_api_url: encodeURIComponent('http://backend.octaclin.local'), octaclin_tenant_slug: encodeURIComponent('octaclin-admin'), octaclin_email: encodeURIComponent('profissional@octaclin.local'), octaclin_access_expira_em: '2030-01-01T00:00:00.000Z' }; }
function restaurarFetch(original: typeof global.fetch | undefined) { if (original) global.fetch = original; else Reflect.deleteProperty(globalThis, 'fetch'); }

test('BFF de condutas bloqueia sessao ausente', async () => {
  __clearCookies(); const original = global.fetch; let chamado = false;
  global.fetch = (async () => { chamado = true; throw new Error('nao deveria chamar'); }) as typeof global.fetch;
  try { const resposta = await GET(new Request('http://localhost/api/condutas') as never, { params: Promise.resolve({ id: 'paciente-1' }) }); assert.equal(resposta.status, 401); assert.equal(chamado, false); }
  finally { restaurarFetch(original); }
});

test('BFF de condutas encaminha criacao, rascunho e publicacao com IDs codificados', async () => {
  __setCookies(sessao()); const original = global.fetch; const chamadas: Array<[string, string, string | undefined]> = [];
  global.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => { chamadas.push([String(entrada), init?.method ?? 'GET', init?.body?.toString()]); return Response.json({ ok: true }); }) as typeof global.fetch;
  try {
    const corpo = JSON.stringify({ tipo: 'orientacao', titulo: 'Rotina', conteudo: 'Conteudo valido.' });
    await criar(new Request('http://localhost/api/condutas', { method: 'POST', body: corpo }) as never, { params: Promise.resolve({ id: 'paciente/1' }) });
    await atualizarRascunho(new Request('http://localhost/api/condutas', { method: 'PUT', body: corpo }) as never, { params: Promise.resolve({ id: 'paciente/1', condutaId: 'conduta/1', acao: 'rascunho' }) });
    await publicar(new Request('http://localhost/api/condutas', { method: 'POST' }) as never, { params: Promise.resolve({ id: 'paciente/1', condutaId: 'conduta/1', acao: 'publicacao' }) });
    assert.deepEqual(chamadas, [
      ['http://backend.octaclin.local/pacientes/paciente%2F1/condutas-terapeuticas', 'POST', corpo],
      ['http://backend.octaclin.local/pacientes/paciente%2F1/condutas-terapeuticas/conduta%2F1/rascunho', 'PUT', corpo],
      ['http://backend.octaclin.local/pacientes/paciente%2F1/condutas-terapeuticas/conduta%2F1/publicacao', 'POST', undefined]
    ]);
  } finally { restaurarFetch(original); }
});

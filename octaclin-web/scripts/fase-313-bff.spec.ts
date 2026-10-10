import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import type { NextRequest } from 'next/server';
import { GET,POST,PUT } from '../app/api/pacientes/[id]/gestacoes/[[...caminho]]/route';
import { GET as portalGet, PUT as portalPut } from '../app/api/portal/paciente/gestacoes/[[...caminho]]/route';
import { salvarSessaoBff } from '../lib/server/sessao-bff';
const { __clearCookies } = nextHeaders as typeof nextHeaders & { __clearCookies: () => void };
const id = '10000000-0000-4000-8000-000000000001';
const gestacao = '10000000-0000-4000-8000-000000000002';
function req(method = 'GET',body = '',query = '',origin = true) {
  const url = new URL('http://localhost/api'+query);
  const r = new Request(url,{ method,...(method === 'GET' ? {} : { body }),headers: origin ? { origin: 'http://localhost' } : {} });
  Object.defineProperty(r,'nextUrl',{ value: url });return r as NextRequest;
}
async function sessao(permissoes: string[],papel = 'Professional') {
  await salvarSessaoBff({ apiUrl: 'http://backend.octaclin.local',tenantSlug: 'clinica-sintetica',email: 'user@example.test' },{ accessToken: 'token-sintetico',refreshToken: 'refresh-sintetico',tipoToken: 'Bearer',expiraEmSegundos: 3600,permissoes,papel });
}
test('Fase 313 BFF protege permissoes, caminhos, origem, limites e cache',async () => {
  const original = global.fetch,calls: string[] = [];
  global.fetch = (async url => {calls.push(String(url));return new Response('{}',{ status: 200 });}) as typeof fetch;
  const p = { params: Promise.resolve({ id }) };
  try {
    __clearCookies();assert.equal((await GET(req(),p)).status,401);
    await sessao(['pacientes.ler']);assert.equal((await POST(req('POST','{}'),p)).status,403);assert.equal(calls.length,0);
    const r = await GET(req('GET','','?limite=20'),p);assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'private, no-store');
    await sessao(['pacientes.gerenciar']);assert.equal((await POST(req('POST','{}','',false),p)).status,403);
    assert.equal((await POST(req('POST','x'.repeat(24001)),p)).status,413);
    assert.equal((await PUT(req('PUT','{}'),{ params: Promise.resolve({ id,caminho: [gestacao,'qualquer-rota'] }) })).status,404);
    assert.equal((await POST(req('POST','{}'),p)).status,200);
    assert(calls.every(url => url.startsWith('http://backend.octaclin.local/pacientes/'+id+'/gestacoes')));
  } finally {global.fetch = original;__clearCookies();}
});
test('Fase 313 portal preserva sessao e no-store em erro, sem capacidade por URL',async () => {
  const original = global.fetch;
  try {
    __clearCookies();assert.equal((await portalGet(req(),{ params: Promise.resolve({}) })).status,401);
    await sessao([],'Patient');
    global.fetch = (async () => new Response('{}',{ status: 403 })) as typeof fetch;
    const denied = await portalGet(req(),{ params: Promise.resolve({ caminho: [gestacao] }) });
    assert.equal(denied.status,403);assert.equal(denied.headers.get('Cache-Control'),'private, no-store');
    assert.equal((await portalPut(req('PUT','{}','',false),{ params: Promise.resolve({ caminho: [gestacao,'consentimento'] }) })).status,403);
    global.fetch = (async () => {throw new Error('Falha sintetica');}) as typeof fetch;
    const falha = await portalGet(req(),{ params: Promise.resolve({}) });assert.equal(falha.status,502);assert.equal(falha.headers.get('Cache-Control'),'private, no-store');assert(!await falha.text().then(s => s.includes('Falha sintetica')));
  } finally {global.fetch = original;__clearCookies();}
});

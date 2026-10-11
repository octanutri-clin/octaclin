import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import type { NextRequest } from 'next/server';
import { GET } from '../app/api/pacientes/[id]/acompanhamento-pediatrico/route';
import { salvarSessaoBff } from '../lib/server/sessao-bff';
const { __clearCookies } = nextHeaders as typeof nextHeaders & { __clearCookies: () => void };
const id = '10000000-0000-4000-8000-000000000001';
function req(query = '') { const url = new URL('http://localhost/api'+query); const r = new Request(url); Object.defineProperty(r,'nextUrl',{ value: url }); return r as NextRequest; }
async function sessao(permissoes: string[]) { await salvarSessaoBff({ apiUrl: 'http://backend.octaclin.local',tenantSlug: 'clinica-sintetica',email: 'user@example.test' },{ accessToken: 'token-sintetico',refreshToken: 'refresh-sintetico',tipoToken: 'Bearer',expiraEmSegundos: 3600,permissoes,papel: 'Professional' }); }
test('Fase314: sessão, permissão, cursor, limite, query mínima e cache',async () => {
  const original = global.fetch,calls: string[] = []; global.fetch = (async url => { calls.push(String(url)); return new Response('{}'); }) as typeof fetch;
  const p = { params: Promise.resolve({ id }) };
  try {
    __clearCookies(); assert.equal((await GET(req(),p)).status,401);
    await sessao([]); assert.equal((await GET(req(),p)).status,403); assert.equal(calls.length,0);
    await sessao(['pacientes.ler']);
    for (const q of ['?limite=101','?limite=0','?cursor=invalido']) assert.equal((await GET(req(q),p)).status,400);
    const r = await GET(req('?limite=20&nascimento=nao_encaminhar'),p);
    assert.equal(r.status,200); assert.equal(r.headers.get('Cache-Control'),'private, no-store'); assert.equal(r.headers.get('Vary'),'Cookie');
    assert.equal(calls.length,1); assert(!calls[0].includes('nascimento')); assert(calls[0].includes('/acompanhamento-pediatrico?limite=20'));
    global.fetch = (async () => { throw new Error('detalhe-interno-sintetico'); }) as typeof fetch;
    const falha = await GET(req(),p); assert.equal(falha.status,502); assert(!((await falha.text()).includes('detalhe-interno')));
  } finally { global.fetch = original; __clearCookies(); }
});

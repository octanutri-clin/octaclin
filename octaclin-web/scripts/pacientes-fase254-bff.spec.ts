import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { NextRequest } from 'next/server';
import { GET as listarFiltros, POST as criarFiltro } from '../app/api/pacientes/filtros-salvos/route';
import { DELETE as arquivarFiltro } from '../app/api/pacientes/filtros-salvos/[filtroId]/route';
import { POST as verificarDuplicidade } from '../app/api/pacientes/verificacao-duplicidade/route';
import { GET as obterProfissional } from '../app/api/profissionais/[id]/route';

const { __clearCookies, __setCookies } = nextHeaders as typeof nextHeaders & {
  __clearCookies: () => void;
  __setCookies: (cookies: Record<string, string>) => void;
};

function cookiesSessao() {
  return {
    octaclin_access_token: 'access-token-valido',
    octaclin_refresh_token: 'refresh-token-valido',
    octaclin_api_url: encodeURIComponent('http://backend.octaclin.local'),
    octaclin_tenant_slug: encodeURIComponent('clinica-sintetica'),
    octaclin_email: encodeURIComponent('profissional@octaclin.local'),
    octaclin_access_expira_em: '2030-08-22T12:00:00.000Z',
    octaclin_papel: 'Professional',
    octaclin_permissoes: encodeURIComponent(JSON.stringify(['pacientes.listar', 'pacientes.gerenciar']))
  };
}

function restaurarFetch(original: typeof global.fetch | undefined) {
  if (original) global.fetch = original;
  else Reflect.deleteProperty(globalThis, 'fetch');
}

test('BFFs da Fase 254 recusam sessao ausente antes do backend', async () => {
  const original = global.fetch;
  let chamadas = 0;
  global.fetch = (async () => { chamadas += 1; throw new Error('nao deve chamar'); }) as typeof global.fetch;
  try {
    __clearCookies();
    assert.equal((await listarFiltros(new NextRequest('http://localhost/api/pacientes/filtros-salvos'))).status, 401);
    assert.equal((await criarFiltro(new NextRequest('http://localhost/api/pacientes/filtros-salvos', { method: 'POST', body: '{}' }))).status, 401);
    assert.equal((await verificarDuplicidade(new NextRequest('http://localhost/api/pacientes/verificacao-duplicidade', { method: 'POST', body: '{}' }))).status, 401);
    assert.equal((await obterProfissional(new NextRequest('http://localhost/api/profissionais/id'), { params: Promise.resolve({ id: 'id' }) })).status, 401);
    assert.equal(chamadas, 0);
  } finally { restaurarFetch(original); }
});

test('BFF encaminha somente contratos permitidos e mantem PII fora da URL', async () => {
  const original = global.fetch;
  const chamadas: Array<{ url: string; metodo?: string; corpo?: BodyInit | null }> = [];
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), metodo: init?.method, corpo: init?.body });
    return new Response(JSON.stringify({ itens: [], candidatos: [], arquivado: true }), { headers: { 'Content-Type': 'application/json' } });
  }) as typeof global.fetch;
  try {
    __setCookies(cookiesSessao());
    await listarFiltros(new NextRequest('http://localhost/api/pacientes/filtros-salvos?origem=clinica&busca=Maria'));
    await criarFiltro(new NextRequest('http://localhost/api/pacientes/filtros-salvos', { method: 'POST', body: JSON.stringify({ nome: 'Risco alto', origem: 'pessoal', criterios: { risco: 'alto' } }) }));
    await arquivarFiltro(new Request('http://localhost/api/pacientes/filtros-salvos/id'), { params: Promise.resolve({ filtroId: 'id/forjado' }) });
    await verificarDuplicidade(new NextRequest('http://localhost/api/pacientes/verificacao-duplicidade', { method: 'POST', body: JSON.stringify({ nome: 'Maria', contato: 'maria@example.com' }) }));
    await obterProfissional(new NextRequest('http://localhost/api/profissionais/id'), { params: Promise.resolve({ id: 'id/forjado' }) });

    assert.equal(new URL(chamadas[0].url).search, '?origem=clinica');
    assert.equal(chamadas[1].corpo, JSON.stringify({ nome: 'Risco alto', origem: 'pessoal', criterios: { risco: 'alto' } }));
    assert.match(new URL(chamadas[2].url).pathname, /id%2Fforjado$/);
    assert.equal(new URL(chamadas[3].url).pathname, '/pacientes/verificacao-duplicidade');
    assert.doesNotMatch(chamadas[3].url, /Maria|maria%40example/);
    assert.equal(chamadas[3].corpo, JSON.stringify({ nome: 'Maria', contato: 'maria@example.com' }));
    assert.match(new URL(chamadas[4].url).pathname, /id%2Fforjado$/);
  } finally { restaurarFetch(original); }
});

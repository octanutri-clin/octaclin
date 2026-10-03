import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { NextRequest } from 'next/server';
import { GET as listar } from '../app/api/cliente/lgpd/solicitacoes/route';
import { GET as detalhar } from '../app/api/cliente/lgpd/solicitacoes/[protocolo]/route';
import { POST as assumir } from '../app/api/cliente/lgpd/solicitacoes/[protocolo]/assumir/route';
import { POST as rascunho } from '../app/api/cliente/lgpd/solicitacoes/[protocolo]/rascunho/route';

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

const params = { params: Promise.resolve({ protocolo: 'LGPD-EXEMPLO' }) };

test('rotas LGPD da clinica negam sessao e permissao antes do backend', async () => {
  const anterior = global.fetch;
  let chamadas = 0;
  global.fetch = (async () => { chamadas++; return Response.json({}); }) as typeof global.fetch;
  try {
    __clearCookies();
    assert.equal((await listar(new NextRequest('http://localhost/api/cliente/lgpd/solicitacoes'))).status, 401);
    assert.equal((await detalhar(new Request('http://localhost/'), params)).status, 401);
    assert.equal((await assumir(new Request('http://localhost/', { method: 'POST' }), params)).status, 401);
    assert.equal((await rascunho(new Request('http://localhost/', { method: 'POST' }), params)).status, 401);
    __setCookies(sessao([]));
    assert.equal((await listar(new NextRequest('http://localhost/api/cliente/lgpd/solicitacoes'))).status, 403);
    assert.equal((await detalhar(new Request('http://localhost/'), params)).status, 403);
    assert.equal((await assumir(new Request('http://localhost/', { method: 'POST' }), params)).status, 403);
    assert.equal((await rascunho(new Request('http://localhost/', { method: 'POST' }), params)).status, 403);
    assert.equal(chamadas, 0);
  } finally { global.fetch = anterior; }
});

test('lista recusa tenant arbitrario e filtros repetidos; rotas so propagam protocolo', async () => {
  const anterior = global.fetch;
  const chamadas: { url: string; metodo: string }[] = [];
  global.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(entrada), metodo: init?.method ?? 'GET' });
    return Response.json({ itens: [] });
  }) as typeof global.fetch;
  try {
    __setCookies(sessao(['cliente.acessar']));
    for (const query of ['tenantId=outro', 'pagina=1&pagina=2', 'status=recebida&status=concluida']) {
      assert.equal((await listar(new NextRequest(`http://localhost/api/cliente/lgpd/solicitacoes?${query}`))).status, 400);
    }
    assert.equal(chamadas.length, 0);
    const respostas = [
      await listar(new NextRequest('http://localhost/api/cliente/lgpd/solicitacoes?status=recebida&pagina=2')),
      await detalhar(new Request('http://localhost/'), params),
      await assumir(new Request('http://localhost/', { method: 'POST' }), params),
      await rascunho(new Request('http://localhost/', { method: 'POST' }), params)
    ];
    assert.ok(respostas.every((resposta) => resposta.status === 200 && resposta.headers.get('cache-control') === 'private, no-store'));
    assert.deepEqual(chamadas, [
      { url: 'http://backend.octaclin.local/cliente/lgpd/solicitacoes?status=recebida&pagina=2', metodo: 'GET' },
      { url: 'http://backend.octaclin.local/cliente/lgpd/solicitacoes/LGPD-EXEMPLO', metodo: 'GET' },
      { url: 'http://backend.octaclin.local/cliente/lgpd/solicitacoes/LGPD-EXEMPLO/assumir', metodo: 'POST' },
      { url: 'http://backend.octaclin.local/cliente/lgpd/solicitacoes/LGPD-EXEMPLO/rascunho', metodo: 'POST' }
    ]);
  } finally { global.fetch = anterior; }
});

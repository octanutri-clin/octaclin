import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { POST as revisarEnvio } from '../app/api/questionarios/envios/[envioId]/revisar/route';
import { GET as listarPendentes } from '../app/api/questionarios/revisoes/pendentes/route';
import { GET as abrirResposta } from '../app/api/questionarios/revisoes/[envioId]/route';

const { __clearCookies, __setCookies } = nextHeaders as typeof nextHeaders & {
  __clearCookies: () => void;
  __setCookies: (cookies: Record<string, string>) => void;
};

function restaurarFetch(fetchOriginal: typeof global.fetch | undefined) {
  if (fetchOriginal) {
    global.fetch = fetchOriginal;
  } else {
    Reflect.deleteProperty(globalThis, 'fetch');
  }
}

function cookiesSessaoValida(permissoes: string[]) {
  return {
    octaclin_access_token: 'access-token-valido',
    octaclin_refresh_token: 'refresh-token-valido',
    octaclin_api_url: encodeURIComponent('http://backend.octaclin.local'),
    octaclin_tenant_slug: encodeURIComponent('clinica-carla'),
    octaclin_email: encodeURIComponent('dra.carla@octaclin.local'),
    octaclin_access_expira_em: '2030-07-27T15:00:00.000Z',
    octaclin_permissoes: encodeURIComponent(JSON.stringify(permissoes))
  };
}

test('BFF de revisao retorna 401 sem sessao e nao consulta o backend', async () => {
  __clearCookies();
  const fetchOriginal = global.fetch;
  let backendChamado = false;
  global.fetch = (async () => {
    backendChamado = true;
    throw new Error('nao deveria consultar o backend');
  }) as typeof global.fetch;

  try {
    const resposta = await revisarEnvio(new Request('http://localhost/api/revisar'), {
      params: Promise.resolve({ envioId: 'envio-1' })
    });

    assert.equal(resposta.status, 401);
    assert.deepEqual(await resposta.json(), { mensagem: 'Sessão ausente ou expirada.' });
    assert.equal(backendChamado, false);
  } finally {
    restaurarFetch(fetchOriginal);
  }
});

test('BFF de revisao retorna 403 sem permissao e nao consulta o backend', async () => {
  __setCookies(cookiesSessaoValida(['questionarios.ler']));
  const fetchOriginal = global.fetch;
  let backendChamado = false;
  global.fetch = (async () => {
    backendChamado = true;
    throw new Error('nao deveria consultar o backend');
  }) as typeof global.fetch;

  try {
    const resposta = await revisarEnvio(new Request('http://localhost/api/revisar'), {
      params: Promise.resolve({ envioId: 'envio-1' })
    });

    assert.equal(resposta.status, 403);
    assert.deepEqual(await resposta.json(), { mensagem: 'Usuário sem permissão para esta ação.' });
    assert.equal(backendChamado, false);
  } finally {
    restaurarFetch(fetchOriginal);
  }
});

test('BFF generico nao encaminha origem e remove token publico da resposta', async () => {
  __setCookies(cookiesSessaoValida(['questionarios.gerenciar']));
  const fetchOriginal = global.fetch;
  let headersBackend: Headers | undefined;

  global.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    headersBackend = new Headers(init?.headers);
    return new Response(
      JSON.stringify({
        id: 'envio-1',
        tenantId: 'tenant-1',
        pacienteId: 'paciente-1',
        status: 'respondido',
        revisadoEm: '2026-07-27T15:00:00.000Z',
        revisadoPorUsuarioId: 'usuario-1',
        tokenFormulario: 'segredo',
        linkFormulario: 'https://app.octaclin.test/formularios/segredo'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof global.fetch;

  try {
    const resposta = await revisarEnvio(new Request('http://localhost/api/revisar', {
      method: 'POST', headers: { 'x-octaclin-origem': 'dashboard_clinico', 'Content-Type': 'application/json' },
      body: JSON.stringify({ comprovanteLeitura: 'comprovante-sintetico' })
    }), {
      params: Promise.resolve({ envioId: 'envio-1' })
    });
    const corpo = (await resposta.json()) as Record<string, unknown>;

    assert.equal(resposta.status, 200);
    assert.equal(headersBackend?.get('x-octaclin-origem'), null);
    assert.deepEqual(corpo, {
      id: 'envio-1',
      status: 'respondido',
      revisadoEm: '2026-07-27T15:00:00.000Z',
      revisadoPorUsuarioId: 'usuario-1'
    });
    assert.equal('tokenFormulario' in corpo, false);
    assert.equal('linkFormulario' in corpo, false);
  } finally {
    restaurarFetch(fetchOriginal);
  }
});

test('BFF da fila e detalhe exigem permissao antes de consultar o backend', async () => {
  __setCookies(cookiesSessaoValida(['questionarios.ler']));
  const original = global.fetch;
  let chamadas = 0;
  global.fetch = (async () => { chamadas += 1; throw new Error('backend nao deve ser consultado'); }) as typeof global.fetch;
  try {
    const lista = await listarPendentes(new Request('http://localhost/api/questionarios/revisoes/pendentes'));
    const detalhe = await abrirResposta(new Request('http://localhost/api/questionarios/revisoes/envio-1'), { params: Promise.resolve({ envioId: 'envio-1' }) });
    assert.equal(lista.status, 403);
    assert.equal(detalhe.status, 403);
    assert.equal(chamadas, 0);
  } finally { restaurarFetch(original); }
});

test('BFF da fila e detalhe encaminham escopo mínimo sem cache', async () => {
  __setCookies(cookiesSessaoValida(['questionarios.gerenciar']));
  const original = global.fetch;
  const caminhos: string[] = [];
  global.fetch = (async (url: string | URL | Request) => {
    caminhos.push(new URL(url instanceof Request ? url.url : url.toString()).pathname + new URL(url instanceof Request ? url.url : url.toString()).search);
    return new Response(JSON.stringify({ itens: [], total: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof global.fetch;
  try {
    const lista = await listarPendentes(new Request('http://localhost/api/questionarios/revisoes/pendentes?pagina=2'));
    const detalhe = await abrirResposta(new Request('http://localhost/api/questionarios/revisoes/envio-1'), { params: Promise.resolve({ envioId: 'envio-1' }) });
    assert.deepEqual(caminhos, ['/questionarios/revisoes/pendentes?pagina=2', '/questionarios/revisoes/envio-1']);
    assert.equal(lista.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(detalhe.headers.get('Cache-Control'), 'private, no-store');
  } finally { restaurarFetch(original); }
});

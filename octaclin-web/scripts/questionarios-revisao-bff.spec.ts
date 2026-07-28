import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { POST as revisarEnvio } from '../app/api/questionarios/envios/[envioId]/revisar/route';

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
    assert.deepEqual(await resposta.json(), { mensagem: 'Sessao ausente ou expirada.' });
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
    assert.deepEqual(await resposta.json(), { mensagem: 'Usuario sem permissao para esta acao.' });
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
      headers: { 'x-octaclin-origem': 'dashboard_clinico' }
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

import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { GET as obterTimeline } from '../app/api/pacientes/[id]/prontuario/timeline/route';

const { __clearCookies, __setCookies } = nextHeaders as typeof nextHeaders & {
  __clearCookies: () => void;
  __setCookies: (cookies: Record<string, string>) => void;
};

function cookiesSessao() {
  return {
    octaclin_access_token: 'access-token-valido',
    octaclin_refresh_token: 'refresh-token-valido',
    octaclin_api_url: encodeURIComponent('http://backend.octaclin.local'),
    octaclin_tenant_slug: encodeURIComponent('clinica-carla'),
    octaclin_email: encodeURIComponent('profissional@octaclin.local'),
    octaclin_access_expira_em: '2030-08-13T15:00:00.000Z',
    octaclin_papel: encodeURIComponent('Professional'),
    octaclin_permissoes: encodeURIComponent(JSON.stringify(['pacientes.ler']))
  };
}

function restaurarFetch(original: typeof global.fetch | undefined) {
  if (original) global.fetch = original;
  else Reflect.deleteProperty(globalThis, 'fetch');
}

test('BFF da timeline recusa sessao ausente antes de chamar o backend', async () => {
  const original = global.fetch;
  let chamadas = 0;
  global.fetch = (async () => {
    chamadas += 1;
    throw new Error('nao deve chamar');
  }) as typeof global.fetch;

  try {
    __clearCookies();
    const resposta = await obterTimeline(
      new Request('http://localhost/api/pacientes/paciente-1/prontuario/timeline'),
      { params: Promise.resolve({ id: 'paciente-1' }) }
    );
    assert.equal(resposta.status, 401);
    assert.equal(chamadas, 0);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF da timeline encaminha filtros permitidos e codifica o paciente', async () => {
  const original = global.fetch;
  let urlBackend = '';
  global.fetch = (async (url: string | URL | Request) => {
    urlBackend = String(url);
    return new Response(JSON.stringify({ itens: [] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }) as typeof global.fetch;

  try {
    __setCookies(cookiesSessao());
    const consulta = new URLSearchParams({
      cursor: '2026-08-13T12:00:00.000Z_evento-1',
      limite: '25',
      tipo: 'evento_financeiro',
      inicio: '2026-08-01T00:00:00.000Z',
      fim: '2026-08-31T23:59:59.000Z',
      responsavelId: '11111111-1111-4111-8111-111111111111',
      ignorado: 'nao-encaminhar'
    });
    const resposta = await obterTimeline(
      new Request(`http://localhost/api/pacientes/paciente%2F1/prontuario/timeline?${consulta}`),
      { params: Promise.resolve({ id: 'paciente/1' }) }
    );

    assert.equal(resposta.status, 200);
    const destino = new URL(urlBackend);
    assert.equal(destino.pathname, '/pacientes/paciente%2F1/prontuario/timeline');
    for (const nome of ['cursor', 'limite', 'tipo', 'inicio', 'fim', 'responsavelId']) {
      assert.equal(destino.searchParams.get(nome), consulta.get(nome));
    }
    assert.equal(destino.searchParams.has('ignorado'), false);
  } finally {
    restaurarFetch(original);
  }
});

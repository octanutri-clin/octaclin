import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { NextRequest } from 'next/server';
import { GET as listarSessoes } from '../app/api/auth/sessoes/route';
import { DELETE as encerrarSessao } from '../app/api/auth/sessoes/[referencia]/route';
import { POST as encerrarOutras } from '../app/api/auth/sessoes/encerrar-outras/route';
import { salvarSessaoBff } from '../lib/server/sessao-bff';

const { __clearCookies, __setCookies, __opcoesCookie } = nextHeaders as typeof nextHeaders & {
  __clearCookies: () => void;
  __setCookies: (cookies: Record<string, string>) => void;
  __opcoesCookie: (nome: string) => Record<string, unknown> | undefined;
};

const REFERENCIA = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

function cookiesSessao() {
  return {
    octaclin_access_token: 'access-token-sintetico',
    octaclin_refresh_token: 'refresh-token-sintetico',
    octaclin_api_url: encodeURIComponent('http://backend.octaclin.local'),
    octaclin_tenant_slug: encodeURIComponent('clinica-sintetica'),
    octaclin_email: encodeURIComponent('profissional@octaclin.local'),
    octaclin_access_expira_em: '2030-08-22T12:00:00.000Z',
    octaclin_papel: 'Professional',
    octaclin_permissoes: encodeURIComponent(JSON.stringify([]))
  };
}

function restaurarFetch(original: typeof global.fetch | undefined) {
  if (original) global.fetch = original;
  else Reflect.deleteProperty(globalThis, 'fetch');
}

test('rotas de sessao recusam sessao ausente antes de tocar o backend', async () => {
  const original = global.fetch;
  let chamadas = 0;
  global.fetch = (async () => {
    chamadas += 1;
    throw new Error('nao deve chamar o backend sem sessao');
  }) as typeof global.fetch;

  try {
    __clearCookies();
    assert.equal((await listarSessoes()).status, 401);
    assert.equal(
      (
        await encerrarSessao(new NextRequest('http://localhost/api/auth/sessoes/x'), {
          params: Promise.resolve({ referencia: REFERENCIA })
        })
      ).status,
      401
    );
    assert.equal((await encerrarOutras()).status, 401);
    assert.equal(chamadas, 0);
  } finally {
    restaurarFetch(original);
  }
});

test('rotas de sessao encaminham metodo, caminho e credencial corretos', async () => {
  const original = global.fetch;
  const chamadas: Array<{ url: string; metodo?: string; autorizacao?: string }> = [];
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({
      url: String(url),
      metodo: init?.method ?? 'GET',
      autorizacao: new Headers(init?.headers).get('Authorization') ?? undefined
    });
    return new Response(JSON.stringify({ encerradas: 1 }), { headers: { 'Content-Type': 'application/json' } });
  }) as typeof global.fetch;

  try {
    __setCookies(cookiesSessao());
    await listarSessoes();
    await encerrarSessao(new NextRequest('http://localhost/api/auth/sessoes/x'), {
      params: Promise.resolve({ referencia: `${REFERENCIA}/../outra` })
    });
    await encerrarOutras();

    assert.deepEqual(
      chamadas.map((chamada) => `${chamada.metodo} ${chamada.url}`),
      [
        'GET http://backend.octaclin.local/auth/sessoes',
        `DELETE http://backend.octaclin.local/auth/sessoes/${encodeURIComponent(`${REFERENCIA}/../outra`)}`,
        'POST http://backend.octaclin.local/auth/sessoes/encerrar-outras'
      ]
    );
    for (const chamada of chamadas) {
      assert.equal(chamada.autorizacao, 'Bearer access-token-sintetico');
    }
  } finally {
    restaurarFetch(original);
  }
});

test('listagem de sessoes nunca devolve token ao navegador e nao entra em cache', async () => {
  const original = global.fetch;
  global.fetch = (async () =>
    new Response(
      JSON.stringify([
        {
          referencia: REFERENCIA,
          criadaEm: '2026-08-01T10:00:00.000Z',
          ultimaAtividadeEm: '2026-08-01T11:00:00.000Z',
          expiraEm: '2026-09-01T10:00:00.000Z',
          estado: 'ativa',
          atual: true
        }
      ]),
      { headers: { 'Content-Type': 'application/json' } }
    )) as typeof global.fetch;

  try {
    __setCookies(cookiesSessao());
    const resposta = await listarSessoes();
    const corpo = await resposta.text();

    assert.equal(resposta.headers.get('Cache-Control'), 'no-store');
    assert.ok(!corpo.includes('access-token-sintetico'));
    assert.ok(!corpo.includes('refresh-token-sintetico'));
    assert.ok(!/tokenHash|familiaToken|sessaoId/.test(corpo));
  } finally {
    restaurarFetch(original);
  }
});

test('cookies de sessao permanecem HttpOnly, SameSite e com validade coerente com o backend', async () => {
  const secureAnterior = process.env.OCTACLIN_COOKIE_SECURE;
  process.env.OCTACLIN_COOKIE_SECURE = 'true';

  try {
    __clearCookies();
    await salvarSessaoBff(
      { apiUrl: 'http://backend.octaclin.local', tenantSlug: 'clinica-sintetica', email: 'profissional@octaclin.local' },
      {
        accessToken: 'access-token-sintetico',
        refreshToken: 'refresh-token-sintetico',
        tipoToken: 'Bearer',
        expiraEmSegundos: 900,
        renovacaoExpiraEmSegundos: 604800
      }
    );

    const access = __opcoesCookie('octaclin_access_token');
    const refresh = __opcoesCookie('octaclin_refresh_token');

    for (const opcoes of [access, refresh]) {
      assert.equal(opcoes?.httpOnly, true);
      assert.equal(opcoes?.sameSite, 'lax');
      assert.equal(opcoes?.secure, true);
      assert.equal(opcoes?.path, '/');
    }

    assert.equal(access?.maxAge, 900);
    assert.equal(refresh?.maxAge, 604800);
  } finally {
    if (secureAnterior === undefined) delete process.env.OCTACLIN_COOKIE_SECURE;
    else process.env.OCTACLIN_COOKIE_SECURE = secureAnterior;
  }
});

test('sem duracao de renovacao declarada, o cookie cai no padrao de 30 dias', async () => {
  __clearCookies();
  await salvarSessaoBff(
    { apiUrl: 'http://backend.octaclin.local', tenantSlug: 'clinica-sintetica', email: 'profissional@octaclin.local' },
    {
      accessToken: 'access-token-sintetico',
      refreshToken: 'refresh-token-sintetico',
      tipoToken: 'Bearer',
      expiraEmSegundos: 900
    }
  );

  assert.equal(__opcoesCookie('octaclin_refresh_token')?.maxAge, 60 * 60 * 24 * 30);
});

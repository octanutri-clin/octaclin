import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { DELETE as removerOverride, POST as criarOverride } from '../app/api/pacientes/[id]/prioridade-acompanhamento/override/route';
import { converterDataOverrideParaIso } from '../lib/prioridade-acompanhamento';

const { __clearCookies, __setCookies } = nextHeaders as typeof nextHeaders & {
  __clearCookies: () => void;
  __setCookies: (cookies: Record<string, string>) => void;
};

function cookiesSessao(permissoes: string[]) {
  return {
    octaclin_access_token: 'access-token-valido',
    octaclin_refresh_token: 'refresh-token-valido',
    octaclin_api_url: encodeURIComponent('http://backend.octaclin.local'),
    octaclin_tenant_slug: encodeURIComponent('clinica-carla'),
    octaclin_email: encodeURIComponent('profissional@octaclin.local'),
    octaclin_access_expira_em: '2030-08-13T15:00:00.000Z',
    octaclin_papel: encodeURIComponent('Professional'),
    octaclin_permissoes: encodeURIComponent(JSON.stringify(permissoes))
  };
}

function restaurarFetch(original: typeof global.fetch | undefined) {
  if (original) global.fetch = original;
  else Reflect.deleteProperty(globalThis, 'fetch');
}

const corpoOverride = JSON.stringify({
  faixa: 'alta',
  codigoMotivo: 'acompanhamento_intensificado',
  justificativa: 'paciente em situacao de risco social',
  expiraEm: '2026-12-01T00:00:00.000Z'
});

test('data maxima exibida pela UI preserva o horario e permanece dentro de 90 dias', () => {
  const agora = new Date('2026-09-18T12:34:56.789Z');
  const expiraEm = converterDataOverrideParaIso('2026-12-17', agora);

  assert.equal(expiraEm, '2026-12-17T12:34:56.789Z');
  assert.ok(new Date(expiraEm).getTime() - agora.getTime() <= 90 * 24 * 60 * 60 * 1000);
});

test('POST do override recusa sessao ausente antes de chamar o backend', async () => {
  const original = global.fetch;
  let chamadas = 0;
  global.fetch = (async () => {
    chamadas += 1;
    throw new Error('nao deve chamar');
  }) as typeof global.fetch;

  try {
    __clearCookies();
    const resposta = await criarOverride(
      new Request('http://localhost/api/pacientes/paciente-1/prioridade-acompanhamento/override', {
        method: 'POST',
        body: corpoOverride
      }),
      { params: Promise.resolve({ id: 'paciente-1' }) }
    );
    assert.equal(resposta.status, 401);
    assert.equal(chamadas, 0);
  } finally {
    restaurarFetch(original);
  }
});

test('POST do override recusa sessao sem pacientes.gerenciar antes de chamar o backend', async () => {
  const original = global.fetch;
  let chamadas = 0;
  global.fetch = (async () => {
    chamadas += 1;
    throw new Error('nao deve chamar');
  }) as typeof global.fetch;

  try {
    __setCookies(cookiesSessao(['pacientes.ler']));
    const resposta = await criarOverride(
      new Request('http://localhost/api/pacientes/paciente-1/prioridade-acompanhamento/override', {
        method: 'POST',
        body: corpoOverride
      }),
      { params: Promise.resolve({ id: 'paciente-1' }) }
    );
    assert.equal(resposta.status, 403);
    assert.equal(chamadas, 0);
  } finally {
    restaurarFetch(original);
  }
});

test('POST do override encaminha o corpo e codifica o paciente na URL quando ha permissao', async () => {
  const original = global.fetch;
  let urlBackend = '';
  let metodo = '';
  let corpoEnviado = '';
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    urlBackend = String(url);
    metodo = init?.method ?? '';
    corpoEnviado = String(init?.body ?? '');
    return new Response(
      JSON.stringify({
        pacienteId: 'paciente/1',
        valorCalculado: { score: 0, faixa: 'baixa', fatores: [] },
        valorEfetivo: { faixa: 'alta', origem: 'override' }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof global.fetch;

  try {
    __setCookies(cookiesSessao(['pacientes.gerenciar']));
    const resposta = await criarOverride(
      new Request('http://localhost/api/pacientes/paciente%2F1/prioridade-acompanhamento/override', {
        method: 'POST',
        body: corpoOverride
      }),
      { params: Promise.resolve({ id: 'paciente/1' }) }
    );

    assert.equal(resposta.status, 200);
    assert.equal(metodo, 'POST');
    assert.equal(corpoEnviado, corpoOverride);
    const destino = new URL(urlBackend);
    assert.equal(destino.pathname, '/pacientes/paciente%2F1/prioridade-acompanhamento/override');
  } finally {
    restaurarFetch(original);
  }
});

test('DELETE do override recusa sessao ausente antes de chamar o backend', async () => {
  const original = global.fetch;
  let chamadas = 0;
  global.fetch = (async () => {
    chamadas += 1;
    throw new Error('nao deve chamar');
  }) as typeof global.fetch;

  try {
    __clearCookies();
    const resposta = await removerOverride(
      new Request('http://localhost/api/pacientes/paciente-1/prioridade-acompanhamento/override', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'paciente-1' }) }
    );
    assert.equal(resposta.status, 401);
    assert.equal(chamadas, 0);
  } finally {
    restaurarFetch(original);
  }
});

test('DELETE do override recusa sessao sem pacientes.gerenciar antes de chamar o backend', async () => {
  const original = global.fetch;
  let chamadas = 0;
  global.fetch = (async () => {
    chamadas += 1;
    throw new Error('nao deve chamar');
  }) as typeof global.fetch;

  try {
    __setCookies(cookiesSessao(['pacientes.ler']));
    const resposta = await removerOverride(
      new Request('http://localhost/api/pacientes/paciente-1/prioridade-acompanhamento/override', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'paciente-1' }) }
    );
    assert.equal(resposta.status, 403);
    assert.equal(chamadas, 0);
  } finally {
    restaurarFetch(original);
  }
});

test('DELETE do override encaminha para o backend com o paciente codificado quando ha permissao', async () => {
  const original = global.fetch;
  let urlBackend = '';
  let metodo = '';
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    urlBackend = String(url);
    metodo = init?.method ?? '';
    return new Response(
      JSON.stringify({
        pacienteId: 'paciente/1',
        valorCalculado: { score: 0, faixa: 'baixa', fatores: [] },
        valorEfetivo: { faixa: 'baixa', origem: 'calculado' }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof global.fetch;

  try {
    __setCookies(cookiesSessao(['pacientes.gerenciar']));
    const resposta = await removerOverride(
      new Request('http://localhost/api/pacientes/paciente%2F1/prioridade-acompanhamento/override', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'paciente/1' }) }
    );

    assert.equal(resposta.status, 200);
    assert.equal(metodo, 'DELETE');
    const destino = new URL(urlBackend);
    assert.equal(destino.pathname, '/pacientes/paciente%2F1/prioridade-acompanhamento/override');
  } finally {
    restaurarFetch(original);
  }
});

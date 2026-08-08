import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { GET as listarPlanos, POST as criarPlano } from '../app/api/pacientes/[id]/planos-alimentares/route';
import { GET as buscarAlimentos } from '../app/api/pacientes/[id]/planos-alimentares/alimentos/route';
import { PUT as salvarRascunho } from '../app/api/pacientes/[id]/planos-alimentares/[planoId]/rascunho/route';
import { POST as publicarPlano } from '../app/api/pacientes/[id]/planos-alimentares/[planoId]/publicacao/route';

const { __clearCookies, __setCookies } = nextHeaders as typeof nextHeaders & {
  __clearCookies: () => void;
  __setCookies: (cookies: Record<string, string>) => void;
};

function cookiesSessaoValida(permissoes: string[]) {
  return {
    octaclin_access_token: 'access-token-valido',
    octaclin_refresh_token: 'refresh-token-valido',
    octaclin_api_url: encodeURIComponent('http://backend.octaclin.local'),
    octaclin_tenant_slug: encodeURIComponent('octaclin-admin'),
    octaclin_email: encodeURIComponent('profissional@octaclin.local'),
    octaclin_access_expira_em: '2030-08-08T15:00:00.000Z',
    octaclin_permissoes: encodeURIComponent(JSON.stringify(permissoes))
  };
}

function restaurarFetch(original: typeof global.fetch | undefined) {
  if (original) global.fetch = original;
  else Reflect.deleteProperty(globalThis, 'fetch');
}

test('BFF recusa listagem sem sessao antes de consultar o backend', async () => {
  __clearCookies();
  const original = global.fetch;
  let chamado = false;
  global.fetch = (async () => {
    chamado = true;
    throw new Error('nao deveria consultar o backend');
  }) as typeof global.fetch;

  try {
    const resposta = await listarPlanos(new Request('http://localhost/api/planos'), {
      params: Promise.resolve({ id: 'paciente-1' })
    });
    assert.equal(resposta.status, 401);
    assert.equal(chamado, false);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF recusa plano alimentar sem permissao clinica especifica', async () => {
  __setCookies(cookiesSessaoValida(['pacientes.ler']));
  const original = global.fetch;
  let chamado = false;
  global.fetch = (async () => {
    chamado = true;
    throw new Error('nao deveria consultar o backend');
  }) as typeof global.fetch;

  try {
    const resposta = await listarPlanos(new Request('http://localhost/api/planos'), {
      params: Promise.resolve({ id: 'paciente-1' })
    });
    assert.equal(resposta.status, 403);
    assert.equal(chamado, false);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF encaminha listagem e criacao somente ao paciente da rota', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler', 'planos_alimentares.gerenciar']));
  const original = global.fetch;
  const chamadas: Array<{ url: string; metodo: string; corpo?: string }> = [];
  global.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(entrada), metodo: init?.method ?? 'GET', corpo: init?.body?.toString() });
    return Response.json({ ok: true });
  }) as typeof global.fetch;

  try {
    await listarPlanos(new Request('http://localhost/api/planos'), {
      params: Promise.resolve({ id: 'paciente/1' })
    });
    await criarPlano(new Request('http://localhost/api/planos', {
      method: 'POST',
      body: JSON.stringify({ titulo: 'Plano 1' })
    }), { params: Promise.resolve({ id: 'paciente/1' }) });

    assert.deepEqual(chamadas.map((item) => [item.url, item.metodo]), [
      ['http://backend.octaclin.local/pacientes/paciente%2F1/planos-alimentares', 'GET'],
      ['http://backend.octaclin.local/pacientes/paciente%2F1/planos-alimentares', 'POST']
    ]);
    assert.equal(chamadas[1].corpo, JSON.stringify({ titulo: 'Plano 1' }));
  } finally {
    restaurarFetch(original);
  }
});

test('BFF preserva PUT do rascunho e POST sem payload da publicacao', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.gerenciar']));
  const original = global.fetch;
  const chamadas: Array<{ url: string; metodo: string; corpo?: string }> = [];
  global.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(entrada), metodo: init?.method ?? 'GET', corpo: init?.body?.toString() });
    return Response.json({ ok: true });
  }) as typeof global.fetch;

  try {
    const corpo = JSON.stringify({ formula: 'mifflin_st_jeor_1990' });
    await salvarRascunho(new Request('http://localhost/api/rascunho', { method: 'PUT', body: corpo }), {
      params: Promise.resolve({ id: 'paciente-1', planoId: 'plano-1' })
    });
    await publicarPlano(new Request('http://localhost/api/publicacao', { method: 'POST' }), {
      params: Promise.resolve({ id: 'paciente-1', planoId: 'plano-1' })
    });

    assert.deepEqual(chamadas.map((item) => [item.url, item.metodo, item.corpo]), [
      ['http://backend.octaclin.local/pacientes/paciente-1/planos-alimentares/plano-1/rascunho', 'PUT', corpo],
      ['http://backend.octaclin.local/pacientes/paciente-1/planos-alimentares/plano-1/publicacao', 'POST', '{}']
    ]);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF codifica a busca TACO antes de encaminhar ao catalogo global', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler']));
  const original = global.fetch;
  let url = '';
  global.fetch = (async (entrada: string | URL | Request) => {
    url = String(entrada);
    return Response.json([]);
  }) as typeof global.fetch;

  try {
    await buscarAlimentos(new Request('http://localhost/api/alimentos?busca=arroz%20%26%20feijao'), {
      params: Promise.resolve({ id: 'paciente-1' })
    });
    assert.equal(url, 'http://backend.octaclin.local/planos-alimentares/alimentos?busca=arroz%20%26%20feijao');
  } finally {
    restaurarFetch(original);
  }
});

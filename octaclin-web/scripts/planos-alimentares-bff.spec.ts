import { GET as obterApresentacaoPaciente } from '../app/api/pacientes/[id]/planos-alimentares/[planoId]/versoes/[numero]/apresentacao-paciente/route';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { GET as listarPlanos, POST as criarPlano } from '../app/api/pacientes/[id]/planos-alimentares/route';
import { GET as obterPlano } from '../app/api/pacientes/[id]/planos-alimentares/[planoId]/route';
import { PUT as alterarAtivacaoPlano } from '../app/api/pacientes/[id]/planos-alimentares/[planoId]/ativacao/route';
import { PUT as alterarAtivacaoRefeicao } from '../app/api/pacientes/[id]/planos-alimentares/[planoId]/refeicoes/[identidadeId]/ativacao/route';
import { GET as listarPlanosPortal } from '../app/api/portal/paciente/planos-alimentares/route';
import { GET as obterPlanoPortal } from '../app/api/portal/paciente/planos-alimentares/[planoId]/route';
import { GET as listarEscolhasPaciente } from '../app/api/pacientes/[id]/planos-alimentares/[planoId]/escolhas-paciente/route';
import { GET as buscarAlimentos } from '../app/api/pacientes/[id]/planos-alimentares/alimentos/route';
import { GET as buscarAlimentosModelo } from '../app/api/planos-alimentares/alimentos/route';
import { GET as obterVersao } from '../app/api/pacientes/[id]/planos-alimentares/[planoId]/versoes/[numero]/route';
import { GET as obterAcompanhamentoVersao } from '../app/api/pacientes/[id]/planos-alimentares/[planoId]/versoes/[numero]/acompanhamento/route';
import { PUT as salvarRascunho } from '../app/api/pacientes/[id]/planos-alimentares/[planoId]/rascunho/route';
import { POST as publicarPlano } from '../app/api/pacientes/[id]/planos-alimentares/[planoId]/publicacao/route';
import { POST as revisarPlano } from '../app/api/pacientes/[id]/planos-alimentares/[planoId]/revisao/route';
import { POST as criarNovaVersao } from '../app/api/pacientes/[id]/planos-alimentares/[planoId]/nova-versao/route';
import { POST as arquivarPlano } from '../app/api/pacientes/[id]/planos-alimentares/[planoId]/arquivamento/route';
import { GET as listarModelos, POST as criarModelo } from '../app/api/planos-alimentares/modelos/route';
import { GET as obterModelo, DELETE as arquivarModelo, PUT as editarModelo } from '../app/api/planos-alimentares/modelos/[modeloId]/route';
import { GET as listarVersoesModelo } from '../app/api/planos-alimentares/modelos/[modeloId]/versoes/route';
import { GET as obterVersaoModelo } from '../app/api/planos-alimentares/modelos/[modeloId]/versoes/[numero]/route';
import { POST as restaurarVersaoModelo } from '../app/api/planos-alimentares/modelos/[modeloId]/versoes/[numero]/restaurar/route';
import { GET as listarReceitas, POST as criarReceita } from '../app/api/planos-alimentares/receitas/route';
import { GET as obterReceita, PUT as atualizarReceita, DELETE as arquivarReceita } from '../app/api/planos-alimentares/receitas/[receitaId]/route';
import { alterarAtivacaoPlanoAlimentar, alterarAtivacaoRefeicaoPlanoAlimentar, obterAcompanhamentoVersaoPlanoAlimentar } from '../lib/plano-alimentar-api';
import { listarPlanosAlimentaresPortalPaciente, obterPlanoAlimentarPortalPaciente } from '../lib/portal-api';
import { aplicarAckAtivacao, ativacaoOperacionalEstaDesatualizada, localizarAtivacaoRefeicao, mesclarProjecaoAtivacao } from '../lib/ativacao-plano';

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

test('BFF encaminha detalhe com permissao de leitura e IDs codificados', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler']));
  const original = global.fetch;
  let chamada = '';
  global.fetch = (async (entrada: string | URL | Request) => {
    chamada = String(entrada);
    return Response.json({ id: 'plano-1' });
  }) as typeof global.fetch;

  try {
    const resposta = await obterPlano(new Request('http://localhost/api/plano'), {
      params: Promise.resolve({ id: 'paciente/1', planoId: 'plano/1' })
    });
    assert.equal(resposta.status, 200);
    assert.equal(
      chamada,
      'http://backend.octaclin.local/pacientes/paciente%2F1/planos-alimentares/plano%2F1'
    );
  } finally {
    restaurarFetch(original);
  }
});

test('BFF encaminha a trilha de trocas somente com paginacao permitida', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler']));
  const original = global.fetch;
  let url = '';
  global.fetch = (async (entrada: string | URL | Request) => {
    url = String(entrada);
    return Response.json({ itens: [], total: 0, pagina: 2, limite: 10 });
  }) as typeof global.fetch;

  try {
    const resposta = await listarEscolhasPaciente(
      new Request('http://localhost/api/trocas?pagina=2&limite=10&profissionalId=alheio'),
      { params: Promise.resolve({ id: 'paciente/1', planoId: 'plano/1' }) }
    );
    assert.equal(resposta.status, 200);
    assert.equal(
      url,
      'http://backend.octaclin.local/pacientes/paciente%2F1/planos-alimentares/plano%2F1/escolhas-paciente?pagina=2&limite=10'
    );
  } finally {
    restaurarFetch(original);
  }
});

test('BFF recusa detalhe sem permissao de leitura antes do backend', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.gerenciar']));
  const original = global.fetch;
  let chamado = false;
  global.fetch = (async () => {
    chamado = true;
    throw new Error('nao deveria consultar o backend');
  }) as typeof global.fetch;

  try {
    const resposta = await obterPlano(new Request('http://localhost/api/plano'), {
      params: Promise.resolve({ id: 'paciente-1', planoId: 'plano-1' })
    });
    assert.equal(resposta.status, 403);
    assert.equal(chamado, false);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF recusa todas as mutacoes para usuario com somente leitura', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler']));
  const original = global.fetch;
  let chamadas = 0;
  global.fetch = (async () => {
    chamadas += 1;
    throw new Error('nao deveria consultar o backend');
  }) as typeof global.fetch;
  const paramsPaciente = { params: Promise.resolve({ id: 'paciente-1' }) };
  const paramsPlano = { params: Promise.resolve({ id: 'paciente-1', planoId: 'plano-1' }) };

  try {
    const respostas = await Promise.all([
      criarPlano(new Request('http://localhost/api/planos', { method: 'POST', body: '{}' }), paramsPaciente),
      salvarRascunho(new Request('http://localhost/api/rascunho', { method: 'PUT', body: '{}' }), paramsPlano),
      revisarPlano(new Request('http://localhost/api/revisao', { method: 'POST' }), paramsPlano),
      publicarPlano(new Request('http://localhost/api/publicacao', { method: 'POST' }), paramsPlano),
      criarNovaVersao(new Request('http://localhost/api/nova-versao', { method: 'POST' }), paramsPlano),
      arquivarPlano(new Request('http://localhost/api/arquivamento', { method: 'POST' }), paramsPlano)
    ]);

    assert.deepEqual(respostas.map((resposta) => resposta.status), [403, 403, 403, 403, 403, 403]);
    assert.equal(chamadas, 0);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF encaminha ativacao CAS com identidade codificada, permissao e no-store', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.gerenciar']));
  const original = global.fetch;
  const chamadas: Array<{ url: string; metodo: string; corpo?: string }> = [];
  global.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(entrada), metodo: init?.method ?? 'GET', corpo: init?.body?.toString() });
    return Response.json({ ativo: false });
  }) as typeof global.fetch;
  try {
    const corpo = JSON.stringify({ ativo: false, ativacaoRevisaoEsperada: 7 });
    const plano = await alterarAtivacaoPlano(new Request('http://localhost/toggle', { method: 'PUT', body: corpo }), {
      params: Promise.resolve({ id: 'paciente/1', planoId: 'plano/1' })
    });
    const refeicao = await alterarAtivacaoRefeicao(new Request('http://localhost/toggle', { method: 'PUT', body: corpo }), {
      params: Promise.resolve({ id: 'paciente/1', planoId: 'plano/1', identidadeId: 'refeicao/1' })
    });
    assert.equal(plano.status, 200);
    assert.equal(plano.headers.get('Cache-Control'), 'no-store');
    assert.equal(refeicao.status, 200);
    assert.deepEqual(chamadas, [
      { url: 'http://backend.octaclin.local/pacientes/paciente%2F1/planos-alimentares/plano%2F1/ativacao', metodo: 'PUT', corpo },
      { url: 'http://backend.octaclin.local/pacientes/paciente%2F1/planos-alimentares/plano%2F1/refeicoes/refeicao%2F1/ativacao', metodo: 'PUT', corpo }
    ]);
  } finally { restaurarFetch(original); }
});

test('BFF bloqueia ativacao sem permissao antes do backend', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler']));
  const original = global.fetch;
  let chamou = false;
  global.fetch = (async () => { chamou = true; return Response.json({}); }) as typeof global.fetch;
  try {
    const resposta = await alterarAtivacaoPlano(new Request('http://localhost/toggle', { method: 'PUT', body: '{}' }), {
      params: Promise.resolve({ id: 'paciente-1', planoId: 'plano-1' })
    });
    assert.equal(resposta.status, 403);
    assert.equal(chamou, false);
  } finally { restaurarFetch(original); }
});

test('BFF limita o corpo das mutacoes operacionais antes de encaminhar', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.gerenciar']));
  const original = global.fetch;
  let chamou = false;
  global.fetch = (async () => { chamou = true; return Response.json({}); }) as typeof global.fetch;
  try {
    const resposta = await alterarAtivacaoPlano(new Request('http://localhost/toggle', { method: 'PUT', body: 'x'.repeat(2049) }), {
      params: Promise.resolve({ id: 'paciente-1', planoId: 'plano-1' })
    });
    assert.equal(resposta.status, 413);
    assert.equal(chamou, false);
  } finally { restaurarFetch(original); }
});

test('BFF do portal limita query e encaminha lista e detalhe sem cache', async () => {
  __setCookies(cookiesSessaoValida([]));
  const original = global.fetch;
  const urls: string[] = [];
  global.fetch = (async (entrada: string | URL | Request) => {
    urls.push(String(entrada));
    return Response.json({ itens: [], total: 0, pagina: 2, limite: 10 });
  }) as typeof global.fetch;
  try {
    const lista = await listarPlanosPortal(new Request('http://localhost/portal?pagina=2&limite=10&tenantId=alheio'));
    const detalhe = await obterPlanoPortal(new Request('http://localhost/portal'), {
      params: Promise.resolve({ planoId: 'plano/1' })
    });
    assert.equal(lista.status, 200);
    assert.equal(lista.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(detalhe.status, 200);
    assert.equal(detalhe.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(urls, [
      'http://backend.octaclin.local/portal/paciente/planos-alimentares?pagina=2&limite=10',
      'http://backend.octaclin.local/portal/paciente/planos-alimentares/plano%2F1'
    ]);
  } finally { restaurarFetch(original); }
});

test('cliente da API transmite CAS e consulta portal com no-store', async () => {
  const original = global.fetch;
  const chamadas: Array<{ url: string; method?: string; cache?: RequestCache; body?: string }> = [];
  global.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(entrada), method: init?.method, cache: init?.cache, body: init?.body?.toString() });
    return Response.json({ ok: true });
  }) as typeof global.fetch;
  try {
    await alterarAtivacaoPlanoAlimentar('paciente/1', 'plano/1', false, 8);
    await alterarAtivacaoRefeicaoPlanoAlimentar('paciente/1', 'plano/1', 'identidade/1', true, 9);
    await listarPlanosAlimentaresPortalPaciente({ pagina: 3, limite: 10 });
    await obterPlanoAlimentarPortalPaciente('plano/1');
    assert.deepEqual(chamadas, [
      { url: '/api/pacientes/paciente%2F1/planos-alimentares/plano%2F1/ativacao', method: 'PUT', cache: 'no-store', body: JSON.stringify({ ativo: false, ativacaoRevisaoEsperada: 8 }) },
      { url: '/api/pacientes/paciente%2F1/planos-alimentares/plano%2F1/refeicoes/identidade%2F1/ativacao', method: 'PUT', cache: 'no-store', body: JSON.stringify({ ativo: true, ativacaoRevisaoEsperada: 9 }) },
      { url: '/api/portal/paciente/planos-alimentares?pagina=3&limite=10', method: undefined, cache: 'no-store', body: undefined },
      { url: '/api/portal/paciente/planos-alimentares/plano%2F1', method: undefined, cache: 'no-store', body: undefined }
    ]);
  } finally { restaurarFetch(original); }
});

test('ativacao de refeicao usa identidade de chave exata e falha fechada sem mapa', () => {
  const versao = {
    ativacaoEdicao: [
      { chaveCliente: 'chave-atual', identidadeId: 'raiz-atual', ativa: false },
      { chaveCliente: 'chave-mesma', identidadeId: 'raiz-compartilhada', ativa: true }
    ],
    ativacaoRefeicoes: [
      { refeicaoId: 'id-fisico-legado', identidadeId: 'raiz-legada', ativa: false },
      { refeicaoId: 'id-fisico-mesma', identidadeId: 'raiz-compartilhada', ativa: false }
    ]
  };
  assert.deepEqual(localizarAtivacaoRefeicao(versao, 'chave-atual'), { identidadeId: 'raiz-atual', ativa: false });
  assert.deepEqual(localizarAtivacaoRefeicao(versao, 'id-fisico-legado'), { identidadeId: 'raiz-legada', ativa: false });
  assert.deepEqual(localizarAtivacaoRefeicao(versao, 'chave-mesma'), { identidadeId: 'raiz-compartilhada', ativa: true });
  assert.equal(localizarAtivacaoRefeicao(versao, 'chave-antiga'), undefined);
  assert.deepEqual(localizarAtivacaoRefeicao(versao, 'id-fisico-mesma'), { identidadeId: 'raiz-compartilhada', ativa: false });
});

test('ACK editorial atrasado nao pode regredir a revisao ou flags operacionais', () => {
  assert.equal(ativacaoOperacionalEstaDesatualizada(
    { ativacaoRevisao: 12, ativoParaPaciente: false },
    { ativacaoRevisao: 11, ativoParaPaciente: true }
  ), true);
  assert.equal(ativacaoOperacionalEstaDesatualizada(
    { ativacaoRevisao: 12 },
    { ativacaoRevisao: 12 }
  ), false);
});

test('ACK operacional atualiza só visibilidade e não regressa um ACK posterior', () => {
  const plano = {
    id: 'plano-1', pacienteId: 'paciente-1', profissionalId: 'profissional-1', titulo: 'Plano', criadoEm: '', atualizadoEm: '',
    ativoParaPaciente: true, ativacaoRevisao: 4,
    current: { id: 'versao-publicada', ativacaoRevisao: 4, ativoParaPaciente: true, objetivos: 'preservar', refeicoes: [],
      ativacaoRefeicoes: [{ refeicaoId: 'fisica-1', identidadeId: 'raiz-1', ativa: true }] },
    draft: { id: 'versao-rascunho', ativacaoRevisao: 4, ativoParaPaciente: true, objetivos: 'preservar rascunho', refeicoes: [],
      ativacaoEdicao: [{ chaveCliente: 'chave-1', identidadeId: 'raiz-1', ativa: true }] },
    historico: []
  } as unknown as import('../lib/plano-alimentar-api').PlanoAlimentarApi;
  const anterior = aplicarAckAtivacao(plano, { planoId: plano.id, ativoParaPaciente: false, ativacaoRevisao: 3 });
  assert.equal(anterior, plano);
  const atualizado = aplicarAckAtivacao(plano, {
    planoId: plano.id, ativoParaPaciente: true, ativacaoRevisao: 5, identidadeRefeicaoId: 'raiz-1', ativa: false
  });
  assert.equal(atualizado.draft?.objetivos, 'preservar rascunho');
  assert.equal(atualizado.current?.ativacaoRefeicoes?.[0].ativa, false);
  assert.equal(atualizado.draft?.ativacaoEdicao?.[0].ativa, false);
  assert.equal(atualizado.ativacaoRevisao, 5);
});

test('reconciliação operacional atrasada preserva o mapa da revisão editorial mais recente', () => {
  const plano = {
    id: 'plano-sintetico', ativacaoRevisao: 5, ativoParaPaciente: true,
    draft: { id: 'draft-sintetico', rascunhoRevisao: 8, ativacaoRevisao: 5,
      ativacaoEdicao: [{ chaveCliente: 'nova-chave', identidadeId: 'nova-raiz', ativa: true }],
      resumoRefeicoesAtivas: { estado: 'completo', energiaKcal: 200 } }
  } as unknown as import('../lib/plano-alimentar-api').PlanoAlimentarApi;
  const remoto = { ...plano, draft: { ...plano.draft!, rascunhoRevisao: 7,
    ativacaoEdicao: [{ chaveCliente: 'antiga-chave', identidadeId: 'antiga-raiz', ativa: false }],
    resumoRefeicoesAtivas: { estado: 'completo' as const, energiaKcal: 0 } } };
  const resultado = mesclarProjecaoAtivacao(plano, remoto);
  assert.deepEqual(resultado.draft?.ativacaoEdicao, plano.draft?.ativacaoEdicao);
  assert.deepEqual(resultado.draft?.resumoRefeicoesAtivas, plano.draft?.resumoRefeicoesAtivas);
  // Uma combinação contraditória não confirma vínculos de outro documento.
  const contraditorio = mesclarProjecaoAtivacao(plano, { ...remoto, ativacaoRevisao: 6,
    draft: { ...remoto.draft, ativacaoRevisao: 6 } });
  assert.equal(contraditorio.draft?.rascunhoRevisao, 8);
  assert.equal(contraditorio.draft?.ativacaoEdicao, undefined);
  assert.deepEqual(contraditorio.draft?.resumoRefeicoesAtivas, { estado: 'indisponivel' });
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

test('BFF encaminha paginacao da listagem somente pelos parametros conhecidos', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler']));
  const original = global.fetch;
  let url = '';
  global.fetch = (async (entrada: string | URL | Request) => {
    url = String(entrada);
    return Response.json({ itens: [], total: 0 });
  }) as typeof global.fetch;

  try {
    await listarPlanos(
      new Request('http://localhost/api/planos?pagina=3&limite=10&ordem=DROP%20TABLE'),
      { params: Promise.resolve({ id: 'paciente-1' }) }
    );
    assert.equal(
      url,
      'http://backend.octaclin.local/pacientes/paciente-1/planos-alimentares?pagina=3&limite=10'
    );
  } finally {
    restaurarFetch(original);
  }
});

test('BFF encaminha filtros multifonte da busca e descarta parametro desconhecido', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler']));
  const original = global.fetch;
  let url = '';
  global.fetch = (async (entrada: string | URL | Request) => {
    url = String(entrada);
    return Response.json({ itens: [], total: 0, fontes: [] });
  }) as typeof global.fetch;

  try {
    await buscarAlimentos(
      new Request(
        'http://localhost/api/alimentos?busca=arroz&pagina=2&limite=5&fonteCodigo=TBCA&versao=7.3&baseCodigo=BD-AIN&interno=1'
      ),
      { params: Promise.resolve({ id: 'paciente-1' }) }
    );
    assert.equal(
      url,
      'http://backend.octaclin.local/planos-alimentares/alimentos?busca=arroz&pagina=2&limite=5&fonteCodigo=TBCA&versao=7.3&baseCodigo=BD-AIN'
    );
  } finally {
    restaurarFetch(original);
  }
});

test('BFF encaminha versao historica com permissao de leitura e IDs codificados', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler']));
  const original = global.fetch;
  let url = '';
  global.fetch = (async (entrada: string | URL | Request) => {
    url = String(entrada);
    return Response.json({ numero: 0 });
  }) as typeof global.fetch;

  try {
    const resposta = await obterVersao(new Request('http://localhost/api/versao'), {
      params: Promise.resolve({ id: 'paciente/1', planoId: 'plano/1', numero: '2' })
    });
    assert.equal(resposta.status, 200);
    assert.equal(
      url,
      'http://backend.octaclin.local/pacientes/paciente%2F1/planos-alimentares/plano%2F1/versoes/2'
    );
  } finally {
    restaurarFetch(original);
  }
});

test('BFF recusa versao historica sem permissao de leitura antes do backend', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.gerenciar']));
  const original = global.fetch;
  let chamado = false;
  global.fetch = (async () => {
    chamado = true;
    throw new Error('nao deveria consultar o backend');
  }) as typeof global.fetch;

  try {
    const resposta = await obterVersao(new Request('http://localhost/api/versao'), {
      params: Promise.resolve({ id: 'paciente-1', planoId: 'plano-1', numero: '2' })
    });
    assert.equal(resposta.status, 403);
    assert.equal(chamado, false);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF encaminha acompanhamento da versao com allowlist, leitura e no-store', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler']));
  const original = global.fetch;
  let url = '';
  global.fetch = (async (entrada: string | URL | Request) => {
    url = String(entrada);
    return Response.json({ versao: { numero: 2 } });
  }) as typeof global.fetch;

  try {
    const resposta = await obterAcompanhamentoVersao(
      new Request('http://localhost/api/acompanhamento?paginaCheckins=2&paginaQuestionarios=3&paginaEscolhas=4&limite=10&tenantId=alheio'),
      { params: Promise.resolve({ id: 'paciente/1', planoId: 'plano/1', numero: '2' }) }
    );
    assert.equal(resposta.status, 200);
    assert.equal(resposta.headers.get('Cache-Control'), 'no-store');
    assert.equal(
      url,
      'http://backend.octaclin.local/pacientes/paciente%2F1/planos-alimentares/plano%2F1/versoes/2/acompanhamento?paginaCheckins=2&paginaQuestionarios=3&paginaEscolhas=4&limite=10'
    );
  } finally {
    restaurarFetch(original);
  }
});

test('BFF recusa acompanhamento da versao sem permissao antes do backend', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.gerenciar']));
  const original = global.fetch;
  let chamado = false;
  global.fetch = (async () => {
    chamado = true;
    throw new Error('nao deveria consultar o backend');
  }) as typeof global.fetch;

  try {
    const resposta = await obterAcompanhamentoVersao(new Request('http://localhost/api/acompanhamento'), {
      params: Promise.resolve({ id: 'paciente-1', planoId: 'plano-1', numero: '2' })
    });
    assert.equal(resposta.status, 403);
    assert.equal(chamado, false);
  } finally {
    restaurarFetch(original);
  }
});

test('cliente web consulta acompanhamento sem cache e com paginacao explicita', async () => {
  const original = global.fetch;
  let entrada = '';
  let init: RequestInit | undefined;
  global.fetch = (async (recurso: string | URL | Request, opcoes?: RequestInit) => {
    entrada = String(recurso);
    init = opcoes;
    return Response.json({ versao: { numero: 3 } });
  }) as typeof global.fetch;

  try {
    await obterAcompanhamentoVersaoPlanoAlimentar('paciente/1', 'plano/1', 3, {
      paginaCheckins: 2,
      paginaQuestionarios: 3,
      paginaEscolhas: 4,
      limite: 10
    });
    assert.equal(
      entrada,
      '/api/pacientes/paciente%2F1/planos-alimentares/plano%2F1/versoes/3/acompanhamento?paginaCheckins=2&paginaQuestionarios=3&paginaEscolhas=4&limite=10'
    );
    assert.equal(init?.cache, 'no-store');
  } finally {
    restaurarFetch(original);
  }
});

test('BFF encaminha listagem de modelos so com os parametros da allowlist', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler']));
  const original = global.fetch;
  let url = '';
  global.fetch = (async (entrada: string | URL | Request) => {
    url = String(entrada);
    return Response.json({ itens: [], total: 0, pagina: 1, limite: 25 });
  }) as typeof global.fetch;

  try {
    await listarModelos(
      new Request('http://localhost/api/planos-alimentares/modelos?pagina=2&limite=10&origem=clinica&profissionalId=alheio')
    );
    // `profissionalId` e descartado: deixar o cliente escolher de quem sao os
    // modelos pessoais listados seria contornar o escopo do backend.
    assert.equal(
      url,
      'http://backend.octaclin.local/planos-alimentares/modelos?pagina=2&limite=10&origem=clinica'
    );
  } finally {
    restaurarFetch(original);
  }
});

test('BFF exige permissao de gerenciar para criar modelo', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler']));
  const original = global.fetch;
  let chamou = false;
  global.fetch = (async () => {
    chamou = true;
    return Response.json({});
  }) as typeof global.fetch;

  try {
    const resposta = await criarModelo(
      new Request('http://localhost/api/planos-alimentares/modelos', { method: 'POST', body: '{}' })
    );
    assert.equal(resposta.status, 403);
    assert.equal(chamou, false);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF codifica o id do modelo ao obter e ao arquivar', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler', 'planos_alimentares.gerenciar']));
  const original = global.fetch;
  const urls: string[] = [];
  const metodos: string[] = [];
  global.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
    urls.push(String(entrada));
    metodos.push(init?.method ?? 'GET');
    return Response.json({});
  }) as typeof global.fetch;

  try {
    await obterModelo(new Request('http://localhost'), { params: Promise.resolve({ modeloId: 'modelo/1' }) });
    await arquivarModelo(new Request('http://localhost'), { params: Promise.resolve({ modeloId: 'modelo/1' }) });
    assert.equal(urls[0], 'http://backend.octaclin.local/planos-alimentares/modelos/modelo%2F1');
    assert.equal(urls[1], 'http://backend.octaclin.local/planos-alimentares/modelos/modelo%2F1');
    assert.equal(metodos[1], 'DELETE');
  } finally {
    restaurarFetch(original);
  }
});

test('BFF recusa arquivar modelo sem permissao de gerenciar', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler']));
  const original = global.fetch;
  let chamou = false;
  global.fetch = (async () => {
    chamou = true;
    return Response.json({});
  }) as typeof global.fetch;

  try {
    const resposta = await arquivarModelo(new Request('http://localhost'), {
      params: Promise.resolve({ modeloId: 'modelo-1' })
    });
    assert.equal(resposta.status, 403);
    assert.equal(chamou, false);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF permite buscar catálogo para modelos sem aceitar parâmetros de escopo do cliente', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler']));
  const original = global.fetch;
  let url = '';
  global.fetch = (async (entrada: string | URL | Request) => {
    url = String(entrada);
    return Response.json({ itens: [], total: 0, pagina: 1, limite: 10 });
  }) as typeof global.fetch;
  try {
    const resposta = await buscarAlimentosModelo(new Request(
      'http://localhost/api/planos-alimentares/alimentos?busca=aveia&pagina=2&limite=10&tenantId=outro'
    ));
    assert.equal(resposta.status, 200);
    assert.equal(url, 'http://backend.octaclin.local/planos-alimentares/alimentos?busca=aveia&pagina=2&limite=10');
  } finally {
    restaurarFetch(original);
  }
});

test('BFF encaminha edição e restauração com permissão de gerenciar e corpo intacto', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler', 'planos_alimentares.gerenciar']));
  const original = global.fetch;
  const chamadas: Array<{ url: string; metodo: string; corpo?: string }> = [];
  global.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(entrada), metodo: init?.method ?? 'GET', corpo: init?.body?.toString() });
    return Response.json({ versaoAtual: 2 });
  }) as typeof global.fetch;
  const parametros = { params: Promise.resolve({ modeloId: 'modelo/1', numero: '1' }) };
  try {
    const corpoEdicao = JSON.stringify({ versaoEsperada: 1, nome: 'Cópia revisada', refeicoes: [] });
    const corpoRestauracao = JSON.stringify({ versaoEsperada: 1 });
    const respostas = await Promise.all([
      editarModelo(new Request('http://localhost/modelo', { method: 'PUT', body: corpoEdicao }), parametros),
      restaurarVersaoModelo(new Request('http://localhost/restaurar', { method: 'POST', body: corpoRestauracao }), parametros)
    ]);
    assert.deepEqual(respostas.map((resposta) => resposta.status), [200, 200]);
    assert.deepEqual(chamadas, [
      { url: 'http://backend.octaclin.local/planos-alimentares/modelos/modelo%2F1', metodo: 'PUT', corpo: corpoEdicao },
      { url: 'http://backend.octaclin.local/planos-alimentares/modelos/modelo%2F1/versoes/1/restaurar', metodo: 'POST', corpo: corpoRestauracao }
    ]);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF protege leitura paginada e snapshot sob demanda com permissão de ler', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler']));
  const original = global.fetch;
  const urls: string[] = [];
  global.fetch = (async (entrada: string | URL | Request) => {
    urls.push(String(entrada));
    return Response.json({ itens: [], total: 0 });
  }) as typeof global.fetch;
  const parametros = { params: Promise.resolve({ modeloId: 'modelo/1', numero: '2' }) };
  try {
    await listarVersoesModelo(new Request('http://localhost/versoes?pagina=2&limite=10&tenantId=alheio'), parametros);
    await obterVersaoModelo(new Request('http://localhost/versao'), parametros);
    assert.deepEqual(urls, [
      'http://backend.octaclin.local/planos-alimentares/modelos/modelo%2F1/versoes?pagina=2&limite=10',
      'http://backend.octaclin.local/planos-alimentares/modelos/modelo%2F1/versoes/2'
    ]);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF encaminha receitas com allowlist e descarta filtros de escopo', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler']));
  const original = global.fetch;
  let url = '';
  global.fetch = (async (entrada: string | URL | Request) => {
    url = String(entrada);
    return Response.json({ itens: [], total: 0, pagina: 1, limite: 25 });
  }) as typeof global.fetch;

  try {
    await listarReceitas(new Request('http://localhost/api/receitas?pagina=2&limite=10&origem=clinica&tipo=receita&profissionalId=alheio'));
    assert.equal(
      url,
      'http://backend.octaclin.local/planos-alimentares/receitas?pagina=2&limite=10&origem=clinica&tipo=receita'
    );
  } finally {
    restaurarFetch(original);
  }
});

test('BFF exige gerenciar para criar, editar e arquivar receitas', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler']));
  const original = global.fetch;
  let chamadas = 0;
  global.fetch = (async () => {
    chamadas += 1;
    return Response.json({});
  }) as typeof global.fetch;
  const params = { params: Promise.resolve({ receitaId: 'receita-1' }) };

  try {
    const respostas = await Promise.all([
      criarReceita(new Request('http://localhost/api/receitas', { method: 'POST', body: '{}' })),
      atualizarReceita(new Request('http://localhost/api/receitas', { method: 'PUT', body: '{}' }), params),
      arquivarReceita(new Request('http://localhost/api/receitas', { method: 'DELETE' }), params)
    ]);
    assert.deepEqual(respostas.map((resposta) => resposta.status), [403, 403, 403]);
    assert.equal(chamadas, 0);
  } finally {
    restaurarFetch(original);
  }
});

test('BFF codifica ID de receita e preserva corpo da atualizacao', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.ler', 'planos_alimentares.gerenciar']));
  const original = global.fetch;
  const chamadas: Array<{ url: string; metodo: string; corpo?: string }> = [];
  global.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(entrada), metodo: init?.method ?? 'GET', corpo: init?.body?.toString() });
    return Response.json({});
  }) as typeof global.fetch;
  const params = { params: Promise.resolve({ receitaId: 'receita/1' }) };

  try {
    const corpo = JSON.stringify({ nome: 'Cafe' });
    await obterReceita(new Request('http://localhost/api/receitas'), params);
    await atualizarReceita(new Request('http://localhost/api/receitas', { method: 'PUT', body: corpo }), params);
    assert.deepEqual(chamadas, [
      { url: 'http://backend.octaclin.local/planos-alimentares/receitas/receita%2F1', metodo: 'GET', corpo: undefined },
      { url: 'http://backend.octaclin.local/planos-alimentares/receitas/receita%2F1', metodo: 'PUT', corpo }
    ]);
  } finally {
    restaurarFetch(original);
  }
});

test('PA05 BFF de prévia paciente exige sessão/permissão e não encaminha escopo do cliente', async () => {
  const original = global.fetch;
  let chamado = 0;
  global.fetch = (async (url: string | URL | Request) => {
    chamado++;
    assert.equal(String(url), 'http://backend.octaclin.local/pacientes/paciente%2F1/planos-alimentares/plano%2F1/versoes/2/apresentacao-paciente');
    return new Response(JSON.stringify({ status: 'rascunho', refeicoes: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof global.fetch;
  const props = { params: Promise.resolve({ id: 'paciente/1', planoId: 'plano/1', numero: '2' }) };
  try {
    __clearCookies();
    assert.equal((await obterApresentacaoPaciente(new Request('http://localhost/preview'), props)).status, 401);
    __setCookies(cookiesSessaoValida(['pacientes.ler']));
    assert.equal((await obterApresentacaoPaciente(new Request('http://localhost/preview'), props)).status, 403);
    assert.equal(chamado, 0);
    __setCookies(cookiesSessaoValida(['planos_alimentares.ler']));
    const resposta = await obterApresentacaoPaciente(new Request('http://localhost/preview?tenantId=alheio&versaoId=alheia'), props);
    assert.equal(resposta.status, 200);
    assert.equal(resposta.headers.get('Cache-Control'), 'no-store');
    assert.equal(chamado, 1);
  } finally { restaurarFetch(original); __clearCookies(); }
});

test('PA06 revisão e publicação preservam precondição e conflito sem retry', async () => {
  __setCookies(cookiesSessaoValida(['planos_alimentares.gerenciar']));
  const original = global.fetch;
  const chamadas: string[] = [];
  const corpo = JSON.stringify({ rascunhoIdEsperado: 'geracao-sintetica', rascunhoRevisaoEsperada: 7 });
  global.fetch = (async (_entrada: unknown, init?: RequestInit) => {
    chamadas.push(String(init?.body));
    return Response.json({ message: 'Conflito de edição' }, { status: 409 });
  }) as typeof global.fetch;
  try {
    for (const rota of [revisarPlano, publicarPlano]) {
      const resposta = await rota(new Request('http://localhost/api/transicao', { method: 'POST', body: corpo }), { params: Promise.resolve({ id: 'p', planoId: 'pl' }) });
      assert.equal(resposta.status, 409);
      assert.equal(resposta.headers.get('Cache-Control'), 'no-store');
    }
    assert.deepEqual(chamadas, [corpo, corpo]);
  } finally { restaurarFetch(original); }
});

test('PA06 edição exige gerenciar, preserva escopo, documento, status e no-store', async () => {
  const { PUT } = await import('../app/api/pacientes/[id]/planos-alimentares/[planoId]/rascunho/edicao/route');
  const original = global.fetch;
  const corpo = JSON.stringify({ rascunhoIdEsperado: 'g', rascunhoRevisaoEsperada: 1, documento: { schemaVersao: 1, refeicoes: [] } });
  const chamadas: string[] = [];
  global.fetch = (async (url: unknown, init?: RequestInit) => {
    chamadas.push(String(url)); assert.equal(init?.method, 'PUT'); assert.equal(init?.body, corpo);
    return Response.json({ message: 'Conflito sintético' }, { status: 409 });
  }) as typeof global.fetch;
  const params = { params: Promise.resolve({ id: 'paciente/1', planoId: 'plano/1' }) };
  const request = () => new Request('http://localhost/api/edicao', { method: 'PUT', body: corpo });
  try {
    __clearCookies(); assert.equal((await PUT(request(), params)).status, 401);
    __setCookies(cookiesSessaoValida(['planos_alimentares.ler'])); assert.equal((await PUT(request(), params)).status, 403);
    assert.equal(chamadas.length, 0);
    __setCookies(cookiesSessaoValida(['planos_alimentares.gerenciar']));
    const resposta = await PUT(request(), params);
    assert.equal(resposta.status, 409); assert.equal(resposta.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(chamadas, ['http://backend.octaclin.local/pacientes/paciente%2F1/planos-alimentares/plano%2F1/rascunho/edicao']);
  } finally { restaurarFetch(original); }
});

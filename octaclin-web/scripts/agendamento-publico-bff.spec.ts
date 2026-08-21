import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { NextRequest } from 'next/server';
import { GET as obterAgendaPublica } from '../app/api/agendamentos-publicos/[token]/route';
import { POST as criarSolicitacaoPublica } from '../app/api/agendamentos-publicos/[token]/solicitacoes/route';
import { PATCH as salvarRascunhoFormularioPublico } from '../app/api/formularios/[token]/rascunho/route';
import { GET as obterLinkInterno } from '../app/api/agenda/agendamento-publico/route';
import { POST as rotacionarLinkInterno } from '../app/api/agenda/agendamento-publico/rotacionar/route';
import { GET as listarSolicitacoesInternas } from '../app/api/agenda/solicitacoes/route';
import { POST as reprocessarIntegracoesConsulta } from '../app/api/agenda/consultas/[consultaId]/integracoes/reprocessar/route';
import { obterOrigemPublicaAgenda } from '../lib/server/agendamento-publico-bff';

const { __clearCookies, __getCookies, __setCookies } = nextHeaders as typeof nextHeaders & {
  __clearCookies: () => void;
  __getCookies: () => Record<string, string>;
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

test('BFF publico nao encaminha Cookie ou Authorization ao backend', async () => {
  __clearCookies();
  const fetchOriginal = global.fetch;
  let captura: { url: string; headers: Headers; body: string } | null = null;

  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    captura = {
      url: String(url),
      headers: new Headers(init?.headers),
      body: String(init?.body ?? '')
    };

    return new Response(JSON.stringify({ status: 'pendente' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  }) as typeof global.fetch;

  try {
    const requisicao = new Request('http://localhost:3000/api/agendamentos-publicos/token-publico/solicitacoes', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer segredo-do-cliente',
        Cookie: 'octaclin_access_token=segredo',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nome: 'Ana Silva', email: 'ana@exemplo.com' })
    });

    const resposta = await criarSolicitacaoPublica(requisicao, {
      params: Promise.resolve({ token: 'token-publico' })
    });

    assert.equal(resposta.status, 201);
    if (!captura) {
      throw new Error('A requisicao ao backend nao foi capturada.');
    }
    const capturaAtual = captura as {
      url: string;
      headers: Headers;
      body: string;
    };
    assert.match(capturaAtual.url, /\/agendamentos-publicos\/token-publico\/solicitacoes$/);
    assert.equal(capturaAtual.headers.get('accept'), 'application/json');
    assert.equal(capturaAtual.headers.get('content-type'), 'application/json');
    assert.equal(capturaAtual.headers.get('authorization'), null);
    assert.equal(capturaAtual.headers.get('cookie'), null);
    assert.equal(capturaAtual.body, JSON.stringify({ nome: 'Ana Silva', email: 'ana@exemplo.com' }));
  } finally {
    restaurarFetch(fetchOriginal);
  }
});

test('BFF interno rejeita requisicao sem sessao antes de consultar o backend', async () => {
  __clearCookies();
  const fetchOriginal = global.fetch;
  let backendChamado = false;

  global.fetch = (async () => {
    backendChamado = true;
    throw new Error('nao deveria consultar o backend sem sessao');
  }) as typeof global.fetch;

  try {
    const resposta = await listarSolicitacoesInternas(new NextRequest('http://localhost:3000/api/agenda/solicitacoes'));
    const corpo = (await resposta.json()) as { mensagem: string };

    assert.equal(resposta.status, 401);
    assert.equal(corpo.mensagem, 'Sessao ausente ou expirada.');
    assert.equal(backendChamado, false);
  } finally {
    restaurarFetch(fetchOriginal);
  }
});

test('BFF de reprocessamento exige permissao e encaminha somente o ID codificado', async () => {
  const fetchOriginal = global.fetch;
  let backendChamado = false;
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    backendChamado = true;
    assert.equal(
      String(url),
      'http://backend.octaclin.local/agenda/consultas/consulta%2Fsegura/integracoes/reprocessar'
    );
    assert.equal(init?.method, 'POST');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer access-token-valido');
    return new Response(JSON.stringify({ id: 'consulta/segura', notificacoes: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }) as typeof global.fetch;

  try {
    __setCookies(cookiesSessaoValida(['agenda.consultas.ler']));
    const proibida = await reprocessarIntegracoesConsulta(
      new Request('http://localhost:3000/api/agenda/consultas/consulta%2Fsegura/integracoes/reprocessar', {
        method: 'POST'
      }),
      { params: Promise.resolve({ consultaId: 'consulta/segura' }) }
    );
    assert.equal(proibida.status, 403);
    assert.equal(backendChamado, false);

    __setCookies(cookiesSessaoValida(['agenda.consultas.criar']));
    const permitida = await reprocessarIntegracoesConsulta(
      new Request('http://localhost:3000/api/agenda/consultas/consulta%2Fsegura/integracoes/reprocessar', {
        method: 'POST'
      }),
      { params: Promise.resolve({ consultaId: 'consulta/segura' }) }
    );
    assert.equal(permitida.status, 200);
    assert.equal(backendChamado, true);
  } finally {
    restaurarFetch(fetchOriginal);
    __clearCookies();
  }
});

test('BFF interno expõe estado explicito quando o token atual nao pode ser reconstituido', async () => {
  __setCookies(cookiesSessaoValida(['agenda.consultas.ler']));
  const fetchOriginal = global.fetch;

  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), 'http://backend.octaclin.local/agenda/agendamento-publico');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer access-token-valido');

    return new Response(
      JSON.stringify([
        {
          id: 'link-1',
          profissionalId: 'profissional-1',
          duracaoMinutos: 50,
          ativo: true,
          criadoEm: '2026-07-26T12:00:00.000Z',
          atualizadoEm: '2026-07-27T09:00:00.000Z'
        }
      ]),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }) as typeof global.fetch;

  try {
    const resposta = await obterLinkInterno(new NextRequest('http://localhost:3000/api/agenda/agendamento-publico'));
    const corpo = (await resposta.json()) as {
      urlPublica: string | null;
      urlPublicaDisponivel?: boolean;
      requerRotacaoConfirmada?: boolean;
      mensagemUrlPublica?: string;
    };

    assert.equal(resposta.status, 200);
    assert.equal(corpo.urlPublica, null);
    assert.equal(corpo.urlPublicaDisponivel, false);
    assert.equal(corpo.requerRotacaoConfirmada, true);
    assert.match(corpo.mensagemUrlPublica ?? '', /token bruto não é persistido/i);
  } finally {
    restaurarFetch(fetchOriginal);
    __clearCookies();
  }
});

test('rotacao confirmada devolve nova URL publica sem persistir token bruto em cookie', async () => {
  __setCookies(cookiesSessaoValida(['agenda.consultas.criar']));
  const fetchOriginal = global.fetch;

  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), 'http://backend.octaclin.local/agenda/agendamento-publico/rotacionar');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer access-token-valido');

    return new Response(
      JSON.stringify({
        id: 'link-1',
        profissionalId: 'profissional-1',
        duracaoMinutos: 50,
        ativo: true,
        criadoEm: '2026-07-26T12:00:00.000Z',
        atualizadoEm: '2026-07-27T09:15:00.000Z',
        token: 'token-rotacionado'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }) as typeof global.fetch;

  try {
    const resposta = await rotacionarLinkInterno(
      new NextRequest('http://localhost:3000/api/agenda/agendamento-publico/rotacionar', { method: 'POST' })
    );
    const corpo = (await resposta.json()) as {
      urlPublica: string;
      urlPublicaDisponivel?: boolean;
    };

    assert.equal(resposta.status, 200);
    assert.equal(corpo.urlPublica, 'http://localhost:3000/agendar/token-rotacionado');
    assert.equal(corpo.urlPublicaDisponivel, true);
    assert.equal(__getCookies().octaclin_agendamento_publico_token, undefined);
    assert.equal(__getCookies().octaclin_agendamento_publico_link_id, undefined);
  } finally {
    restaurarFetch(fetchOriginal);
    __clearCookies();
  }
});

test('URL publica configurada prevalece sobre a origem interna do proxy', () => {
  const valorAnterior = process.env.OCTACLIN_WEB_URL;
  process.env.OCTACLIN_WEB_URL = 'https://octaclin-web-producao.onrender.com/';

  try {
    assert.equal(obterOrigemPublicaAgenda('http://localhost:3000'), 'https://octaclin-web-producao.onrender.com');
  } finally {
    if (valorAnterior === undefined) Reflect.deleteProperty(process.env, 'OCTACLIN_WEB_URL');
    else process.env.OCTACLIN_WEB_URL = valorAnterior;
  }
});

test('BFF de rascunho publico nao encaminha Cookie ou Authorization ao backend', async () => {
  __clearCookies();
  const fetchOriginal = global.fetch;
  let headersBackend: Headers | null = null;

  global.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    headersBackend = new Headers(init?.headers);
    return new Response(JSON.stringify({ rascunhoVersao: 1, rascunhoAtualizadoEm: '2026-08-01T12:00:00.000Z' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }) as typeof global.fetch;

  try {
    const requisicao = new Request('http://localhost:3000/api/formularios/token-publico/rascunho', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer segredo',
        Cookie: 'octaclin_access_token=segredo',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ versaoBase: 0, respostas: [] })
    });
    const resposta = await salvarRascunhoFormularioPublico(requisicao, {
      params: Promise.resolve({ token: 'token-publico' })
    });

    assert.equal(resposta.status, 200);
    const headersAtuais = headersBackend as unknown as Headers;
    assert.equal(headersAtuais.get('authorization'), null);
    assert.equal(headersAtuais.get('cookie'), null);
    assert.equal(headersAtuais.get('content-type'), 'application/json');
  } finally {
    restaurarFetch(fetchOriginal);
  }
});

test('URL externa fornecida pelo Render substitui a origem interna quando nao ha configuracao explicita', () => {
  const valorAnterior = process.env.RENDER_EXTERNAL_URL;
  const origemAnterior = process.env.OCTACLIN_WEB_URL;
  Reflect.deleteProperty(process.env, 'OCTACLIN_WEB_URL');
  process.env.RENDER_EXTERNAL_URL = 'https://octaclin-web-producao.onrender.com';

  try {
    assert.equal(obterOrigemPublicaAgenda('http://localhost:10000'), 'https://octaclin-web-producao.onrender.com');
  } finally {
    if (origemAnterior === undefined) Reflect.deleteProperty(process.env, 'OCTACLIN_WEB_URL');
    else process.env.OCTACLIN_WEB_URL = origemAnterior;
    if (valorAnterior === undefined) Reflect.deleteProperty(process.env, 'RENDER_EXTERNAL_URL');
    else process.env.RENDER_EXTERNAL_URL = valorAnterior;
  }
});

test('BFF publico de leitura agrupa horarios livres sem vazar metadados internos', async () => {
  __clearCookies();
  const fetchOriginal = global.fetch;

  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        profissionalNome: 'Dra. Carla',
        clinica: { nome: 'Clinica Bem Estar', corPrimaria: '#0ea5e9' },
        timezone: 'America/Sao_Paulo',
        duracaoMinutos: 50,
        horariosLivres: ['2026-08-03T13:00:00.000Z', '2026-08-03T14:00:00.000Z']
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )) as typeof global.fetch;

  try {
    const resposta = await obterAgendaPublica(new Request('http://localhost:3000/api/agendamentos-publicos/token-publico'), {
      params: Promise.resolve({ token: 'token-publico' })
    });
    const corpo = (await resposta.json()) as {
      clinica: { nome: string; corPrimaria: string };
      dias: Array<{ horarios: Array<{ inicioEm: string; rotulo: string }> }>;
    };

    assert.equal(resposta.status, 200);
    assert.equal(corpo.dias.length, 1);
    assert.equal(corpo.dias[0]?.horarios.length, 2);
    assert.deepEqual(corpo.clinica, { nome: 'Clinica Bem Estar', corPrimaria: '#0ea5e9' });
  } finally {
    restaurarFetch(fetchOriginal);
  }
});

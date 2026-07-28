import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { NextRequest } from 'next/server';
import { GET as obterResumo } from '../app/api/dashboard/clinico/route';
import { POST as registrarDesfechoDashboard } from '../app/api/dashboard/clinico/consultas/[consultaId]/desfecho/route';
import { PATCH as concluirTarefaDashboard } from '../app/api/dashboard/clinico/pacientes/[pacienteId]/tarefas/[tarefaId]/concluir/route';
import { POST as revisarEnvioDashboard } from '../app/api/dashboard/clinico/questionarios/envios/[envioId]/revisar/route';
import { POST as ocultarAlertaDashboard } from '../app/api/dashboard/clinico/alertas/[alertaId]/ocultar/route';
import { POST as registrarDesfechoAgenda } from '../app/api/agenda/consultas/[consultaId]/desfecho/route';
import { PATCH as atualizarTarefaPaciente } from '../app/api/pacientes/[id]/tarefas-acompanhamento/[tarefaId]/route';
import { POST as revisarEnvioQuestionarios } from '../app/api/questionarios/envios/[envioId]/revisar/route';

const { __clearCookies, __setCookies } = nextHeaders as typeof nextHeaders & { __clearCookies: () => void; __setCookies: (cookies: Record<string, string>) => void };

function cookiesSessao(papel: string, permissoes: string[]) {
  return {
    octaclin_access_token: 'access-token-valido', octaclin_refresh_token: 'refresh-token-valido',
    octaclin_api_url: encodeURIComponent('http://backend.octaclin.local'), octaclin_tenant_slug: encodeURIComponent('clinica-carla'),
    octaclin_email: encodeURIComponent('usuario@octaclin.local'), octaclin_access_expira_em: '2030-07-27T15:00:00.000Z',
    octaclin_papel: encodeURIComponent(papel), octaclin_permissoes: encodeURIComponent(JSON.stringify(permissoes))
  };
}

function restaurarFetch(original: typeof global.fetch | undefined) { if (original) global.fetch = original; else Reflect.deleteProperty(globalThis, 'fetch'); }

test('BFF clinico recusa sessao ausente e colaborador antes do backend', async () => {
  const original = global.fetch; let chamadas = 0;
  global.fetch = (async () => { chamadas += 1; throw new Error('nao deve chamar'); }) as typeof global.fetch;
  try {
    __clearCookies();
    assert.equal((await obterResumo(new NextRequest('http://localhost/api/dashboard/clinico'))).status, 401);
    __setCookies(cookiesSessao('Collaborator', ['dashboard.ler']));
    assert.equal((await obterResumo(new NextRequest('http://localhost/api/dashboard/clinico'))).status, 403);
    assert.equal(chamadas, 0);
  } finally { restaurarFetch(original); }
});

test('BFF clinico fixa escopo do Professional e permite contexto apenas ao SuperAdmin', async () => {
  const original = global.fetch; const urls: string[] = [];
  global.fetch = (async (url: string | URL | Request) => { urls.push(String(url)); return new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } }); }) as typeof global.fetch;
  try {
    __setCookies(cookiesSessao('Professional', ['dashboard.ler']));
    assert.equal((await obterResumo(new NextRequest('http://localhost/api/dashboard/clinico?periodo=hoje&profissionalId=profissional-2'))).status, 200);
    assert.match(urls[0], /periodo=hoje/); assert.doesNotMatch(urls[0], /profissionalId=/);
    __setCookies(cookiesSessao('SuperAdmin', ['dashboard.ler']));
    assert.equal((await obterResumo(new NextRequest('http://localhost/api/dashboard/clinico?periodo=sete_dias&profissionalId=profissional-2'))).status, 200);
    assert.match(urls[1], /profissionalId=profissional-2/);
  } finally { restaurarFetch(original); }
});

test('BFFs de acao clinica exigem papel clinico e usam endpoints backend dedicados sem encaminhar origem', async () => {
  const original = global.fetch;
  const chamadas: { url: string; headers: Headers; body?: BodyInit | null }[] = [];
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), headers: new Headers(init?.headers), body: init?.body });
    return new Response(JSON.stringify({ id: 'recurso-1', status: 'concluida' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }) as typeof global.fetch;

  try {
    __setCookies(cookiesSessao('Collaborator', ['agenda.consultas.criar', 'pacientes.gerenciar', 'questionarios.gerenciar']));
    assert.equal((await registrarDesfechoDashboard(
      new NextRequest('http://localhost/api/dashboard/clinico/consultas/consulta-1/desfecho', {
        method: 'POST',
        headers: { 'x-octaclin-origem': 'origem_forjada' },
        body: JSON.stringify({ status: 'concluida' })
      }),
      { params: Promise.resolve({ consultaId: 'consulta-1' }) }
    )).status, 403);
    assert.equal(chamadas.length, 0);

    __setCookies(cookiesSessao('Professional', ['agenda.consultas.criar', 'pacientes.gerenciar', 'questionarios.gerenciar']));
    await registrarDesfechoDashboard(
      new NextRequest('http://localhost/api/dashboard/clinico/consultas/consulta-1/desfecho', {
        method: 'POST',
        headers: { 'x-octaclin-origem': 'origem_forjada' },
        body: JSON.stringify({ status: 'falta' })
      }),
      { params: Promise.resolve({ consultaId: 'consulta-1' }) }
    );
    await concluirTarefaDashboard(
      new NextRequest('http://localhost/api/dashboard/clinico/pacientes/paciente-1/tarefas/tarefa-1/concluir', {
        method: 'PATCH',
        headers: { 'x-octaclin-origem': 'origem_forjada' }
      }),
      { params: Promise.resolve({ pacienteId: 'paciente-1', tarefaId: 'tarefa-1' }) }
    );
    await revisarEnvioDashboard(
      new Request('http://localhost/api/dashboard/clinico/questionarios/envios/envio-1/revisar', {
        method: 'POST',
        headers: { 'x-octaclin-origem': 'origem_forjada' }
      }),
      { params: Promise.resolve({ envioId: 'envio-1' }) }
    );

    assert.deepEqual(
      chamadas.map((chamada) => ({
        caminho: new URL(chamada.url).pathname,
        origem: chamada.headers.get('x-octaclin-origem'),
        corpo: chamada.body
      })),
      [
        {
          caminho: '/agenda/dashboard/consultas/consulta-1/desfecho',
          origem: null,
          corpo: JSON.stringify({ status: 'falta' })
        },
        {
          caminho: '/pacientes/dashboard/paciente-1/tarefas-acompanhamento/tarefa-1',
          origem: null,
          corpo: JSON.stringify({ status: 'concluida' })
        },
        {
          caminho: '/questionarios/dashboard/envios/envio-1/revisar',
          origem: null,
          corpo: undefined
        }
      ]
    );
  } finally {
    restaurarFetch(original);
  }
});

test('BFFs genericos nao encaminham origem fornecida pelo navegador', async () => {
  const original = global.fetch;
  const origens: Array<string | null> = [];
  global.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    origens.push(new Headers(init?.headers).get('x-octaclin-origem'));
    return new Response(JSON.stringify({ id: 'recurso-1', status: 'respondido' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }) as typeof global.fetch;

  try {
    __setCookies(cookiesSessao('Collaborator', ['agenda.consultas.criar', 'pacientes.gerenciar', 'questionarios.gerenciar']));
    await registrarDesfechoAgenda(
      new NextRequest('http://localhost/api/agenda/consultas/consulta-1/desfecho', {
        method: 'POST',
        headers: { 'x-octaclin-origem': 'dashboard_clinico' },
        body: JSON.stringify({ status: 'concluida' })
      }),
      { params: Promise.resolve({ consultaId: 'consulta-1' }) }
    );
    await atualizarTarefaPaciente(
      new NextRequest('http://localhost/api/pacientes/paciente-1/tarefas-acompanhamento/tarefa-1', {
        method: 'PATCH',
        headers: { 'x-octaclin-origem': 'dashboard_clinico' },
        body: JSON.stringify({ status: 'concluida' })
      }),
      { params: Promise.resolve({ id: 'paciente-1', tarefaId: 'tarefa-1' }) }
    );
    await revisarEnvioQuestionarios(
      new Request('http://localhost/api/questionarios/envios/envio-1/revisar', {
        method: 'POST',
        headers: { 'x-octaclin-origem': 'dashboard_clinico' }
      }),
      { params: Promise.resolve({ envioId: 'envio-1' }) }
    );

    assert.deepEqual(origens, [null, null, null]);
  } finally {
    restaurarFetch(original);
  }
});

test('ocultacao de alerta permanece no fluxo proprio do dashboard e nao encaminha origem', async () => {
  const original = global.fetch;
  let chamada: { caminho: string; origem: string | null } | undefined;
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    chamada = {
      caminho: new URL(String(url)).pathname,
      origem: new Headers(init?.headers).get('x-octaclin-origem')
    };
    return new Response(JSON.stringify({ alertaId: 'alerta-1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }) as typeof global.fetch;

  try {
    __setCookies(cookiesSessao('Professional', ['dashboard.ler']));
    const resposta = await ocultarAlertaDashboard(
      new Request('http://localhost/api/dashboard/clinico/alertas/alerta-1/ocultar', {
        method: 'POST',
        headers: { 'x-octaclin-origem': 'origem_forjada' }
      }),
      { params: Promise.resolve({ alertaId: 'alerta-1' }) }
    );

    assert.equal(resposta.status, 200);
    assert.deepEqual(chamada, {
      caminho: '/dashboard/clinico/alertas/alerta-1/ocultar',
      origem: null
    });
  } finally {
    restaurarFetch(original);
  }
});

import { expect, test } from '@playwright/test';

const usuarioProfissional = {
  autenticado: true,
  apiUrl: 'http://localhost:3001',
  tenantSlug: 'clinica-carla',
  email: 'dra.carla@octaclin.local',
  expiraEm: '2026-07-23T15:00:00.000Z',
  papel: 'Professional',
  permissoes: [
    'dashboard.ler',
    'agenda.consultas.ler',
    'agenda.consultas.criar',
    'pacientes.listar',
    'pacientes.ler',
    'pacientes.gerenciar',
    'questionarios.ler',
    'comunicacoes.mensagens.ler'
  ],
  destinoInicial: '/dashboard'
};

const profissional = {
  id: 'profissional-1',
  tenantId: 'tenant-1',
  nome: 'Dra. Carla',
  email: 'dra.carla@octaclin.local',
  especialidade: 'Nutrologia',
  criadoEm: '2026-07-20T10:00:00.000Z'
};

function respostaPaginada(itens) {
  return { itens, total: itens.length };
}

async function criarSessao(page, papel, destinoInicial) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: papel, domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent(destinoInicial), domain: 'localhost', path: '/' }
  ]);
}

async function prepararCliente(page) {
  let conviteCriado = null;

  await criarSessao(page, 'Client', '/cliente');
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        autenticado: true,
        apiUrl: 'http://localhost:3001',
        tenantSlug: 'clinica-carla',
        email: 'gestor@octaclin.local',
        expiraEm: '2026-07-23T15:00:00.000Z',
        papel: 'Client',
        permissoes: [
          'cliente.portal.ler',
          'cliente.usuarios.ler',
          'cliente.usuarios.convidar',
          'cliente.convites.gerenciar',
          'cliente.configuracoes.gerenciar',
          'cliente.assinatura.gerenciar'
        ],
        destinoInicial: '/cliente'
      })
    });
  });

  await page.route('**/api/cliente/resumo', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conta: {
          tenantId: 'tenant-1',
          nome: 'Clinica Octa Real',
          slug: 'clinica-carla',
          status: 'ativo',
          criadoEm: '2026-07-01T10:00:00.000Z',
          atualizadoEm: '2026-07-20T10:00:00.000Z'
        },
        assinatura: {
          plano: 'Profissional',
          planoId: 'profissional',
          status: 'ativa',
          origem: 'manual_admin',
          renovacaoEm: '2026-08-22T00:00:00.000Z',
          limites: {
            usuariosAdministrativos: 3,
            pacientes: 100,
            mensagensMes: 1000,
            formulariosAtivos: 20,
            armazenamentoMb: 2048
          },
          uso: {
            usuariosAdministrativos: 1,
            pacientes: 1,
            mensagensMes: 10,
            formulariosAtivos: 2,
            armazenamentoMb: 120
          },
          alertas: []
        },
        usuarios: { totalAtivos: 1, clientes: 1, profissionais: 0, pacientes: 0 },
        acesso: {
          usuarioId: 'cliente-1',
          papel: 'Client',
          escopoDados: 'conta_cliente',
          destinoInicial: '/cliente'
        }
      })
    });
  });

  await page.route('**/api/cliente/usuarios', async (route) => {
    if (route.request().method() === 'POST') {
      conviteCriado = await route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'usuario-convidado-1',
          email: conviteCriado.email,
          role: conviteCriado.role,
          ativo: false,
          convite: {
            expiraEm: '2026-07-30T12:00:00.000Z',
            linkPrimeiroAcesso: 'https://app.octaclin.test/recuperar-senha?token=convite'
          }
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        respostaPaginada([
          { id: 'cliente-1', email: 'gestor@octaclin.local', role: 'Client', ativo: true, criadoEm: '2026-07-20T10:00:00.000Z' }
        ])
      )
    });
  });

  await page.route('**/api/cliente/usuarios/convites', async (route) => {
    const convites = conviteCriado
      ? [
          {
            usuarioId: 'usuario-convidado-1',
            email: conviteCriado.email,
            role: conviteCriado.role,
            status: 'pendente',
            expiraEm: '2026-07-30T12:00:00.000Z',
            criadoEm: '2026-07-23T12:00:00.000Z'
          }
        ]
      : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(respostaPaginada(convites))
    });
  });

  await page.route('**/api/cliente/usuarios/convites/historico', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(respostaPaginada([])) });
  });

  await page.route('**/api/cliente/configuracoes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        nome: 'Clinica Octa Real',
        timezone: 'America/Sao_Paulo',
        idioma: 'pt-BR',
        canaisPadrao: { email: true, whatsapp: true },
        marca: { nomeExibido: 'OctaClin', emailRemetente: 'contato@octaclin.com.br' }
      })
    });
  });

  await page.route('**/api/cliente/perfil-empresa', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tipoPessoa: 'pj',
        documento: '12.345.678/0001-90',
        nomeLegal: 'OctaClin Consultoria LTDA',
        nomeFantasia: 'OctaClin',
        inscricaoEstadual: '',
        inscricaoMunicipal: '',
        responsavel: { nome: 'Carla Octa', email: 'carla@octaclin.com.br', telefone: '' },
        endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: 'Sao Paulo', uf: 'SP', pais: 'BR' },
        contatos: { financeiroEmail: 'financeiro@octaclin.com.br', suporteEmail: 'suporte@octaclin.com.br' },
        fiscal: { regime: '', observacoes: '' }
      })
    });
  });

  return {
    conviteCriado: () => conviteCriado
  };
}

async function prepararProfissional(page) {
  const pacientes = [
    {
      id: 'paciente-1',
      tenantId: 'tenant-1',
      profissionalResponsavelId: 'profissional-1',
      nome: 'Ana Souza',
      contato: '5511999999999',
      statusAdesao: 'em_acompanhamento',
      scoreRisco: '25',
      criadoEm: '2026-07-20T10:00:00.000Z'
    }
  ];
  let pacienteCriado = null;
  let consultaCriada = null;

  await criarSessao(page, 'Professional', '/dashboard');
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(usuarioProfissional) });
  });

  await page.route('**/api/profissionais**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(respostaPaginada([profissional])) });
  });

  await page.route('**/api/agenda/google/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conectado: false })
    });
  });

  await page.route('**/api/agenda/agendamento-publico', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'link-publico-profissional',
        profissionalId: 'profissional-1',
        duracaoMinutos: 50,
        ativo: false,
        criadoEm: '2026-07-27T08:00:00.000Z',
        atualizadoEm: '2026-07-27T08:00:00.000Z',
        urlPublica: null,
        urlPublicaDisponivel: false,
        requerRotacaoConfirmada: true,
        mensagemUrlPublica: 'Nenhum link ativo. Rotacione para gerar o primeiro endereco publico.'
      })
    });
  });

  await page.route('**/api/agenda/solicitacoes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(respostaPaginada([]))
    });
  });

  await page.route('**/api/pacientes**', async (route) => {
    if (route.request().method() === 'POST') {
      const payload = await route.request().postDataJSON();
      pacienteCriado = {
        id: 'paciente-jornada',
        tenantId: 'tenant-1',
        statusAdesao: 'novo',
        scoreRisco: '0',
        criadoEm: '2026-07-23T12:00:00.000Z',
        ...payload
      };
      pacientes.unshift(pacienteCriado);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(pacienteCriado) });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(respostaPaginada(pacientes)) });
  });

  await page.route('**/api/agenda/consultas', async (route) => {
    if (route.request().method() === 'POST') {
      const payload = await route.request().postDataJSON();
      consultaCriada = payload;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'consulta-jornada',
          tenantId: 'tenant-1',
          pacienteId: payload.pacienteId,
          pacienteNome: 'Ana Jornada',
          profissionalId: payload.profissionalId,
          profissionalNome: 'Dra. Carla',
          titulo: 'Consulta - Ana Jornada',
          inicioEm: payload.inicioEm,
          fimEm: '2026-08-10T14:50:00.000Z',
          timezone: 'America/Sao_Paulo',
          status: 'agendada',
          local: payload.local,
          googleEventId: 'google-event-1',
          googleEventHtmlLink: 'https://calendar.google.com/event?eid=teste',
          notificacoes: {
            googleCalendar: { status: 'sincronizado' },
            email: { status: 'enviado' },
            whatsapp: { status: 'enviado' },
            lembrete24h: { status: 'pendente' },
            confirmacaoPaciente: { status: 'aguardando' }
          },
          payload: { observacoes: payload.observacoes },
          criadoEm: '2026-07-23T12:00:00.000Z',
          atualizadoEm: '2026-07-23T12:00:00.000Z'
        })
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  return {
    pacienteCriado: () => pacienteCriado,
    consultaCriada: () => consultaCriada
  };
}

async function prepararPaciente(page) {
  let desmarcou = false;
  await criarSessao(page, 'Patient', '/portal');
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        autenticado: true,
        apiUrl: 'http://localhost:3001',
        tenantSlug: 'clinica-carla',
        email: 'ana.jornada@example.com',
        expiraEm: '2026-07-23T15:00:00.000Z',
        papel: 'Patient',
        permissoes: ['portal.paciente.ler'],
        destinoInicial: '/portal'
      })
    });
  });

  await page.route((url) => url.pathname === '/api/portal/paciente', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        paciente: { id: 'paciente-jornada', nome: 'Ana Jornada', statusAdesao: 'novo', scoreRisco: '0' },
        perfil: {
          contato: 'ana.jornada@example.com',
          email: 'ana.jornada@example.com',
          whatsapp: '5511999999999',
          preferenciasContato: { email: true, whatsapp: true },
          profissionalResponsavelId: 'profissional-1'
        },
        resumo: {
          consultasProximas: desmarcou ? 0 : 1,
          formulariosPendentes: 0,
          formulariosRespondidos: 0,
          mensagensRecentes: 1,
          tarefasPendentes: 1,
          materiaisDisponiveis: 1,
          checkinsRecentes: 0,
          notificacoesPendentes: 1,
          notificacoesHistorico: 1
        },
        consultasProximas: desmarcou
          ? []
          : [
              {
                id: 'consulta-jornada',
                titulo: 'Consulta inicial',
                inicioEm: '2026-08-10T13:00:00.000Z',
                fimEm: '2026-08-10T13:50:00.000Z',
                status: 'agendada',
                local: 'Online',
                googleEventHtmlLink: 'https://calendar.google.com/event?eid=teste'
              }
            ],
        formulariosPendentes: [],
        formulariosRespondidos: [],
        mensagensRecentes: [
          {
            id: 'mensagem-agendamento',
            titulo: 'Consulta agendada',
            texto: 'Sua consulta foi agendada.',
            status: 'enviado',
            criadoEm: '2026-07-23T12:00:00.000Z',
            enviadoEm: '2026-07-23T12:01:00.000Z'
          }
        ],
        notificacoesPaciente: [
          {
            id: 'notificacao-lembrete',
            canal: 'whatsapp',
            titulo: 'Lembrete de consulta',
            texto: 'Sua consulta sera amanha.',
            status: 'pendente',
            evento: 'agenda.consulta.lembrete',
            criadoEm: '2026-07-23T12:00:00.000Z',
            agendadoPara: '2026-08-09T13:00:00.000Z'
          },
          {
            id: 'mensagem-agendamento',
            canal: 'email',
            titulo: 'Consulta agendada',
            texto: 'Sua consulta foi agendada.',
            status: 'enviado',
            evento: 'agenda.consulta.agendada',
            criadoEm: '2026-07-23T12:00:00.000Z',
            enviadoEm: '2026-07-23T12:01:00.000Z'
          }
        ],
        tarefasAcompanhamento: [
          {
            id: 'tarefa-jornada',
            titulo: 'Responder check-in inicial',
            descricao: 'Registrar sintomas antes da consulta.',
            categoria: 'checkin',
            prioridade: 'normal',
            status: 'pendente',
            criadoEm: '2026-07-23T12:00:00.000Z',
            atualizadoEm: '2026-07-23T12:00:00.000Z'
          }
        ],
        materiaisDisponiveis: [
          {
            id: 'material-jornada',
            materialId: 'material-1',
            titulo: 'Orientacoes iniciais',
            tipo: 'link',
            categoria: 'Onboarding',
            resumo: 'Material enviado apos o agendamento.',
            url: 'https://materiais.octaclin.test/inicio',
            status: 'enviado',
            criadoEm: '2026-07-23T12:00:00.000Z',
            atualizadoEm: '2026-07-23T12:00:00.000Z'
          }
        ],
        diariosRecentes: [],
        lgpd: { versaoAtual: '2026-07', documentosLegais: [], consentimentos: [], solicitacoes: [] }
      })
    });
  });

  await page.route('**/api/portal/paciente/consultas/consulta-jornada/desmarcar', async (route) => {
    desmarcou = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'consulta-jornada',
        status: 'cancelada',
        payload: { historico: [{ acao: 'cancelada', origem: 'paciente', canceladaEm: '2026-08-09T12:00:00.000Z' }] }
      })
    });
  });

  return { desmarcou: () => desmarcou };
}

async function prepararJornadaSolicitacaoPublica(page) {
  const profissionalSessaoAgenda = {
    ...usuarioProfissional,
    destinoInicial: '/agenda'
  };
  const pacienteSessaoPortal = {
    autenticado: true,
    apiUrl: 'http://localhost:3001',
    tenantSlug: 'clinica-carla',
    email: 'ana.silva@example.com',
    expiraEm: '2026-07-27T15:00:00.000Z',
    papel: 'Patient',
    permissoes: ['portal.paciente.ler'],
    destinoInicial: '/portal'
  };
  const pacienteAprovacao = {
    id: 'paciente-1',
    tenantId: 'tenant-1',
    profissionalResponsavelId: 'profissional-1',
    nome: 'Ana Souza',
    contato: 'ana.silva@example.com',
    statusAdesao: 'em_acompanhamento',
    scoreRisco: '15',
    criadoEm: '2026-07-20T10:00:00.000Z'
  };
  const horarioSolicitado = {
    inicioEm: '2026-08-03T13:00:00.000Z',
    fimEm: '2026-08-03T13:50:00.000Z',
    rotulo: '10:00'
  };
  let sessaoAtual = null;
  let solicitacaoEnviada = null;
  let urlPublica = null;
  let solicitacaoAtual = null;
  let consultaCriada = null;
  let notificacoesCriadas = [];

  async function ativarSessao(papel, destinoInicial) {
    sessaoAtual = papel;
    await criarSessao(page, papel, destinoInicial);
  }

  await page.route('**/api/auth/session', async (route) => {
    if (sessaoAtual === 'Professional') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profissionalSessaoAgenda)
      });
      return;
    }

    if (sessaoAtual === 'Patient') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pacienteSessaoPortal)
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        autenticado: false,
        apiUrl: 'http://localhost:3001',
        tenantSlug: 'clinica-carla',
        destinoInicial: '/login'
      })
    });
  });

  await page.route('**/api/agendamentos-publicos/token-publico', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        profissional: {
          nomeExibicao: 'Dra. Carla',
          especialidade: 'Nutricao clinica'
        },
        timezone: 'America/Sao_Paulo',
        duracaoMinutos: 50,
        dias: [
          {
            data: '2026-08-03',
            rotulo: '03/08/2026',
            horarios: [{ inicioEm: horarioSolicitado.inicioEm, rotulo: horarioSolicitado.rotulo }]
          }
        ]
      })
    });
  });

  await page.route('**/api/agendamentos-publicos/token-publico/solicitacoes', async (route) => {
    solicitacaoEnviada = JSON.parse(route.request().postData() ?? '{}');
    solicitacaoAtual = {
      id: 'solicitacao-publica-1',
      status: 'pendente',
      nome: solicitacaoEnviada.nome,
      email: solicitacaoEnviada.email,
      whatsapp: solicitacaoEnviada.whatsapp ?? '',
      observacao: solicitacaoEnviada.observacao ?? '',
      inicioEm: horarioSolicitado.inicioEm,
      expiraEm: '2026-08-04T13:00:00.000Z'
    };

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: solicitacaoAtual.id,
        status: solicitacaoAtual.status,
        inicioEm: solicitacaoAtual.inicioEm
      })
    });
  });

  await page.route('**/api/profissionais**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(respostaPaginada([profissional]))
    });
  });

  await page.route('**/api/pacientes**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(respostaPaginada([pacienteAprovacao]))
    });
  });

  await page.route('**/api/agenda/consultas', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(consultaCriada ? [consultaCriada] : [])
    });
  });

  await page.route('**/api/agenda/google/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conectado: false })
    });
  });

  await page.route('**/api/agenda/agendamento-publico', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'link-publico-1',
        profissionalId: 'profissional-1',
        duracaoMinutos: 50,
        ativo: true,
        criadoEm: '2026-07-26T12:00:00.000Z',
        atualizadoEm: '2026-07-27T09:00:00.000Z',
        urlPublica,
        urlPublicaDisponivel: Boolean(urlPublica),
        requerRotacaoConfirmada: !urlPublica,
        mensagemUrlPublica: urlPublica
          ? 'URL publica disponivel ate nova rotacao confirmada.'
          : 'URL atual indisponivel nesta sessao. Por seguranca, o token bruto nao e persistido. Rotacione com confirmacao para gerar uma nova URL publica.'
      })
    });
  });

  await page.route('**/api/agenda/agendamento-publico/rotacionar', async (route) => {
    urlPublica = 'https://octaclin.local/agendar/token-rotacionado';

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'link-publico-1',
        profissionalId: 'profissional-1',
        duracaoMinutos: 50,
        ativo: true,
        criadoEm: '2026-07-26T12:00:00.000Z',
        atualizadoEm: '2026-07-27T09:15:00.000Z',
        urlPublica,
        urlPublicaDisponivel: true,
        requerRotacaoConfirmada: false,
        mensagemUrlPublica: 'URL publica disponivel ate nova rotacao confirmada.'
      })
    });
  });

  await page.route('**/api/agenda/solicitacoes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        respostaPaginada(
          solicitacaoAtual
            ? [
                {
                  ...solicitacaoAtual,
                  pacienteId: consultaCriada?.pacienteId ?? null,
                  consultaId: consultaCriada?.id ?? null
                }
              ]
            : []
        )
      )
    });
  });

  await page.route('**/api/agenda/solicitacoes/solicitacao-publica-1/aprovar', async (route) => {
    const corpo = JSON.parse(route.request().postData() ?? '{}');
    expect(corpo).toEqual({ pacienteId: pacienteAprovacao.id });
    expect(solicitacaoAtual?.status).toBe('pendente');

    solicitacaoAtual = {
      ...solicitacaoAtual,
      status: 'aprovada',
      pacienteId: pacienteAprovacao.id,
      consultaId: 'consulta-solicitacao-1'
    };
    consultaCriada = {
      id: 'consulta-solicitacao-1',
      tenantId: 'tenant-1',
      pacienteId: pacienteAprovacao.id,
      pacienteNome: pacienteAprovacao.nome,
      profissionalId: 'profissional-1',
      profissionalNome: 'Dra. Carla',
      titulo: 'Consulta por solicitacao publica',
      inicioEm: horarioSolicitado.inicioEm,
      fimEm: horarioSolicitado.fimEm,
      timezone: 'America/Sao_Paulo',
      status: 'agendada',
      local: 'Online',
      googleEventId: 'google-event-publico-1',
      googleEventHtmlLink: 'https://calendar.google.com/event?eid=solicitacao',
      notificacoes: {
        googleCalendar: { status: 'sincronizado' },
        email: { status: 'enviado' },
        whatsapp: { status: 'enviado' },
        lembrete24h: { status: 'pendente' },
        confirmacaoPaciente: { status: 'aguardando' }
      },
      payload: { origem: 'solicitacao_publica_aprovada' },
      criadoEm: '2026-07-27T10:00:00.000Z',
      atualizadoEm: '2026-07-27T10:00:00.000Z'
    };
    notificacoesCriadas = [
      {
        id: 'mensagem-agendamento-publico',
        canal: 'email',
        titulo: 'Consulta agendada',
        texto: 'Sua consulta foi agendada apos aprovacao manual.',
        status: 'enviado',
        evento: 'agenda.consulta.agendada',
        criadoEm: '2026-07-27T10:00:00.000Z',
        enviadoEm: '2026-07-27T10:01:00.000Z'
      },
      {
        id: 'notificacao-lembrete-publico',
        canal: 'whatsapp',
        titulo: 'Lembrete de consulta',
        texto: 'Sua consulta sera amanha.',
        status: 'pendente',
        evento: 'agenda.consulta.lembrete',
        criadoEm: '2026-07-27T10:00:00.000Z',
        agendadoPara: '2026-08-02T13:00:00.000Z'
      }
    ];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: solicitacaoAtual.id,
        status: solicitacaoAtual.status,
        pacienteId: solicitacaoAtual.pacienteId,
        consultaId: solicitacaoAtual.consultaId,
        nome: solicitacaoAtual.nome,
        email: solicitacaoAtual.email,
        whatsapp: solicitacaoAtual.whatsapp,
        inicioEm: solicitacaoAtual.inicioEm
      })
    });
  });

  await page.route((url) => url.pathname === '/api/portal/paciente', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        paciente: { id: pacienteAprovacao.id, nome: pacienteAprovacao.nome, statusAdesao: 'em_acompanhamento', scoreRisco: '15' },
        perfil: {
          contato: 'ana.silva@example.com',
          email: 'ana.silva@example.com',
          whatsapp: '5511999999999',
          preferenciasContato: { email: true, whatsapp: true },
          profissionalResponsavelId: 'profissional-1'
        },
        resumo: {
          consultasProximas: consultaCriada ? 1 : 0,
          formulariosPendentes: 0,
          formulariosRespondidos: 0,
          mensagensRecentes: notificacoesCriadas.length,
          tarefasPendentes: 0,
          materiaisDisponiveis: 0,
          checkinsRecentes: 0,
          notificacoesPendentes: notificacoesCriadas.filter((item) => item.status === 'pendente').length,
          notificacoesHistorico: notificacoesCriadas.length
        },
        consultasProximas: consultaCriada
          ? [
              {
                id: consultaCriada.id,
                titulo: consultaCriada.titulo,
                inicioEm: consultaCriada.inicioEm,
                fimEm: consultaCriada.fimEm,
                status: consultaCriada.status,
                local: consultaCriada.local,
                googleEventHtmlLink: consultaCriada.googleEventHtmlLink
              }
            ]
          : [],
        formulariosPendentes: [],
        formulariosRespondidos: [],
        mensagensRecentes: notificacoesCriadas.filter((item) => item.status === 'enviado'),
        notificacoesPaciente: notificacoesCriadas,
        tarefasAcompanhamento: [],
        materiaisDisponiveis: [],
        diariosRecentes: [],
        lgpd: { versaoAtual: '2026-07', documentosLegais: [], consentimentos: [], solicitacoes: [] }
      })
    });
  });

  return {
    ativarSessaoProfissional: () => ativarSessao('Professional', '/agenda'),
    ativarSessaoPaciente: () => ativarSessao('Patient', '/portal'),
    solicitacaoEnviada: () => solicitacaoEnviada,
    consultaCriada: () => consultaCriada,
    notificacoesCriadas: () => notificacoesCriadas,
    urlPublica: () => urlPublica
  };
}

test.describe('jornadas criticas de producao', () => {
  test('cliente convida usuario administrativo com trilha de convite', async ({ page }) => {
    const cliente = await prepararCliente(page);

    await page.goto('/cliente');
    const gestaoUsuarios = page.locator('#gestao-usuarios');
    await expect(gestaoUsuarios.getByRole('heading', { name: 'Gerenciar usuarios' })).toBeVisible();

    await gestaoUsuarios.getByLabel('Email').fill('agenda.jornada@octaclin.local');
    await gestaoUsuarios.getByLabel('Papel').selectOption('Collaborator');
    await gestaoUsuarios.getByRole('button', { name: 'Convidar usuario' }).click();

    await expect(gestaoUsuarios.getByText('Convite enviado por email.')).toBeVisible();
    await expect.poll(() => cliente.conviteCriado()).toEqual({
      email: 'agenda.jornada@octaclin.local',
      role: 'Collaborator'
    });
    await expect(page.locator('#convites-usuarios').getByText('agenda.jornada@octaclin.local')).toBeVisible();
  });

  test('profissional cria paciente e agenda consulta com email, WhatsApp e Google Calendar', async ({ page }) => {
    const profissionalFluxo = await prepararProfissional(page);

    await page.goto('/pacientes');
    const formularioPaciente = page.locator('form').filter({ hasText: 'Novo paciente' });
    await formularioPaciente.getByLabel('Profissional').selectOption('profissional-1');
    await formularioPaciente.getByLabel('Nome').fill('Ana Jornada');
    await formularioPaciente.getByLabel('Contato').fill('5511999999999');
    await formularioPaciente.getByLabel('Nascimento').fill('1990-04-15');
    await formularioPaciente.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByText('Paciente criado.')).toBeVisible();
    await expect.poll(() => profissionalFluxo.pacienteCriado()?.nome).toBe('Ana Jornada');

    await page.goto('/agenda');
    const formularioAgenda = page.locator('form').filter({ hasText: 'Novo agendamento' });
    await formularioAgenda.getByLabel('Paciente').selectOption('paciente-jornada');
    await formularioAgenda.getByLabel('Profissional').selectOption('profissional-1');
    await formularioAgenda.getByLabel('Data e hora').fill('2026-08-10T10:00');
    await formularioAgenda.getByLabel('Duracao').fill('50');
    await formularioAgenda.getByLabel('Local').fill('Online');
    await formularioAgenda.getByLabel('Email').fill('ana.jornada@example.com');
    await formularioAgenda.getByLabel('WhatsApp').fill('5511999999999');
    await formularioAgenda.getByLabel('Observacoes').fill('Jornada critica com notificacoes.');
    await formularioAgenda.getByRole('button', { name: 'Agendar' }).click();

    await expect(page.getByText('Consulta agendada e horario bloqueado na agenda interna. Integracoes processadas conforme configuracao.')).toBeVisible();
    await expect.poll(() => profissionalFluxo.consultaCriada()).toMatchObject({
      pacienteId: 'paciente-jornada',
      profissionalId: 'profissional-1',
      emailContato: 'ana.jornada@example.com',
      whatsappContato: '5511999999999',
      enviarNotificacoes: true
    });
    await expect(page.getByText('Google Calendar: Sincronizado')).toBeVisible();
    const consulta = page.locator('article').filter({ hasText: 'Ana Jornada' });
    await expect(consulta.getByText('Enviado')).toHaveCount(2);
  });

  test('solicitacao publica segue para aprovacao manual antes de gerar consulta e notificacoes', async ({ page }) => {
    const jornada = await prepararJornadaSolicitacaoPublica(page);

    await page.goto('/agendar/token-publico');

    await expect(page.getByRole('heading', { name: 'Agendar com Dra. Carla' })).toBeVisible();
    await page.getByRole('button', { name: '10:00' }).click();
    await page.getByLabel('Nome completo').fill('Ana Silva');
    await page.getByLabel('Email').fill('ana.silva@example.com');
    await page.getByLabel('WhatsApp').fill('5511999999999');
    await page.getByLabel('Observacoes').fill('Prefiro atendimento online.');
    await page.getByRole('button', { name: 'Enviar solicitacao' }).click();

    await expect(page.getByText('Solicitacao enviada para analise.')).toBeVisible();
    await expect.poll(() => jornada.solicitacaoEnviada()).toMatchObject({
      nome: 'Ana Silva',
      email: 'ana.silva@example.com',
      whatsapp: '5511999999999'
    });
    expect(jornada.consultaCriada()).toBeNull();
    expect(jornada.notificacoesCriadas()).toHaveLength(0);

    await page.goto('/agendar/token-publico');
    await expect(page.getByRole('button', { name: '10:00' })).toBeVisible();

    await jornada.ativarSessaoProfissional();
    await page.goto('/agenda');

    await expect(page.getByRole('heading', { name: 'Link publico de agendamento' })).toBeVisible();
    await expect(page.getByText(/token bruto nao e persistido/i)).toBeVisible();
    const solicitacao = page.locator('article').filter({ hasText: 'Ana Silva' });
    await expect(solicitacao).toBeVisible();
    await expect(solicitacao.getByRole('button', { name: 'Aprovar solicitacao' })).toBeVisible();
    await expect(solicitacao.getByLabel('Paciente para aprovar')).toHaveValue('');
    await expect(solicitacao.getByRole('button', { name: 'Aprovar solicitacao' })).toBeDisabled();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('invalida a URL publica anterior');
      await dialog.accept();
    });
    await page.getByRole('button', { name: 'Rotacionar link' }).click();

    await expect.poll(() => jornada.urlPublica()).toBe('https://octaclin.local/agendar/token-rotacionado');
    await expect(page.getByText('https://octaclin.local/agendar/token-rotacionado')).toBeVisible();

    await solicitacao.getByLabel('Paciente para aprovar').selectOption('paciente-1');
    await expect(solicitacao.getByRole('button', { name: 'Aprovar solicitacao' })).toBeEnabled();
    await solicitacao.getByRole('button', { name: 'Aprovar solicitacao' }).click();

    await expect.poll(() => jornada.consultaCriada()).toMatchObject({
      pacienteId: 'paciente-1',
      profissionalId: 'profissional-1',
      titulo: 'Consulta por solicitacao publica'
    });
    await expect(page.getByText('Solicitacao aprovada e convertida em consulta.')).toBeVisible();
    await expect.poll(() => jornada.notificacoesCriadas().length).toBe(2);

    await jornada.ativarSessaoPaciente();
    await page.goto('/portal');

    await expect(page.getByRole('heading', { name: 'Portal do paciente' })).toBeVisible();
    await expect(page.locator('#agenda').getByText('Consulta por solicitacao publica')).toBeVisible();
    await expect(page.locator('#notificacoes').getByText('Consulta agendada')).toBeVisible();
    await expect(page.locator('#notificacoes').getByText('Lembrete de consulta').first()).toBeVisible();
  });

  test('paciente acessa portal com consulta, notificacoes e plano visiveis', async ({ page }) => {
    await prepararPaciente(page);

    await page.goto('/portal');

    await expect(page.getByRole('heading', { name: 'Portal do paciente' })).toBeVisible();
    await expect(page.locator('#agenda').getByText('Consulta inicial')).toBeVisible();
    await expect(page.locator('#notificacoes').getByText('Consulta agendada')).toBeVisible();
    await expect(page.locator('#notificacoes').getByText('Lembrete de consulta').first()).toBeVisible();
    await expect(page.locator('#plano').getByText('Responder check-in inicial')).toBeVisible();
    await expect(page.locator('#plano').getByText('Orientacoes iniciais')).toBeVisible();
  });

  test('paciente desmarca a propria consulta e ela some da lista de proximas consultas', async ({ page }) => {
    const paciente = await prepararPaciente(page);

    await page.goto('/portal');
    await expect(page.locator('#agenda').getByText('Consulta inicial')).toBeVisible();

    await page.getByRole('button', { name: 'Desmarcar' }).click();

    await expect.poll(() => paciente.desmarcou()).toBe(true);
    await expect(page.getByText('Consulta desmarcada.')).toBeVisible();
    await expect(page.locator('#resumo').getByText('Nenhuma consulta futura agendada.')).toBeVisible();
  });
});

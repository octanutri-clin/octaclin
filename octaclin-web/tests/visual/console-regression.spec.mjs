import { expect, test } from '@playwright/test';

const credenciais = {
  apiUrl: process.env.E2E_API_URL ?? 'http://localhost:3001',
  tenantSlug: process.env.E2E_TENANT_SLUG ?? 'clinica-carla',
  email: process.env.E2E_EMAIL ?? 'admin@octaclin.local',
  senha: process.env.E2E_SENHA ?? 'OctaClin@123'
};

const rotas = [
  { caminho: '/dashboard', titulo: 'Dashboard' },
  { caminho: '/operacoes', titulo: 'Confiabilidade OctaClin' },
  { caminho: '/pacientes', titulo: 'Pacientes' },
  { caminho: '/profissionais', titulo: 'Profissionais' },
  { caminho: '/questionarios', titulo: 'Editor de Questionarios' },
  { caminho: '/comunicacoes', titulo: 'Comunicacoes' },
  { caminho: '/automacoes', titulo: 'Automacoes' },
  { caminho: '/ia', titulo: 'IA clinica' },
  { caminho: '/mobile', titulo: 'Mobile' },
  { caminho: '/gamificacao', titulo: 'Gamificacao' }
];

const rotulosMenu = [
  'Dashboard',
  'Questionarios',
  'Comunicacoes',
  'Agenda',
  'Automacoes',
  'IA',
  'Mobile',
  'Gamificacao',
  'Operacoes',
  'Pacientes',
  'Profissionais'
];

async function login(page) {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Acesso operacional' })).toBeVisible();

  const campos = page.locator('input');
  await expect(campos).toHaveCount(4);
  await campos.nth(0).fill(credenciais.apiUrl);
  await campos.nth(1).fill(credenciais.tenantSlug);
  await campos.nth(2).fill(credenciais.email);
  await campos.nth(3).fill(credenciais.senha);

  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function assertSemOverflowHorizontal(page) {
  const medidas = await page.evaluate(() => ({
    larguraDocumento: document.documentElement.scrollWidth,
    larguraViewport: document.documentElement.clientWidth
  }));

  expect(medidas.larguraDocumento).toBeLessThanOrEqual(medidas.larguraViewport + 1);
}

async function prepararOperacoesMockadas(page) {
  let requisitouCsvLgpd = false;
  let aplicouPlanoAssinatura = false;

  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'SuperAdmin', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/operacoes'), domain: 'localhost', path: '/' }
  ]);

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        autenticado: true,
        apiUrl: 'http://localhost:3001',
        tenantSlug: 'clinica-carla',
        email: 'admin@octaclin.local',
        expiraEm: '2026-07-22T15:00:00.000Z',
        papel: 'SuperAdmin',
        permissoes: ['operacoes.auditoria.ler'],
        destinoInicial: '/operacoes'
      })
    });
  });
  await page.route('**/api/operacoes/resumo', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        outbox: { pendente: 1, processando: 0, processado: 12, falhou: 0 },
        mobile: { sincronizado: 3, erro: 0 }
      })
    });
  });
  await page.route('**/api/operacoes/outbox/falhas**', async (route) => {
    const paginada = route.request().url().includes('/paginada');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(paginada ? { itens: [], total: 0, pagina: 1, limite: 25 } : [])
    });
  });
  await page.route('**/api/operacoes/mobile/sincronizacoes**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/operacoes/auditoria**', async (route) => {
    const paginada = route.request().url().includes('/paginada');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(paginada ? { itens: [], total: 0, pagina: 1, limite: 25 } : [])
    });
  });
  await page.route('**/api/operacoes/assinaturas/solicitacoes**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        itens: [
          {
            tenantId: 'clinica-carla',
            acao: 'upgrade',
            status: aplicouPlanoAssinatura ? 'concluida' : 'pendente',
            planoAtualId: 'profissional',
            planoAtual: 'Profissional',
            planoDesejado: 'clinica',
            observacao: 'Mais usuarios administrativos.',
            solicitadoPorUsuarioId: 'cliente-1',
            solicitadoEm: '2026-07-22T10:00:00.000Z',
            ...(aplicouPlanoAssinatura
              ? {
                  planoAplicadoId: 'clinica',
                  resolvidoPorUsuarioId: 'admin-1',
                  resolvidoEm: '2026-07-22T12:00:00.000Z'
                }
              : {})
          }
        ],
        total: 1,
        pagina: 1,
        limite: 25
      })
    });
  });
  await page.route('**/api/operacoes/assinaturas/plano', async (route) => {
    aplicouPlanoAssinatura = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenantId: 'clinica-carla',
        planoId: 'clinica',
        plano: 'Clinica',
        status: 'ativa',
        origem: 'operacao_manual',
        atualizadoPorUsuarioId: 'admin-1',
        atualizadoEm: '2026-07-22T12:00:00.000Z'
      })
    });
  });
  await page.route('**/api/operacoes/lgpd/solicitacoes**', async (route) => {
    const url = route.request().url();
    if (url.includes('/LGPD-123/exportar.csv')) {
      requisitouCsvLgpd = true;
      await route.fulfill({
        status: 200,
        contentType: 'text/csv; charset=utf-8',
        body: '"protocolo","pacienteId","tipo","status","criadoEm","responsavelId","detalhes"\n"LGPD-123","paciente-1","retificacao","recebida","2026-07-22T10:00:00.000Z","","Atualizar telefone cadastrado."\n'
      });
      return;
    }

    if (url.endsWith('/LGPD-123/resposta')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          protocolo: 'LGPD-123',
          pacienteId: 'paciente-1',
          status: 'em_tratamento',
          assuntoEmail: 'Atualizacao da solicitacao LGPD LGPD-123',
          corpoEmail: 'Ola,\\n\\nSeu pedido LGPD LGPD-123 esta em tratamento.\\n\\nProtocolo: LGPD-123.\\n\\nEquipe OctaClin',
          textoWhatsapp: 'Seu pedido LGPD LGPD-123 esta em tratamento. Protocolo: LGPD-123.',
          canaisSugeridos: ['email', 'whatsapp'],
          geradoEm: '2026-07-22T12:00:00.000Z'
        })
      });
      return;
    }

    if (url.endsWith('/LGPD-123')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          protocolo: 'LGPD-123',
          pacienteId: 'paciente-1',
          usuarioPacienteId: 'usuario-paciente-1',
          tipo: 'retificacao',
          status: 'em_tratamento',
          detalhes: 'Atualizar telefone cadastrado.',
          abertoEm: '2026-07-22T10:00:00.000Z',
          atualizadoEm: '2026-07-22T11:00:00.000Z',
          responsavelId: 'usuario-admin-1',
          ultimaTratativa: 'Validando cadastro.',
          historico: [
            {
              id: 'consentimento-1',
              tipo: 'solicitacao_lgpd_retificacao',
              status: 'recebida',
              detalhes: 'Atualizar telefone cadastrado.',
              criadoEm: '2026-07-22T10:00:00.000Z'
            },
            {
              id: 'tratativa-1',
              tipo: 'tratativa_lgpd',
              status: 'em_tratamento',
              detalhes: 'Validando cadastro.',
              responsavelId: 'usuario-admin-1',
              criadoEm: '2026-07-22T11:00:00.000Z'
            }
          ]
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        itens: [
          {
            protocolo: 'LGPD-123',
            pacienteId: 'paciente-1',
            usuarioPacienteId: 'usuario-paciente-1',
            tipo: 'retificacao',
            status: 'recebida',
            detalhes: 'Atualizar telefone cadastrado.',
            abertoEm: '2026-07-22T10:00:00.000Z',
            atualizadoEm: '2026-07-22T10:00:00.000Z'
          }
        ],
        total: 1,
        pagina: 1,
        limite: 25
      })
    });
  });
  await page.route('**/api/operacoes/lgpd/solicitacoes/LGPD-123/status**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        protocolo: 'LGPD-123',
        pacienteId: 'paciente-1',
        usuarioPacienteId: 'usuario-paciente-1',
        tipo: 'retificacao',
        status: 'em_tratamento',
        detalhes: 'Atualizar telefone cadastrado.',
        abertoEm: '2026-07-22T10:00:00.000Z',
        atualizadoEm: '2026-07-22T11:00:00.000Z',
        responsavelId: 'usuario-admin-1',
        ultimaTratativa: 'Em atendimento.'
      })
    });
  });
  return {
    requisitouCsvLgpd: () => requisitouCsvLgpd,
    aplicouPlanoAssinatura: () => aplicouPlanoAssinatura
  };
}

test.describe('console operacional', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const rota of rotas) {
    test(`${rota.caminho} renderiza sem regressao visual`, async ({ page }, testInfo) => {
      await page.goto(rota.caminho);
      await expect(page.locator('h1')).toHaveText(rota.titulo);
      await expect(page.getByText('OctaClin').first()).toBeVisible();
      await expect(page.getByText('Console clinico')).toBeVisible();

      for (const rotulo of rotulosMenu) {
        await expect(page.getByRole('link', { name: rotulo })).toBeVisible();
      }

      await expect(page.locator('body')).not.toContainText('__NEXT_ERROR__');
      await expect(page.locator('body')).not.toContainText('Application error');
      await assertSemOverflowHorizontal(page);

      const nomeArquivo = `${testInfo.project.name}-${rota.caminho.replace('/', '') || 'home'}.png`;
      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach(nomeArquivo, { body: screenshot, contentType: 'image/png' });
    });
  }
});

async function prepararDashboardMockado(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/dashboard'), domain: 'localhost', path: '/' }
  ]);

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        autenticado: true,
        apiUrl: 'http://localhost:3001',
        tenantSlug: 'clinica-carla',
        email: 'dra.carla@octaclin.local',
        expiraEm: '2026-07-22T15:00:00.000Z',
        papel: 'Professional',
        permissoes: [
          'dashboard.ler',
          'agenda.consultas.ler',
          'pacientes.listar',
          'questionarios.ler',
          'comunicacoes.mensagens.ler'
        ],
        destinoInicial: '/dashboard'
      })
    });
  });

  await page.route('**/api/agenda/consultas', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'consulta-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          pacienteNome: 'Ana Souza',
          profissionalId: 'profissional-1',
          profissionalNome: 'Dra. Carla',
          titulo: 'Consulta inicial',
          inicioEm: '2026-07-22T13:00:00.000Z',
          fimEm: '2026-07-22T14:00:00.000Z',
          timezone: 'America/Sao_Paulo',
          status: 'agendada',
          local: 'Online',
          notificacoes: {},
          payload: {},
          criadoEm: '2026-07-20T10:00:00.000Z',
          atualizadoEm: '2026-07-20T10:00:00.000Z'
        },
        {
          id: 'consulta-2',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-2',
          pacienteNome: 'Bruno Lima',
          profissionalId: 'profissional-1',
          profissionalNome: 'Dra. Carla',
          titulo: 'Retorno',
          inicioEm: '2026-07-23T13:00:00.000Z',
          fimEm: '2026-07-23T13:30:00.000Z',
          timezone: 'America/Sao_Paulo',
          status: 'agendada',
          notificacoes: {},
          payload: {},
          criadoEm: '2026-07-20T10:00:00.000Z',
          atualizadoEm: '2026-07-20T10:00:00.000Z'
        }
      ])
    });
  });

  await page.route('**/api/pacientes**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        itens: [
          {
            id: 'paciente-1',
            tenantId: 'tenant-1',
            profissionalResponsavelId: 'profissional-1',
            nome: 'Ana Souza',
            contato: '11999990000',
            statusAdesao: 'risco',
            scoreRisco: '82',
            ultimoCheckinEm: '2026-07-21T12:00:00.000Z',
            criadoEm: '2026-07-21T10:00:00.000Z'
          },
          {
            id: 'paciente-2',
            tenantId: 'tenant-1',
            profissionalResponsavelId: 'profissional-1',
            nome: 'Bruno Lima',
            contato: '11988880000',
            statusAdesao: 'em_acompanhamento',
            scoreRisco: '34',
            criadoEm: '2026-07-18T10:00:00.000Z'
          }
        ],
        total: 2
      })
    });
  });

  await page.route('**/api/questionarios**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        itens: [
          {
            id: 'questionario-1',
            tenantId: 'tenant-1',
            profissionalId: 'profissional-1',
            titulo: 'Check-in semanal',
            status: 'publicado',
            versao: 2,
            criadoEm: '2026-07-10T10:00:00.000Z',
            atualizadoEm: '2026-07-20T10:00:00.000Z'
          },
          {
            id: 'questionario-2',
            tenantId: 'tenant-1',
            profissionalId: 'profissional-1',
            titulo: 'Pre-consulta',
            status: 'rascunho',
            versao: 1,
            criadoEm: '2026-07-10T10:00:00.000Z',
            atualizadoEm: '2026-07-20T10:00:00.000Z'
          }
        ],
        total: 2
      })
    });
  });

  await page.route('**/api/comunicacoes/mensagens', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'mensagem-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          status: 'recebido',
          payload: { texto: 'Dra., posso trocar o horario?' },
          criadoEm: '2026-07-22T11:30:00.000Z'
        },
        {
          id: 'mensagem-2',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-2',
          status: 'falhou',
          erro: 'Template pendente',
          payload: {},
          criadoEm: '2026-07-22T10:30:00.000Z'
        }
      ])
    });
  });
}

async function prepararProntuarioMockado(page) {
  let criouEvolucao = false;
  let criouTarefa = false;
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/dashboard'), domain: 'localhost', path: '/' }
  ]);

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        autenticado: true,
        apiUrl: 'http://localhost:3001',
        tenantSlug: 'clinica-carla',
        email: 'dra.carla@octaclin.local',
        expiraEm: '2026-07-22T15:00:00.000Z',
        papel: 'Professional',
        permissoes: [
          'dashboard.ler',
          'pacientes.listar',
          'pacientes.ler',
          'pacientes.gerenciar',
          'agenda.consultas.ler',
          'questionarios.ler',
          'comunicacoes.mensagens.ler'
        ],
        destinoInicial: '/dashboard'
      })
    });
  });

  await page.route('**/api/pacientes/paciente-1/prontuario', async (route) => {
    const eventos = [
      ...(criouTarefa
        ? [
            {
              id: 'tarefa-1',
              tipo: 'tarefa_acompanhamento',
              titulo: 'Beber agua no periodo da tarde',
              descricao: 'Meta diaria de 1 litro entre 13h e 18h.',
              data: '2026-07-29T18:00:00.000Z',
              status: 'pendente'
            }
          ]
        : []),
      ...(criouEvolucao
        ? [
            {
              id: 'evolucao-1',
              tipo: 'evolucao_clinica',
              titulo: 'Conduta ajustada',
              descricao: 'Aumentar ingestao de agua no periodo da tarde.',
              data: '2026-07-22T18:00:00.000Z',
              status: 'ajuste_plano'
            }
          ]
        : []),
      {
        id: 'mensagem-1',
        tipo: 'mensagem',
        titulo: 'Mensagem recebida',
        descricao: 'Estou com duvida no plano.',
        data: '2026-07-22T16:00:00.000Z',
        status: 'recebido'
      },
      {
        id: 'consulta-1',
        tipo: 'consulta',
        titulo: 'Consulta de retorno',
        descricao: 'Online',
        data: '2026-07-22T13:00:00.000Z',
        status: 'agendada'
      },
      {
        id: 'resposta-1',
        tipo: 'resposta_formulario',
        titulo: 'Resposta de Check-in semanal',
        descricao: 'Score final 74.5',
        data: '2026-07-21T15:00:00.000Z',
        status: 'finalizado'
      },
      {
        id: 'envio-1',
        tipo: 'formulario',
        titulo: 'Check-in semanal',
        descricao: 'Expira em 2026-07-25T13:00:00.000Z',
        data: '2026-07-20T13:00:00.000Z',
        status: 'enviado'
      }
    ];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        paciente: {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          profissionalResponsavelId: 'profissional-1',
          nome: 'Ana Souza',
          contato: 'ana@example.com',
          dataNascimento: '1990-04-12',
          statusAdesao: 'risco',
          scoreRisco: '82',
          ultimoCheckinEm: '2026-07-21T10:00:00.000Z',
          criadoEm: '2026-07-01T10:00:00.000Z',
          atualizadoEm: '2026-07-21T10:00:00.000Z'
        },
        resumo: {
          consultas: 1,
          formulariosPendentes: 1,
          respostas: 1,
          mensagens: 1,
          evolucoes: criouEvolucao ? 1 : 0,
          tarefasPendentes: criouTarefa ? 1 : 0,
          ultimoEventoEm: criouTarefa
            ? '2026-07-29T18:00:00.000Z'
            : criouEvolucao
              ? '2026-07-22T18:00:00.000Z'
              : '2026-07-22T16:00:00.000Z'
        },
        linhaDoTempo: eventos
      })
    });
  });

  await page.route('**/api/pacientes/paciente-1/evolucoes', async (route) => {
    if (route.request().method() === 'POST') {
      criouEvolucao = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'evolucao-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          autorUsuarioId: 'usuario-profissional-1',
          titulo: 'Conduta ajustada',
          conteudo: 'Aumentar ingestao de agua no periodo da tarde.',
          tipo: 'ajuste_plano',
          visibilidade: 'privada',
          criadoEm: '2026-07-22T18:00:00.000Z',
          atualizadoEm: '2026-07-22T18:00:00.000Z'
        })
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/pacientes/paciente-1/tarefas-acompanhamento', async (route) => {
    if (route.request().method() === 'POST') {
      criouTarefa = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'tarefa-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          profissionalId: 'usuario-profissional-1',
          titulo: 'Beber agua no periodo da tarde',
          descricao: 'Meta diaria de 1 litro entre 13h e 18h.',
          categoria: 'meta',
          prioridade: 'media',
          status: 'pendente',
          vencimentoEm: '2026-07-29T18:00:00.000Z',
          criadoEm: '2026-07-22T18:00:00.000Z',
          atualizadoEm: '2026-07-22T18:00:00.000Z'
        })
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  return {
    criouEvolucao: () => criouEvolucao,
    criouTarefa: () => criouTarefa
  };
}

test.describe('dashboard profissional', () => {
  test('agrega rotina diaria do profissional', async ({ page }) => {
    await prepararDashboardMockado(page);
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Consultas de hoje' })).toBeVisible();
    await expect(page.getByText('Ana Souza').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pacientes recentes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Formularios pendentes' })).toBeVisible();
    await expect(page.getByText('1 rascunho para publicar')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mensagens para revisar' })).toBeVisible();
    await expect(page.getByText('Dra., posso trocar o horario?')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Abrir agenda' })).toHaveAttribute('href', '/agenda');
    await assertSemOverflowHorizontal(page);
  });
});

test.describe('prontuario do paciente', () => {
  test('exibe linha do tempo clinica consolidada', async ({ page }) => {
    await prepararProntuarioMockado(page);
    await page.goto('/pacientes/paciente-1');

    await expect(page.getByRole('heading', { name: 'Prontuario do paciente' })).toBeVisible();
    await expect(page.getByText('Ana Souza')).toBeVisible();
    await expect(page.getByText('Risco 82 pontos')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Linha do tempo clinica' })).toBeVisible();
    await expect(page.getByText('Mensagem recebida')).toBeVisible();
    await expect(page.getByText('Estou com duvida no plano.')).toBeVisible();
    await expect(page.getByText('Consulta de retorno')).toBeVisible();
    await expect(page.getByText('Resposta de Check-in semanal')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Check-in semanal', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Voltar para pacientes' })).toHaveAttribute('href', '/pacientes');
    await assertSemOverflowHorizontal(page);
  });

  test('permite registrar evolucao clinica privada', async ({ page }) => {
    const prontuario = await prepararProntuarioMockado(page);
    await page.goto('/pacientes/paciente-1');

    await page.getByLabel('Titulo da evolucao').fill('Conduta ajustada');
    await page.getByLabel('Tipo da evolucao').selectOption('ajuste_plano');
    await page.getByLabel('Conteudo da evolucao').fill('Aumentar ingestao de agua no periodo da tarde.');
    await page.getByRole('button', { name: 'Registrar evolucao' }).click();

    await expect.poll(() => prontuario.criouEvolucao()).toBe(true);
    await expect(page.getByText('Evolucao clinica registrada.')).toBeVisible();
    await expect(page.getByText('Conduta ajustada')).toBeVisible();
    await expect(page.getByText('Aumentar ingestao de agua no periodo da tarde.')).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });

  test('permite prescrever tarefa de acompanhamento', async ({ page }) => {
    const prontuario = await prepararProntuarioMockado(page);
    await page.goto('/pacientes/paciente-1');

    await page.getByLabel('Titulo da tarefa').fill('Beber agua no periodo da tarde');
    await page.getByLabel('Categoria da tarefa').selectOption('meta');
    await page.getByLabel('Prioridade da tarefa').selectOption('media');
    await page.getByLabel('Vencimento da tarefa').fill('2026-07-29T15:00');
    await page.getByLabel('Descricao da tarefa').fill('Meta diaria de 1 litro entre 13h e 18h.');
    await page.getByRole('button', { name: 'Prescrever tarefa' }).click();

    await expect.poll(() => prontuario.criouTarefa()).toBe(true);
    await expect(page.getByText('Tarefa de acompanhamento prescrita.')).toBeVisible();
    await expect(page.getByText('Beber agua no periodo da tarde')).toBeVisible();
    await expect(page.getByText('Meta diaria de 1 litro entre 13h e 18h.')).toBeVisible();
    await expect(page.getByText('1 tarefas pendentes')).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });
});


test.describe('operacoes LGPD', () => {
  test('exibe fila LGPD e permite iniciar tratativa', async ({ page }) => {
    const operacoes = await prepararOperacoesMockadas(page);
    await page.goto('/operacoes');

    await expect(page.getByRole('heading', { name: 'Solicitacoes LGPD' })).toBeVisible();
    await expect(page.getByText('LGPD-123')).toBeVisible();
    await expect(page.getByText('Atualizar telefone cadastrado.')).toBeVisible();

    await page.getByRole('button', { name: 'Iniciar tratativa' }).click();
    await expect(page.getByText('Solicitacao LGPD atualizada: LGPD-123.')).toBeVisible();

    await page.getByRole('button', { name: 'Ver detalhes LGPD-123' }).click();
    await expect(page.getByRole('heading', { name: 'Detalhe do protocolo LGPD-123' })).toBeVisible();
    await expect(page.getByText('Validando cadastro.')).toBeVisible();
    await page.getByRole('button', { name: 'Exportar protocolo LGPD-123' }).click();
    await expect.poll(() => operacoes.requisitouCsvLgpd()).toBe(true);

    await page.getByRole('button', { name: 'Preparar resposta LGPD-123' }).click();
    await expect(page.getByRole('heading', { name: 'Resposta ao paciente' })).toBeVisible();
    await expect(page.getByText('Atualizacao da solicitacao LGPD LGPD-123')).toBeVisible();
    await expect(page.getByText('Seu pedido LGPD LGPD-123 esta em tratamento. Protocolo: LGPD-123.')).toBeVisible();
    await page.getByRole('button', { name: 'Copiar resposta LGPD-123' }).click();
    await expect(page.getByText('Resposta LGPD copiada para LGPD-123.')).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });
});

test.describe('operacoes assinatura', () => {
  test('exibe solicitacao comercial e permite aplicar plano manualmente', async ({ page }) => {
    const operacoes = await prepararOperacoesMockadas(page);
    await page.goto('/operacoes');

    await expect(page.getByRole('heading', { name: 'Assinaturas' })).toBeVisible();
    await expect(page.getByText('Mais usuarios administrativos.')).toBeVisible();
    await page.getByRole('button', { name: 'Aplicar Clinica' }).click();
    await expect(page.getByText('Plano Clinica aplicado para clinica-carla.')).toBeVisible();
    await expect.poll(() => operacoes.aplicouPlanoAssinatura()).toBe(true);
    await assertSemOverflowHorizontal(page);
  });
});

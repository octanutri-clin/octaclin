import { expect, test } from '@playwright/test';

const credenciais = {
  apiUrl: process.env.E2E_API_URL ?? 'http://localhost:3001',
  tenantSlug: process.env.E2E_TENANT_SLUG ?? 'clinica-carla',
  email: process.env.E2E_EMAIL ?? 'admin@octaclin.local',
  senha: process.env.E2E_SENHA ?? 'OctaClin@123'
};
const webUrl = process.env.E2E_WEB_URL ?? 'http://localhost:3000';

const rotas = [
  { caminho: '/dashboard', titulo: 'Dashboard' },
  { caminho: '/operacoes', titulo: 'Confiabilidade OctaClin' },
  { caminho: '/pacientes', titulo: 'Pacientes' },
  { caminho: '/profissionais', titulo: 'Profissionais' },
  { caminho: '/questionarios', titulo: 'Editor de Questionarios' },
  { caminho: '/comunicacoes', titulo: 'Comunicacoes' },
  { caminho: '/automacoes', titulo: 'Automacoes' },
  { caminho: '/ia', titulo: 'Sugestoes assistidas' },
  { caminho: '/mobile', titulo: 'Confiabilidade OctaClin' },
  { caminho: '/gamificacao', titulo: 'Metas e adesao' }
];

const rotulosMenu = [
  'Hoje',
  'Formularios',
  'Comunicacoes',
  'Agenda',
  'Automacoes',
  'IA assistida',
  'Metas e adesao',
  'Operacoes',
  'Pacientes',
  'Profissionais'
];
const rotulosForaMenuDiario = ['Mobile'];
const permissoesConsoleCompleto = [
  'console.acessar',
  'dashboard.ler',
  'questionarios.ler',
  'comunicacoes.mensagens.ler',
  'agenda.consultas.ler',
  'agenda.consultas.criar',
  'automacoes.gerenciar',
  'ia.executar',
  'mobile.operar',
  'gamificacao.gerenciar',
  'operacoes.auditoria.ler',
  'pacientes.listar',
  'pacientes.gerenciar',
  'profissionais.ler'
];

async function login(page) {
  let payloadLogin;
  let autenticado = false;

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: autenticado ? 200 : 401,
      contentType: 'application/json',
      body: JSON.stringify(
        autenticado
          ? {
              autenticado: true,
              apiUrl: credenciais.apiUrl,
              tenantSlug: credenciais.tenantSlug,
              email: credenciais.email,
              expiraEm: '2026-07-27T15:00:00.000Z',
              papel: 'SuperAdmin',
              permissoes: ['operacoes.auditoria.ler'],
              destinoInicial: '/operacoes'
            }
          : { autenticado: false }
      )
    });
  });

  await page.route('**/api/dashboard/clinico**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contexto: { periodo: 'hoje', inicioEm: '2026-07-22T00:00:00.000Z', fimEm: '2026-07-22T23:59:59.999Z', profissionalId: 'profissional-1', profissionalNome: 'Dra. Carla' },
        indicadores: { consultasHoje: 1, proximas: 1, concluidas: 0, reagendadas: 0, canceladas: 0, faltas: 0, semRetorno30: 1, semRetorno60: 0, semRetorno90Mais: 0, formulariosPendentes: 1, tarefasVencidas: 1, solicitacoesPendentes: 1, comunicacoesEmAlerta: 1, pacientesRiscoAlto: 1 },
        atendimentos: [{ id: 'consulta-1', pacienteId: 'paciente-1', profissionalId: 'profissional-1', pacienteNome: 'Ana Souza', inicioEm: '2026-07-22T13:00:00.000Z', fimEm: '2026-07-22T14:00:00.000Z', status: 'agendada' }],
        semRetorno: [{ pacienteId: 'paciente-2', profissionalId: 'profissional-1', pacienteNome: 'Bruno Lima', nivelRisco: 'alto', scoreRisco: 82, diasSemRetorno: 31, faixa: '30' }],
        tarefasVencidas: [{ id: 'tarefa-1', pacienteId: 'paciente-1', profissionalId: 'profissional-1', pacienteNome: 'Ana Souza', titulo: 'Revisar plano alimentar', prioridade: 'alta', vencimentoEm: '2026-07-21T12:00:00.000Z' }],
        formulariosPendentes: [{ id: 'envio-1', pacienteId: 'paciente-1', profissionalId: 'profissional-1', pacienteNome: 'Ana Souza', questionarioId: 'questionario-1', respondidoEm: '2026-07-21T10:00:00.000Z' }],
        solicitacoesPendentes: [{ id: 'solicitacao-1', profissionalId: 'profissional-1', solicitanteNome: 'Marina Reis', inicioEm: '2026-07-23T14:00:00.000Z', fimEm: '2026-07-23T14:30:00.000Z', expiraEm: '2026-07-23T12:00:00.000Z' }],
        comunicacoes: [{ id: 'mensagem-1', pacienteId: 'paciente-1', profissionalId: 'profissional-1', pacienteNome: 'Ana Souza', status: 'recebido', criadoEm: '2026-07-22T10:00:00.000Z' }],
        alertas: [{ id: 'tarefa_vencida:profissional-1:tarefa-1', tipo: 'tarefa_vencida', prioridade: 1, recursoId: 'tarefa-1', pacienteId: 'paciente-1', ocorridoEm: '2026-07-21T12:00:00.000Z', ocultavel: true }],
        selecaoObrigatoria: false
      })
    });
  });
  await page.route('**/api/auth/login', async (route) => {
    payloadLogin = route.request().postDataJSON();
    autenticado = true;
    await page.context().addCookies([
      { name: 'octaclin_access_token', value: 'fake', url: webUrl },
      { name: 'octaclin_refresh_token', value: 'fake', url: webUrl },
      { name: 'octaclin_papel', value: 'SuperAdmin', url: webUrl },
      { name: 'octaclin_destino_inicial', value: encodeURIComponent('/operacoes'), url: webUrl }
    ]);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        apiUrl: credenciais.apiUrl,
        tenantSlug: credenciais.tenantSlug,
        email: credenciais.email,
        expiraEmSegundos: 900,
        papel: 'SuperAdmin',
        permissoes: permissoesConsoleCompleto,
        destinoInicial: '/operacoes'
      })
    });
  });

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Acesso OctaClin' })).toBeVisible();

  const campos = page.locator('input');
  await expect(campos).toHaveCount(2);
  await expect(page.getByText('API', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Tenant', { exact: true })).toHaveCount(0);
  await campos.nth(0).fill(credenciais.email);
  await campos.nth(1).fill(credenciais.senha);

  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/operacoes$/);
  expect(payloadLogin).toEqual({ email: credenciais.email, senha: credenciais.senha });
}

async function prepararSessaoConsoleMockada(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', url: webUrl },
    { name: 'octaclin_refresh_token', value: 'fake', url: webUrl },
    { name: 'octaclin_papel', value: 'SuperAdmin', url: webUrl },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/operacoes'), url: webUrl }
  ]);

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        autenticado: true,
        apiUrl: credenciais.apiUrl,
        tenantSlug: credenciais.tenantSlug,
        email: credenciais.email,
        expiraEm: '2026-07-27T15:00:00.000Z',
        papel: 'SuperAdmin',
        permissoes: permissoesConsoleCompleto,
        destinoInicial: '/operacoes'
      })
    });
  });
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
  let programouRetencao = false;
  let atualizouFlags = false;

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
  await page.route('**/api/operacoes/alertas', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'critico',
        geradoEm: '2026-07-23T13:00:00.000Z',
        resumo: { total: 2, criticos: 1, atencao: 1, informativos: 0 },
        itens: [
          {
            id: 'fila.outbox.pendente.atrasado',
            severidade: 'critico',
            origem: 'fila',
            titulo: 'Outbox com eventos pendentes atrasados',
            mensagem: 'Existem eventos pendentes acima da janela operacional esperada.',
            acaoSugerida: 'Verificar Redis, processador de outbox e central de falhas.',
            metrica: 'outbox_pendente_atrasado',
            valor: 4
          },
          {
            id: 'integracao.comunicacoes.falhas',
            severidade: 'atencao',
            origem: 'integracao',
            titulo: 'Falhas de comunicacao aguardam tratamento',
            mensagem: 'Existem falhas reprocessaveis ou pendentes na central de comunicacoes.',
            acaoSugerida: 'Abrir /operacoes/comunicacoes/falhas.',
            valor: 1
          }
        ]
      })
    });
  });
  await page.route('**/api/operacoes/rollout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        decisaoSugerida: 'promover',
        geradoEm: '2026-08-13T18:00:00.000Z',
        release: { commit: 'abc123def456', servicoId: 'configurado', ambiente: 'production', papelProcesso: 'all' },
        health: { status: 'ok', checks: { backend: 'ok', banco: 'ok', migracoes: 'ok', redis: 'ok' } },
        telemetria: {
          processo: { iniciadoEm: '2026-08-13T17:00:00.000Z', uptimeSegundos: 3600 },
          http: { total: 240, sucesso: 238, errosCliente: 2, errosServidor: 0, taxaErro5xx: 0, duracaoMediaMs: 120, duracaoP95Ms: 430, amostrasDuracao: 240, porRota: [] },
          tracesRecentes: [
            { requestId: 'req-sintetico-1', horario: '2026-08-13T18:00:00.000Z', metodo: 'GET', rota: '/health/pronto', statusCode: 200, duracaoMs: 32, resultado: 'sucesso' }
          ]
        },
        filas: [
          { nome: 'notificacoes', status: 'ok', esperando: 2, ativas: 1, atrasadas: 0, falharam: 0, pausada: false },
          { nome: 'google_calendar', status: 'ok', esperando: 0, ativas: 0, atrasadas: 0, falharam: 0, pausada: false },
          { nome: 'automacoes', status: 'ok', esperando: 1, ativas: 0, atrasadas: 0, falharam: 0, pausada: false }
        ],
        flags: { configuracaoValida: true, flags: [{ chave: 'ia.clinica', habilitada: false, origem: 'padrao' }, { chave: 'mobile.sync', habilitada: false, origem: 'padrao' }] }
      })
    });
  });
  await page.route('**/api/operacoes/tenants', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        itens: [{ id: '00000000-0000-4000-8000-000000000002', nome: 'Clinica Piloto', slug: 'clinica-piloto', status: 'ativo', cicloVidaStatus: 'ativo', planoId: 'profissional', assinaturaStatus: 'ativa', criadoEm: '2026-08-13T12:00:00.000Z', atualizadoEm: '2026-08-13T12:00:00.000Z' }],
        total: 1
      })
    });
  });
  await page.route('**/api/operacoes/feature-flags/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configuracaoValida: true, flags: [{ chave: 'ia.clinica', habilitada: false, origem: 'padrao' }, { chave: 'mobile.sync', habilitada: false, origem: 'padrao' }] }) });
  });
  await page.route('**/api/operacoes/feature-flags', async (route) => {
    atualizouFlags = route.request().method() === 'POST';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configuracaoValida: true, flags: [{ chave: 'ia.clinica', habilitada: true, origem: 'tenant' }, { chave: 'mobile.sync', habilitada: false, origem: 'tenant' }] }) });
  });
  await page.route('**/api/operacoes/outbox/falhas**', async (route) => {
    const paginada = route.request().url().includes('/paginada');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(paginada ? { itens: [], total: 0, pagina: 1, limite: 25 } : [])
    });
  });
  await page.route('**/api/operacoes/comunicacoes/falhas**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        itens: [
          {
            id: 'mensagem:mensagem-email-1',
            origem: 'mensagem',
            canal: 'email',
            tipo: 'agenda.consulta.lembrete',
            referenciaId: 'mensagem-email-1',
            erro: 'SMTP indisponivel',
            criadoEm: '2026-07-22T12:00:00.000Z',
            reprocessavel: true,
            resumo: 'ana@example.com'
          }
        ],
        total: 1,
        pagina: 1,
        limite: 25,
        resumo: { total: 1, email: 1, whatsapp: 0, googleCalendar: 0, outbox: 0, outras: 0, reprocessaveis: 1 }
      })
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
  await page.route('**/api/operacoes/lgpd/retencao', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        versao: '2026-10',
        geradoEm: '2026-07-23T12:00:00.000Z',
        politicas: [
          {
            id: 'auditoria_operacional',
            rotulo: 'Auditoria operacional',
            entidade: 'user_action_logs',
            campoData: 'criadoEm',
            diasRetencao: 3650,
            acao: 'arquivar_exportar',
            baseLegal: 'Obrigacao legal e exercicio regular de direitos',
            descricao: 'Logs sensiveis sao preservados por 10 anos antes de arquivo controlado.'
          },
          {
            id: 'outbox_processado',
            rotulo: 'Outbox processado',
            entidade: 'outbox_eventos',
            campoData: 'criadoEm',
            diasRetencao: 180,
            acao: 'excluir',
            baseLegal: 'Minimizacao operacional',
            descricao: 'Eventos processados sao elegiveis para limpeza apos 180 dias.'
          }
        ],
        resumo: {
          totalVencidos: 11,
          itens: [
            {
              politicaId: 'auditoria_operacional',
              rotulo: 'Auditoria operacional',
              acao: 'arquivar_exportar',
              diasRetencao: 3650,
              corteEm: '2016-07-25T12:00:00.000Z',
              vencidos: 7
            },
            {
              politicaId: 'outbox_processado',
              rotulo: 'Outbox processado',
              acao: 'excluir',
              diasRetencao: 180,
              corteEm: '2026-01-24T12:00:00.000Z',
              vencidos: 4
            }
          ]
        }
      })
    });
  });
  await page.route('**/api/operacoes/lgpd/retencao/programar', async (route) => {
    programouRetencao = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        protocolo: 'RET-20260723120000',
        status: 'programada',
        programadoEm: '2026-07-23T12:00:00.000Z',
        totalItensVencidos: 11,
        resumo: {
          totalVencidos: 11,
          itens: []
        }
      })
    });
  });
  return {
    requisitouCsvLgpd: () => requisitouCsvLgpd,
    aplicouPlanoAssinatura: () => aplicouPlanoAssinatura,
    programouRetencao: () => programouRetencao,
    atualizouFlags: () => atualizouFlags
  };
}

test.describe('login do console', () => {
  test('envia as credenciais e respeita o destino da sessao', async ({ page }) => {
    await login(page);
  });

  test('recupera senha sem expor configuracao tecnica', async ({ page }) => {
    let payloadRecuperacao;
    await page.route('**/api/auth/recuperar-senha', async (route) => {
      payloadRecuperacao = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mensagem: 'Se o email estiver cadastrado, enviaremos as instrucoes.' })
      });
    });

    await page.goto('/esqueci-senha');
    await expect(page.getByRole('heading', { name: 'Recuperar senha' })).toBeVisible();
    await expect(page.locator('input')).toHaveCount(1);
    await expect(page.getByText('API', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Tenant', { exact: true })).toHaveCount(0);
    await page.getByLabel('Email').fill(credenciais.email);
    await page.getByRole('button', { name: 'Enviar link' }).click();

    await expect(page.getByText('Se o email estiver cadastrado, enviaremos as instrucoes.')).toBeVisible();
    expect(payloadRecuperacao).toEqual({ email: credenciais.email });
  });
});

test.describe('console operacional', () => {
  test.beforeEach(async ({ page }) => {
    await prepararSessaoConsoleMockada(page);
  });

  for (const rota of rotas) {
    test(`${rota.caminho} renderiza sem regressao visual`, async ({ page }, testInfo) => {
      await page.goto(rota.caminho);
      await expect(page.getByRole('heading', { level: 1, name: rota.titulo })).toHaveCount(1);
      await expect(page.getByText('OctaClin').first()).toBeVisible();
      await expect(page.getByText('Console clinico')).toBeVisible();

      const navegacao = page.getByRole('navigation', { name: 'Modulos do console' });
      for (const rotulo of rotulosMenu) {
        await expect(navegacao.getByRole('link', { name: rotulo })).toBeVisible();
      }
      for (const rotulo of rotulosForaMenuDiario) {
        await expect(navegacao.getByRole('link', { name: rotulo })).toHaveCount(0);
      }

      if (rota.caminho === '/dashboard') {
        await expect(page.getByRole('link', { name: 'Agendar' })).toHaveAttribute('href', '/agenda#novo-agendamento');
        await expect(page.getByRole('link', { name: 'Novo paciente' })).toHaveAttribute('href', '/pacientes#novo-paciente');
        await expect(page.getByRole('button', { name: /^Notificacoes/ })).toBeVisible();
        await page.locator('button[aria-label="Abrir menu da conta"]').click();
        await expect(page.getByText('Clinica Carla')).toBeVisible();
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

async function prepararDashboardMockado(page, { googleConectado = true } = {}) {
  let remarcouConsulta = false;
  let cancelouConsulta = false;
  const consultasAgenda = [
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
  ];
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
          'agenda.consultas.criar',
          'agenda.financeiro.ler',
          'pacientes.listar',
          'pacientes.gerenciar',
          'questionarios.ler',
          'comunicacoes.mensagens.ler'
        ],
        destinoInicial: '/dashboard'
      })
    });
  });

  await page.route('**/api/agenda/consultas', async (route) => {
    if (route.request().method() === 'POST') {
      const consulta = {
        id: 'consulta-3',
        tenantId: 'tenant-1',
        pacienteId: 'paciente-1',
        pacienteNome: 'Ana Souza',
        profissionalId: 'profissional-1',
        profissionalNome: 'Dra. Carla',
        titulo: 'Consulta - Ana Souza',
        inicioEm: '2026-07-24T13:00:00.000Z',
        fimEm: '2026-07-24T14:00:00.000Z',
        timezone: 'America/Sao_Paulo',
        status: 'agendada',
        notificacoes: {},
        payload: {},
        criadoEm: '2026-07-22T10:00:00.000Z',
        atualizadoEm: '2026-07-22T10:00:00.000Z'
      };
      consultasAgenda.unshift(consulta);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(consulta) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(consultasAgenda)
    });
  });

  await page.route('**/api/agenda/consultas/consulta-1', async (route) => {
    const consulta = consultasAgenda.find((item) => item.id === 'consulta-1');
    if (route.request().method() === 'PATCH') {
      remarcouConsulta = true;
      Object.assign(consulta, {
        inicioEm: '2026-07-24T13:30:00.000Z',
        fimEm: '2026-07-24T14:15:00.000Z',
        status: 'reagendada',
        local: 'Sala 2',
        atualizadoEm: '2026-07-22T12:00:00.000Z',
        notificacoes: { googleCalendar: { sincronizado: true } }
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(consulta) });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/agenda/consultas/consulta-1/desfecho', async (route) => {
    const consulta = consultasAgenda.find((item) => item.id === 'consulta-1');
    const dados = route.request().postDataJSON();
    if (route.request().method() === 'POST' && dados.status === 'cancelada') {
      cancelouConsulta = true;
      Object.assign(consulta, {
        status: 'cancelada',
        notificacoes: { googleCalendar: { sincronizado: true } },
        payload: { historico: [{ acao: 'cancelada', origem: 'octaclin' }] }
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(consulta) });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/agenda/agendamento-publico', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  });

  await page.route('**/api/agenda/solicitacoes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ itens: [], total: 0 })
    });
  });

  await page.route('**/api/agenda/financeiro/recebimentos**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        inicioEm: '2026-07-01T00:00:00.000Z',
        fimEm: '2026-07-31T23:59:59.000Z',
        consultas: 2,
        recebidoCentavos: 18000,
        pendenteCentavos: 18000,
        isentas: 0,
        pacotesRecebidoCentavos: 0,
        pacotesPendenteCentavos: 0,
        porProfissional: [{
          profissionalId: 'profissional-1',
          profissionalNome: 'Dra. Carla',
          consultas: 2,
          recebidoCentavos: 18000,
          pendenteCentavos: 18000,
          isentas: 0
        }]
      })
    });
  });

  await page.route('**/api/agenda/google/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conectado: googleConectado })
    });
  });

  await page.route('**/api/agenda/feed*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        ...consultasAgenda.filter((consulta) => consulta.status === 'agendada' || consulta.status === 'reagendada').map((consulta) => ({ ...consulta, tipo: 'consulta' })),
        {
          id: 'bloqueio-google-1',
          tipo: 'google_indisponivel',
          profissionalId: 'profissional-1',
          inicioEm: '2026-07-24T15:00:00.000Z',
          fimEm: '2026-07-24T16:00:00.000Z',
          rotulo: 'Indisponivel'
        }
      ])
    });
  });

  await page.route('**/api/pacientes**', async (route) => {
    const parametros = new URL(route.request().url()).searchParams;
    const pacientes = [
      {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1',
        nome: 'Ana Souza',
        contato: '11999990000',
        statusAdesao: 'risco',
        scoreRisco: '82',
        ultimoCheckinEm: '2026-07-21T12:00:00.000Z',
        ultimaConsultaConcluidaEm: '2026-07-10T12:00:00.000Z',
        proximaConsultaEm: '2026-07-31T12:00:00.000Z',
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
    ].filter((paciente) => {
      if (parametros.get('risco') === 'alto' && Number(paciente.scoreRisco) < 70) return false;
      if (parametros.get('semProximaConsulta') === 'true' && paciente.proximaConsultaEm) return false;
      return true;
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        itens: pacientes,
        total: pacientes.length
      })
    });
  });

  await page.route('**/api/profissionais**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        itens: [
          {
            id: 'profissional-1',
            tenantId: 'tenant-1',
            nome: 'Dra. Carla',
            email: 'dra.carla@octaclin.local',
            especialidade: 'Nutrologia',
            criadoEm: '2026-07-20T10:00:00.000Z'
          }
        ],
        total: 1
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

  return {
    remarcouConsulta: () => remarcouConsulta,
    cancelouConsulta: () => cancelouConsulta
  };
}

async function prepararProntuarioMockado(page, {
  permissoesExtras = [],
  permissoesRemovidas = [],
  papel = 'Professional',
  profissionalResponsavelId = 'profissional-1'
} = {}) {
  let criouEvolucao = false;
  let criouTarefa = false;
  let criouMaterial = false;
  let enviouMaterial = false;
  let condutas = [];
  let anexos = [];
  let documentos = [];
  let corpoDocumentoEmitido = null;
  let statusPortal = 'convite_pendente';
  let revogouConvite = false;
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: papel, domain: 'localhost', path: '/' },
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
        papel,
        permissoes: [
          'dashboard.ler',
          'pacientes.listar',
          'pacientes.ler',
          'pacientes.gerenciar',
          'materiais.ler',
          'materiais.gerenciar',
          'agenda.consultas.ler',
          'agenda.consultas.criar',
          'questionarios.ler',
          'comunicacoes.mensagens.ler',
          ...permissoesExtras
        ].filter((permissao) => !permissoesRemovidas.includes(permissao)),
        destinoInicial: '/dashboard'
      })
    });
  });

  await page.route('**/api/pacientes/paciente-1/perfil-cadastro', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        identificacao: { nomeUso: 'Ana', sexo: 'feminino', condicaoBiologica: 'nao_gestante' },
        contato: { email: 'ana@example.com', ddi: '+55', celular: '11999999999', canalPreferido: 'email' },
        operacao: { categoria: 'Acompanhamento', tags: ['retorno'] }
      })
    });
  });

  await page.route('**/api/pacientes/paciente-1/perfil-cadastro/qualidade-acesso', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        percentualPreenchido: 68,
        secoes: [
          { secao: 'identificacao', titulo: 'Identificacao', camposFaltantes: [], preenchidos: 5, total: 5 },
          { secao: 'contato', titulo: 'Contato e endereco', camposFaltantes: ['CEP', 'Endereco', 'Bairro', 'Cidade', 'Estado', 'Instagram'], preenchidos: 4, total: 10 },
          { secao: 'operacao', titulo: 'Operacao', camposFaltantes: ['Origem'], preenchidos: 2, total: 3 }
        ],
        possiveisDuplicidades: [{ pacienteId: 'paciente-2', nome: 'Ana Souza homonima', motivos: ['nome_e_nascimento'] }],
        acessoPortal: {
          status: statusPortal,
          email: 'ana@example.com',
          conviteId: 'convite-1',
          conviteCriadoEm: '2026-08-10T10:00:00.000Z',
          conviteExpiraEm: '2026-08-17T10:00:00.000Z',
          canalPreferido: 'email',
          preferencias: { email: true, whatsapp: false, canalPreferido: 'email', horarioPermitido: { inicio: '08:00', fim: '20:00', timezone: 'America/Sao_Paulo' } },
          aceites: []
        }
      })
    });
  });

  await page.route('**/api/pacientes/paciente-1/convites-acesso', async (route) => {
    if (route.request().method() === 'DELETE') {
      statusPortal = 'convite_revogado';
      revogouConvite = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ conviteId: 'convite-1', revogadoEm: '2026-08-14T12:00:00.000Z' }) });
      return;
    }
    await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ message: 'Metodo inesperado.' }) });
  });

  await page.route('**/api/profissionais**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        itens: [{
          id: 'profissional-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-profissional-1',
          nome: 'Dra. Carla',
          especialidade: 'Nutrologia',
          criadoEm: '2026-07-20T10:00:00.000Z'
        }],
        total: 1
      })
    });
  });

  await page.route('**/api/pacientes/paciente-1/condutas-terapeuticas**', async (route) => {
    const requisicao = route.request();
    const url = new URL(requisicao.url());
    const partes = url.pathname.split('/').filter(Boolean);
    const acao = partes.at(-1);
    const resposta = () => ({
      id: 'conduta-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      tipo: 'orientacao',
      arquivadaEm: condutas[0]?.arquivadaEm,
      versoes: condutas[0]?.versoes ?? []
    });

    if (requisicao.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(condutas.map(() => resposta())) });
      return;
    }

    if (requisicao.method() === 'POST' && acao === 'condutas-terapeuticas') {
      const entrada = requisicao.postDataJSON();
      condutas = [{
        id: 'conduta-1',
        arquivadaEm: undefined,
        versoes: [{
          id: 'conduta-versao-1', numero: 1, estado: 'rascunho', titulo: entrada.titulo,
          conteudo: entrada.conteudo, validadeInicio: entrada.validadeInicio, validadeFim: entrada.validadeFim
        }]
      }];
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(resposta()) });
      return;
    }

    if (requisicao.method() === 'POST' && condutas.length) {
      if (acao === 'publicacao') condutas[0].versoes[0].estado = 'publicada';
      if (acao === 'nova-versao') {
        const publicada = condutas[0].versoes.find((versao) => versao.estado === 'publicada');
        condutas[0].versoes.unshift({
          ...publicada, id: 'conduta-versao-2', numero: 2, estado: 'rascunho'
        });
      }
      if (acao === 'arquivamento') condutas[0].arquivadaEm = '2026-08-13T12:00:00.000Z';
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resposta()) });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Rota mockada nao encontrada.' }) });
  });

  await page.route('**/api/pacientes/paciente-1/prontuario/timeline**', async (route) => {
    const parametros = new URL(route.request().url()).searchParams;
    const tipo = parametros.get('tipo');
    const responsavelId = parametros.get('responsavelId');
    const itens = [
      {
        id: 'plano-versao-1',
        tipo: 'plano_alimentar_publicado',
        titulo: 'Plano alimentar publicado',
        data: '2026-07-23T18:00:00.000Z',
        status: 'publicado',
        origem: 'Plano alimentar',
        responsavelId: 'profissional-1',
        autorUsuarioId: 'usuario-profissional-1'
      },
      {
        id: 'avaliacao-1',
        tipo: 'avaliacao_antropometrica',
        titulo: 'Avaliacao antropometrica',
        data: '2026-07-23T17:00:00.000Z',
        status: 'registrada',
        origem: 'Antropometria',
        responsavelId: 'profissional-1',
        autorUsuarioId: 'usuario-profissional-1'
      },
      {
        id: 'consulta-pagamento:consulta-1',
        tipo: 'evento_financeiro',
        titulo: 'Pagamento de consulta',
        data: '2026-07-23T16:00:00.000Z',
        status: 'pago',
        origem: 'Financeiro',
        responsavelId: 'profissional-1'
      },
      {
        id: 'documento-1',
        tipo: 'documento_emitido',
        titulo: 'Relatorio de alta emitido',
        data: '2026-07-23T15:00:00.000Z',
        status: 'emitido',
        origem: 'Documentos',
        responsavelId: 'profissional-1',
        autorUsuarioId: 'usuario-profissional-1'
      },
      {
        id: 'anexo-1',
        tipo: 'anexo_confirmado',
        titulo: 'Anexo clinico confirmado',
        data: '2026-07-23T14:00:00.000Z',
        status: 'confirmado',
        origem: 'Anexos',
        responsavelId: 'profissional-1'
      },
      {
        id: 'exame-1',
        tipo: 'exame_laboratorial',
        titulo: 'Coleta de exames laboratoriais',
        data: '2026-07-23T13:00:00.000Z',
        status: 'registrada',
        origem: 'Exames laboratoriais',
        responsavelId: 'profissional-1',
        autorUsuarioId: 'usuario-profissional-1'
      },
      {
        id: 'foto-1',
        tipo: 'evolucao_fotografica',
        titulo: 'Serie fotografica clinica',
        data: '2026-07-23T12:00:00.000Z',
        status: 'registrada',
        origem: 'Evolucao fotografica',
        responsavelId: 'profissional-1',
        autorUsuarioId: 'usuario-profissional-1'
      },
      {
        id: 'evolucao-1',
        tipo: 'evolucao_clinica',
        titulo: 'Ajuste de conduta',
        data: '2026-07-22T18:00:00.000Z',
        status: 'ajuste_plano',
        origem: 'Prontuario',
        responsavelId: 'profissional-1',
        autorUsuarioId: 'usuario-profissional-1'
      },
      {
        id: 'mensagem-1',
        tipo: 'mensagem',
        titulo: 'Mensagem recebida',
        data: '2026-07-22T16:00:00.000Z',
        status: 'recebido',
        origem: 'Comunicacoes',
        autorUsuarioId: 'usuario-paciente-1'
      },
      {
        id: 'consulta-1',
        tipo: 'consulta',
        titulo: 'Consulta de retorno',
        data: '2026-07-22T13:00:00.000Z',
        status: 'agendada',
        origemId: 'consulta-1'
      },
      {
        id: 'resposta-1',
        tipo: 'resposta_formulario',
        titulo: 'Resposta de Check-in semanal',
        data: '2026-07-21T15:00:00.000Z',
        status: 'finalizado',
        origem: 'Formularios',
        autorUsuarioId: 'usuario-paciente-1'
      },
      {
        id: 'envio-1',
        tipo: 'formulario',
        titulo: 'Formulario',
        data: '2026-07-20T13:00:00.000Z',
        status: 'enviado'
      }
    ];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        itens: itens.filter((item) => (!tipo || item.tipo === tipo)
          && (!responsavelId || item.responsavelId === responsavelId))
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
        data: '2026-09-22T13:00:00.000Z',
        status: 'agendada'
      },
      {
        id: 'consulta-0',
        tipo: 'consulta',
        titulo: 'Primeira consulta',
        descricao: 'Presencial',
        data: '2026-07-15T13:00:00.000Z',
        status: 'concluida',
        origemId: 'consulta-0'
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
          profissionalResponsavelId,
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
          checkinsRapidos: 1,
          mensagens: 1,
          evolucoes: criouEvolucao ? 1 : 0,
          tarefasPendentes: criouTarefa ? 1 : 0,
          ultimoAtendimento: {
            consultaId: 'consulta-0',
            titulo: 'Primeira consulta',
            concluidaEm: '2026-07-15T13:00:00.000Z'
          },
          planoAtual: {
            planoId: 'plano-1',
            versaoId: 'plano-versao-2',
            numeroVersao: 2,
            publicadaEm: '2026-07-23T18:00:00.000Z'
          },
          tarefaVencida: {
            tarefaId: 'tarefa-vencida',
            titulo: 'Revisar exames pendentes',
            vencimentoEm: '2026-07-19T13:00:00.000Z'
          },
          falhaComunicacao: {
            mensagemId: 'mensagem-falha',
            registradaEm: '2026-07-22T16:00:00.000Z'
          },
          indicadoresRecentes: [
            { tipo: 'adesao', valor: '85%', fonte: 'Check-in rapido', registradoEm: '2026-07-21T18:00:00.000Z' },
            { tipo: 'sintomas', valor: 'Sono leve', fonte: 'Check-in rapido', registradoEm: '2026-07-21T18:00:00.000Z' }
          ],
          proximaConduta: {
            tipo: 'falha_comunicacao',
            titulo: 'Revisar falha de comunicacao',
            descricao: 'Uma mensagem para este paciente nao foi entregue.',
            destino: 'mensagens',
            referenciaId: 'mensagem-falha',
            dataReferencia: '2026-07-22T16:00:00.000Z'
          },
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

  await page.route('**/api/pacientes/paciente-1/avaliacoes-antropometricas', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        avaliacoes: [
          {
            id: 'avaliacao-2', pacienteId: 'paciente-1', avaliadaEm: '2026-07-21', protocolo: 'nenhum',
            medidas: { pesoKg: 68.2, alturaCm: 165 },
            resultado: { imc: 25.05, protocoloAplicado: 'nenhum', avisos: [] },
            criadoEm: '2026-07-21T13:00:00.000Z'
          },
          {
            id: 'avaliacao-1', pacienteId: 'paciente-1', avaliadaEm: '2026-06-21', protocolo: 'nenhum',
            medidas: { pesoKg: 70.4, alturaCm: 165 },
            resultado: { imc: 25.86, protocoloAplicado: 'nenhum', avisos: [] },
            criadoEm: '2026-06-21T13:00:00.000Z'
          }
        ],
        deltaUltimas: [{ campo: 'pesoKg', anterior: 70.4, atual: 68.2, variacao: -2.2 }]
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

  await page.route('**/api/materiais', async (route) => {
    if (route.request().method() === 'POST') {
      criouMaterial = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'material-1',
          tenantId: 'tenant-1',
          criadoPorUsuarioId: 'usuario-profissional-1',
          titulo: 'Guia de hidratacao',
          tipo: 'link',
          categoria: 'Habitos',
          resumo: 'Orientacao simples para rotina diaria.',
          url: 'https://example.com/hidratacao',
          ativo: true,
          criadoEm: '2026-07-22T18:00:00.000Z',
          atualizadoEm: '2026-07-22T18:00:00.000Z'
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        criouMaterial
          ? [
              {
                id: 'material-1',
                tenantId: 'tenant-1',
                criadoPorUsuarioId: 'usuario-profissional-1',
                titulo: 'Guia de hidratacao',
                tipo: 'link',
                categoria: 'Habitos',
                resumo: 'Orientacao simples para rotina diaria.',
                url: 'https://example.com/hidratacao',
                ativo: true,
                criadoEm: '2026-07-22T18:00:00.000Z',
                atualizadoEm: '2026-07-22T18:00:00.000Z'
              }
            ]
          : []
      )
    });
  });

  await page.route('**/api/materiais/pacientes/paciente-1', async (route) => {
    if (route.request().method() === 'POST') {
      enviouMaterial = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'envio-material-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          materialId: 'material-1',
          enviadoPorUsuarioId: 'usuario-profissional-1',
          titulo: 'Guia de hidratacao',
          tipo: 'link',
          categoria: 'Habitos',
          resumo: 'Orientacao simples para rotina diaria.',
          url: 'https://example.com/hidratacao',
          observacao: 'Ler antes do retorno.',
          status: 'enviado',
          enviadoEm: '2026-07-22T19:00:00.000Z',
          criadoEm: '2026-07-22T19:00:00.000Z',
          atualizadoEm: '2026-07-22T19:00:00.000Z'
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        enviouMaterial
          ? [
              {
                id: 'envio-material-1',
                tenantId: 'tenant-1',
                pacienteId: 'paciente-1',
                materialId: 'material-1',
                enviadoPorUsuarioId: 'usuario-profissional-1',
                titulo: 'Guia de hidratacao',
                tipo: 'link',
                categoria: 'Habitos',
                resumo: 'Orientacao simples para rotina diaria.',
                url: 'https://example.com/hidratacao',
                observacao: 'Ler antes do retorno.',
                status: 'enviado',
                enviadoEm: '2026-07-22T19:00:00.000Z',
                criadoEm: '2026-07-22T19:00:00.000Z',
                atualizadoEm: '2026-07-22T19:00:00.000Z'
              }
            ]
          : []
      )
    });
  });

  await page.route('https://upload.example/**', async (route) => {
    await route.fulfill({ status: 200, body: '' });
  });

  await page.route('**/api/mobile/midias/uploads**', async (route) => {
    const requisicao = route.request();
    const url = new URL(requisicao.url());
    if (url.pathname.endsWith('/confirmacao')) {
      const confirmado = {
        id: 'anexo-1',
        pacienteId: 'paciente-1',
        tipo: 'documento',
        categoria: 'exame',
        nomeArquivo: 'hemograma.pdf',
        mimeType: 'application/pdf',
        tamanhoBytes: '18',
        hashConteudo: 'sha256-real',
        status: 'confirmado',
        criadoEm: '2026-07-22T20:00:00.000Z',
        confirmadoEm: '2026-07-22T20:00:01.000Z'
      };
      anexos = [confirmado];
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(confirmado) });
      return;
    }
    if (url.pathname.endsWith('/acesso')) {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ url: 'https://download.example/anexo-1', expiraEmSegundos: 300 }) });
      return;
    }
    if (requisicao.method() === 'DELETE') {
      anexos = [];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'excluido' }) });
      return;
    }
    if (requisicao.method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          arquivo: { id: 'anexo-1', pacienteId: 'paciente-1', tipo: 'documento', categoria: 'exame', mimeType: 'application/pdf', tamanhoBytes: '0', status: 'pendente', criadoEm: '2026-07-22T20:00:00.000Z' },
          uploadUrl: 'https://upload.example/anexo-1',
          uploadHeaders: { 'Content-Type': 'application/pdf' },
          expiraEmSegundos: 300
        })
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(anexos) });
  });

  await page.route('**/api/pacientes/paciente-1/documentos', async (route) => {
    if (route.request().method() === 'POST') {
      corpoDocumentoEmitido = route.request().postDataJSON();
      documentos = [
        {
          id: 'documento-1',
          tipo: 'declaracao_comparecimento',
          titulo: 'Declaracao de comparecimento',
          corpo: 'Declaro que Ana Souza compareceu em 15/07/2026.',
          paragrafos: ['Declaro que Ana Souza compareceu em 15/07/2026.', 'Recife, 05 de agosto de 2026.'],
          cabecalho: {
            clinicaNome: 'Clinica Carla',
            clinicaDocumento: '12.345.678/0001-90',
            clinicaEndereco: 'Rua A, 10 - Recife/PE',
            profissionalNome: 'Dra. Carla',
            profissionalRegistro: 'CRN-6 1234',
            profissionalEspecialidade: 'Nutricao clinica'
          },
          consultaId: 'consulta-0',
          emitidoEm: '2026-08-05T12:00:00.000Z',
          podeEnviarPorEmail: true,
          variaveisVazias: []
        }
      ];
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(documentos[0]) });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(documentos) });
  });

  return {
    corpoDocumentoEmitido: () => corpoDocumentoEmitido,
    criouEvolucao: () => criouEvolucao,
    criouTarefa: () => criouTarefa,
    criouMaterial: () => criouMaterial,
    enviouMaterial: () => enviouMaterial,
    condutas: () => condutas,
    revogouConvite: () => revogouConvite
  };
}

test.describe('painel clinico profissional', () => {
  test('Professional conserva o proprio escopo e mostra filas clinicas', async ({ page }) => {
    await prepararDashboardMockado(page);
    await page.route('**/api/dashboard/clinico?*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        contexto: { periodo: 'hoje', inicioEm: '2026-07-22T00:00:00.000Z', fimEm: '2026-07-22T23:59:59.999Z', profissionalId: 'profissional-1', profissionalNome: 'Dra. Carla' },
        indicadores: { consultasHoje: 1, proximas: 1, concluidas: 0, reagendadas: 0, canceladas: 0, faltas: 0, semRetorno30: 1, semRetorno60: 0, semRetorno90Mais: 0, formulariosPendentes: 1, tarefasVencidas: 1, solicitacoesPendentes: 1, comunicacoesEmAlerta: 1, pacientesRiscoAlto: 1 },
        atendimentos: [{ id: 'consulta-1', pacienteId: 'paciente-1', profissionalId: 'profissional-1', pacienteNome: 'Ana Souza', inicioEm: '2026-07-22T13:00:00.000Z', fimEm: '2026-07-22T14:00:00.000Z', status: 'agendada' }],
        semRetorno: [{ pacienteId: 'paciente-2', profissionalId: 'profissional-1', pacienteNome: 'Bruno Lima', nivelRisco: 'alto', scoreRisco: 82, diasSemRetorno: 31, faixa: '30' }],
        tarefasVencidas: [{ id: 'tarefa-1', pacienteId: 'paciente-1', profissionalId: 'profissional-1', pacienteNome: 'Ana Souza', titulo: 'Revisar plano alimentar', prioridade: 'alta', vencimentoEm: '2026-07-21T12:00:00.000Z' }],
        formulariosPendentes: [{ id: 'envio-1', pacienteId: 'paciente-1', profissionalId: 'profissional-1', pacienteNome: 'Ana Souza', questionarioId: 'questionario-1', respondidoEm: '2026-07-21T10:00:00.000Z' }],
        solicitacoesPendentes: [{ id: 'solicitacao-1', profissionalId: 'profissional-1', solicitanteNome: 'Marina Reis', inicioEm: '2026-07-23T14:00:00.000Z', fimEm: '2026-07-23T14:30:00.000Z', expiraEm: '2026-07-23T12:00:00.000Z' }],
        comunicacoes: [{ id: 'mensagem-1', pacienteId: 'paciente-1', profissionalId: 'profissional-1', pacienteNome: 'Ana Souza', status: 'recebido', criadoEm: '2026-07-22T10:00:00.000Z' }],
        alertas: [], selecaoObrigatoria: false
      }) });
    });
    await page.goto('/dashboard?profissionalId=profissional-2');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Painel clinico' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hoje em foco' })).toBeVisible();
    await expect(page.getByText('Ana Souza').first()).toBeVisible();
    await expect(page.getByLabel('Profissional em contexto')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Criar retorno' })).toHaveAttribute('href', /pacienteId=paciente-2/);
    await assertSemOverflowHorizontal(page);
  });

  test('SuperAdmin seleciona profissional e conclui tarefa sem overflow', async ({ page }) => {
    let tarefaConcluida = false;
    await prepararSessaoConsoleMockada(page);
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ autenticado: true, apiUrl: credenciais.apiUrl, tenantSlug: credenciais.tenantSlug, email: credenciais.email, expiraEm: '2026-07-27T15:00:00.000Z', papel: 'SuperAdmin', permissoes: ['dashboard.ler', 'profissionais.ler', 'pacientes.gerenciar'], destinoInicial: '/dashboard' }) });
    });
    await page.route('**/api/profissionais**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [{ id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-1', nome: 'Dra. Carla', criadoEm: '2026-07-20T10:00:00.000Z' }, { id: 'profissional-2', tenantId: 'tenant-1', usuarioId: 'usuario-2', nome: 'Dr. Paulo', criadoEm: '2026-07-20T10:00:00.000Z' }], total: 2 }) });
    });
    await page.route('**/api/dashboard/clinico?*', async (route) => {
      const selecionado = new URL(route.request().url()).searchParams.get('profissionalId');
      const base = { contexto: { periodo: 'hoje', inicioEm: '2026-07-22T00:00:00.000Z', fimEm: '2026-07-22T23:59:59.999Z', profissionalId: selecionado, profissionalNome: 'Dr. Paulo' }, indicadores: { consultasHoje: 0, proximas: 0, concluidas: 0, reagendadas: 0, canceladas: 0, faltas: 0, semRetorno30: 0, semRetorno60: 0, semRetorno90Mais: 0, formulariosPendentes: 0, tarefasVencidas: tarefaConcluida ? 0 : 1, solicitacoesPendentes: 0, comunicacoesEmAlerta: 0, pacientesRiscoAlto: 0 }, atendimentos: [], semRetorno: [], formulariosPendentes: [], solicitacoesPendentes: [], comunicacoes: [], alertas: [], selecaoObrigatoria: !selecionado };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...base, tarefasVencidas: selecionado && !tarefaConcluida ? [{ id: 'tarefa-2', pacienteId: 'paciente-2', profissionalId: selecionado, pacienteNome: 'Beatriz', titulo: 'Revisar exames', prioridade: 'alta', vencimentoEm: '2026-07-21T12:00:00.000Z' }] : [] }) });
    });
    await page.route('**/api/dashboard/clinico/pacientes/paciente-2/tarefas/tarefa-2/concluir', async (route) => {
      expect(route.request().postData()).toBeNull();
      tarefaConcluida = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'tarefa-2', status: 'concluida' }) });
    });
    await page.goto('/dashboard');
    await expect(page.getByLabel('Profissional em contexto')).toBeVisible();
    await page.getByLabel('Profissional em contexto').selectOption('profissional-2');
    await expect(page.getByText('Revisar exames')).toBeVisible();
    await page.getByRole('button', { name: 'Concluir tarefa' }).click();
    await expect(page.getByRole('dialog', { name: 'Confirmar acao' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('Tarefa concluida.')).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });

  test('SuperAdmin limpa dados antigos e ignora resposta obsoleta ao trocar contexto', async ({ page }) => {
    let liberarRespostaPaulo;
    const respostaPauloLiberada = new Promise((resolve) => {
      liberarRespostaPaulo = resolve;
    });

    await prepararSessaoConsoleMockada(page);
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          autenticado: true,
          apiUrl: credenciais.apiUrl,
          tenantSlug: credenciais.tenantSlug,
          email: credenciais.email,
          expiraEm: '2026-07-27T15:00:00.000Z',
          papel: 'SuperAdmin',
          permissoes: ['dashboard.ler', 'profissionais.ler', 'pacientes.gerenciar'],
          destinoInicial: '/dashboard'
        })
      });
    });
    await page.route('**/api/profissionais**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          itens: [
            { id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-1', nome: 'Dra. Carla', criadoEm: '2026-07-20T10:00:00.000Z' },
            { id: 'profissional-2', tenantId: 'tenant-1', usuarioId: 'usuario-2', nome: 'Dr. Paulo', criadoEm: '2026-07-20T10:00:00.000Z' }
          ],
          total: 2
        })
      });
    });
    await page.route('**/api/dashboard/clinico?*', async (route) => {
      const profissionalId = new URL(route.request().url()).searchParams.get('profissionalId');
      if (profissionalId === 'profissional-2') await respostaPauloLiberada;
      const nome = profissionalId === 'profissional-2' ? 'Dr. Paulo' : 'Dra. Carla';
      const tarefa = profissionalId === 'profissional-2' ? 'Tarefa Paulo' : 'Tarefa Carla';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          contexto: { periodo: 'hoje', inicioEm: '2026-07-22T00:00:00.000Z', fimEm: '2026-07-22T23:59:59.999Z', profissionalId, profissionalNome: nome },
          indicadores: { consultasHoje: 0, proximas: 0, concluidas: 0, reagendadas: 0, canceladas: 0, faltas: 0, semRetorno30: 0, semRetorno60: 0, semRetorno90Mais: 0, formulariosPendentes: 0, tarefasVencidas: profissionalId ? 1 : 0, solicitacoesPendentes: 0, comunicacoesEmAlerta: 0, pacientesRiscoAlto: 0 },
          atendimentos: [],
          semRetorno: [],
          tarefasVencidas: profissionalId ? [{ id: `tarefa-${profissionalId}`, pacienteId: `paciente-${profissionalId}`, profissionalId, pacienteNome: nome, titulo: tarefa, prioridade: 'alta', vencimentoEm: '2026-07-21T12:00:00.000Z' }] : [],
          formulariosPendentes: [],
          solicitacoesPendentes: [],
          comunicacoes: [],
          alertas: [],
          selecaoObrigatoria: !profissionalId
        })
      });
    });

    await page.goto('/dashboard');
    await expect(page.getByLabel('Profissional em contexto')).toBeVisible();
    await page.getByLabel('Profissional em contexto').selectOption('profissional-1');
    await expect(page.getByText('Tarefa Carla')).toBeVisible();

    await page.getByLabel('Profissional em contexto').selectOption('profissional-2');
    await expect(page.getByText('Tarefa Carla')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Concluir tarefa' })).toHaveCount(0);

    await page.getByLabel('Profissional em contexto').selectOption('profissional-1');
    await expect(page.getByText('Tarefa Carla')).toBeVisible();
    liberarRespostaPaulo();
    await expect(page.getByText('Tarefa Paulo')).toHaveCount(0);
    await expect(page.getByText('Tarefa Carla')).toBeVisible();
  });
});

test.describe('agenda de producao', () => {
  test('mantem agenda interna visual sem Google e sinaliza horarios ocupados', async ({ page }) => {
    await prepararDashboardMockado(page, { googleConectado: false });
    await page.goto('/agenda');

    const agendaInterna = page.getByRole('region', { name: 'Agenda interna semanal' });
    await expect(agendaInterna).toBeVisible();
    await expect(agendaInterna.getByText('Google Agenda opcional')).toBeVisible();
    await expect(agendaInterna.getByRole('button', { name: /Horario ocupado: Ana Souza/ })).toBeVisible();
    await expect(agendaInterna.getByText('Indisponivel')).toBeVisible();
    await expect(agendaInterna.getByRole('button', { name: 'Semana anterior' })).toBeVisible();
    await expect(agendaInterna.getByRole('button', { name: 'Proxima semana' })).toBeVisible();
    await agendaInterna.getByRole('button', { name: 'mes' }).click();
    await expect(agendaInterna.getByText('Seg')).toBeVisible();
    await agendaInterna.getByRole('button', { name: 'lista' }).click();
    await expect(agendaInterna.getByRole('button', { name: /Abrir detalhes de Ana Souza/ })).toBeVisible();
    await agendaInterna.getByRole('button', { name: /Abrir detalhes de Ana Souza/ }).click();
    const detalhes = page.getByRole('dialog', { name: 'Detalhes da consulta' });
    await expect(detalhes).toBeVisible();
    await expect(detalhes.getByText(/Google Agenda:/)).toBeVisible();
    await expect(detalhes.getByRole('button', { name: 'Remarcar' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Meus recebimentos' })).toBeVisible();
    await expect(page.getByText('R$ 180,00').first()).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });

  test('permite remarcar e cancelar consulta agendada', async ({ page }) => {
    const agenda = await prepararDashboardMockado(page);
    await page.goto('/agenda');

    await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();
    const consultaAna = page.locator('article').filter({ hasText: 'Ana Souza' });
    await expect(consultaAna).toBeVisible();

    await consultaAna.getByRole('button', { name: 'Gerenciar consulta' }).click();
    const detalhes = page.getByRole('dialog', { name: 'Detalhes da consulta' });
    await expect(detalhes).toBeVisible();
    await detalhes.getByLabel('Nova data e hora').fill('2026-07-24T10:30');
    await detalhes.getByLabel('Nova duracao').fill('45');
    await detalhes.getByLabel('Novo local').fill('Sala 2');
    await detalhes.getByRole('button', { name: 'Remarcar' }).click();

    await expect.poll(() => agenda.remarcouConsulta()).toBe(true);
    await expect(
      page.getByText('Consulta remarcada e horario atualizado na agenda interna. Integracoes processadas conforme configuracao.')
    ).toBeVisible();
    await expect(consultaAna.getByText('24/07/2026')).toBeVisible();
    await expect(consultaAna.getByText('Reagendada')).toBeVisible();

    await detalhes.getByRole('button', { name: 'Cancelar', exact: true }).click();
    const confirmacao = page.getByRole('dialog', { name: 'Cancelar consulta' });
    await expect(confirmacao).toBeVisible();
    await expect(confirmacao.getByText(/libera o horario na agenda interna/)).toBeVisible();
    await confirmacao.getByRole('button', { name: 'Cancelar consulta', exact: true }).click();

    await expect.poll(() => agenda.cancelouConsulta()).toBe(true);
    await expect(
      page.getByText('Consulta cancelada e horario liberado na agenda interna. Integracoes processadas conforme configuracao.')
    ).toBeVisible();
    await expect(consultaAna.getByText('Cancelada')).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });
});

test.describe('lista de pacientes operacional', () => {
  test('filtra prioridades e mostra o resumo clinico na lista', async ({ page }) => {
    await prepararDashboardMockado(page);
    await page.goto('/pacientes');

    await expect(page.getByRole('heading', { name: 'Pacientes', exact: true })).toBeVisible();
    await expect(page.locator('body')).toContainText('Ultima consulta');
    await expect(page.locator('body')).toContainText('Revisar risco');
    await page.getByRole('button', { name: 'Alta prioridade' }).click();
    await expect(page.locator('body')).toContainText('Ana Souza');
    await expect(page.locator('body')).not.toContainText('Bruno Lima');
    await page.getByRole('button', { name: 'Sem consulta futura' }).click();
    await expect(page.locator('body')).toContainText('Bruno Lima');
    await expect(page.locator('body')).toContainText('Agendar retorno');

    await page.getByRole('button', { name: 'Novo paciente' }).click();
    await expect(page.getByRole('heading', { name: 'Identificacao' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Contato' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Responsavel e acompanhamento' })).toBeVisible();
    await expect(page.getByLabel('E-mail ou telefone')).toBeVisible();
    await expect(page.getByText('Salve o cadastro primeiro. Depois, use a acao de convite na lista para liberar o acesso seguro ao portal do paciente.')).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });
});

test.describe('prontuario do paciente', () => {
  test('revisa qualidade cadastral e revoga convite pendente sem expor token anterior', async ({ page }) => {
    const prontuario = await prepararProntuarioMockado(page);
    await page.goto('/pacientes/paciente-1');

    await page.getByRole('button', { name: 'Editar cadastro do paciente' }).click();
    const cadastro = page.getByRole('dialog', { name: 'Cadastro do paciente' });
    await expect(cadastro.getByRole('heading', { name: 'Qualidade do cadastro' })).toBeVisible();
    await expect(cadastro.getByRole('progressbar', { name: 'Percentual do cadastro preenchido' })).toHaveAttribute('aria-valuenow', '68');
    await expect(cadastro.getByText(/Revisar: CEP, Endereco/)).toBeVisible();
    await expect(cadastro.getByText('Possiveis cadastros duplicados')).toBeVisible();
    await expect(cadastro.getByRole('link', { name: 'Ana Souza homonima' })).toHaveAttribute('href', '/pacientes/paciente-2');
    await expect(cadastro.getByText('Convite pendente', { exact: true })).toBeVisible();
    await expect(cadastro.getByText(/E-mail: permitido - WhatsApp: desativado/)).toBeVisible();
    await expect(cadastro.locator('a[href*="primeiro-acesso"]')).toHaveCount(0);

    await cadastro.getByRole('button', { name: 'Revogar convite' }).click();
    const confirmacao = page.getByRole('dialog', { name: 'Revogar convite pendente' });
    await confirmacao.getByRole('button', { name: 'Revogar convite' }).click();
    await expect.poll(() => prontuario.revogouConvite()).toBe(true);
    await expect(cadastro.getByText('Convite revogado', { exact: true })).toBeVisible();
    await expect(cadastro.getByText('Convite pendente revogado. O link anterior nao pode mais ser utilizado.')).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });

  test('organiza as funcoes do prontuario em areas clinicas', async ({ page }) => {
    await prepararProntuarioMockado(page);
    await page.goto('/pacientes/paciente-1');

    const areas = page.getByRole('tablist', { name: 'Areas principais do prontuario' });
    await expect(areas.getByRole('tab', { name: 'Resumo' })).toBeVisible();
    await expect(areas.getByRole('tab', { name: 'Atendimentos' })).toBeVisible();
    await expect(areas.getByRole('tab', { name: 'Avaliacoes' })).toBeVisible();
    await expect(areas.getByRole('tab', { name: 'Plano' })).toBeVisible();
    await expect(areas.getByRole('tab', { name: 'Documentos' })).toBeVisible();
    await expect(areas.getByRole('tab', { name: 'Financeiro' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Revisar falha de comunicacao' })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir acao' }).click();
    await expect(page.getByRole('heading', { name: 'Mensagens do paciente' })).toBeVisible();

    await areas.getByRole('tab', { name: 'Plano' }).click();
    await expect(page.getByRole('heading', { name: 'Plano de acompanhamento' })).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Subareas de Plano' }).getByRole('tab', { name: 'Acompanhamento' })).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });

  test('oferece atalhos seguros para as acoes frequentes do paciente', async ({ page }) => {
    await prepararProntuarioMockado(page);
    await page.goto('/pacientes/paciente-1');

    const acoes = page.getByRole('navigation', { name: 'Acoes rapidas do paciente' });
    await expect(acoes.getByRole('link', { name: 'Agendar' })).toHaveAttribute('href', '/agenda?pacienteId=paciente-1');
    await acoes.getByRole('button', { name: 'Formularios', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Formularios e check-ins' })).toBeVisible();
    await acoes.getByRole('button', { name: 'Anexar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Anexos do paciente' })).toBeVisible();

    await page.getByRole('tab', { name: 'Atendimentos' }).click();
    await page.getByLabel('Titulo da evolucao').fill('Rascunho clinico');
    await acoes.getByRole('link', { name: 'Agendar' }).click();
    await expect(page.getByRole('heading', { name: 'Sair sem salvar' })).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });

  test('identifica o contexto transversal e as acoes autorizadas apenas para SuperAdmin', async ({ page }) => {
    await prepararProntuarioMockado(page, {
      papel: 'SuperAdmin',
      permissoesExtras: ['profissionais.ler', 'planos_alimentares.ler', 'agenda.financeiro.ler']
    });
    await page.goto('/pacientes/paciente-1');

    const contexto = page.getByRole('status').filter({ hasText: 'Contexto SuperAdmin' });
    await expect(contexto).toBeVisible();
    await expect(contexto).toContainText('Dra. Carla');
    await expect(contexto).toContainText('As acoes ficam registradas no seu usuario.');

    const acoes = page.getByRole('navigation', { name: 'Acoes rapidas do paciente' });
    await expect(acoes.getByRole('button', { name: 'Nova evolucao' })).toBeVisible();
    await expect(acoes.getByRole('link', { name: 'Agendar' })).toHaveAttribute('href', '/agenda?pacienteId=paciente-1');
    await expect(acoes.getByRole('link', { name: 'Abrir consulta' })).toHaveAttribute(
      'href',
      '/agenda?pacienteId=paciente-1&consultaId=consulta-1'
    );
    await expect(acoes.getByRole('button', { name: 'Plano atual' })).toBeVisible();
    await expect(acoes.getByRole('button', { name: 'Revisar mensagem' })).toBeVisible();
    await expect(acoes.getByRole('link', { name: 'Financeiro' })).toHaveAttribute('href', '/agenda?pacienteId=paciente-1&financeiro=1');
    await assertSemOverflowHorizontal(page);
  });

  test('nao oferece troca de contexto nem acoes sem permissao a outros papeis', async ({ page }) => {
    await prepararProntuarioMockado(page, {
      papel: 'Collaborator',
      profissionalResponsavelId: 'profissional-outro',
      permissoesRemovidas: [
        'pacientes.gerenciar',
        'agenda.consultas.criar',
        'questionarios.ler',
        'comunicacoes.mensagens.ler'
      ]
    });
    await page.goto('/pacientes/paciente-1');

    await expect(page.getByText('Contexto SuperAdmin')).toHaveCount(0);
    await expect(page.getByLabel('Trocar contexto profissional')).toHaveCount(0);
    const acoes = page.getByRole('navigation', { name: 'Acoes rapidas do paciente' });
    await expect(acoes.getByRole('button', { name: 'Nova evolucao' })).toHaveCount(0);
    await expect(acoes.getByRole('button', { name: 'Nova tarefa' })).toHaveCount(0);
    await expect(acoes.getByRole('link', { name: 'Agendar' })).toHaveCount(0);
    await expect(acoes.getByRole('button', { name: 'Formularios' })).toHaveCount(0);
    await expect(acoes.getByRole('button', { name: 'Revisar mensagem' })).toHaveCount(0);
    await expect(acoes.getByRole('button', { name: 'Anexar' })).toHaveCount(0);
    await expect(acoes.getByRole('link', { name: 'Abrir consulta' })).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });

  test('apresenta resumo clinico acionavel e serie antropometrica acessivel', async ({ page }) => {
    await prepararProntuarioMockado(page, { permissoesExtras: ['planos_alimentares.ler'] });
    await page.goto('/pacientes/paciente-1');

    await expect(page.getByRole('heading', { name: 'Revisar falha de comunicacao' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Contexto operacional' })).toBeVisible();
    await expect(page.getByText('Versao 2')).toBeVisible();
    await expect(page.getByText('Revisar exames pendentes')).toBeVisible();
    await expect(page.getByText('85%')).toBeVisible();
    await expect(page.getByText(/Fonte: Check-in rapido em/).first()).toBeVisible();

    const serie = page.getByRole('region', { name: 'Evolucao antropometrica' });
    await expect(serie.getByRole('table')).toBeVisible();
    await expect(serie.getByRole('cell', { name: '68,2 kg' })).toBeVisible();
    await serie.getByLabel('Metrica da serie').selectOption('imc');
    await expect(serie.getByRole('cell', { name: '25,05 kg/m2' })).toBeVisible();

    await page.getByRole('button', { name: 'Abrir acao' }).click();
    await expect(page.getByRole('heading', { name: 'Mensagens do paciente' })).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });

  test('exibe linha do tempo clinica consolidada', async ({ page }) => {
    await prepararProntuarioMockado(page, {
      permissoesExtras: ['agenda.financeiro.ler', 'planos_alimentares.ler', 'profissionais.ler']
    });
    await page.goto('/pacientes/paciente-1');

    await expect(page.getByRole('heading', { name: 'Prontuario do paciente' })).toBeVisible();
    await expect(page.getByText('Ana Souza')).toBeVisible();
    await expect(page.getByText('Risco 82 pontos')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Linha de cuidado' })).toBeVisible();
    await page.getByRole('tab', { name: 'Atendimentos' }).click();
    await page.getByRole('tablist', { name: 'Subareas de Atendimentos' }).getByRole('tab', { name: 'Historico' }).click();
    await expect(page.getByRole('heading', { name: 'Linha do tempo clinica' })).toBeVisible();
    await expect(page.getByText('Mensagem recebida')).toBeVisible();
    await expect(page.getByText('Estou com duvida no plano.')).not.toBeVisible();
    await expect(page.getByText('Consulta de retorno')).toBeVisible();
    await expect(page.getByText('Resposta de Check-in semanal')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Formulario', exact: true })).toBeVisible();
    await expect(page.getByText('Plano alimentar publicado')).toBeVisible();
    await expect(page.getByText('Avaliacao antropometrica')).toBeVisible();
    await expect(page.getByText('Pagamento de consulta')).toBeVisible();
    await expect(page.getByText('Origem: Plano alimentar - Autor: Dra. Carla')).toBeVisible();
    await expect(page.getByText('Origem: Formularios - Autor: paciente')).toBeVisible();
    await page.getByLabel('Responsavel').selectOption('profissional-1');
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await expect(page.getByText('Pagamento de consulta')).toBeVisible();
    await page.getByLabel('Tipo de evento').selectOption('evolucao_clinica');
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await expect(page.getByText('Ajuste de conduta')).toBeVisible();
    await expect(page.getByText('Mensagem recebida')).not.toBeVisible();
    await page.getByRole('button', { name: 'Abrir detalhe de Ajuste de conduta' }).click();
    await expect(page.getByRole('heading', { name: 'Nova evolucao clinica' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', '/pacientes');
    await assertSemOverflowHorizontal(page);
  });

  test('abre os novos eventos na fonte de verdade correspondente', async ({ page }) => {
    await prepararProntuarioMockado(page, {
      permissoesExtras: ['agenda.financeiro.ler', 'planos_alimentares.ler', 'profissionais.ler']
    });
    await page.goto('/pacientes/paciente-1');

    const abrirHistorico = async () => {
      await page.getByRole('tab', { name: 'Atendimentos' }).click();
      await page.getByRole('tablist', { name: 'Subareas de Atendimentos' }).getByRole('tab', { name: 'Historico' }).click();
    };
    const abrirEConferir = async (titulo, area, subarea) => {
      await page.getByRole('button', { name: `Abrir detalhe de ${titulo}` }).click();
      await expect(page.getByRole('tablist', { name: 'Areas principais do prontuario' })
        .getByRole('tab', { name: area, exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tablist', { name: `Subareas de ${area}` })
        .getByRole('tab', { name: subarea, exact: true })).toHaveAttribute('aria-selected', 'true');
      await abrirHistorico();
    };

    await abrirHistorico();
    await abrirEConferir('Plano alimentar publicado', 'Plano', 'Plano alimentar');
    await abrirEConferir('Avaliacao antropometrica', 'Avaliacoes', 'Antropometria');
    await abrirEConferir('Relatorio de alta emitido', 'Documentos', 'Documentos');
    await abrirEConferir('Anexo clinico confirmado', 'Documentos', 'Anexos');
    await abrirEConferir('Coleta de exames laboratoriais', 'Avaliacoes', 'Exames laboratoriais');
    await abrirEConferir('Serie fotografica clinica', 'Avaliacoes', 'Evolucao fotografica');
    await page.getByRole('button', { name: 'Abrir detalhe de Pagamento de consulta' }).click();
    await expect(page).toHaveURL('/agenda?financeiro=1&pacienteId=paciente-1');
  });

  test('emite declaracao apenas a partir de consulta concluida', async ({ page }) => {
    const prontuario = await prepararProntuarioMockado(page);
    await page.goto('/pacientes/paciente-1');

    await page.getByRole('tab', { name: 'Documentos' }).click();

    // Consulta agendada nao entra no seletor: declaracao nasce de comparecimento.
    const opcoes = await page.getByLabel('Consulta').locator('option').allTextContents();
    expect(opcoes.some((texto) => texto.includes('Primeira consulta'))).toBe(true);
    expect(opcoes.some((texto) => texto.includes('Consulta de retorno'))).toBe(false);

    await page.getByLabel('Consulta').selectOption('consulta-0');
    await page.getByRole('button', { name: 'Emitir documento' }).click();

    await expect.poll(() => prontuario.corpoDocumentoEmitido()).toEqual({
      tipo: 'declaracao_comparecimento',
      consultaId: 'consulta-0'
    });
    await expect(page.getByText('Declaracao de comparecimento emitida. Confira antes de imprimir.')).toBeVisible();

    // A folha impressa carrega a identidade da clinica e a identificacao do profissional.
    const folha = page.getByRole('region', { name: 'Visualizacao do documento' });
    await expect(folha.getByText('Clinica Carla')).toBeVisible();
    await expect(folha.getByText('12.345.678/0001-90')).toBeVisible();
    await expect(folha.getByText('Declaro que Ana Souza compareceu em 15/07/2026.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Imprimir / salvar PDF' })).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });

  test('permite registrar evolucao clinica privada', async ({ page }) => {
    const prontuario = await prepararProntuarioMockado(page);
    await page.goto('/pacientes/paciente-1');

    await page.getByRole('tab', { name: 'Atendimentos' }).click();
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

    await page.getByRole('tab', { name: 'Plano' }).click();
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
    await page.getByRole('tab', { name: 'Resumo' }).click();
    const atividade = page.getByRole('region', { name: 'Atividade do prontuario' });
    await expect(atividade.getByText('Tarefas pendentes')).toBeVisible();
    await expect(atividade.getByText('Tarefas pendentes').locator('..').getByText('1', { exact: true })).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });

  test('Fase 239 - valida jornada sintetica, versionada e acessivel de conduta terapeutica', async ({ page }) => {
    const prontuario = await prepararProntuarioMockado(page);
    await page.goto('/pacientes/paciente-1');

    await page.getByRole('tablist', { name: 'Areas principais do prontuario' }).getByRole('tab', { name: 'Plano' }).click();
    const subareas = page.getByRole('tablist', { name: 'Subareas de Plano' });
    const acompanhamento = subareas.getByRole('tab', { name: 'Acompanhamento' });
    await acompanhamento.focus();
    await acompanhamento.press('ArrowRight');
    const condutas = subareas.getByRole('tab', { name: 'Condutas terapeuticas' });
    await expect(condutas).toBeFocused();
    await expect(condutas).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Condutas terapeuticas' })).toBeVisible();
    await expect(page.getByText(/mantido fora do portal/i)).toBeVisible();

    await page.getByLabel('Titulo').fill('Teste sintetico de prontuario');
    await page.getByLabel('Conteudo documentado').fill('Conteudo de validacao sem orientacao clinica.');
    await page.getByRole('button', { name: 'Criar rascunho' }).click();
    await expect.poll(() => prontuario.condutas()[0]?.versoes[0]?.estado).toBe('rascunho');
    await expect(page.getByRole('button', { name: 'Publicar' })).toBeVisible();

    await page.getByRole('button', { name: 'Publicar' }).click();
    await expect.poll(() => prontuario.condutas()[0]?.versoes[0]?.estado).toBe('publicada');
    await page.getByRole('button', { name: 'Nova versao' }).click();
    await expect.poll(() => prontuario.condutas()[0]?.versoes).toHaveLength(2);
    await page.getByText('Ver versoes (2)').click();
    await expect(page.getByText('Versao 2: rascunho')).toBeVisible();

    await page.getByRole('button', { name: 'Arquivar' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Arquivar conduta terapeutica' });
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Arquivar conduta' }).click();
    await expect.poll(() => prontuario.condutas()[0]?.arquivadaEm).toBeTruthy();
    await expect(page.getByText('Conduta arquivada.')).toBeVisible();
    await expect(page.getByText('Arquivada', { exact: true })).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });

  test('permite criar material e enviar ao paciente', async ({ page }) => {
    const prontuario = await prepararProntuarioMockado(page);
    await page.goto('/pacientes/paciente-1');

    await page.getByRole('tab', { name: 'Plano' }).click();
    await page.getByRole('tablist', { name: 'Subareas de Plano' }).getByRole('tab', { name: 'Materiais' }).click();
    await page.getByLabel('Titulo do material').fill('Guia de hidratacao');
    await page.getByLabel('Tipo do material').selectOption('link');
    await page.getByLabel('Categoria do material').fill('Habitos');
    await page.getByLabel('URL do material').fill('https://example.com/hidratacao');
    await page.getByLabel('Resumo do material').fill('Orientacao simples para rotina diaria.');
    await page.getByRole('button', { name: 'Salvar material' }).click();

    await expect.poll(() => prontuario.criouMaterial()).toBe(true);
    await expect(page.getByText('Material salvo na biblioteca.')).toBeVisible();
    await page.getByLabel('Material para enviar').selectOption('material-1');
    await page.getByLabel('Observacao do envio').fill('Ler antes do retorno.');
    await page.getByRole('button', { name: 'Enviar material' }).click();

    await expect.poll(() => prontuario.enviouMaterial()).toBe(true);
    await expect(page.getByText('Material enviado ao paciente.', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Materiais enviados' })).toBeVisible();
    await expect(page.locator('article').filter({ hasText: 'Guia de hidratacao' })).toBeVisible();
    await expect(page.getByText('Ler antes do retorno.')).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });

  test('envia, confirma e exclui anexo clinico', async ({ page }) => {
    await prepararProntuarioMockado(page);
    await page.goto('/pacientes/paciente-1');

    await page.getByRole('tab', { name: 'Documentos' }).click();
    await page.getByRole('tablist', { name: 'Subareas de Documentos' }).getByRole('tab', { name: 'Anexos' }).click();
    await expect(page.getByLabel('Vincular a consulta')).toBeVisible();
    await page.getByLabel('Categoria do novo anexo').selectOption('exame');
    await page.getByLabel('Arquivo').setInputFiles({
      name: 'hemograma.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7 sintetico')
    });
    await page.getByRole('button', { name: 'Enviar anexo' }).click();

    await expect(page.getByText('Anexo confirmado e incluido no prontuario.')).toBeVisible();
    await expect(page.getByText('hemograma.pdf')).toBeVisible();
    await page.getByLabel('Filtrar anexos por categoria').selectOption('foto');
    await expect(page.getByText('Nenhum anexo nesta categoria')).toBeVisible();
    await page.getByLabel('Filtrar anexos por categoria').selectOption('exame');
    await expect(page.getByText('hemograma.pdf')).toBeVisible();
    await page.getByRole('button', { name: 'Excluir hemograma.pdf' }).click();
    await page.getByRole('button', { name: 'Excluir anexo', exact: true }).click();
    await expect(page.getByText('Nenhum anexo clinico')).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });
});


test.describe('operacoes LGPD', () => {
  test('exibe fila LGPD e permite iniciar tratativa', async ({ page }) => {
    const operacoes = await prepararOperacoesMockadas(page);
    await page.goto('/operacoes');

    await page.getByRole('tab', { name: 'Incidentes' }).click();
    await expect(page.getByRole('heading', { name: 'Alertas operacionais' })).toBeVisible();
    await expect(page.getByText('Outbox com eventos pendentes atrasados')).toBeVisible();
    await page.getByRole('tab', { name: 'Comunicacoes' }).click();
    await expect(page.getByRole('heading', { name: 'Central de comunicacao' })).toBeVisible();
    await expect(page.getByText('SMTP indisponivel')).toBeVisible();
    await page.getByRole('tab', { name: 'LGPD' }).click();
    await expect(page.getByRole('heading', { name: 'Solicitacoes LGPD' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Retencao e exclusao programada' })).toBeVisible();
    await expect(page.getByText('11 itens vencidos')).toBeVisible();
    await page.getByRole('button', { name: 'Programar retencao LGPD' }).click();
    await expect.poll(() => operacoes.programouRetencao()).toBe(true);
    await expect(page.getByText('Retencao LGPD programada: RET-20260723120000.')).toBeVisible();
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
    await page.getByRole('tab', { name: 'Auditoria' }).click();
    await expect(page.getByRole('heading', { name: 'Auditoria sensivel' })).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });
});

test.describe('operacoes assinatura', () => {
  test('exibe solicitacao comercial e permite aplicar plano manualmente', async ({ page }) => {
    const operacoes = await prepararOperacoesMockadas(page);
    await page.goto('/operacoes');

    await page.getByRole('tab', { name: 'Filas' }).click();
    await expect(page.getByRole('heading', { name: 'Assinaturas' })).toBeVisible();
    await expect(page.getByText('Mais usuarios administrativos.')).toBeVisible();
    await page.getByRole('button', { name: 'Aplicar Clinica' }).click();
    await expect(page.getByText('Plano Clinica aplicado para clinica-carla.')).toBeVisible();
    await expect.poll(() => operacoes.aplicouPlanoAssinatura()).toBe(true);
    await assertSemOverflowHorizontal(page);
  });
});

test.describe('operacoes rollout seguro', () => {
  test('mostra metricas sanitizadas e libera funcionalidades por clinica', async ({ page }) => {
    const operacoes = await prepararOperacoesMockadas(page);
    await page.goto('/operacoes');

    await page.getByRole('tab', { name: 'Rollout' }).click();
    await expect(page.getByRole('heading', { name: 'Release abc123def456' })).toBeVisible();
    await expect(page.getByText('promover', { exact: true })).toBeVisible();
    await expect(page.getByText('req-sintetico-1')).toBeVisible();
    await page.getByLabel('Clinica', { exact: true }).selectOption('00000000-0000-4000-8000-000000000002');
    await page.getByLabel('IA clinica').check();
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect.poll(() => operacoes.atualizouFlags()).toBe(true);
    await expect(page.getByText('Funcionalidades atualizadas para a clinica selecionada e registradas na auditoria.')).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });
});

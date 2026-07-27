import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Checagens genericas de acessibilidade/navegacao por teclado, reaproveitadas
// por todas as rotas criticas cobertas neste arquivo.
// ---------------------------------------------------------------------------

async function assertMainUnicoETituloVisivel(page) {
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('h1').first()).toBeVisible();
}

async function assertSemOverflowHorizontal(page) {
  const medidas = await page.evaluate(() => ({
    larguraDocumento: document.documentElement.scrollWidth,
    larguraViewport: document.documentElement.clientWidth
  }));

  expect(medidas.larguraDocumento).toBeLessThanOrEqual(medidas.larguraViewport + 1);
}

async function assertBotoesComNomeAcessivel(page) {
  const botoes = page.locator('button:visible, [role="button"]:visible');
  const total = await botoes.count();
  for (let indice = 0; indice < total; indice += 1) {
    await expect(botoes.nth(indice), `Botao ${indice + 1} de ${total} sem nome acessivel`).not.toHaveAccessibleName('');
  }
}

async function assertCamposComLabelAcessivel(page) {
  const campos = page.locator(
    'input:visible:not([type="hidden"]):not([type="submit"]):not([type="button"]), select:visible, textarea:visible'
  );
  const total = await campos.count();
  for (let indice = 0; indice < total; indice += 1) {
    await expect(campos.nth(indice), `Campo ${indice + 1} de ${total} sem label acessivel`).not.toHaveAccessibleName('');
  }
}

// Conta quantos elementos focalizaveis e visiveis existem na pagina, para
// usar como teto real da tabulacao abaixo (em vez de um numero fixo
// arbitrario). Sem isso, tabular alem do ultimo elemento focalizavel faz o
// Chromium headless (sem "chrome" de navegador para onde o foco possa ir)
// derrubar o foco para o body - o que e comportamento normal de fim de
// sequencia, nao uma perda de foco real, e nao deve reprovar o teste.
async function contarElementosFocalizaveis(page) {
  return page.evaluate(() => {
    const seletor =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll(seletor)).filter((elemento) => {
      const retangulo = elemento.getBoundingClientRect();
      return retangulo.width > 0 && retangulo.height > 0;
    }).length;
  });
}

// Tabula pela pagina ate o numero real de elementos focalizaveis detectados
// (com um teto para paginas muito longas) e, a cada passo, confirma que (a)
// o foco nao caiu de volta no body/foi perdido antes do esperado, (b) o
// elemento focado esta de fato visivel na tela, e (c) existe algum indicador
// visual de foco (outline ou box-shadow), o que cobre tanto "navegacao por
// Tab sem foco perdido" quanto "foco visivel em controles principais" em uma
// unica passada.
async function assertTabPreservaEExibeFoco(page) {
  const totalFocalizaveis = await contarElementosFocalizaveis(page);
  expect(totalFocalizaveis, 'Nenhum elemento focalizavel encontrado na pagina').toBeGreaterThan(0);

  const TETO_PARA_PAGINAS_LONGAS = 40;
  const voltas = Math.min(totalFocalizaveis, TETO_PARA_PAGINAS_LONGAS);

  for (let volta = 1; volta <= voltas; volta += 1) {
    await page.keyboard.press('Tab');

    const foco = await page.evaluate(() => {
      const ativo = document.activeElement;
      if (!ativo || ativo === document.body) return null;
      const retangulo = ativo.getBoundingClientRect();
      const estilo = getComputedStyle(ativo);
      return {
        tag: ativo.tagName,
        rotulo: ativo.getAttribute('aria-label') ?? ativo.textContent?.trim().slice(0, 40) ?? '',
        visivel: retangulo.width > 0 && retangulo.height > 0,
        outlineStyle: estilo.outlineStyle,
        outlineWidth: estilo.outlineWidth,
        boxShadow: estilo.boxShadow
      };
    });

    expect(
      foco,
      `Tab ${volta}/${voltas} (de ${totalFocalizaveis} elementos focalizaveis detectados): foco caiu no body ou foi perdido antes do esperado`
    ).not.toBeNull();

    expect(foco.visivel, `Tab ${volta}/${voltas}: elemento focado (${foco.tag} "${foco.rotulo}") nao esta visivel`).toBe(
      true
    );

    const temIndicadorDeFoco = (foco.outlineStyle !== 'none' && foco.outlineWidth !== '0px') || foco.boxShadow !== 'none';
    expect(
      temIndicadorDeFoco,
      `Tab ${volta}/${voltas}: elemento focado (${foco.tag} "${foco.rotulo}") sem indicador de foco visivel`
    ).toBe(true);
  }
}

async function rodarChecagensDeAcessibilidade(page) {
  await assertMainUnicoETituloVisivel(page);
  await assertBotoesComNomeAcessivel(page);
  await assertCamposComLabelAcessivel(page);
  await assertTabPreservaEExibeFoco(page);
  await assertSemOverflowHorizontal(page);
}

// ---------------------------------------------------------------------------
// Mocks de sessao/API por rota, reaproveitando o padrao ja usado em
// console-regression.spec.mjs, portal-cliente.spec.mjs e portal-paciente.spec.mjs
// (cookies de sessao falsa + page.route interceptando as chamadas de API).
// ---------------------------------------------------------------------------

async function prepararDashboardMockado(page) {
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
          'pacientes.listar',
          'questionarios.ler',
          'comunicacoes.mensagens.ler'
        ],
        destinoInicial: '/dashboard'
      })
    });
  });

  await page.route('**/api/agenda/consultas', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(consultasAgenda) });
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
          }
        ],
        total: 1
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
        }
      ])
    });
  });
}

async function prepararSessaoCliente(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Client', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/cliente'), domain: 'localhost', path: '/' }
  ]);

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        autenticado: true,
        apiUrl: 'http://localhost:3001',
        tenantSlug: 'clinica-carla',
        email: 'gestor@octaclin.local',
        expiraEm: '2026-07-22T15:00:00.000Z',
        papel: 'Client',
        permissoes: [
          'cliente.acessar',
          'cliente.assinatura.ler',
          'cliente.usuarios.ler',
          'cliente.usuarios.convidar',
          'cliente.usuarios.desativar',
          'cliente.convites.gerenciar',
          'cliente.configuracoes.gerenciar'
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
          slug: 'clinica-octa-real',
          status: 'ativo',
          criadoEm: '2026-07-01T10:00:00.000Z',
          atualizadoEm: '2026-07-20T10:00:00.000Z'
        },
        assinatura: {
          plano: 'Profissional',
          planoId: 'profissional',
          status: 'trial',
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
            usuariosAdministrativos: 3,
            pacientes: 82,
            mensagensMes: 790,
            formulariosAtivos: 12,
            armazenamentoMb: 640
          },
          alertas: [{ recurso: 'usuariosAdministrativos', uso: 3, limite: 3, percentual: 100, status: 'excedido' }]
        },
        usuarios: { totalAtivos: 4, clientes: 1, profissionais: 2, pacientes: 1 },
        acesso: { usuarioId: 'cliente-1', papel: 'Client', escopoDados: 'conta_cliente', destinoInicial: '/cliente' }
      })
    });
  });

  await page.route('**/api/cliente/usuarios', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        itens: [
          {
            id: 'cliente-1',
            tenantId: 'tenant-1',
            email: 'gestor@octaclin.local',
            role: 'Client',
            ativo: true,
            ultimoLoginEm: '2026-07-21T10:00:00.000Z',
            criadoEm: '2026-07-01T10:00:00.000Z',
            atualizadoEm: '2026-07-21T10:00:00.000Z'
          }
        ],
        total: 1
      })
    });
  });

  await page.route('**/api/cliente/usuarios/convites/historico', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], total: 0 }) });
  });

  await page.route('**/api/cliente/usuarios/convites', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], total: 0 }) });
  });

  await page.route('**/api/cliente/configuracoes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenantId: 'tenant-1',
        nome: 'Clinica Octa Real',
        slug: 'clinica-octa-real',
        status: 'ativo',
        timezone: 'America/Sao_Paulo',
        idioma: 'pt-BR',
        canaisPadrao: { email: true, whatsapp: true, googleCalendar: true },
        marca: { nomeExibido: 'Clinica Octa Real', emailRemetente: 'contato@octaclin.com.br', corPrimaria: '#197d8f' },
        atualizadoEm: '2026-07-20T10:00:00.000Z'
      })
    });
  });

  await page.route('**/api/cliente/perfil-empresa', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenantId: 'tenant-1',
        tipoPessoa: 'pj',
        documento: '12.345.678/0001-90',
        nomeLegal: 'OctaClin Consultoria LTDA',
        nomeFantasia: 'OctaClin Prime',
        inscricaoEstadual: 'isento',
        inscricaoMunicipal: '123456',
        responsavel: { nome: 'Carla Octa', email: 'carla@octaclin.com.br', telefone: '5511999990000', cargo: 'Diretora' },
        endereco: {
          cep: '01310-100',
          logradouro: 'Avenida Paulista',
          numero: '1000',
          complemento: 'cj 101',
          bairro: 'Bela Vista',
          cidade: 'Sao Paulo',
          uf: 'SP',
          pais: 'BR'
        },
        contatos: {
          emailFinanceiro: 'financeiro@octaclin.com.br',
          telefoneFinanceiro: '5511888880000',
          whatsappAtendimento: '5511992362080',
          emailAtendimento: 'atendimento@octaclin.com.br'
        },
        fiscal: { prepararRecibos: true, observacoes: 'Emitir recibos em nome do responsavel financeiro.' },
        atualizadoEm: '2026-07-20T10:00:00.000Z'
      })
    });
  });
}

const portalPacienteFixture = {
  paciente: {
    id: 'paciente-1',
    nome: 'Ana Paula',
    statusAdesao: 'aderente',
    scoreRisco: '12.50',
    ultimoCheckinEm: '2026-07-20T12:00:00.000Z'
  },
  perfil: {
    contato: 'ana@example.com',
    email: 'ana@example.com',
    whatsapp: '5511999999999',
    preferenciasContato: { email: true, whatsapp: true },
    dataNascimento: '1990-04-15',
    profissionalResponsavelId: 'profissional-1',
    ultimoCheckinEm: '2026-07-20T12:00:00.000Z'
  },
  resumo: {
    consultasProximas: 1,
    formulariosPendentes: 1,
    formulariosRespondidos: 1,
    mensagensRecentes: 1,
    tarefasPendentes: 1,
    materiaisDisponiveis: 1,
    checkinsRecentes: 1,
    notificacoesPendentes: 1,
    notificacoesHistorico: 2
  },
  consultasProximas: [
    {
      id: 'consulta-1',
      titulo: 'Consulta nutricional',
      inicioEm: '2026-08-10T13:00:00.000Z',
      fimEm: '2026-08-10T13:50:00.000Z',
      status: 'agendada',
      local: 'Online',
      googleEventHtmlLink: 'https://calendar.google.com/event'
    }
  ],
  formulariosPendentes: [
    {
      envioId: 'envio-1',
      questionarioId: 'questionario-1',
      titulo: 'Check-in semanal',
      status: 'enviado',
      expiraEm: '2026-08-12T12:00:00.000Z',
      linkFormulario: 'https://app.octaclin.test/formularios/token'
    }
  ],
  formulariosRespondidos: [
    {
      respostaId: '00000000-0000-0000-0000-000000000001',
      envioId: 'envio-2',
      questionarioId: 'questionario-2',
      titulo: 'Recordatorio alimentar',
      status: 'respondido',
      respondidoEm: '2026-07-19T12:05:00.000Z',
      finalizadoEm: '2026-07-19T12:05:00.000Z',
      scoreFinal: '87.40'
    }
  ],
  mensagensRecentes: [
    {
      id: 'mensagem-1',
      titulo: 'Consulta agendada',
      texto: 'Sua consulta foi agendada.',
      status: 'enviado',
      criadoEm: '2026-07-20T14:00:00.000Z',
      enviadoEm: '2026-07-20T14:01:00.000Z'
    }
  ],
  notificacoesPaciente: [
    {
      id: 'mensagem-1',
      canal: 'email',
      titulo: 'Consulta agendada',
      texto: 'Sua consulta foi agendada.',
      status: 'enviado',
      evento: 'agenda.consulta.agendada',
      criadoEm: '2026-07-20T14:00:00.000Z',
      enviadoEm: '2026-07-20T14:01:00.000Z'
    }
  ],
  tarefasAcompanhamento: [
    {
      id: 'tarefa-1',
      titulo: 'Registrar agua diariamente',
      descricao: 'Meta de 2 litros por dia.',
      categoria: 'meta',
      prioridade: 'alta',
      status: 'pendente',
      vencimentoEm: '2026-08-05T12:00:00.000Z',
      criadoEm: '2026-07-22T12:00:00.000Z',
      atualizadoEm: '2026-07-22T12:00:00.000Z'
    }
  ],
  materiaisDisponiveis: [
    {
      id: 'envio-material-1',
      materialId: 'material-1',
      titulo: 'Guia de hidratacao',
      tipo: 'link',
      categoria: 'Habitos',
      resumo: 'Orientacoes para hidratar melhor.',
      url: 'https://materiais.octaclin.test/hidratacao',
      observacao: 'Ler antes da proxima consulta.',
      status: 'enviado',
      enviadoEm: '2026-07-22T13:00:00.000Z',
      criadoEm: '2026-07-22T13:00:00.000Z',
      atualizadoEm: '2026-07-22T13:00:00.000Z'
    }
  ],
  diariosRecentes: [
    {
      id: 'diario-1',
      pacienteId: 'paciente-1',
      tipo: 'humor',
      humor: 'bem',
      adesaoPlano: 80,
      sintomas: 'Sono leve',
      observacoes: 'Consegui seguir o plano no almoco.',
      registradoEm: '2026-07-23T10:00:00.000Z'
    }
  ],
  lgpd: {
    versaoAtual: '2026-07',
    ultimoAceiteEm: '2026-07-10T10:00:00.000Z',
    documentosLegais: [
      {
        tipo: 'termos_uso',
        titulo: 'Termos de uso',
        versao: '2026-07',
        perfil: 'paciente',
        resumo: 'Regras de acesso e uso adequado do OctaClin.',
        obrigatorio: true,
        aceito: true,
        aceitoEm: '2026-07-10T10:00:00.000Z'
      },
      {
        tipo: 'politica_privacidade',
        titulo: 'Politica de privacidade',
        versao: '2026-07',
        perfil: 'paciente',
        resumo: 'Como seus dados pessoais e de saude sao tratados.',
        obrigatorio: true,
        aceito: false
      },
      {
        tipo: 'consentimento_lgpd',
        titulo: 'Consentimento LGPD',
        versao: '2026-07',
        perfil: 'paciente',
        resumo: 'Autorizacao para tratamento de dados no acompanhamento clinico.',
        obrigatorio: true,
        aceito: true,
        aceitoEm: '2026-07-10T10:00:00.000Z'
      }
    ],
    consentimentos: [
      {
        id: 'consentimento-1',
        tipo: 'primeiro_acesso_paciente',
        versao: '2026-07',
        aceitoEm: '2026-07-10T10:00:00.000Z',
        metadados: { origem: 'primeiro_acesso' }
      }
    ],
    solicitacoes: [
      {
        protocolo: 'LGPD-123',
        pacienteId: 'paciente-1',
        tipo: 'retificacao',
        status: 'em_tratamento',
        detalhes: 'Atualizar telefone cadastrado.',
        abertoEm: '2026-07-22T10:00:00.000Z',
        atualizadoEm: '2026-07-22T12:00:00.000Z',
        ultimaTratativa: 'Validando cadastro.',
        ultimaResposta: 'Atualizacao da solicitacao LGPD LGPD-123'
      }
    ]
  }
};

async function prepararSessaoPortalPaciente(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Patient', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/portal'), domain: 'localhost', path: '/' }
  ]);

  await page.route((url) => url.pathname === '/api/portal/paciente', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(portalPacienteFixture) });
  });

  await page.route((url) => url.pathname === '/api/portal/paciente/lgpd/solicitacoes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        protocolo: 'LGPD-123',
        pacienteId: 'paciente-1',
        tipo: 'retificacao',
        status: 'recebida',
        criadoEm: '2026-07-22T12:10:00.000Z'
      })
    });
  });
}

// ---------------------------------------------------------------------------
// Testes por rota critica.
// ---------------------------------------------------------------------------

test.describe('gate de acessibilidade - rotas criticas', () => {
  test('login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Acesso OctaClin' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('dashboard', async ({ page }) => {
    await prepararDashboardMockado(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('agenda interna', async ({ page }) => {
    await prepararDashboardMockado(page);
    await page.goto('/agenda');
    await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('portal do paciente', async ({ page }) => {
    await prepararSessaoPortalPaciente(page);
    await page.goto('/portal');
    await expect(page.locator('h1').first()).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('portal do cliente', async ({ page }) => {
    await prepararSessaoCliente(page);
    await page.goto('/cliente', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.getByRole('heading', { name: 'Portal do cliente' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });
});

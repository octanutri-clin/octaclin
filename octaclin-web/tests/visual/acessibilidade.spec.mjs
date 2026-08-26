import AxeBuilder from '@axe-core/playwright';
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
      'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll(seletor)).filter((elemento) => {
      const detalhesFechado = elemento.closest('details:not([open])');
      if (detalhesFechado && elemento !== detalhesFechado.querySelector(':scope > summary')) return false;
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
  // O toolbar de desenvolvimento do Next nao pertence ao produto e pode capturar Tab fora da viewport.
  await page.locator('nextjs-portal').evaluateAll((elementos) => elementos.forEach((elemento) => elemento.remove()));
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

// PR 14 da governanca: cobre o que a checagem manual acima nao cobre
// (contraste, ARIA invalido, hierarquia de headings, alt text, etc.) via
// axe-core, nas mesmas 5 rotas ja cobertas — ver GAP_ANALYSIS_A11Y_2026-08-25.md.
async function assertSemViolacoesAxe(page) {
  const resultado = await new AxeBuilder({ page })
    // Toolbar de dev do Next, mesma exclusao ja usada em assertTabPreservaEExibeFoco.
    .exclude('nextjs-portal')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violacoes = resultado.violations.map(
    (violacao) =>
      `${violacao.id} (impacto: ${violacao.impact}): ${violacao.help} — ${violacao.nodes.length} elemento(s) — ${violacao.helpUrl}`
  );

  expect(violacoes, `Violacoes de acessibilidade (axe-core):\n${violacoes.join('\n')}`).toEqual([]);
}

async function rodarChecagensDeAcessibilidade(page) {
  await assertMainUnicoETituloVisivel(page);
  await assertBotoesComNomeAcessivel(page);
  await assertCamposComLabelAcessivel(page);
  await assertTabPreservaEExibeFoco(page);
  await assertSemOverflowHorizontal(page);
  await assertSemViolacoesAxe(page);
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
          // `console.acessar` faz parte do papel Professional em
          // `auth/dominio/permissoes.ts`; sem ela aqui o sino de notificacoes da
          // Fase 210 nao renderiza e o gate passaria sem olhar para ele.
          'console.acessar',
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

  await page.route('**/api/notificacoes**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        naoLidas: 2,
        itens: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            tipo: 'mensagem_recebida',
            pacienteId: '22222222-2222-4222-8222-222222222222',
            pacienteNome: 'Paciente Sintetico',
            recursoTipo: 'mensagem_notificacao',
            recursoId: '33333333-3333-4333-8333-333333333333',
            lidoEm: null,
            criadoEm: '2026-08-06T10:00:00.000Z'
          }
        ]
      })
    });
  });

  await page.route('**/api/dashboard/clinico?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contexto: { periodo: 'hoje', inicioEm: '2026-07-22T00:00:00.000Z', fimEm: '2026-07-22T23:59:59.999Z' },
        indicadores: {
          consultasHoje: 0, proximas: 0, concluidas: 0, reagendadas: 0, canceladas: 0, faltas: 0,
          semRetorno30: 0, semRetorno60: 0, semRetorno90Mais: 0, formulariosPendentes: 0,
          tarefasVencidas: 0, solicitacoesPendentes: 0, comunicacoesEmAlerta: 0, pacientesRiscoAlto: 0
        },
        atendimentos: [], semRetorno: [], tarefasVencidas: [], formulariosPendentes: [],
        solicitacoesPendentes: [], comunicacoes: [], alertas: [], selecaoObrigatoria: false
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
          payload: { texto: 'Dra., posso trocar o horário?' },
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
          nome: 'Clínica Octa Real',
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
        nome: 'Clínica Octa Real',
        slug: 'clinica-octa-real',
        status: 'ativo',
        timezone: 'America/Sao_Paulo',
        idioma: 'pt-BR',
        canaisPadrao: { email: true, whatsapp: true, googleCalendar: true },
        marca: { nomeExibido: 'Clínica Octa Real', emailRemetente: 'contato@octaclin.com.br', corPrimaria: '#197d8f' },
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
  evolucaoPeso: [
    { data: '2026-05-10', pesoKg: 82.4 },
    { data: '2026-06-14', pesoKg: 80.1 },
    { data: '2026-07-19', pesoKg: 78.6 }
  ],
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
        titulo: 'Política de privacidade',
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

// PR 18 da governanca: mesmo mock ja usado em portal-paciente.spec.mjs para
// o detalhe de um formulario respondido (dados sinteticos identicos).
async function prepararDetalheFormularioRespondido(page) {
  await page.route('**/api/portal/paciente/formularios-respondidos/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        respostaId: '00000000-0000-0000-0000-000000000001',
        envioId: 'envio-2',
        questionarioId: 'questionario-2',
        titulo: 'Recordatorio alimentar',
        descricao: 'Resumo da resposta',
        scoreFinal: '87.40',
        finalizadoEm: '2026-07-19T12:05:00.000Z',
        respostas: [
          {
            perguntaId: 'pergunta-1',
            enunciado: 'Como foi sua adesao ao plano alimentar?',
            tipo: 'texto_longo',
            obrigatoria: true,
            ordem: 1,
            valor: 'Mantive boa adesão durante a semana.'
          }
        ]
      })
    });
  });
}

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
// Mocks das rotas publicas (PR 15 da governanca). Dados sinteticos,
// reaproveitando os mesmos fixtures ja usados em agendamento-publico.spec.mjs,
// formulario-publico.spec.mjs e pwa-portal.spec.mjs.
// ---------------------------------------------------------------------------

async function prepararAgendamentoPublico(page) {
  await page.route('**/api/agendamentos-publicos/token-publico', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        clinica: { nome: 'Clínica Bem Estar', corPrimaria: '#0ea5e9' },
        profissional: { nomeExibicao: 'Dra. Carla', especialidade: 'Nutricao clinica' },
        timezone: 'America/Sao_Paulo',
        duracaoMinutos: 50,
        dias: [
          {
            data: '2026-08-03',
            rotulo: '03/08/2026',
            horarios: [{ inicioEm: '2026-08-03T14:00:00.000Z', rotulo: '11:00' }]
          }
        ]
      })
    });
  });
}

// PR 16 da governanca: mocks das rotas de acesso publico (esqueci-senha,
// recuperar-senha, primeiro-acesso). Textos e formatos de resposta
// reaproveitados de acesso-ativacao.spec.mjs, console-regression.spec.mjs e
// primeiro-acesso-paciente.spec.mjs.
function prepararSolicitacaoRecuperacaoSenha(page, { falhar = false } = {}) {
  return page.route('**/api/auth/recuperar-senha', async (route) => {
    if (falhar) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ mensagem: 'Falha ao solicitar redefinicao.' })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ mensagem: 'Se o email estiver cadastrado, enviaremos as instrucoes.' })
    });
  });
}

function prepararValidacaoTokenRecuperacao(page, resposta) {
  return page.route('**/api/auth/recuperar-senha/validar', (route) => route.fulfill(resposta));
}

function prepararConviteAcessoPaciente(page, token, resposta) {
  return page.route(`**/api/pacientes/convites-acesso/${encodeURIComponent(token)}`, (route) => route.fulfill(resposta));
}

// assertTabPreservaEExibeFoco pressupoe foco inicial no <body> (como acontece
// logo apos um page.goto sem interacao). Os demais estados desta secao
// (formulario preenchido, sucesso) tem exatamente os mesmos elementos
// focalizaveis do estado inicial da mesma rota — a navegacao por Tab ja foi
// coberta la. Preencher campos via .fill() move o "ponto de retomada" do Tab
// do Chromium headless para o meio da pagina, e um blur() via JS nao o
// devolve ao topo (artefato conhecido, nao um problema real de foco para um
// usuario), entao repetir assertTabPreservaEExibeFoco aqui so daria falso
// negativo sem cobertura adicional.
async function rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page) {
  await assertMainUnicoETituloVisivel(page);
  await assertBotoesComNomeAcessivel(page);
  await assertCamposComLabelAcessivel(page);
  await assertSemOverflowHorizontal(page);
  await assertSemViolacoesAxe(page);
}

function prepararFormularioPublico(page, { token, titulo, pergunta }) {
  return page.route(`**/api/formularios/${token}`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        envioId: `envio-${token}`,
        titulo,
        status: 'enviado',
        rascunhoVersao: 0,
        respostasRascunho: [],
        perguntas: [pergunta]
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
    await expect(page.getByRole('heading', { name: 'Hoje' })).toBeVisible();
    // O sino da Fase 210 precisa estar em tela para as checagens abaixo o
    // cobrirem. Sem esta linha, uma permissao faltando no mock faria o gate
    // passar sem nunca olhar para o botao.
    await expect(page.getByRole('button', { name: 'Notificações, 2 não lidas' })).toBeVisible();
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

// PR 15 da governanca: expansao para rotas publicas criticas (sem sessao
// autenticada). Ver docs/governance/GAP_ANALYSIS_A11Y_2026-08-25.md secao 2.1.
test.describe('gate de acessibilidade - rotas publicas', () => {
  test('agendamento publico', async ({ page }) => {
    await prepararAgendamentoPublico(page);
    await page.goto('/agendar/token-publico');
    await expect(page.getByRole('heading', { name: 'Agendar com Dra. Carla' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('formulario publico', async ({ page }) => {
    await prepararFormularioPublico(page, {
      token: 'token-publico',
      titulo: 'Check-in semanal',
      pergunta: {
        id: '11111111-1111-4111-8111-111111111111',
        tipo: 'sim_nao',
        enunciado: 'Conseguiu seguir o plano?',
        obrigatoria: true,
        configuracao: { rotuloSim: 'Sim', rotuloNao: 'Nao' },
        opcoes: [],
        ordem: 1
      }
    });
    await page.goto('/formularios/token-publico');
    await expect(page.getByRole('heading', { name: 'Check-in semanal' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('formulario pwa (modo offline-first)', async ({ page }) => {
    await prepararFormularioPublico(page, {
      token: 'token-pwa',
      titulo: 'Check-in offline',
      pergunta: {
        id: 'pergunta-1',
        tipo: 'texto_longo',
        enunciado: 'Como voce esta?',
        obrigatoria: true,
        configuracao: { secao: 'Hoje', limiteCaracteres: 500 },
        opcoes: [],
        ordem: 1
      }
    });
    await page.goto('/formularios/token-pwa');
    await expect(page.getByRole('heading', { name: 'Check-in offline' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('formulario com upload de arquivo', async ({ page }) => {
    await prepararFormularioPublico(page, {
      token: 'token-upload',
      titulo: 'Envio de exame',
      pergunta: {
        id: '22222222-2222-4222-8222-222222222222',
        tipo: 'upload_midia',
        enunciado: 'Anexe o exame',
        obrigatoria: true,
        configuracao: { tiposAceitos: ['application/pdf'], maxArquivos: 1 },
        opcoes: [],
        ordem: 1
      }
    });
    await page.goto('/formularios/token-upload');
    await expect(page.getByRole('heading', { name: 'Envio de exame' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });
});

// PR 16 da governanca: acesso publico sem sessao (recuperacao de senha e
// primeiro acesso do paciente). Ver docs/governance/GAP_ANALYSIS_A11Y_2026-08-25.md.
test.describe('gate de acessibilidade - acesso publico', () => {
  test('esqueci a senha - estado inicial', async ({ page }) => {
    await page.goto('/esqueci-senha');
    await expect(page.getByRole('heading', { name: 'Recuperar senha' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('esqueci a senha - formulario preenchido', async ({ page }) => {
    await page.goto('/esqueci-senha');
    await page.getByLabel('Email').fill('paciente@example.com');
    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('esqueci a senha - validacao invalida (falha ao solicitar)', async ({ page }) => {
    await prepararSolicitacaoRecuperacaoSenha(page, { falhar: true });
    await page.goto('/esqueci-senha');
    await page.getByLabel('Email').fill('paciente@example.com');
    await page.getByRole('button', { name: 'Enviar link' }).click();
    // getByRole('alert') sozinho colide com o route-announcer do Next
    // (tambem role="alert"), por isso o texto exato do erro do formulario.
    await expect(page.getByText('Falha ao solicitar redefinicao.')).toBeVisible();
    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('esqueci a senha - sucesso', async ({ page }) => {
    await prepararSolicitacaoRecuperacaoSenha(page);
    await page.goto('/esqueci-senha');
    await page.getByLabel('Email').fill('paciente@example.com');
    await page.getByRole('button', { name: 'Enviar link' }).click();
    await expect(page.getByText('Se o email estiver cadastrado, enviaremos as instrucoes.')).toBeVisible();
    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('recuperar senha - estado inicial (token valido)', async ({ page }) => {
    await prepararValidacaoTokenRecuperacao(page, {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ email: 'paciente@example.com', expiraEm: '2026-08-01T12:00:00.000Z' })
    });
    await page.goto('/recuperar-senha?token=token-valido');
    await expect(page.getByRole('heading', { name: 'Nova senha' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('recuperar senha - formulario preenchido', async ({ page }) => {
    await prepararValidacaoTokenRecuperacao(page, {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ email: 'paciente@example.com', expiraEm: '2026-08-01T12:00:00.000Z' })
    });
    await page.goto('/recuperar-senha?token=token-valido');
    await page.locator('#nova-senha').fill('SenhaNova@123');
    await page.locator('#confirmar-senha').fill('SenhaNova@123');
    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('recuperar senha - validacao invalida (link nao encontrado)', async ({ page }) => {
    await prepararValidacaoTokenRecuperacao(page, {
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ mensagem: 'Token de redefinicao invalido.' })
    });
    await page.goto('/recuperar-senha?token=token-invalido');
    await expect(page.getByRole('heading', { name: 'Link não encontrado' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('recuperar senha - sucesso', async ({ page }) => {
    await prepararValidacaoTokenRecuperacao(page, {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ email: 'paciente@example.com', expiraEm: '2026-08-01T12:00:00.000Z' })
    });
    await page.route('**/api/auth/redefinir-senha', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mensagem: 'Senha redefinida.' }) })
    );
    await page.goto('/recuperar-senha?token=token-valido');
    await page.locator('#nova-senha').fill('SenhaNova@123');
    await page.locator('#confirmar-senha').fill('SenhaNova@123');
    await page.getByRole('button', { name: 'Redefinir senha' }).click();
    await expect(page.getByText('Senha redefinida. Entre novamente com a nova senha.')).toBeVisible();
    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('primeiro acesso - estado inicial (sem token)', async ({ page }) => {
    await page.goto('/primeiro-acesso');
    await expect(page.getByRole('heading', { name: 'Link de primeiro acesso indisponível' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('primeiro acesso - validacao invalida (convite nao encontrado)', async ({ page }) => {
    const token = 'tenant-1.token-invalido-a11y';
    await prepararConviteAcessoPaciente(page, token, {
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ mensagem: 'Convite não encontrado.' })
    });
    await page.goto(`/primeiro-acesso?token=${encodeURIComponent(token)}`);
    await expect(page.getByRole('heading', { name: 'Convite não encontrado' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  // Sucesso completo (clicar em "Ativar acesso") redireciona para /portal,
  // rota autenticada fora do escopo desta PR — parado deliberadamente no
  // passo de aceite de termos, ultimo estado que ainda pertence a esta rota.
  test('primeiro acesso - formulario preenchido (senha e termos)', async ({ page }) => {
    const token = 'tenant-1.token-valido-a11y';
    await prepararConviteAcessoPaciente(page, token, {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pacienteId: 'paciente-1',
        nomePaciente: 'Ana Paula',
        email: 'ana@example.com',
        status: 'pendente',
        expiraEm: '2026-08-01T12:00:00.000Z'
      })
    });
    await page.goto(`/primeiro-acesso?token=${encodeURIComponent(token)}`);
    await expect(page.getByRole('heading', { name: 'Primeiro acesso' })).toBeVisible();

    await page.locator('input[type="password"]').nth(0).fill('SenhaPaciente@123');
    await page.locator('input[type="password"]').nth(1).fill('SenhaPaciente@123');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByLabel('Aceito os Termos de uso do OctaClin')).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });
});

// PR 17 da governanca: areas autenticadas do portal do paciente. Reaproveita
// prepararSessaoPortalPaciente (mesmos mocks sinteticos do PR 14). O
// componente PortalPaciente renderiza todas as secoes na mesma arvore e
// oculta as demais via classe "hidden" (display:none), entao cada rota expoe
// apenas os elementos da sua propria secao ao axe-core e as checagens
// manuais, incluindo a navegacao por Tab.
test.describe('gate de acessibilidade - portal do paciente (areas autenticadas)', () => {
  test('agenda', async ({ page }) => {
    await prepararSessaoPortalPaciente(page);
    await page.goto('/portal/agenda');
    await expect(page.getByRole('heading', { name: 'Próximas consultas' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('checkins', async ({ page }) => {
    await prepararSessaoPortalPaciente(page);
    await page.goto('/portal/checkins');
    await expect(page.getByRole('heading', { name: 'Check-in rapido' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('mensagens', async ({ page }) => {
    await prepararSessaoPortalPaciente(page);
    await page.goto('/portal/mensagens');
    await expect(page.getByRole('heading', { name: 'Mensagens recentes' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  // Fixture nao inclui planoAlimentar: cobre de graca o estado vazio real
  // (plano ainda nao publicado pelo profissional).
  test('plano (estado vazio - plano ainda nao publicado)', async ({ page }) => {
    await prepararSessaoPortalPaciente(page);
    await page.goto('/portal/plano');
    await expect(page.getByRole('heading', { name: 'Plano alimentar' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('privacidade', async ({ page }) => {
    await prepararSessaoPortalPaciente(page);
    await page.goto('/portal/privacidade');
    await expect(page.getByRole('heading', { name: 'Privacidade' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });
});

// PR 18 da governanca: conclui a cobertura do portal do paciente autenticado
// (rotas restantes) e adiciona uma regressao por teclado para a correcao do
// nested-interactive feita no GraficoEvolucao (PR 17).
test.describe('gate de acessibilidade - portal do paciente (complemento PR 18)', () => {
  test('formularios', async ({ page }) => {
    await prepararSessaoPortalPaciente(page);
    await page.goto('/portal/formularios');
    await expect(page.getByRole('heading', { name: 'Formulários pendentes' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('formularios - ver respostas (interacao relevante)', async ({ page }) => {
    await prepararSessaoPortalPaciente(page);
    await prepararDetalheFormularioRespondido(page);
    await page.goto('/portal/formularios');
    await page.getByRole('button', { name: 'Ver respostas' }).click();
    await expect(page.getByText('Mantive boa adesão durante a semana.')).toBeVisible();
    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('mais', async ({ page }) => {
    await prepararSessaoPortalPaciente(page);
    await page.goto('/portal/mais');
    await expect(page.getByRole('heading', { name: 'Mais opções' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('perfil', async ({ page }) => {
    await prepararSessaoPortalPaciente(page);
    await page.goto('/portal/perfil');
    await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  // Valida a justificativa usada na correcao do PR 17: os dados por ponto do
  // grafico deixaram de ser focalizaveis via SVG, mas continuam 100%
  // acessiveis por teclado atraves do <details>/<summary> nativo abaixo dele.
  test('checkins - "Ver valores em tabela" abre por teclado', async ({ page }) => {
    await prepararSessaoPortalPaciente(page);
    await page.goto('/portal/checkins');

    const resumo = page.getByText('Ver valores em tabela');
    await resumo.focus();
    await expect(resumo).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('cell', { name: '82,4' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '78,6' })).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });
});

// ---------------------------------------------------------------------------
// Mocks de pacientes (PR 19 da governanca). Fixtures e labels reaproveitados
// de fase-254-pacientes.spec.mjs (mesmo formulario, mesmos nomes de campo).
// ---------------------------------------------------------------------------

const permissoesPacientes = ['console.acessar', 'pacientes.listar', 'pacientes.ler', 'pacientes.gerenciar', 'profissionais.ler'];

const profissionalPacientesFixture = {
  id: 'profissional-1',
  tenantId: 'tenant-1',
  nome: 'Dra. Carla',
  email: 'dra.carla@octaclin.local',
  especialidade: 'Nutrologia',
  criadoEm: '2026-07-20T10:00:00.000Z'
};

const pacienteFixture = {
  id: 'paciente-1',
  tenantId: 'tenant-1',
  profissionalResponsavelId: 'profissional-1',
  nome: 'Ana Sintética',
  contato: 'ana@example.com',
  dataNascimento: '1990-04-15',
  statusAdesao: 'em_acompanhamento',
  scoreRisco: '35',
  criadoEm: '2026-08-22T10:00:00.000Z'
};

const pacientesListaFixture = [
  pacienteFixture,
  {
    id: 'paciente-2',
    tenantId: 'tenant-1',
    profissionalResponsavelId: 'profissional-1',
    nome: 'Bruno Sintético',
    contato: '11988880000',
    dataNascimento: '1985-02-10',
    statusAdesao: 'risco',
    scoreRisco: '82',
    criadoEm: '2026-07-18T10:00:00.000Z'
  }
];

async function prepararSessaoPacientes(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/pacientes'), domain: 'localhost', path: '/' }
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
        permissoes: permissoesPacientes,
        destinoInicial: '/pacientes'
      })
    });
  });

  await page.route((url) => url.pathname === '/api/profissionais', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ itens: [profissionalPacientesFixture], total: 1 })
    });
  });

  await page.route((url) => url.pathname === '/api/pacientes/verificacao-duplicidade', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidatos: [] }) });
  });
}

function prepararListaPacientes(page, { itens = pacientesListaFixture, total = itens.length } = {}) {
  return page.route((url) => url.pathname === '/api/pacientes', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens, total }) });
  });
}

function prepararDetalhePaciente(page, paciente = pacienteFixture) {
  return page.route((url) => url.pathname === `/api/pacientes/${paciente.id}`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paciente) });
  });
}

// Cobre apenas a aba inicial (resumo) do prontuario, deliberadamente - as
// demais abas (evolucoes, financeiro, documentos, etc.) ficam registradas
// como risco residual no corpo do PR 19.
function prepararProntuarioPaciente(page, paciente = pacienteFixture) {
  return page.route((url) => url.pathname === `/api/pacientes/${paciente.id}/prontuario`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        paciente,
        resumo: {
          consultas: 1,
          formulariosPendentes: 1,
          respostas: 1,
          checkinsRapidos: 2,
          mensagens: 1,
          evolucoes: 1,
          tarefasPendentes: 1,
          indicadoresRecentes: []
        },
        linhaDoTempo: []
      })
    });
  });
}

function prepararAvaliacoesAntropometricas(page, pacienteId = pacienteFixture.id) {
  return page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/avaliacoes-antropometricas`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ avaliacoes: [], deltaUltimas: [] }) });
  });
}

// PR 19 da governanca: expande o gate de a11y para o ciclo principal de
// pacientes no console profissional - lista, cadastro, prontuario (aba
// inicial) e edicao.
test.describe('gate de acessibilidade - pacientes (PR 19)', () => {
  test('lista - carregada com pacientes sinteticos', async ({ page }) => {
    await prepararSessaoPacientes(page);
    await prepararListaPacientes(page);
    await page.goto('/pacientes');
    await expect(page.getByRole('heading', { name: 'Pacientes' })).toBeVisible();
    // Nome do paciente aparece duas vezes no DOM (tabela desktop + cartao
    // mobile); so uma das duas fica visivel por vez conforme o viewport.
    await expect(page.getByText('Ana Sintética').filter({ visible: true })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('lista - estado vazio', async ({ page }) => {
    await prepararSessaoPacientes(page);
    await prepararListaPacientes(page, { itens: [], total: 0 });
    await page.goto('/pacientes');
    await expect(page.getByRole('heading', { name: 'Pacientes' })).toBeVisible();
    await expect(page.getByText('Nenhum paciente encontrado com estes filtros.').filter({ visible: true })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  // Preenchimento move o foco do meio da tabulacao (mesmo artefato ja
  // documentado acima em rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado).
  test('lista - busca filtra a lista (interacao relevante)', async ({ page }) => {
    await prepararSessaoPacientes(page);
    const consultas = [];
    await page.route((url) => url.pathname === '/api/pacientes', async (route) => {
      consultas.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ itens: pacientesListaFixture, total: pacientesListaFixture.length })
      });
    });
    await page.goto('/pacientes');
    await page.getByLabel('Buscar pacientes').fill('Ana');
    await expect.poll(() => consultas.some((url) => url.includes('busca=Ana'))).toBe(true);
    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('lista - navegacao para o detalhe (interacao relevante)', async ({ page }) => {
    await prepararSessaoPacientes(page);
    await prepararListaPacientes(page);
    await prepararProntuarioPaciente(page);
    await prepararAvaliacoesAntropometricas(page);
    await page.goto('/pacientes');
    // exact: true evita casar com "Editar Ana Sintética"; visible: true
    // escolhe a unica instancia (tabela ou cartao) exibida no viewport atual.
    await page.getByRole('link', { name: 'Ana Sintética', exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/pacientes\/paciente-1$/);
    await expect(page.getByRole('heading', { name: 'Prontuário do paciente' })).toBeVisible();
    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('novo - cadastro inicial', async ({ page }) => {
    await prepararSessaoPacientes(page);
    await page.goto('/pacientes/novo');
    await expect(page.getByRole('heading', { name: 'Novo paciente' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('detalhe - aba inicial (resumo)', async ({ page }) => {
    await prepararSessaoPacientes(page);
    await prepararProntuarioPaciente(page);
    await prepararAvaliacoesAntropometricas(page);
    await page.goto('/pacientes/paciente-1');
    await expect(page.getByRole('heading', { name: 'Prontuário do paciente' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Contexto operacional' })).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('editar - dados preenchidos', async ({ page }) => {
    await prepararSessaoPacientes(page);
    await prepararDetalhePaciente(page);
    await page.goto('/pacientes/paciente-1/editar');
    await expect(page.getByRole('heading', { name: 'Editar paciente' })).toBeVisible();
    await expect(page.getByLabel('Nome completo')).toHaveValue('Ana Sintética');
    await rodarChecagensDeAcessibilidade(page);
  });
});

// ---------------------------------------------------------------------------
// Mocks do workspace de questionarios (PR 20 da governanca). Fixtures
// reaproveitadas de questionarios-editor.spec.mjs (mesmos ids e rotulos).
// ---------------------------------------------------------------------------

const permissoesQuestionarios = ['dashboard.ler', 'questionarios.ler', 'questionarios.gerenciar'];

const questionariosFixture = [
  { id: 'q-1', tenantId: 'tenant-1', profissionalId: 'profissional-1', titulo: 'Check-in semanal', descricao: 'Adesão', status: 'rascunho', versao: 1, criadoEm: '2026-07-01T10:00:00.000Z', atualizadoEm: '2026-07-01T10:00:00.000Z' },
  { id: 'q-2', tenantId: 'tenant-1', profissionalId: 'profissional-1', titulo: 'Avaliação mensal', descricao: 'Metricas', status: 'publicado', versao: 2, criadoEm: '2026-07-02T10:00:00.000Z', atualizadoEm: '2026-07-02T10:00:00.000Z' }
];

const perguntaQuestionarioFixture = {
  id: 'p-1', tenantId: 'tenant-1', questionarioId: 'q-1', categoriaId: 'cat-1', tipo: 'likert',
  enunciado: 'Como foi sua semana?', peso: '1', obrigatoria: true, configuracao: {}, opcoes: [], ordem: 1, visivelBiblioteca: false
};

// Pertence a outro questionario (q-9) para aparecer como resultado reutilizavel
// na Biblioteca independente de qual formulario esteja selecionado.
const perguntaBibliotecaFixture = {
  id: 'p-biblioteca-1', tenantId: 'tenant-1', questionarioId: 'q-9', categoriaId: 'cat-1', tipo: 'texto_longo',
  enunciado: 'Pergunta reaproveitável de outro formulário', peso: '1', obrigatoria: false, configuracao: {}, opcoes: [], ordem: 1, chaveClinica: 'adesao-generica', visivelBiblioteca: true
};

async function prepararSessaoQuestionarios(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/questionarios'), domain: 'localhost', path: '/' }
  ]);

  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        autenticado: true,
        apiUrl: 'http://localhost:3001',
        tenantSlug: 'clinica-carla',
        email: 'dra.carla@octaclin.local',
        expiraEm: '2026-12-31T15:00:00.000Z',
        papel: 'Professional',
        permissoes: permissoesQuestionarios,
        destinoInicial: '/questionarios'
      })
    })
  );
}

async function prepararBootstrapQuestionarios(page) {
  await page.route('**/api/categorias-pergunta', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'cat-1', tenantId: 'tenant-1', nome: 'Nutricao', iconeSvg: 'utensils', corHex: '#247BA0', ordem: 1 }]) })
  );
  await page.route('**/api/profissionais*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [{ id: 'profissional-1', tenantId: 'tenant-1', nome: 'Dra. Carla' }], total: 1 }) })
  );
  await page.route('**/api/pacientes*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [{ id: 'paciente-1', tenantId: 'tenant-1', nome: 'Joana' }], total: 1 }) })
  );
  await page.route('**/api/questionarios/modelos', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  );
  await page.route('**/api/biblioteca-perguntas*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([perguntaBibliotecaFixture]) })
  );
  await page.route('**/api/questionarios?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: questionariosFixture, total: questionariosFixture.length }) })
  );
}

function prepararPerguntasQuestionario(page) {
  return Promise.all([
    page.route('**/api/questionarios/q-1/perguntas', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([perguntaQuestionarioFixture]) })
    ),
    page.route('**/api/questionarios/q-2/perguntas', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
  ]);
}

// Mock de leitura clinica vazio (mesmo formato ja usado em
// questionarios-editor.spec.mjs) — cobre o estado vazio da area Respostas.
function prepararLeituraClinicaQuestionario(page) {
  return page.route('**/api/questionarios/*/respostas/leitura-clinica*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ questionarioId: 'q-1', resumo: { totalRespostas: 0, totalPacientes: 0, totalPerguntas: 0, mediaRespostasPorEnvio: 0 }, pacientes: [], perguntas: [], respostas: [] })
    })
  );
}

async function prepararQuestionarios(page) {
  await prepararSessaoQuestionarios(page);
  await prepararBootstrapQuestionarios(page);
  await prepararPerguntasQuestionario(page);
  await prepararLeituraClinicaQuestionario(page);
}

// PR 20 da governanca: expande o gate de a11y para o workspace de
// questionarios (console profissional) - as 5 areas de trabalho (Formularios,
// Editor, Biblioteca, Distribuicoes, Respostas), incluindo navegacao por
// teclado entre elas via o padrao ARIA tabs ja usado em components/ui/abas.tsx.
test.describe('gate de acessibilidade - questionarios (PR 20)', () => {
  test('formularios - estado principal carregado', async ({ page }) => {
    await prepararQuestionarios(page);
    await page.goto('/questionarios');
    await expect(page.getByRole('heading', { name: 'Editor de Questionários' })).toBeVisible();
    await expect(page.getByLabel('Título')).toHaveValue('Check-in semanal');
    await rodarChecagensDeAcessibilidade(page);
  });

  // As areas abaixo (Editor, Biblioteca, Distribuicoes, Respostas) só ficam
  // visiveis apos clicar na aba correspondente - diferente das demais rotas
  // deste arquivo, aqui as 5 areas dividem uma unica rota via troca de aba no
  // cliente, nao rotas separadas. Isso quebra a premissa de foco inicial no
  // <body> de assertTabPreservaEExibeFoco (mesmo motivo documentado acima
  // para .fill()), entao usam a variante sem navegacao por teclado; a
  // cobertura real de teclado entre as areas fica no teste dedicado abaixo.
  test('editor - questionario e pergunta sinteticos com preview do paciente', async ({ page }) => {
    await prepararQuestionarios(page);
    await page.goto('/questionarios');
    await page.getByRole('tab', { name: 'Editor' }).click();
    await expect(page.getByText('Preview do paciente')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Como foi sua semana?' })).toBeVisible();
    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('biblioteca - resultado sintetico reutilizavel', async ({ page }) => {
    await prepararQuestionarios(page);
    await page.goto('/questionarios');
    await page.getByRole('tab', { name: 'Biblioteca' }).click();
    await expect(page.getByRole('heading', { name: 'Biblioteca de perguntas' })).toBeVisible();
    await expect(page.getByText('Pergunta reaproveitável de outro formulário')).toBeVisible();
    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('distribuicao - paciente sintetico disponivel para envio', async ({ page }) => {
    await prepararQuestionarios(page);
    await page.goto('/questionarios');
    await page.getByRole('tab', { name: 'Distribuicoes' }).click();
    await expect(page.getByRole('heading', { name: 'Distribuição do formulário' })).toBeVisible();
    await expect(page.getByLabel('Paciente do check-in recorrente')).toBeVisible();
    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('respostas - estado vazio da leitura clinica', async ({ page }) => {
    await prepararQuestionarios(page);
    await page.goto('/questionarios');
    await page.getByRole('tab', { name: 'Respostas' }).click();
    await expect(page.getByRole('heading', { name: 'Leitura clínica das respostas' })).toBeVisible();
    await expect(page.getByText('Nenhuma resposta encontrada para os filtros atuais.')).toBeVisible();
    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  // Interacao relevante: alternar entre as 5 areas usando apenas o teclado,
  // seguindo o padrao ARIA tabs (seta direita move o foco e ativa a proxima aba).
  test('alterna entre as areas usando teclado (interacao relevante)', async ({ page }) => {
    await prepararQuestionarios(page);
    await page.goto('/questionarios');

    const abaFormularios = page.getByRole('tab', { name: 'Formulários' });
    await expect(abaFormularios).toHaveAttribute('aria-selected', 'true');
    await abaFormularios.focus();

    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Editor' })).toBeFocused();
    await expect(page.getByText('Preview do paciente')).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Biblioteca' })).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Biblioteca de perguntas' })).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Distribuicoes' })).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Distribuição do formulário' })).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Respostas' })).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Leitura clínica das respostas' })).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(abaFormularios).toBeFocused();
    await expect(abaFormularios).toHaveAttribute('aria-selected', 'true');

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  // Interacao relevante: trocar o formulario selecionado atualiza o Titulo.
  test('formularios - selecionar outro formulario (interacao relevante)', async ({ page }) => {
    await prepararQuestionarios(page);
    await page.goto('/questionarios');

    await expect(page.getByLabel('Título')).toHaveValue('Check-in semanal');
    await page.getByLabel('Selecionar').selectOption('q-2');
    await expect(page.getByLabel('Título')).toHaveValue('Avaliação mensal');

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  // Interacao relevante: acessar uma pergunta no editor e validar que os
  // controles de edicao atualizam o preview do paciente em tempo real.
  test('editor - acessa pergunta e valida controles de edicao com preview (interacao relevante)', async ({ page }) => {
    await prepararQuestionarios(page);
    await page.goto('/questionarios');
    await page.getByRole('tab', { name: 'Editor' }).click();

    await page.getByRole('button', { name: 'Como foi sua semana?' }).click();
    const enunciado = page.getByLabel('Enunciado');
    await expect(enunciado).toHaveValue('Como foi sua semana?');
    await enunciado.fill('Como foi sua semana de adesão?');
    await expect(page.getByRole('heading', { name: 'Como foi sua semana de adesão?' })).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });
});

// ---------------------------------------------------------------------------
// Mocks da central de comunicacoes (PR 21 da governanca). Fixtures
// reaproveitadas de fase-196-comunicacoes-equipe.spec.mjs (mesmos ids,
// contatos e formato de payload).
// ---------------------------------------------------------------------------

const permissoesComunicacoes = [
  'comunicacoes.mensagens.ler',
  'comunicacoes.mensagens.enviar',
  'comunicacoes.canais.gerenciar',
  'comunicacoes.templates.gerenciar'
];

const canalWhatsappFixture = { id: 'canal-1', tenantId: 'tenant-1', tipo: 'whatsapp', nome: 'WhatsApp principal', configuracao: {}, ativo: true };
const templateWhatsappFixture = { id: 'template-1', tenantId: 'tenant-1', canal: 'whatsapp', codigoExterno: 'hello_world', nome: 'Resposta padrao', conteudo: { corpo: 'Ola, {{nome}}.' }, aprovado: true };

// Duas conversas sinteticas (Ana Souza e Bruno Lima) para cobrir a navegacao
// entre itens da lista - com só uma conversa a interacao de "abrir outra
// conversa" nao teria o que exercitar.
const mensagensComunicacoesFixture = [
  { id: 'mensagem-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', canalId: 'canal-1', status: 'recebido', payload: { direcao: 'recebida', contato: '5511999999999', texto: 'Posso trocar o horário?' }, criadoEm: '2026-08-01T13:00:00.000Z' },
  { id: 'mensagem-2', tenantId: 'tenant-1', pacienteId: 'paciente-1', canalId: 'canal-1', templateId: 'template-1', status: 'falhou', erro: 'Falha de entrega', payload: { destino: '5511999999999' }, criadoEm: '2026-08-01T13:05:00.000Z' },
  { id: 'mensagem-3', tenantId: 'tenant-1', pacienteId: 'paciente-2', canalId: 'canal-1', status: 'recebido', payload: { direcao: 'recebida', contato: '5511988887777', texto: 'Preciso remarcar.' }, criadoEm: '2026-08-01T12:00:00.000Z' }
];

async function prepararSessaoComunicacoes(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'SuperAdmin', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/comunicacoes'), domain: 'localhost', path: '/' }
  ]);

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      autenticado: true,
      papel: 'SuperAdmin',
      apiUrl: 'http://localhost:3001',
      tenantSlug: 'clinica-octa',
      email: 'admin@octaclin.local',
      expiraEm: '2026-12-31T18:00:00.000Z',
      permissoes: permissoesComunicacoes,
      destinoInicial: '/comunicacoes'
    })
  }));

  await page.route('**/api/pacientes**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      itens: [
        { id: 'paciente-1', nome: 'Ana Souza', contato: '5511999999999' },
        { id: 'paciente-2', nome: 'Bruno Lima', contato: '5511988887777' }
      ],
      total: 2
    })
  }));
  await page.route('**/api/comunicacoes/canais', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([canalWhatsappFixture]) }));
  await page.route('**/api/comunicacoes/templates', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([templateWhatsappFixture]) }));
}

function prepararMensagensComunicacoes(page, { itens = mensagensComunicacoesFixture, status = 200 } = {}) {
  return page.route('**/api/comunicacoes/mensagens', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'mensagem-4', tenantId: 'tenant-1', pacienteId: 'paciente-1', canalId: 'canal-1', templateId: 'template-1', status: 'pendente', payload: route.request().postDataJSON().payload, criadoEm: '2026-08-01T15:00:00.000Z' }) });
      return;
    }
    if (status !== 200) {
      await route.fulfill({ status, contentType: 'text/plain', body: 'Falha ao carregar mensagens.' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(itens) });
  });
}

async function prepararComunicacoes(page, opcoes) {
  await prepararSessaoComunicacoes(page);
  await prepararMensagensComunicacoes(page, opcoes);
}

// PR 21 da governanca: expande o gate de a11y para a central profissional de
// comunicacoes (/comunicacoes) - inbox de conversas WhatsApp, conversa ativa,
// estado vazio e falha de carregamento, mais as interacoes de navegar pela
// lista por teclado, abrir uma conversa, percorrer filtros e preparar uma
// resposta/template sem enviar de verdade. Nao chama Meta/Gmail/WhatsApp,
// nao envia mensagem real e nao cobre /profissionais (fora de escopo).
test.describe('gate de acessibilidade - comunicacoes (PR 21)', () => {
  test('conversas - inbox carregada com conversas e mensagens sinteticas', async ({ page }) => {
    await prepararComunicacoes(page);
    await page.goto('/comunicacoes');
    await expect(page.getByRole('heading', { name: 'Comunicações', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Inbox WhatsApp' })).toBeVisible();
    await expect(page.getByText('Ana Souza').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Responder' })).toBeVisible();
    await expect(page.getByText('Não foi possível concluir o envio.').first()).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  // Interacao relevante: navegar pela lista de conversas usando teclado e
  // abrir uma conversa diferente da que já vem selecionada por padrão.
  test('conversas - navega por teclado e abre outra conversa (interacao relevante)', async ({ page }) => {
    await prepararComunicacoes(page);
    await page.goto('/comunicacoes');

    const conversaAna = page.getByRole('button', { name: /Ana Souza/ });
    const conversaBruno = page.getByRole('button', { name: /Bruno Lima/ });
    await expect(conversaAna).toBeVisible();
    await expect(conversaBruno).toBeVisible();

    await conversaAna.focus();
    await page.keyboard.press('Tab');
    await expect(conversaBruno).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.locator('strong', { hasText: 'Bruno Lima' }).first()).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('conversas - estado vazio (nenhuma mensagem)', async ({ page }) => {
    await prepararComunicacoes(page, { itens: [] });
    await page.goto('/comunicacoes');
    await expect(page.getByRole('heading', { name: 'Inbox WhatsApp' })).toBeVisible();
    await expect(page.getByText('Nenhuma conversa WhatsApp carregada.')).toBeVisible();
    await expect(page.getByText('Nenhuma mensagem persistida.')).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('conversas - falha de carregamento', async ({ page }) => {
    await prepararComunicacoes(page, { status: 500 });
    await page.goto('/comunicacoes');
    await expect(page.getByRole('heading', { name: 'Comunicações', level: 1 })).toBeVisible();
    // getByRole('alert') sozinho colide com o route-announcer do Next (tambem
    // role="alert"), por isso o texto exato do erro (mesmo padrao usado nos
    // testes de esqueci-senha acima).
    await expect(page.getByText('Falha ao carregar mensagens.')).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  // Interacao relevante: percorrer os filtros da inbox (equivalente a "canais"
  // nesta area, ja que so ha um canal WhatsApp sintetico configurado).
  test('conversas - percorre filtros da inbox (interacao relevante)', async ({ page }) => {
    await prepararComunicacoes(page);
    await page.goto('/comunicacoes');

    await page.getByRole('button', { name: 'Com entrada' }).click();
    await expect(page.getByText('Ana Souza').first()).toBeVisible();
    await expect(page.getByText('Bruno Lima').first()).toBeVisible();

    await page.getByRole('button', { name: 'Com falha' }).click();
    await expect(page.getByText('Ana Souza').first()).toBeVisible();
    await expect(page.getByText('Bruno Lima')).toHaveCount(0);

    await page.getByRole('button', { name: 'Acompanhar' }).click();
    await expect(page.getByText('Nenhuma conversa WhatsApp carregada.')).toBeVisible();

    await page.getByRole('button', { name: 'Todas' }).click();
    await expect(page.getByText('Ana Souza').first()).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  // Interacao relevante: abrir a resposta rapida (template pre-preenchido) a
  // partir da mensagem com falha e preencher a observacao sem disparar o
  // envio - a rota de POST /api/comunicacoes/mensagens nunca e chamada
  // neste teste. Usa "Tentar novamente" (nao o "Responder" generico do
  // cabecalho) porque so essa acao carrega o destino a partir do payload da
  // propria mensagem falha; o "Responder" generico usa o contato guardado na
  // conversa, que so e populado a partir da primeira mensagem do grupo.
  test('conversas - abre resposta rapida e preenche observacao sem enviar (interacao relevante)', async ({ page }) => {
    await prepararComunicacoes(page);
    await page.goto('/comunicacoes');

    await page.getByRole('button', { name: 'Tentar novamente' }).click();

    const areas = page.getByRole('tablist', { name: 'Áreas de comunicação' });
    await expect(areas.getByRole('tab', { name: 'Nova mensagem' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Disparo manual')).toBeVisible();
    await expect(page.getByLabel('WhatsApp de destino')).toHaveValue('5511999999999');
    await expect(page.getByLabel('Template')).toHaveValue('template-1');

    const observacao = page.getByLabel('Observação');
    await observacao.fill('Confirmar novo horário com a paciente antes de responder.');
    await expect(observacao).toHaveValue('Confirmar novo horário com a paciente antes de responder.');
    await expect(page.getByRole('button', { name: 'Disparar' })).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });
});

// ---------------------------------------------------------------------------
// Mocks da aba Configuracoes de comunicacoes (PR 22 da governanca). Reutiliza
// prepararSessaoComunicacoes/prepararMensagensComunicacoes do PR 21 e
// sobrescreve apenas canais/templates para os cenarios desta aba.
// ---------------------------------------------------------------------------

// 5 canais (whatsapp/email/push, ativos e inativo) com 3 templates cada -
// conteudo sintetico suficiente para o container "Inventario ativo"
// (max-h-[420px]) realmente ultrapassar a altura visivel e se tornar rolavel,
// confirmado via script Axe ad-hoc antes de qualquer alteracao de produto
// (scrollHeight 689 x clientHeight 420 nesse cenario, em ambos os viewports).
const canaisInventarioFixture = [
  { id: 'canal-cfg-1', tenantId: 'tenant-1', tipo: 'whatsapp', nome: 'WhatsApp Clínica Norte', configuracao: {}, ativo: true },
  { id: 'canal-cfg-2', tenantId: 'tenant-1', tipo: 'email', nome: 'Email Institucional', configuracao: {}, ativo: true },
  { id: 'canal-cfg-3', tenantId: 'tenant-1', tipo: 'push', nome: 'Push App Paciente', configuracao: {}, ativo: false },
  { id: 'canal-cfg-4', tenantId: 'tenant-1', tipo: 'whatsapp', nome: 'WhatsApp Clínica Sul', configuracao: {}, ativo: true },
  { id: 'canal-cfg-5', tenantId: 'tenant-1', tipo: 'email', nome: 'Email Financeiro', configuracao: {}, ativo: true }
];
const templatesInventarioFixture = canaisInventarioFixture.flatMap((canal) =>
  [1, 2, 3].map((indice) => ({
    id: `template-${canal.id}-${indice}`,
    tenantId: 'tenant-1',
    canal: canal.tipo,
    codigoExterno: `codigo_${indice}`,
    nome: `Template ${canal.nome} ${indice}`,
    conteudo: { corpo: 'Ola, {{nome}}.' },
    aprovado: true
  }))
);

function prepararCanaisComunicacoes(page, { itens = canaisInventarioFixture, status = 200 } = {}) {
  return page.route('**/api/comunicacoes/canais', async (route) => {
    if (status !== 200) {
      await route.fulfill({ status, contentType: 'text/plain', body: 'Falha ao carregar canais.' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(itens) });
  });
}

function prepararTemplatesComunicacoes(page, { itens = templatesInventarioFixture } = {}) {
  return page.route('**/api/comunicacoes/templates', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(itens) })
  );
}

async function prepararConfiguracoesComunicacoes(page, opcoes = {}) {
  await prepararSessaoComunicacoes(page);
  await prepararMensagensComunicacoes(page, { itens: [] });
  await prepararCanaisComunicacoes(page, { itens: opcoes.canais, status: opcoes.statusCanais });
  await prepararTemplatesComunicacoes(page, { itens: opcoes.templates });
}

// PR 22 da governanca: completa o gate de a11y de /comunicacoes cobrindo a
// aba "Configuracoes" (canais e templates), incluindo a navegacao por
// teclado ate a aba e a regiao rolavel do inventario. Dados 100% sinteticos;
// nenhuma chamada a Meta/Gmail/WhatsApp e nenhum envio real de mensagem.
test.describe('gate de acessibilidade - comunicacoes configuracoes (PR 22)', () => {
  test('configuracoes - navega por teclado, mostra inventario carregado e a regiao rolavel e focavel', async ({ page }) => {
    await prepararConfiguracoesComunicacoes(page, { canais: canaisInventarioFixture, templates: templatesInventarioFixture });
    await page.goto('/comunicacoes');

    const areas = page.getByRole('tablist', { name: 'Áreas de comunicação' });
    const abaConversas = areas.getByRole('tab', { name: 'Conversas' });
    const abaNovaMensagem = areas.getByRole('tab', { name: 'Nova mensagem' });
    const abaConfiguracoes = areas.getByRole('tab', { name: 'Configurações' });

    await expect(abaConversas).toHaveAttribute('aria-selected', 'true');
    await abaConversas.focus();

    await page.keyboard.press('ArrowRight');
    await expect(abaNovaMensagem).toBeFocused();
    await expect(abaNovaMensagem).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowRight');
    await expect(abaConfiguracoes).toBeFocused();
    await expect(abaConfiguracoes).toHaveAttribute('aria-selected', 'true');

    // Inventario de canais carregado (item 1) e templates carregados (item 2).
    await expect(page.getByRole('heading', { name: 'Novo canal' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Novo template' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Inventario ativo' })).toBeVisible();
    await expect(page.getByText('WhatsApp Clínica Norte', { exact: true })).toBeVisible();
    await expect(page.getByText('Email Financeiro', { exact: true })).toBeVisible();
    await expect(page.getByText('Aprovado: Template WhatsApp Clínica Norte 1').first()).toBeVisible();

    // Regiao rolavel do inventario (item 5): alcancavel e focavel por teclado.
    const inventario = page.getByLabel('Inventario de canais e templates');
    await expect(inventario).toBeVisible();
    await inventario.focus();
    await expect(inventario).toBeFocused();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('configuracoes - estado vazio (nenhum canal ou template carregado)', async ({ page }) => {
    await prepararConfiguracoesComunicacoes(page, { canais: [], templates: [] });
    await page.goto('/comunicacoes');
    await page.getByRole('tab', { name: 'Configurações' }).click();

    await expect(page.getByRole('heading', { name: 'Novo canal' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Novo template' })).toBeVisible();
    await expect(page.getByText('Nenhum canal carregado.')).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('configuracoes - falha de carregamento', async ({ page }) => {
    await prepararConfiguracoesComunicacoes(page, { statusCanais: 500 });
    await page.goto('/comunicacoes');
    await page.getByRole('tab', { name: 'Configurações' }).click();

    await expect(page.getByText('Falha ao carregar canais.')).toBeVisible();
    await expect(page.getByText('Nenhum canal carregado.')).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });
});

// ---------------------------------------------------------------------------
// Mocks da equipe clinica / profissionais (PR 23 da governanca). Fixtures
// adaptadas de fase-196-comunicacoes-equipe.spec.mjs. Matchers por pathname
// exato para nao deixar um matcher amplo capturar tanto /api/profissionais
// quanto /api/profissionais/arquivados.
// ---------------------------------------------------------------------------

const permissoesProfissionaisCompletas = ['profissionais.ler', 'profissionais.gerenciar'];
const permissoesProfissionaisSomenteLeitura = ['profissionais.ler'];

const profissionaisFixture = [
  { id: 'prof-eq-1', tenantId: 'tenant-1', usuarioId: 'usuario-eq-1', nome: 'Dra. Marina Alves', registroProfissional: 'CRN-11111', especialidade: 'Nutrologia', criadoEm: '2026-07-01T10:00:00.000Z' },
  { id: 'prof-eq-2', tenantId: 'tenant-1', usuarioId: 'usuario-eq-2', nome: 'Dr. Bruno Tavares', registroProfissional: 'CRM-22222', especialidade: 'Endocrinologia', criadoEm: '2026-07-05T10:00:00.000Z' },
  { id: 'prof-eq-3', tenantId: 'tenant-1', usuarioId: 'usuario-eq-3', nome: 'Dra. Renata Souza', registroProfissional: 'CRN-33333', especialidade: 'Nutrição Esportiva', criadoEm: '2026-07-10T10:00:00.000Z' }
];

// prof-eq-1 conectado, prof-eq-2 desconectado, prof-eq-3 ausente de proposito
// (cobre "nao configurada").
const statusGoogleFixture = [
  { profissionalId: 'prof-eq-1', conectado: true },
  { profissionalId: 'prof-eq-2', conectado: false }
];

const profissionalArquivadoFixture = {
  id: 'prof-eq-arquivado-1', tenantId: 'tenant-1', usuarioId: 'usuario-eq-arquivado-1',
  nome: 'Dr. Eduardo Lima', registroProfissional: 'CRM-44444', especialidade: 'Psiquiatria',
  arquivadoEm: '2026-07-20T10:00:00.000Z', criadoEm: '2026-06-01T10:00:00.000Z'
};

async function prepararSessaoProfissionais(page, { papel = 'SuperAdmin', permissoes = permissoesProfissionaisCompletas } = {}) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: papel, domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/profissionais'), domain: 'localhost', path: '/' }
  ]);

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      autenticado: true,
      papel,
      apiUrl: 'http://localhost:3001',
      tenantSlug: 'clinica-octa',
      email: 'admin@octaclin.local',
      expiraEm: '2026-12-31T18:00:00.000Z',
      permissoes,
      destinoInicial: '/profissionais'
    })
  }));
}

// Matcher exato: NAO usa wildcard para nao capturar /api/profissionais/arquivados
// nem /api/profissionais/:id (edicao/arquivamento/restauracao), que ficam
// deliberadamente sem mock nesta PR - nenhuma mutacao real e disparada.
function prepararListaProfissionais(page, { itens = profissionaisFixture, total = itens.length, status = 200 } = {}) {
  return page.route((url) => url.pathname === '/api/profissionais', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    if (status !== 200) {
      await route.fulfill({ status, contentType: 'text/plain', body: 'Falha ao carregar profissionais.' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens, total }) });
  });
}

function prepararProfissionaisArquivados(page, { itens = [] } = {}) {
  return page.route((url) => url.pathname === '/api/profissionais/arquivados', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens, total: itens.length }) })
  );
}

function prepararStatusGoogleProfissionais(page, { itens = statusGoogleFixture, status = 200 } = {}) {
  return page.route('**/api/agenda/google/profissionais/status', async (route) => {
    if (status !== 200) {
      await route.fulfill({ status, contentType: 'text/plain', body: 'Falha ao consultar status da Google Agenda.' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(itens) });
  });
}

async function prepararProfissionais(page, { sessao, lista, arquivados, google } = {}) {
  await prepararSessaoProfissionais(page, sessao);
  await prepararListaProfissionais(page, lista);
  await prepararProfissionaisArquivados(page, arquivados);
  await prepararStatusGoogleProfissionais(page, google);
}

// PR 23 da governanca: expande o gate de a11y para /profissionais (equipe
// clinica), respeitando a autorizacao existente (somente SuperAdmin com
// profissionais.gerenciar cria/edita/arquiva/restaura). Dados 100%
// sinteticos; nenhuma chamada real de criacao, edicao, arquivamento ou
// restauracao e disparada - PATCH/POST/DELETE de /api/profissionais/:id
// ficam deliberadamente sem mock.
test.describe('gate de acessibilidade - profissionais (PR 23)', () => {
  test('diretorio - superadmin com profissionais sinteticos, formulario e paginacao', async ({ page }) => {
    await prepararProfissionais(page, { lista: { total: 60 } });
    await page.goto('/profissionais');

    await expect(page.getByRole('heading', { name: 'Profissionais', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Novo profissional' })).toBeVisible();

    await expect(page.getByText('Dra. Marina Alves')).toBeVisible();
    await expect(page.getByText('Dr. Bruno Tavares')).toBeVisible();
    await expect(page.getByText('Conectada', { exact: true })).toBeVisible();
    await expect(page.getByText('Desconectada', { exact: true })).toBeVisible();

    await expect(page.getByText('Página 1 de 3 | 60 profissionais')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Próxima' })).toBeEnabled();

    await rodarChecagensDeAcessibilidade(page);
  });

  test('diretorio - lista vazia', async ({ page }) => {
    await prepararProfissionais(page, { lista: { itens: [], total: 0 } });
    await page.goto('/profissionais');
    await expect(page.getByText('Nenhum profissional carregado.')).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('diretorio - falha ao carregar profissionais', async ({ page }) => {
    await prepararProfissionais(page, { lista: { status: 500 } });
    await page.goto('/profissionais');
    await expect(page.getByText('Falha ao carregar profissionais.')).toBeVisible();
    await rodarChecagensDeAcessibilidade(page);
  });

  test('permissoes - usuario somente leitura nao ve criacao, edicao, arquivamento ou lixeira', async ({ page }) => {
    await prepararProfissionais(page, { sessao: { papel: 'Professional', permissoes: permissoesProfissionaisSomenteLeitura } });
    await page.goto('/profissionais');

    await expect(page.getByRole('heading', { name: 'Profissionais', level: 1 })).toBeVisible();
    await expect(page.getByText('Dra. Marina Alves')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Novo profissional' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Editar profissional' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Arquivar profissional' })).toHaveCount(0);

    const areas = page.getByRole('tablist', { name: 'Áreas da equipe clínica' });
    await expect(areas.getByRole('tab', { name: 'Lixeira' })).toHaveCount(0);

    await rodarChecagensDeAcessibilidade(page);
  });

  // Interacao relevante: alternar entre as 4 areas usando teclado, validando
  // foco e aria-selected, e o link de agenda em Disponibilidade.
  test('areas - navega por teclado entre diretorio, disponibilidade, integracoes e lixeira (interacao relevante)', async ({ page }) => {
    await prepararProfissionais(page);
    await page.goto('/profissionais');

    const areas = page.getByRole('tablist', { name: 'Áreas da equipe clínica' });
    const abaDiretorio = areas.getByRole('tab', { name: 'Diretório' });
    const abaDisponibilidade = areas.getByRole('tab', { name: 'Disponibilidade' });
    const abaIntegracoes = areas.getByRole('tab', { name: 'Integrações' });
    const abaLixeira = areas.getByRole('tab', { name: 'Lixeira' });

    await expect(abaDiretorio).toHaveAttribute('aria-selected', 'true');
    await abaDiretorio.focus();

    await page.keyboard.press('ArrowRight');
    await expect(abaDisponibilidade).toBeFocused();
    await expect(abaDisponibilidade).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('link', { name: 'Abrir agenda de Dra. Marina Alves' })).toHaveAttribute(
      'href',
      '/agenda?profissionalId=prof-eq-1'
    );

    await page.keyboard.press('ArrowRight');
    await expect(abaIntegracoes).toBeFocused();
    await expect(abaIntegracoes).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Convites e permissões ficam na área Equipe da conta.')).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(abaLixeira).toBeFocused();
    await expect(abaLixeira).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(abaDiretorio).toBeFocused();
    await expect(abaDiretorio).toHaveAttribute('aria-selected', 'true');

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('integracoes - google agenda conectada, desconectada e nao configurada', async ({ page }) => {
    await prepararProfissionais(page);
    await page.goto('/profissionais');
    await page.getByRole('tab', { name: 'Integrações' }).click();

    // Cada texto de status e unico na pagina (um card por profissional), entao
    // nao ha necessidade de escopar por card - o texto ja amarra profissional a status.
    await expect(page.getByText('Google Agenda conectada')).toBeVisible();
    await expect(page.getByText('Google Agenda desconectada')).toBeVisible();
    await expect(page.getByText('Google Agenda não configurada')).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('integracoes - status da google agenda indisponivel', async ({ page }) => {
    await prepararProfissionais(page, { google: { status: 500 } });
    await page.goto('/profissionais');
    await page.getByRole('tab', { name: 'Integrações' }).click();

    await expect(page.getByText('Estado da Google Agenda indisponível').first()).toBeVisible();
    await expect(page.getByText('Google Agenda conectada')).toHaveCount(0);

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('lixeira - profissional arquivado carregado', async ({ page }) => {
    await prepararProfissionais(page, { arquivados: { itens: [profissionalArquivadoFixture] } });
    await page.goto('/profissionais');
    await page.getByRole('tab', { name: 'Lixeira' }).click();

    await expect(page.getByText('Dr. Eduardo Lima')).toBeVisible();
    await expect(page.getByText(/Arquivado em/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restaurar acesso' })).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('lixeira - estado vazio', async ({ page }) => {
    await prepararProfissionais(page);
    await page.goto('/profissionais');
    await page.getByRole('tab', { name: 'Lixeira' }).click();

    await expect(page.getByText('Nenhum profissional carregado.')).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  // Interacao relevante: abrir a edicao de um profissional e cancelar sem
  // salvar - nenhum PATCH e disparado (rota nao mockada nesta PR).
  test('diretorio - abre edicao de profissional e cancela sem salvar (interacao relevante)', async ({ page }) => {
    await prepararProfissionais(page);
    await page.goto('/profissionais');

    await page.getByRole('button', { name: 'Editar profissional' }).first().click();
    await expect(page.getByRole('heading', { name: 'Editar profissional' })).toBeVisible();
    await expect(page.getByLabel('Nome')).toHaveValue('Dra. Marina Alves');
    await expect(page.getByLabel('Email')).toHaveCount(0);

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { name: 'Novo profissional' })).toBeVisible();
    await expect(page.getByLabel('Nome')).toHaveValue('');

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  // Interacao relevante: abrir o modal de arquivamento, validar o foco
  // inicial dentro do dialog e cancelar - nenhum DELETE e disparado (rota
  // nao mockada nesta PR, e o botao de confirmar nunca e clicado).
  test('diretorio - abre modal de arquivar profissional, valida foco e cancela sem confirmar (interacao relevante)', async ({ page }) => {
    await prepararProfissionais(page);
    await page.goto('/profissionais');

    await page.getByRole('button', { name: 'Arquivar profissional' }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Arquivar profissional' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Arquivar o profissional Dra. Marina Alves?')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Fechar' })).toBeFocused();

    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });
});

// ---------------------------------------------------------------------------
// Mocks de /automacoes (PR 24 da governanca). Cobre criacao orientada de
// regras (sem salvar), simulacao obrigatoria antes de ativar/pausar, recall
// de pacientes inativos e o historico. Dados 100% sinteticos; toda mutacao
// (POST /regras, POST /simulacoes, POST /recall/simulacoes, PATCH /ativacao)
// fica interceptada e mockada - nenhuma chamada real a backend, WhatsApp,
// Gmail, push ou pacientes e disparada, e nenhuma automacao real e executada.
// O painel nao expoe nenhum botao de envio de mensagem: o unico caminho de
// "disparo" e a acao da regra em producao, fora do alcance deste teste.
// ---------------------------------------------------------------------------

const permissoesAutomacoes = ['automacoes.gerenciar'];

const profissionaisAutomacoesFixture = [{ id: 'prof-auto-1', tenantId: 'tenant-1', nome: 'Dra. Camila Duarte' }];

const pacientesAutomacoesFixture = [
  { id: 'pac-auto-1', nome: 'Fernanda Lima' },
  { id: 'pac-auto-2', nome: 'Marcos Andrade' },
  { id: 'pac-auto-3', nome: 'Juliana Prado' },
  { id: 'pac-auto-4', nome: 'Ricardo Nunes' },
  { id: 'pac-auto-5', nome: 'Beatriz Ramos' }
];

const regraConvencionalInativaFixture = {
  id: 'regra-conv-inativa',
  tenantId: 'tenant-1',
  profissionalId: 'prof-auto-1',
  nome: 'Retomar contato após check-in atrasado',
  gatilho: { tipo: 'checkin.atrasado' },
  condicoes: [{ campo: 'checkinsPerdidos', operador: 'maior_ou_igual', valor: 3 }],
  acoes: [{ tipo: 'notificar_profissional' }],
  ativa: false,
  criadoEm: '2026-08-01T10:00:00.000Z'
};

const regraConvencionalAtivaFixture = {
  id: 'regra-conv-ativa',
  tenantId: 'tenant-1',
  profissionalId: 'prof-auto-1',
  nome: 'Alertar risco alto',
  gatilho: { tipo: 'paciente.risco_alto' },
  condicoes: [{ campo: 'frustracaoScore', operador: 'maior_que', valor: 70 }],
  acoes: [{ tipo: 'criar_tarefa' }],
  ativa: true,
  criadoEm: '2026-08-02T10:00:00.000Z'
};

const regraRecallFixture = {
  id: 'regra-recall',
  tenantId: 'tenant-1',
  profissionalId: 'prof-auto-1',
  nome: 'Recall de pacientes inativos',
  gatilho: { tipo: 'paciente.inativo', diasSemConsulta: 60, intervaloMinimoDias: 30, limitePorExecucao: 25 },
  condicoes: [],
  acoes: [{ tipo: 'enviar_template' }],
  ativa: false,
  criadoEm: '2026-08-03T10:00:00.000Z'
};

// Preenchimento sintetico so para produzir overflow real em "Regras
// cadastradas" (max-h-[520px]) - ver teste de regioes rolaveis abaixo.
const regrasFillerFixture = [1, 2, 3, 4, 5].map((indice) => ({
  id: `regra-filler-${indice}`,
  tenantId: 'tenant-1',
  profissionalId: 'prof-auto-1',
  nome: `Regra sintetica de preenchimento ${indice}`,
  gatilho: { tipo: indice % 2 === 0 ? 'questionario.respondido' : 'checkin.atrasado' },
  condicoes: [{ campo: 'checkinsPerdidos', operador: 'maior_ou_igual', valor: indice }],
  acoes: [{ tipo: indice % 2 === 0 ? 'enviar_template' : 'notificar_profissional' }],
  ativa: indice % 2 === 0,
  criadoEm: '2026-08-04T10:00:00.000Z'
}));

const regrasSuficientesParaOverflowFixture = [
  regraConvencionalInativaFixture,
  regraConvencionalAtivaFixture,
  regraRecallFixture,
  ...regrasFillerFixture
];

const execucaoSimulacaoComumFixture = {
  id: 'exec-sim-comum',
  tenantId: 'tenant-1',
  regraId: 'regra-conv-ativa',
  pacienteId: 'pac-auto-1',
  status: 'executado',
  resultado: { simulacao: true, executar: true, gatilho: 'paciente.risco_alto' },
  criadoEm: '2026-08-05T10:00:00.000Z'
};

const execucaoSimulacaoRecallFixture = {
  id: 'exec-sim-recall',
  tenantId: 'tenant-1',
  regraId: 'regra-recall',
  status: 'executado',
  resultado: {
    simulacao: true,
    gatilho: 'paciente.inativo',
    totalCandidatos: 2,
    candidatos: [
      { pacienteId: 'pac-auto-2', diasSemConsulta: 75 },
      { pacienteId: 'pac-auto-3', diasSemConsulta: null }
    ],
    excluidos: [
      { pacienteId: 'pac-auto-4', motivo: 'sem_contato' },
      { pacienteId: 'pac-auto-5', motivo: 'consulta_recente' }
    ]
  },
  criadoEm: '2026-08-06T10:00:00.000Z'
};

// Preenchimento sintetico so para produzir overflow real em "Historico
// recente" (max-h-[420px]) - ver teste de regioes rolaveis abaixo.
const execucoesFillerFixture = [1, 2, 3, 4].map((indice) => ({
  id: `exec-filler-${indice}`,
  tenantId: 'tenant-1',
  regraId: `regra-filler-${indice}`,
  pacienteId: 'pac-auto-1',
  status: indice % 2 === 0 ? 'executado' : 'ignorado',
  resultado: {
    simulacao: true,
    executar: indice % 2 === 0,
    gatilho: indice % 2 === 0 ? 'questionario.respondido' : 'checkin.atrasado'
  },
  criadoEm: '2026-08-07T10:00:00.000Z'
}));

const execucoesSuficientesParaOverflowFixture = [
  execucaoSimulacaoComumFixture,
  execucaoSimulacaoRecallFixture,
  ...execucoesFillerFixture
];

async function prepararSessaoAutomacoes(page, { papel = 'SuperAdmin', permissoes = permissoesAutomacoes } = {}) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: papel, domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/automacoes'), domain: 'localhost', path: '/' }
  ]);

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      autenticado: true,
      papel,
      apiUrl: 'http://localhost:3001',
      tenantSlug: 'clinica-octa',
      email: 'admin@octaclin.local',
      expiraEm: '2026-12-31T18:00:00.000Z',
      permissoes,
      destinoInicial: '/automacoes'
    })
  }));
}

function prepararListaRegras(page, { itens = [regraConvencionalInativaFixture], status = 200 } = {}) {
  return page.route('**/api/automacoes/regras', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    if (status !== 200) {
      await route.fulfill({ status, contentType: 'text/plain', body: 'Falha ao carregar automações.' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(itens) });
  });
}

function prepararHistoricoExecucoes(page, { itens = [] } = {}) {
  return page.route('**/api/automacoes/avaliacoes', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(itens) })
  );
}

function prepararProfissionaisAutomacoes(page, { itens = profissionaisAutomacoesFixture } = {}) {
  return page.route('**/api/profissionais**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens, total: itens.length }) })
  );
}

function prepararPacientesAutomacoes(page, { itens = pacientesAutomacoesFixture } = {}) {
  return page.route('**/api/pacientes**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens, total: itens.length }) })
  );
}

async function prepararAutomacoes(page, { sessao, regras, execucoes, profissionais, pacientes } = {}) {
  await prepararSessaoAutomacoes(page, sessao);
  await prepararListaRegras(page, regras);
  await prepararHistoricoExecucoes(page, execucoes);
  await prepararProfissionaisAutomacoes(page, profissionais);
  await prepararPacientesAutomacoes(page, pacientes);
}

test.describe('gate de acessibilidade - automacoes (PR 24)', () => {
  test('painel carregado com profissionais, pacientes e historico sinteticos; regioes rolaveis focalizaveis', async ({ page }) => {
    await prepararAutomacoes(page, {
      regras: { itens: regrasSuficientesParaOverflowFixture },
      execucoes: { itens: execucoesSuficientesParaOverflowFixture }
    });
    await page.goto('/automacoes');

    await expect(page.getByRole('heading', { name: 'Automações', level: 1 })).toBeVisible();
    await expect(page.getByText('8 regras, 6 simulacoes e execucoes no histórico')).toBeVisible();

    await expect(page.getByText('Retomar contato após check-in atrasado').first()).toBeVisible();
    await expect(page.getByText('Alertar risco alto').first()).toBeVisible();
    await expect(page.getByText('Recall de pacientes inativos').first()).toBeVisible();
    await expect(page.getByText('Ativa').first()).toBeVisible();
    await expect(page.getByText('Inativa').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Simular recall de Recall de pacientes inativos' })).toBeVisible();

    await expect(page.getByText('Regra: regra-conv-ativa')).toBeVisible();
    await expect(page.getByText('Regra: regra-recall')).toBeVisible();
    await expect(page.getByText('Seriam contatados (2):')).toBeVisible();
    await expect(page.getByText('Marcos Andrade - 75 dias sem consulta')).toBeVisible();
    await expect(page.getByText('Juliana Prado - nunca concluiu consulta')).toBeVisible();
    await expect(page.getByText('Fora (2):')).toBeVisible();
    await expect(page.getByText(/Ricardo Nunes - sem contato cadastrado/)).toBeVisible();
    await expect(page.getByText(/Beatriz Ramos - teve consulta recente/)).toBeVisible();

    // Checagens gerais primeiro (incluindo ordem de tabulacao pagina inteira)
    // - antes de qualquer foco manual abaixo, que deixaria o foco preso no
    // ultimo elemento focalizavel da pagina e quebraria a contagem de Tabs.
    await rodarChecagensDeAcessibilidade(page);

    // Regiao rolavel "Regras cadastradas" (max-h-[520px]): fixture com 8
    // regras produz overflow real, confirmado abaixo por scrollHeight >
    // clientHeight - nao um numero fixo arbitrario.
    const regiaoRegras = page.getByLabel('Regras cadastradas');
    await expect(regiaoRegras).toBeVisible();
    await regiaoRegras.focus();
    await expect(regiaoRegras).toBeFocused();
    const medidasRegras = await regiaoRegras.evaluate((elemento) => ({
      scrollHeight: elemento.scrollHeight,
      clientHeight: elemento.clientHeight
    }));
    expect(medidasRegras.scrollHeight, 'Fixture de regras nao produziu overflow real (520px)').toBeGreaterThan(
      medidasRegras.clientHeight
    );

    // Regiao rolavel "Historico recente" (max-h-[420px]): mesma logica, com
    // fixture de 6 execucoes/simulacoes.
    const regiaoHistorico = page.getByLabel('Histórico recente');
    await expect(regiaoHistorico).toBeVisible();
    await regiaoHistorico.focus();
    await expect(regiaoHistorico).toBeFocused();
    const medidasHistorico = await regiaoHistorico.evaluate((elemento) => ({
      scrollHeight: elemento.scrollHeight,
      clientHeight: elemento.clientHeight
    }));
    expect(medidasHistorico.scrollHeight, 'Fixture de historico nao produziu overflow real (420px)').toBeGreaterThan(
      medidasHistorico.clientHeight
    );
  });

  test('painel - sem regras e sem historico', async ({ page }) => {
    await prepararAutomacoes(page, { regras: { itens: [] }, execucoes: { itens: [] } });
    await page.goto('/automacoes');

    await expect(page.getByRole('heading', { name: 'Automações', level: 1 })).toBeVisible();
    await expect(page.getByText('Nenhuma regra carregada.')).toBeVisible();
    await expect(page.getByText('Nenhuma avaliação persistida.')).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('painel - falha no carregamento inicial', async ({ page }) => {
    await prepararAutomacoes(page, { regras: { status: 500 } });
    await page.goto('/automacoes');

    await expect(page.getByText('Falha ao carregar automações.')).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  // Interacao relevante: alterna o gatilho da "Nova regra" entre check-in
  // atrasado e inatividade e confirma a troca acessivel dos campos
  // condicionais, sem nunca submeter o formulario (POST /regras
  // deliberadamente sem mock nesta PR - nenhuma regra e criada de verdade).
  test('nova regra - alterna gatilho e troca campos condicionais de forma acessivel (interacao relevante)', async ({ page }) => {
    await prepararAutomacoes(page);
    await page.goto('/automacoes');

    await expect(page.getByRole('heading', { name: 'Nova regra' })).toBeVisible();
    await expect(page.getByLabel('Campo')).toBeVisible();
    await expect(page.getByLabel('Operador')).toBeVisible();
    await expect(page.getByLabel('Valor')).toBeVisible();
    await expect(page.getByLabel('Ação', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Dias sem consulta')).toHaveCount(0);

    await page.getByLabel('Gatilho').selectOption({ label: 'Paciente sem consulta há muito tempo' });

    await expect(page.getByLabel('Campo')).toHaveCount(0);
    await expect(page.getByLabel('Operador')).toHaveCount(0);
    await expect(page.getByLabel('Valor')).toHaveCount(0);
    await expect(page.getByLabel('Ação', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Dias sem consulta')).toHaveValue('60');
    await expect(page.getByLabel('Intervalo minimo entre recalls (dias)')).toHaveValue('30');
    await expect(page.getByLabel('Limite de pacientes por rodada')).toHaveValue('25');

    await page.getByLabel('Gatilho').selectOption({ label: 'Check-in atrasado' });

    await expect(page.getByLabel('Dias sem consulta')).toHaveCount(0);
    await expect(page.getByLabel('Campo')).toBeVisible();
    await expect(page.getByLabel('Operador')).toBeVisible();
    await expect(page.getByLabel('Valor')).toBeVisible();
    await expect(page.getByLabel('Ação', { exact: true })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Salvar regra' })).toBeVisible();

    await rodarChecagensDeAcessibilidade(page);
  });

  // Interacao relevante: uma regra inativa nao pode ser ativada antes da
  // simulacao. Simula (POST /simulacoes mockado) e so entao ativa (PATCH
  // /ativacao mockado) - mesmo comportamento ja validado em
  // tests/visual/fase-197-modulos-avancados.spec.mjs, agora com axe-core.
  test('simulacao e ativacao - regra inativa exige simulacao antes de ativar (interacao relevante)', async ({ page }) => {
    await prepararAutomacoes(page, { regras: { itens: [regraConvencionalInativaFixture] } });
    await page.goto('/automacoes');

    const botaoAtivar = page.getByRole('button', { name: 'Ativar Retomar contato após check-in atrasado' });
    await expect(botaoAtivar).toBeDisabled();

    await page.route('**/api/automacoes/simulacoes', (route) => route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'exec-simulacao-teste',
        tenantId: 'tenant-1',
        regraId: regraConvencionalInativaFixture.id,
        pacienteId: 'pac-auto-1',
        status: 'executado',
        resultado: { simulacao: true, executar: true, gatilho: 'checkin.atrasado' },
        criadoEm: '2026-08-08T10:00:00.000Z'
      })
    }));
    await page.getByRole('button', { name: 'Simular sem executar' }).click();
    await expect(page.getByText('Simulação concluída: a regra seria executada.')).toBeVisible();
    await expect(botaoAtivar).toBeEnabled();

    await page.route(`**/api/automacoes/regras/${regraConvencionalInativaFixture.id}/ativacao`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...regraConvencionalInativaFixture, ativa: true })
    }));
    await botaoAtivar.click();
    await expect(page.getByText('Regra ativada.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pausar Retomar contato após check-in atrasado' })).toBeVisible();
    await expect(page.getByText('Ativa', { exact: true })).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('simulacao - condicoes nao atendidas', async ({ page }) => {
    await prepararAutomacoes(page, { regras: { itens: [regraConvencionalInativaFixture] } });
    await page.goto('/automacoes');

    await page.route('**/api/automacoes/simulacoes', (route) => route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'exec-simulacao-sem-condicao',
        tenantId: 'tenant-1',
        regraId: regraConvencionalInativaFixture.id,
        pacienteId: 'pac-auto-1',
        status: 'ignorado',
        resultado: { simulacao: true, executar: false, gatilho: 'checkin.atrasado' },
        criadoEm: '2026-08-09T10:00:00.000Z'
      })
    }));
    await page.getByRole('button', { name: 'Simular sem executar' }).click();
    await expect(page.getByText('Simulação concluída: as condições não foram atendidas.')).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('simulacao - falha ao simular', async ({ page }) => {
    await prepararAutomacoes(page, { regras: { itens: [regraConvencionalInativaFixture] } });
    await page.goto('/automacoes');

    await page.route('**/api/automacoes/simulacoes', (route) => route.fulfill({
      status: 500,
      contentType: 'text/plain',
      body: 'Falha ao simular regra.'
    }));
    await page.getByRole('button', { name: 'Simular sem executar' }).click();
    await expect(page.getByText('Falha ao simular regra.')).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  // Interacao relevante: recall de pacientes inativos, com candidatos e
  // exclusoes sinteticos. Nenhuma mensagem e enviada - o painel nao tem
  // nenhum botao de disparo para esta regra, so simulacao.
  test('recall - simula e mostra candidatos e exclusoes de forma acessivel (interacao relevante)', async ({ page }) => {
    await prepararAutomacoes(page, { regras: { itens: [regraRecallFixture] } });
    await page.goto('/automacoes');

    await page.route('**/api/automacoes/recall/simulacoes', (route) => route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'exec-recall-teste',
        tenantId: 'tenant-1',
        regraId: regraRecallFixture.id,
        status: 'executado',
        resultado: {
          simulacao: true,
          gatilho: 'paciente.inativo',
          totalCandidatos: 2,
          candidatos: [
            { pacienteId: 'pac-auto-2', diasSemConsulta: 75 },
            { pacienteId: 'pac-auto-3', diasSemConsulta: null }
          ],
          excluidos: [
            { pacienteId: 'pac-auto-4', motivo: 'sem_contato' },
            { pacienteId: 'pac-auto-5', motivo: 'consulta_recente' }
          ]
        },
        criadoEm: '2026-08-10T10:00:00.000Z'
      })
    }));

    await page.getByRole('button', { name: `Simular recall de ${regraRecallFixture.nome}` }).click();
    await expect(page.getByText('Simulação concluída: 2 paciente(s) seriam contatados. Confira a lista antes de ativar.')).toBeVisible();

    await expect(page.getByText('Seriam contatados (2):')).toBeVisible();
    await expect(page.getByText('Marcos Andrade - 75 dias sem consulta')).toBeVisible();
    await expect(page.getByText('Juliana Prado - nunca concluiu consulta')).toBeVisible();
    await expect(page.getByText('Fora (2):')).toBeVisible();
    await expect(page.getByText(/Ricardo Nunes - sem contato cadastrado/)).toBeVisible();
    await expect(page.getByText(/Beatriz Ramos - teve consulta recente/)).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });
});

// IA assistida (/ia) - dados integralmente sinteticos. As mutacoes exercitadas
// abaixo sao interceptadas no navegador; nenhum provedor, backend ou prontuario
// real participa deste gate.
const permissoesIa = ['console.acessar', 'ia.executar', 'pacientes.listar', 'pacientes.ler'];
const pacienteIaFixture = { id: 'pac-ia-1', nome: 'Paciente Sintetico' };
const imagemIaFixture = {
  id: 'midia-ia-1',
  pacienteId: pacienteIaFixture.id,
  tipo: 'imagem',
  categoria: 'diario',
  nomeArquivo: 'refeição-sintetica.jpg',
  mimeType: 'image/jpeg',
  tamanhoBytes: '1024',
  hashConteudo: 'a'.repeat(64),
  status: 'confirmado',
  criadoEm: '2026-08-01T12:00:00.000Z',
  confirmadoEm: '2026-08-01T12:05:00.000Z'
};

const analiseIaPendenteFixture = {
  id: 'analise-ia-pendente',
  tenantId: 'tenant-1',
  pacienteId: pacienteIaFixture.id,
  modelo: 'heuristica-sintetica',
  ansiedadeScore: '20',
  frustracaoScore: '75',
  motivacaoScore: '40',
  confusaoScore: '10',
  explicacao: {
    provedor: 'heuristica-sintetica',
    limitacoes: ['Analise lexical sintetica sem prontuario completo.']
  },
  alertaDisparado: false,
  revisaoHumana: { status: 'pendente' },
  criadoEm: '2026-08-01T13:00:00.000Z'
};

const reconhecimentoIaPendenteFixture = {
  id: 'reconhecimento-ia-pendente',
  tenantId: 'tenant-1',
  pacienteId: pacienteIaFixture.id,
  arquivoMidiaId: imagemIaFixture.id,
  provedor: 'heuristica-sintetica',
  imagemHash: 'a'.repeat(64),
  alimentosDetectados: [{ nome: 'arroz sintetico' }],
  pesoEstimadoGramas: '180',
  caloriasEstimadas: '230',
  confiancaMedia: '72',
  limitacoes: ['Estimativa sintetica que exige confirmacao profissional.'],
  revisaoHumana: { status: 'pendente' },
  criadoEm: '2026-08-01T13:10:00.000Z'
};

const analisesIaSomenteLeituraFixture = Array.from({ length: 8 }, (_, indice) => ({
  ...analiseIaPendenteFixture,
  id: `analise-ia-rejeitada-${indice + 1}`,
  modelo: `heuristica-sintetica-${indice + 1}`,
  explicacao: {
    provedor: 'heuristica-sintetica',
    limitacoes: [`Limitacao sintetica detalhada para o item ${indice + 1}.`]
  },
  revisaoHumana: { status: 'rejeitada' },
  criadoEm: `2026-08-${String(indice + 2).padStart(2, '0')}T13:00:00.000Z`
}));

const reconhecimentosIaSomenteLeituraFixture = Array.from({ length: 8 }, (_, indice) => ({
  ...reconhecimentoIaPendenteFixture,
  id: `reconhecimento-ia-rejeitado-${indice + 1}`,
  provedor: `heuristica-sintetica-${indice + 1}`,
  alimentosDetectados: [{ nome: `alimento sintetico ${indice + 1}` }],
  limitacoes: [`Limitacao sintetica detalhada para o reconhecimento ${indice + 1}.`],
  revisaoHumana: { status: 'rejeitada' },
  criadoEm: `2026-08-${String(indice + 2).padStart(2, '0')}T13:10:00.000Z`
}));

async function prepararSessaoIa(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/ia'), domain: 'localhost', path: '/' }
  ]);

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      autenticado: true,
      papel: 'Professional',
      apiUrl: 'http://localhost:3001',
      tenantSlug: 'clinica-octa',
      email: 'profissional@octaclin.local',
      expiraEm: '2026-12-31T18:00:00.000Z',
      permissoes: permissoesIa,
      destinoInicial: '/ia'
    })
  }));
}

function prepararPacientesIa(page, { itens = [pacienteIaFixture] } = {}) {
  return page.route('**/api/pacientes**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ itens, total: itens.length })
  }));
}

function prepararAnalisesIa(page, { itens = [analiseIaPendenteFixture], status = 200 } = {}) {
  return page.route((url) => url.pathname === '/api/ia/sentimento', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    if (status !== 200) {
      await route.fulfill({ status, contentType: 'text/plain', body: 'Falha ao carregar sugestões assistidas.' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(itens) });
  });
}

function prepararReconhecimentosIa(page, { itens = [reconhecimentoIaPendenteFixture] } = {}) {
  return page.route((url) => url.pathname === '/api/ia/reconhecimento-alimentar', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(itens) });
  });
}

function prepararImagensIa(page, { itens = [imagemIaFixture], status = 200 } = {}) {
  return page.route('**/api/mobile/midias/uploads**', async (route) => {
    if (status !== 200) {
      await route.fulfill({ status, contentType: 'text/plain', body: 'Falha ao carregar imagens clínicas.' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(itens) });
  });
}

async function prepararIa(page, { pacientes, analises, reconhecimentos, imagens } = {}) {
  await prepararSessaoIa(page);
  await prepararPacientesIa(page, pacientes);
  await prepararAnalisesIa(page, analises);
  await prepararReconhecimentosIa(page, reconhecimentos);
  await prepararImagensIa(page, imagens);
}

test.describe('gate de acessibilidade - ia assistida (PR 25)', () => {
  test('painel carregado com sugestoes pendentes e revisao humana obrigatoria', async ({ page }) => {
    await prepararIa(page);
    await page.goto('/ia');

    await expect(page.getByRole('heading', { name: 'Sugestões assistidas', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Análise de sentimento' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reconhecimento alimentar' })).toBeVisible();
    await expect(page.getByText('Revisão pendente')).toHaveCount(2);
    await expect(page.getByText('Aguardando revisão')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Abrir prontuário' })).toHaveCount(0);
    await expect(page.getByLabel('Arquivo midia')).toContainText('refeição-sintetica.jpg');

    await rodarChecagensDeAcessibilidade(page);
  });

  test('painel sem historico e sem imagem confirmada', async ({ page }) => {
    await prepararIa(page, {
      analises: { itens: [] },
      reconhecimentos: { itens: [] },
      imagens: { itens: [] }
    });
    await page.goto('/ia');

    await expect(page.getByText('Nenhuma análise persistida.')).toBeVisible();
    await expect(page.getByText('Nenhum reconhecimento persistido.')).toBeVisible();
    await expect(page.getByText('Nenhuma imagem confirmada. Envie uma foto no prontuário do paciente antes de solicitar a análise.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reconhecer' })).toBeDisabled();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('painel mostra falha no carregamento inicial', async ({ page }) => {
    await prepararIa(page, { analises: { status: 500 } });
    await page.goto('/ia');

    await expect(page.getByText('Falha ao carregar sugestões assistidas.')).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('painel mostra falha ao carregar imagens clinicas', async ({ page }) => {
    await prepararIa(page, { imagens: { status: 500 } });
    await page.goto('/ia');

    await expect(page.getByText('Falha ao carregar imagens clínicas.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reconhecer' })).toBeDisabled();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('historicos somente leitura com overflow real sao focalizaveis', async ({ page }) => {
    await prepararIa(page, {
      analises: { itens: analisesIaSomenteLeituraFixture },
      reconhecimentos: { itens: reconhecimentosIaSomenteLeituraFixture }
    });
    await page.goto('/ia');

    await expect(page.getByText('8 analises, 8 reconhecimentos persistidos')).toBeVisible();

    await rodarChecagensDeAcessibilidade(page);

    const regiaoSentimentos = page.getByLabel('Sentimentos recentes');
    await regiaoSentimentos.focus();
    await expect(regiaoSentimentos).toBeFocused();
    const medidasSentimentos = await regiaoSentimentos.evaluate((elemento) => ({
      scrollHeight: elemento.scrollHeight,
      clientHeight: elemento.clientHeight
    }));
    expect(medidasSentimentos.scrollHeight).toBeGreaterThan(medidasSentimentos.clientHeight);

    const regiaoReconhecimentos = page.getByLabel('Reconhecimentos recentes');
    await regiaoReconhecimentos.focus();
    await expect(regiaoReconhecimentos).toBeFocused();
    const medidasReconhecimentos = await regiaoReconhecimentos.evaluate((elemento) => ({
      scrollHeight: elemento.scrollHeight,
      clientHeight: elemento.clientHeight
    }));
    expect(medidasReconhecimentos.scrollHeight).toBeGreaterThan(medidasReconhecimentos.clientHeight);
  });

  test('revisao humana editada libera prontuario somente apos PATCH mockado', async ({ page }) => {
    await prepararIa(page, { reconhecimentos: { itens: [] } });
    await page.route(`**/api/ia/sentimento/${analiseIaPendenteFixture.id}/revisao`, async (route) => {
      const corpo = route.request().postDataJSON();
      expect(corpo).toEqual({
        decisao: 'editada',
        conteudoEditado: { interpretacaoProfissional: 'Frustracao pontual sintetica, sem indicio de risco atual.' }
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...analiseIaPendenteFixture,
          revisaoHumana: { status: 'editada', conteudoEditado: corpo.conteudoEditado }
        })
      });
    });
    await page.goto('/ia');

    await page.getByPlaceholder('Informe a interpretação clínica corrigida').fill('Frustracao pontual sintetica, sem indicio de risco atual.');
    await page.getByRole('button', { name: 'Editar e aceitar' }).click();

    await expect(page.getByText('Revisão humana registrada.')).toBeVisible();
    await expect(page.getByText('Editada pelo profissional')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Abrir prontuário' })).toHaveAttribute('href', `/pacientes/${pacienteIaFixture.id}`);

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });

  test('reconhecimento usa apenas imagem confirmada e POST mockado', async ({ page }) => {
    await prepararIa(page, { analises: { itens: [] }, reconhecimentos: { itens: [] } });
    await page.route((url) => url.pathname === '/api/ia/reconhecimento-alimentar', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      expect(route.request().postDataJSON()).toEqual({
        pacienteId: pacienteIaFixture.id,
        arquivoMidiaId: imagemIaFixture.id,
        contexto: { observacao: 'Prato sintetico com arroz.' }
      });
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(reconhecimentoIaPendenteFixture)
      });
    });
    await page.goto('/ia');

    await page.getByLabel('Observação').fill('Prato sintetico com arroz.');
    await page.getByRole('button', { name: 'Reconhecer' }).click();

    await expect(page.getByText('Reconhecimento alimentar criado por heuristica-sintetica.')).toBeVisible();
    await expect(page.getByText('Revisão pendente')).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
  });
});

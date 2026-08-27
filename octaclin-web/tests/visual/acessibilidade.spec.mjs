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

  const violacoes = resultado.violations.map((violacao) => {
    // Os alvos e o resumo de cada no entram na mensagem porque, sem eles, o
    // relatorio diz apenas "1 elemento(s)" e nao ha como corrigir a violacao
    // certa sem reabrir o trace.
    const nos = violacao.nodes
      .map((no) => `    - ${no.target.join(' ')} :: ${(no.failureSummary ?? '').replace(/\s+/g, ' ').trim()}`)
      .join('\n');
    return `${violacao.id} (impacto: ${violacao.impact}): ${violacao.help} — ${violacao.nodes.length} elemento(s) — ${violacao.helpUrl}\n${nos}`;
  });

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

    // Escopado a <main>: flake reproduzido e investigado (~25-30% das
    // execucoes, ver PR de estabilizacao). `getByText` sem escopo resolvia 2
    // elementos identicos - um dentro de <main> (o conteudo real da pagina) e
    // outro fora, no overlay de dev do Next (`<nextjs-portal>`, ja excluido em
    // outros pontos desta suite - ver `.exclude('nextjs-portal')` no axe e a
    // remocao do elemento antes da checagem de teclado). Nao e duplicacao do
    // produto nem duas areas legitimas: e ferramenta de dev vazando para o
    // locator. Escopar a <main> restringe a assercao ao conteudo real, sem
    // esconder ambiguidade com indice nem mascarar com retry/timeout.
    const conteudo = page.getByRole('main');
    await expect(conteudo.getByText('Nenhuma análise persistida.')).toBeVisible();
    await expect(conteudo.getByText('Nenhum reconhecimento persistido.')).toBeVisible();
    await expect(conteudo.getByText('Nenhuma imagem confirmada. Envie uma foto no prontuário do paciente antes de solicitar a análise.')).toBeVisible();
    await expect(conteudo.getByRole('button', { name: 'Reconhecer' })).toBeDisabled();

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

// ---------------------------------------------------------------------------
// PR 26 da governanca: expande o gate de a11y para /operacoes, cobrindo as oito
// areas do painel operacional (Onboarding, Saude, Rollout, Incidentes,
// Comunicacoes, LGPD, Auditoria e Filas).
//
// Todos os dados sao sinteticos e TODAS as chamadas de API sao interceptadas
// pelo Playwright: `prepararOperacoes` registra primeiro um catch-all
// `**/api/**` que apenas REGISTRA e bloqueia qualquer rota nao mockada (a
// precedencia do Playwright e a ordem inversa de registro, entao ele so pega o
// que nenhum mock especifico casou). Os testes conferem essa lista vazia, o que
// prova que nada saiu para backend, banco, Render, Neon ou integracao.
// ---------------------------------------------------------------------------

const permissoesOperacoes = ['console.acessar', 'operacoes.auditoria.ler'];

const abasOperacoesFixture = [
  { id: 'onboarding', rotulo: 'Onboarding' },
  { id: 'saude', rotulo: 'Saude' },
  { id: 'rollout', rotulo: 'Rollout' },
  { id: 'incidentes', rotulo: 'Incidentes' },
  { id: 'comunicacoes', rotulo: 'Comunicações' },
  { id: 'lgpd', rotulo: 'LGPD' },
  { id: 'auditoria', rotulo: 'Auditoria' },
  { id: 'filas', rotulo: 'Filas' }
];

const resumoOperacionalFixture = {
  outbox: { pendente: 3, processando: 1, processado: 42, falhou: 2 },
  mobile: { sincronizado: 5, erro: 0 }
};

const alertasOperacionaisFixture = {
  status: 'critico',
  geradoEm: '2026-08-20T13:00:00.000Z',
  resumo: { total: 2, criticos: 1, atencao: 1, informativos: 0 },
  itens: [
    {
      id: 'fila.outbox.pendente.atrasado',
      severidade: 'critico',
      origem: 'fila',
      titulo: 'Outbox com eventos pendentes atrasados',
      mensagem: 'Eventos sintéticos acima da janela operacional esperada.',
      acaoSugerida: 'Verificar fila, processador de outbox e central de falhas.',
      metrica: 'outbox_pendente_atrasado',
      valor: 4
    },
    {
      id: 'integracao.comunicacoes.falhas',
      severidade: 'atencao',
      origem: 'integracao',
      titulo: 'Falhas de comunicação aguardam tratamento',
      mensagem: 'Falhas sintéticas reprocessáveis na central de comunicações.',
      acaoSugerida: 'Abrir a área Comunicações do painel operacional.',
      valor: 1
    }
  ]
};

const alertasOperacionaisVaziosFixture = {
  status: 'ok',
  geradoEm: '2026-08-20T13:00:00.000Z',
  resumo: { total: 0, criticos: 0, atencao: 0, informativos: 0 },
  itens: []
};

const rolloutOperacionalFixture = {
  status: 'ok',
  decisaoSugerida: 'promover',
  geradoEm: '2026-08-20T18:00:00.000Z',
  release: { commit: 'sintetico0001', servicoId: 'configurado', ambiente: 'sintetico', papelProcesso: 'all' },
  health: { status: 'ok', checks: { backend: 'ok', banco: 'ok', migracoes: 'ok', redis: 'ok' } },
  telemetria: {
    processo: { iniciadoEm: '2026-08-20T17:00:00.000Z', uptimeSegundos: 3600 },
    http: {
      total: 240,
      sucesso: 238,
      errosCliente: 2,
      errosServidor: 0,
      taxaErro5xx: 0,
      duracaoMediaMs: 120,
      duracaoP95Ms: 430,
      amostrasDuracao: 240,
      porRota: []
    },
    tracesRecentes: [
      {
        requestId: 'req-sintetico-1',
        horario: '2026-08-20T18:00:00.000Z',
        metodo: 'GET',
        rota: '/health/pronto',
        statusCode: 200,
        duracaoMs: 32,
        resultado: 'sucesso'
      }
    ]
  },
  filas: [
    { nome: 'notificacoes', status: 'ok', esperando: 2, ativas: 1, atrasadas: 0, falharam: 0, pausada: false },
    { nome: 'google_calendar', status: 'degradado', esperando: 0, ativas: 0, atrasadas: 0, falharam: 0, pausada: false },
    { nome: 'automacoes', status: 'ok', esperando: 1, ativas: 0, atrasadas: 0, falharam: 0, pausada: false }
  ],
  flags: {
    configuracaoValida: true,
    flags: [
      { chave: 'ia.clinica', habilitada: false, origem: 'padrao' },
      { chave: 'mobile.sync', habilitada: false, origem: 'padrao' }
    ]
  }
};

const featureFlagsOperacoesFixture = {
  configuracaoValida: true,
  flags: [
    { chave: 'ia.clinica', habilitada: false, origem: 'padrao' },
    { chave: 'mobile.sync', habilitada: false, origem: 'padrao' }
  ]
};

const tenantsOperacoesFixture = {
  itens: [
    {
      id: '00000000-0000-4000-8000-000000000101',
      nome: 'Clínica Sintética Um',
      slug: 'clinica-sintetica-um',
      status: 'ativo',
      cicloVidaStatus: 'ativo_assistido',
      planoId: 'profissional',
      assinaturaStatus: 'ativa',
      provisionamentoReferencia: 'contrato-sintetico-001',
      proprietarioEmailMascarado: 'p***@octaclin.test',
      conviteStatus: 'pendente',
      criadoEm: '2026-08-10T12:00:00.000Z',
      atualizadoEm: '2026-08-18T12:00:00.000Z'
    },
    {
      id: '00000000-0000-4000-8000-000000000102',
      nome: 'Clínica Sintética Dois',
      slug: 'clinica-sintetica-dois',
      status: 'ativo',
      cicloVidaStatus: 'encerramento_pendente',
      planoId: 'clinica',
      assinaturaStatus: 'ativa',
      provisionamentoReferencia: 'contrato-sintetico-002',
      proprietarioEmailMascarado: 'g***@octaclin.test',
      conviteStatus: 'aceito',
      criadoEm: '2026-08-11T12:00:00.000Z',
      atualizadoEm: '2026-08-19T12:00:00.000Z'
    }
  ],
  total: 2
};

const falhasOutboxFixture = [
  {
    id: 'outbox-sintetico-1',
    tipo: 'agenda.consulta.criada',
    tentativas: 3,
    erro: 'Tempo esgotado sintético no consumidor.',
    payload: { consultaId: 'consulta-sintetica-1' },
    criadoEm: '2026-08-20T12:00:00.000Z'
  }
];

const sincronizacoesMobileFixture = [
  {
    id: 'sincronizacao-sintetica-1',
    tipo: 'checkin',
    status: 'sincronizado',
    idLocal: 'local-sintetico-1',
    recursoId: 'recurso-sintetico-1',
    criadoEm: '2026-08-20T12:10:00.000Z'
  }
];

const auditoriaOperacionalFixture = [
  {
    id: 'auditoria-sintetica-1',
    acao: 'pacientes.listar_dados_sensiveis',
    recursoTipo: 'paciente',
    recursoId: 'paciente-sintetico-1',
    usuarioId: 'usuario-sintetico-1',
    ip: '203.0.113.10',
    userAgent: 'Mozilla/5.0 (sintetico)',
    metadados: { filtro: 'ativos' },
    criadoEm: '2026-08-20T11:00:00.000Z'
  }
];

const falhasComunicacaoFixture = {
  itens: [
    {
      id: 'mensagem:mensagem-sintetica-1',
      origem: 'mensagem',
      canal: 'email',
      tipo: 'agenda.consulta.lembrete',
      referenciaId: 'mensagem-sintetica-1',
      erro: 'Servidor de e-mail sintético indisponível.',
      criadoEm: '2026-08-20T12:00:00.000Z',
      reprocessavel: true,
      tentativas: 2,
      resumo: 'contato-sintetico@octaclin.test'
    }
  ],
  total: 1,
  pagina: 1,
  limite: 25,
  resumo: { total: 1, email: 1, whatsapp: 0, googleCalendar: 0, outbox: 0, outras: 0, reprocessaveis: 1 }
};

const falhasComunicacaoVaziasFixture = {
  itens: [],
  total: 0,
  pagina: 1,
  limite: 25,
  resumo: { total: 0, email: 0, whatsapp: 0, googleCalendar: 0, outbox: 0, outras: 0, reprocessaveis: 0 }
};

const protocoloLgpdFixture = 'LGPD-SINTETICO-1';

const solicitacoesLgpdFixture = {
  itens: [
    {
      protocolo: protocoloLgpdFixture,
      pacienteId: 'paciente-sintetico-1',
      usuarioPacienteId: 'usuario-paciente-sintetico-1',
      tipo: 'retificacao',
      status: 'recebida',
      detalhes: 'Atualizar contato sintético cadastrado.',
      abertoEm: '2026-08-20T10:00:00.000Z',
      atualizadoEm: '2026-08-20T10:00:00.000Z'
    },
    {
      protocolo: 'LGPD-SINTETICO-2',
      pacienteId: 'paciente-sintetico-2',
      usuarioPacienteId: 'usuario-paciente-sintetico-2',
      tipo: 'exclusao',
      status: 'concluida',
      detalhes: 'Exclusão sintética concluída.',
      abertoEm: '2026-08-18T10:00:00.000Z',
      atualizadoEm: '2026-08-19T10:00:00.000Z',
      responsavelId: 'usuario-sintetico-1',
      ultimaTratativa: 'Encerrada com evidência sintética.'
    }
  ],
  total: 2,
  pagina: 1,
  limite: 25
};

const detalheLgpdFixture = {
  protocolo: protocoloLgpdFixture,
  pacienteId: 'paciente-sintetico-1',
  usuarioPacienteId: 'usuario-paciente-sintetico-1',
  tipo: 'retificacao',
  status: 'em_tratamento',
  detalhes: 'Atualizar contato sintético cadastrado.',
  abertoEm: '2026-08-20T10:00:00.000Z',
  atualizadoEm: '2026-08-20T11:00:00.000Z',
  responsavelId: 'usuario-sintetico-1',
  ultimaTratativa: 'Validando cadastro sintético.',
  historico: [
    {
      id: 'consentimento-sintetico-1',
      tipo: 'solicitacao_lgpd_retificacao',
      status: 'recebida',
      detalhes: 'Atualizar contato sintético cadastrado.',
      criadoEm: '2026-08-20T10:00:00.000Z'
    },
    {
      id: 'tratativa-sintetica-1',
      tipo: 'tratativa_lgpd',
      status: 'em_tratamento',
      detalhes: 'Validando cadastro sintético.',
      responsavelId: 'usuario-sintetico-1',
      criadoEm: '2026-08-20T11:00:00.000Z'
    }
  ]
};

const retencaoLgpdFixture = {
  versao: '2026-10',
  geradoEm: '2026-08-20T12:00:00.000Z',
  politicas: [
    {
      id: 'auditoria_operacional',
      rotulo: 'Auditoria operacional',
      entidade: 'user_action_logs',
      campoData: 'criadoEm',
      diasRetencao: 3650,
      acao: 'arquivar_exportar',
      baseLegal: 'Obrigação legal e exercício regular de direitos',
      descricao: 'Registros sensíveis são preservados por 10 anos antes do arquivo controlado.'
    },
    {
      id: 'outbox_processado',
      rotulo: 'Outbox processado',
      entidade: 'outbox_eventos',
      campoData: 'criadoEm',
      diasRetencao: 180,
      acao: 'excluir',
      baseLegal: 'Minimização operacional',
      descricao: 'Eventos processados ficam elegíveis para limpeza após 180 dias.'
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
        corteEm: '2016-08-20T12:00:00.000Z',
        vencidos: 7
      },
      {
        politicaId: 'outbox_processado',
        rotulo: 'Outbox processado',
        acao: 'excluir',
        diasRetencao: 180,
        corteEm: '2026-02-21T12:00:00.000Z',
        vencidos: 4
      }
    ]
  }
};

const retencaoLgpdVaziaFixture = {
  versao: '2026-10',
  geradoEm: '2026-08-20T12:00:00.000Z',
  politicas: [],
  resumo: { totalVencidos: 0, itens: [] }
};

const solicitacoesAssinaturaFixture = {
  itens: [
    {
      tenantId: 'tenant-sintetico-1',
      acao: 'upgrade',
      status: 'pendente',
      planoAtualId: 'profissional',
      planoAtual: 'Profissional',
      planoDesejado: 'clinica',
      observacao: 'Mais usuários administrativos sintéticos.',
      solicitadoPorUsuarioId: 'usuario-sintetico-2',
      solicitadoEm: '2026-08-20T10:00:00.000Z'
    },
    {
      tenantId: 'tenant-sintetico-2',
      acao: 'downgrade',
      status: 'concluida',
      planoAtualId: 'clinica',
      planoAtual: 'Clínica',
      planoDesejado: 'profissional',
      planoAplicadoId: 'profissional',
      observacao: 'Ajuste sintético de plano.',
      solicitadoPorUsuarioId: 'usuario-sintetico-3',
      solicitadoEm: '2026-08-18T10:00:00.000Z',
      resolvidoPorUsuarioId: 'usuario-sintetico-1',
      resolvidoEm: '2026-08-19T10:00:00.000Z'
    }
  ],
  total: 2,
  pagina: 1,
  limite: 25
};

const paginadoVazioFixture = { itens: [], total: 0, pagina: 1, limite: 25 };

function responderJson(route, { status = 200, corpo }) {
  if (status !== 200) {
    return route.fulfill({
      status,
      contentType: 'text/plain; charset=utf-8',
      body: typeof corpo === 'string' ? corpo : 'Falha sintética na rota operacional.'
    });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) });
}

async function prepararOperacoes(page, opcoes = {}) {
  const {
    resumo = {},
    alertas = {},
    rollout = {},
    tenants = {},
    outbox = {},
    sincronizacoes = {},
    auditoria = {},
    comunicacoes = {},
    lgpd = {},
    retencao = {},
    assinaturas = {}
  } = opcoes;

  const chamadas = {
    naoMockadas: [],
    mutacoes: []
  };

  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'SuperAdmin', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/operacoes'), domain: 'localhost', path: '/' }
  ]);

  // Rede de seguranca: registrada PRIMEIRO, portanto so recebe o que nenhum
  // mock especifico casou. Nada daqui chega ao BFF, ao backend ou ao banco.
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    chamadas.naoMockadas.push(`${route.request().method()} ${url.pathname}`);
    await route.fulfill({ status: 599, contentType: 'text/plain; charset=utf-8', body: 'Rota nao mockada no gate de a11y.' });
  });

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      autenticado: true,
      papel: 'SuperAdmin',
      apiUrl: 'http://localhost:3001',
      tenantSlug: 'clinica-sintetica',
      email: 'operacoes@octaclin.test',
      expiraEm: '2026-12-31T18:00:00.000Z',
      permissoes: permissoesOperacoes,
      destinoInicial: '/operacoes'
    })
  }));

  await page.route('**/api/notificacoes**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ naoLidas: 0, itens: [] }) })
  );

  await page.route('**/api/operacoes/resumo', (route) =>
    responderJson(route, { corpo: resumoOperacionalFixture, ...resumo })
  );

  await page.route('**/api/operacoes/alertas', (route) =>
    responderJson(route, { corpo: alertasOperacionaisFixture, ...alertas })
  );

  await page.route('**/api/operacoes/rollout', (route) =>
    responderJson(route, { corpo: rolloutOperacionalFixture, ...rollout })
  );

  await page.route('**/api/operacoes/mobile/sincronizacoes**', (route) =>
    responderJson(route, { corpo: sincronizacoesMobileFixture, ...sincronizacoes })
  );

  await page.route('**/api/operacoes/outbox/falhas**', (route) => {
    const paginada = route.request().url().includes('/paginada');
    const itens = outbox.corpo ?? falhasOutboxFixture;
    return responderJson(route, {
      status: outbox.status ?? 200,
      corpo: paginada ? { itens, total: itens.length, pagina: 1, limite: 25 } : itens
    });
  });

  await page.route('**/api/operacoes/auditoria**', (route) => {
    const paginada = route.request().url().includes('/paginada');
    const itens = auditoria.corpo ?? auditoriaOperacionalFixture;
    return responderJson(route, {
      status: auditoria.status ?? 200,
      corpo: paginada ? { itens, total: itens.length, pagina: 1, limite: 25 } : itens
    });
  });

  await page.route('**/api/operacoes/comunicacoes/falhas**', (route) =>
    responderJson(route, { corpo: falhasComunicacaoFixture, ...comunicacoes })
  );

  await page.route('**/api/operacoes/assinaturas/solicitacoes**', (route) =>
    responderJson(route, { corpo: solicitacoesAssinaturaFixture, ...assinaturas })
  );

  await page.route('**/api/operacoes/lgpd/retencao', (route) =>
    responderJson(route, { corpo: retencaoLgpdFixture, ...retencao })
  );

  await page.route('**/api/operacoes/lgpd/retencao/programar', (route) => {
    chamadas.mutacoes.push('POST /api/operacoes/lgpd/retencao/programar');
    return responderJson(route, {
      corpo: {
        protocolo: 'RET-SINTETICO-1',
        status: 'programada',
        programadoEm: '2026-08-20T12:00:00.000Z',
        totalItensVencidos: 11,
        resumo: { totalVencidos: 11, itens: [] }
      }
    });
  });

  await page.route('**/api/operacoes/lgpd/solicitacoes**', (route) => {
    const caminho = new URL(route.request().url()).pathname;
    if (caminho.endsWith(`/${protocoloLgpdFixture}/resposta`)) {
      chamadas.mutacoes.push(`POST ${caminho}`);
      return responderJson(route, {
        corpo: {
          protocolo: protocoloLgpdFixture,
          pacienteId: 'paciente-sintetico-1',
          status: 'em_tratamento',
          assuntoEmail: `Atualização da solicitação LGPD ${protocoloLgpdFixture}`,
          corpoEmail: 'Olá,\n\nSeu pedido LGPD sintético está em tratamento.\n\nEquipe OctaClin',
          textoWhatsapp: 'Seu pedido LGPD sintético está em tratamento.',
          canaisSugeridos: ['email', 'whatsapp'],
          geradoEm: '2026-08-20T12:00:00.000Z'
        }
      });
    }
    if (caminho.endsWith(`/${protocoloLgpdFixture}`)) {
      return responderJson(route, { corpo: detalheLgpdFixture });
    }
    return responderJson(route, { corpo: solicitacoesLgpdFixture, ...lgpd });
  });

  await page.route('**/api/operacoes/tenants', (route) =>
    responderJson(route, { corpo: tenantsOperacoesFixture, ...tenants })
  );

  await page.route('**/api/operacoes/tenants/*/ciclo-vida', (route) => {
    chamadas.mutacoes.push(`POST ${new URL(route.request().url()).pathname}`);
    return responderJson(route, { corpo: tenantsOperacoesFixture.itens[0] });
  });

  await page.route('**/api/operacoes/feature-flags', (route) => {
    if (route.request().method() === 'POST') {
      chamadas.mutacoes.push('POST /api/operacoes/feature-flags');
    }
    return responderJson(route, { corpo: featureFlagsOperacoesFixture });
  });

  await page.route('**/api/operacoes/feature-flags/**', (route) =>
    responderJson(route, { corpo: featureFlagsOperacoesFixture })
  );

  return chamadas;
}

async function abrirPainelOperacoes(page, chamadas) {
  await page.goto('/operacoes');
  await expect(page.getByRole('heading', { name: 'Confiabilidade OctaClin', level: 1 })).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Áreas de operações' })).toBeVisible();
  if (chamadas) expect(chamadas.naoMockadas, 'houve chamada de API nao mockada').toEqual([]);
}

// Depois de trocar de aba com o mouse, o ponto de retomada do Tab do Chromium
// headless fica no meio da pagina e a passada global de tabulacao
// (assertTabPreservaEExibeFoco) acusaria fim de sequencia como se fosse foco
// perdido - o mesmo artefato ja documentado acima para .fill(). Esta checagem
// cobre o que importa na area aberta: todo controle focalizavel do tabpanel
// precisa exibir indicador de foco. O Tab inicial marca a modalidade de teclado
// do Chromium, para que o foco programatico seguinte case com :focus-visible.
async function assertFocoVisivelNaArea(page, painel) {
  await page.keyboard.press('Tab');
  const controles = painel.locator(
    'a[href]:visible, button:not([disabled]):visible, input:not([disabled]):not([type="hidden"]):visible, select:not([disabled]):visible, textarea:not([disabled]):visible'
  );
  // Areas somente leitura (Incidentes) podem nao ter controle focalizavel
  // proprio; o laco abaixo simplesmente nao roda nesse caso.
  const total = await controles.count();

  for (let indice = 0; indice < total; indice += 1) {
    const controle = controles.nth(indice);
    await controle.focus();
    const foco = await controle.evaluate((elemento) => {
      const estilo = getComputedStyle(elemento);
      return {
        rotulo:
          elemento.getAttribute('aria-label') ??
          elemento.getAttribute('placeholder') ??
          elemento.textContent?.trim().slice(0, 40) ??
          elemento.tagName,
        outlineStyle: estilo.outlineStyle,
        outlineWidth: estilo.outlineWidth,
        boxShadow: estilo.boxShadow
      };
    });
    const temIndicadorDeFoco =
      (foco.outlineStyle !== 'none' && foco.outlineWidth !== '0px') || foco.boxShadow !== 'none';
    expect(
      temIndicadorDeFoco,
      `controle ${indice + 1}/${total} ("${foco.rotulo}") da area aberta sem indicador de foco visivel`
    ).toBe(true);
  }
}

async function abrirAreaOperacoes(page, rotulo) {
  const aba = page.getByRole('tab', { name: rotulo, exact: true });
  await aba.click();
  await expect(aba).toHaveAttribute('aria-selected', 'true');
  const painelId = await aba.getAttribute('aria-controls');
  const painel = page.locator(`#${painelId}`);
  await expect(painel).toBeVisible();
  return painel;
}

test.describe('gate de acessibilidade - operacoes (PR 26)', () => {
  test('area Saude carregada com as metricas de outbox', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);

    const abaSaude = page.getByRole('tab', { name: 'Saude', exact: true });
    await expect(abaSaude).toHaveAttribute('aria-selected', 'true');
    const painel = page.locator('#operacoes-saude-painel');
    await expect(painel).toBeVisible();
    await expect(painel).toHaveAttribute('aria-labelledby', 'operacoes-saude-aba');
    await expect(painel.getByText('Pendentes')).toBeVisible();
    await expect(painel.getByText('Processando')).toBeVisible();
    await expect(painel.getByText('Processados')).toBeVisible();
    await expect(painel.getByText('Falharam')).toBeVisible();
    await expect(painel.getByText('42')).toBeVisible();

    await rodarChecagensDeAcessibilidade(page);
    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('navegacao pelas oito areas somente com teclado', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);

    const tablist = page.getByRole('tablist', { name: 'Áreas de operações' });
    await expect(tablist.getByRole('tab')).toHaveCount(abasOperacoesFixture.length);

    // A area inicial e Saude (estado padrao do controlador).
    const abaInicial = page.getByRole('tab', { name: 'Saude', exact: true });
    await expect(abaInicial).toHaveAttribute('aria-selected', 'true');
    await abaInicial.focus();

    // ArrowRight percorre as oito abas em ordem e volta a primeira selecionada.
    const ordemDireita = ['Rollout', 'Incidentes', 'Comunicações', 'LGPD', 'Auditoria', 'Filas', 'Onboarding', 'Saude'];
    for (const rotulo of ordemDireita) {
      await page.keyboard.press('ArrowRight');
      const aba = page.getByRole('tab', { name: rotulo, exact: true });
      await expect(aba, `ArrowRight nao moveu o foco para a aba ${rotulo}`).toBeFocused();
      await expect(aba, `aba ${rotulo} focada sem aria-selected=true`).toHaveAttribute('aria-selected', 'true');

      const abaId = await aba.getAttribute('id');
      const painelId = await aba.getAttribute('aria-controls');
      expect(painelId, `aba ${rotulo} sem aria-controls`).toBeTruthy();
      const painel = page.locator(`#${painelId}`);
      await expect(painel, `tabpanel ${painelId} nao visivel`).toBeVisible();
      await expect(painel).toHaveAttribute('role', 'tabpanel');
      await expect(painel, `tabpanel ${painelId} nao aponta de volta para a aba`).toHaveAttribute('aria-labelledby', abaId);

      // As demais abas saem da ordem de tabulacao (padrao roving tabindex).
      await expect(aba).toHaveAttribute('tabindex', '0');

      const foco = await page.evaluate(() => {
        const ativo = document.activeElement;
        const estilo = getComputedStyle(ativo);
        return {
          outlineStyle: estilo.outlineStyle,
          outlineWidth: estilo.outlineWidth,
          boxShadow: estilo.boxShadow
        };
      });
      const temIndicadorDeFoco =
        (foco.outlineStyle !== 'none' && foco.outlineWidth !== '0px') || foco.boxShadow !== 'none';
      expect(temIndicadorDeFoco, `aba ${rotulo} focada por teclado sem indicador de foco visivel`).toBe(true);
    }

    // ArrowLeft volta na ordem inversa e mantem a associacao aba/painel.
    for (const rotulo of ['Onboarding', 'Filas', 'Auditoria']) {
      await page.keyboard.press('ArrowLeft');
      const aba = page.getByRole('tab', { name: rotulo, exact: true });
      await expect(aba, `ArrowLeft nao moveu o foco para a aba ${rotulo}`).toBeFocused();
      await expect(aba).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator(`#${await aba.getAttribute('aria-controls')}`)).toBeVisible();
    }

    // Somente uma aba selecionada por vez.
    await expect(tablist.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('area Onboarding com formulario de provisionamento e ciclo de vida', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);

    const painel = await abrirAreaOperacoes(page, 'Onboarding');
    await expect(painel.getByRole('heading', { name: 'Nova clínica' })).toBeVisible();
    await expect(painel.getByLabel('Nome da clínica')).toBeVisible();
    await expect(painel.getByLabel('E-mail do proprietario')).toBeVisible();
    await expect(painel.getByRole('button', { name: 'Provisionar e convidar' })).toBeVisible();
    await expect(painel.getByText('Clínica Sintética Um')).toBeVisible();
    await expect(painel.getByText('Clínica Sintética Dois')).toBeVisible();
    await expect(painel.getByRole('button', { name: 'Encerrar definitivamente' })).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
    await assertFocoVisivelNaArea(page, painel);
    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('area Rollout com telemetria sanitizada e liberacao controlada', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);

    const painel = await abrirAreaOperacoes(page, 'Rollout');
    await expect(painel.getByRole('heading', { name: 'Release sintetico0001' })).toBeVisible();
    await expect(painel.getByRole('heading', { name: 'Filas e integrações' })).toBeVisible();
    await expect(painel.getByRole('heading', { name: 'Rastreamentos sanitizados' })).toBeVisible();
    await expect(painel.getByRole('heading', { name: 'Liberacao controlada' })).toBeVisible();
    await expect(painel.getByText('degradado')).toBeVisible();
    await expect(painel.getByLabel('Clínica', { exact: true })).toBeVisible();
    await expect(painel.getByRole('checkbox', { name: 'IA clínica' })).toBeVisible();
    await expect(painel.getByRole('button', { name: 'Aplicar' })).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
    await assertFocoVisivelNaArea(page, painel);
    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('area Incidentes com alertas operacionais e severidades', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);

    const painel = await abrirAreaOperacoes(page, 'Incidentes');
    await expect(painel.getByRole('heading', { name: 'Alertas operacionais' })).toBeVisible();
    await expect(painel.getByRole('heading', { name: 'Outbox com eventos pendentes atrasados' })).toBeVisible();
    await expect(painel.getByRole('heading', { name: 'Falhas de comunicação aguardam tratamento' })).toBeVisible();
    await expect(painel.getByText('2 ativos')).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
    await assertFocoVisivelNaArea(page, painel);
    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('area Comunicacoes com falhas reprocessaveis e paginacao', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);

    const painel = await abrirAreaOperacoes(page, 'Comunicações');
    await expect(painel.getByRole('heading', { name: 'Central de comunicação' })).toBeVisible();
    await expect(painel.getByText('agenda.consulta.lembrete')).toBeVisible();
    await expect(painel.getByText('Servidor de e-mail sintético indisponível.')).toBeVisible();
    await expect(painel.getByLabel('Origem da falha')).toBeVisible();
    await expect(painel.getByLabel('Canal da falha')).toBeVisible();
    await expect(painel.getByRole('button', { name: 'Reprocessar' })).toBeEnabled();
    await expect(painel.getByRole('button', { name: 'Anterior' })).toBeDisabled();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
    await assertFocoVisivelNaArea(page, painel);
    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('area LGPD com protocolos, retencao e filtros', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);

    const painel = await abrirAreaOperacoes(page, 'LGPD');
    await expect(painel.getByRole('heading', { name: 'Solicitações LGPD' })).toBeVisible();
    await expect(painel.getByRole('heading', { name: 'Retenção e exclusao programada' })).toBeVisible();
    await expect(painel.getByText(protocoloLgpdFixture)).toBeVisible();
    await expect(painel.getByText('LGPD-SINTETICO-2')).toBeVisible();
    await expect(painel.getByLabel('Situação LGPD')).toBeVisible();
    await expect(painel.getByLabel('Tipo LGPD')).toBeVisible();
    await expect(painel.getByRole('button', { name: `Ver detalhes ${protocoloLgpdFixture}` })).toBeVisible();
    await expect(painel.getByRole('button', { name: 'Programar retenção LGPD' })).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
    await assertFocoVisivelNaArea(page, painel);
    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('area Auditoria com eventos sensiveis e exportacao disponivel', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);

    const painel = await abrirAreaOperacoes(page, 'Auditoria');
    await expect(painel.getByRole('heading', { name: 'Auditoria sensível' })).toBeVisible();
    await expect(painel.getByText('pacientes.listar_dados_sensiveis').first()).toBeVisible();
    await expect(painel.getByLabel('Ação')).toBeVisible();
    await expect(painel.getByRole('button', { name: 'CSV' })).toBeEnabled();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
    await assertFocoVisivelNaArea(page, painel);
    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('area Filas com assinaturas, outbox e sync mobile', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);

    const painel = await abrirAreaOperacoes(page, 'Filas');
    await expect(page.getByRole('heading', { name: 'Assinaturas' })).toBeVisible();
    await expect(painel.getByRole('heading', { name: 'Outbox com falha' })).toBeVisible();
    await expect(painel.getByRole('heading', { name: 'Sync mobile' })).toBeVisible();
    await expect(painel.getByText('agenda.consulta.criada')).toBeVisible();
    await expect(painel.getByText('Tempo esgotado sintético no consumidor.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aplicar Clínica' })).toBeVisible();
    await expect(page.getByText('Plano Profissional')).toBeVisible();
    await expect(painel.getByLabel('Início outbox')).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
    await assertFocoVisivelNaArea(page, painel);
    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('estados vazios representativos nas areas com dados', async ({ page }) => {
    const chamadas = await prepararOperacoes(page, {
      alertas: { corpo: alertasOperacionaisVaziosFixture },
      outbox: { corpo: [] },
      sincronizacoes: { corpo: [] },
      auditoria: { corpo: [] },
      comunicacoes: { corpo: falhasComunicacaoVaziasFixture },
      lgpd: { corpo: paginadoVazioFixture },
      retencao: { corpo: retencaoLgpdVaziaFixture },
      assinaturas: { corpo: paginadoVazioFixture },
      tenants: { corpo: { itens: [], total: 0 } }
    });
    await abrirPainelOperacoes(page, chamadas);

    const painelIncidentes = await abrirAreaOperacoes(page, 'Incidentes');
    await expect(painelIncidentes.getByText('Nenhum alerta ativo')).toBeVisible();

    const painelComunicacoes = await abrirAreaOperacoes(page, 'Comunicações');
    await expect(painelComunicacoes.getByText('Nenhuma falha de comunicação carregada.')).toBeVisible();

    const painelAuditoria = await abrirAreaOperacoes(page, 'Auditoria');
    await expect(painelAuditoria.getByText('Nenhum evento de auditoria carregado.')).toBeVisible();
    await expect(painelAuditoria.getByRole('button', { name: 'CSV' })).toBeDisabled();

    const painelLgpd = await abrirAreaOperacoes(page, 'LGPD');
    await expect(painelLgpd.getByText('Nenhuma solicitação LGPD carregada.')).toBeVisible();
    await expect(painelLgpd.getByText('Nenhuma política de retenção carregada.')).toBeVisible();

    const painelFilas = await abrirAreaOperacoes(page, 'Filas');
    await expect(painelFilas.getByText('Nenhuma falha carregada.')).toBeVisible();
    await expect(painelFilas.getByText('Nenhuma sincronizacao carregada.')).toBeVisible();

    const painelOnboarding = await abrirAreaOperacoes(page, 'Onboarding');
    await expect(painelOnboarding.getByText('Nenhuma clínica encontrada.')).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
    await assertFocoVisivelNaArea(page, painelOnboarding);
    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('falha no carregamento inicial do painel operacional', async ({ page }) => {
    const chamadas = await prepararOperacoes(page, {
      resumo: { status: 503, corpo: 'Falha sintética ao carregar o resumo operacional.' }
    });
    await page.goto('/operacoes');

    await expect(page.getByRole('alert').filter({ hasText: 'Falha sintética' })).toBeVisible();

    await rodarChecagensDeAcessibilidade(page);
    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('falha operacional ao carregar clinicas na area Rollout', async ({ page }) => {
    const chamadas = await prepararOperacoes(page, {
      tenants: { status: 503, corpo: 'Falha sintética ao carregar clínicas.' }
    });
    await abrirPainelOperacoes(page, chamadas);

    const painel = await abrirAreaOperacoes(page, 'Rollout');
    await expect(painel.getByRole('alert').filter({ hasText: 'Falha sintética' })).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
    await assertFocoVisivelNaArea(page, painel);
    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('filtros e detalhe LGPD sao somente leitura e mantem acessibilidade', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);

    const painelAuditoria = await abrirAreaOperacoes(page, 'Auditoria');
    await painelAuditoria.getByLabel('Ação').selectOption('pacientes.obter_dados_sensiveis');
    await painelAuditoria.getByRole('button', { name: 'Filtrar' }).click();
    await expect(painelAuditoria.getByRole('heading', { name: 'Auditoria sensível' })).toBeVisible();

    const painelLgpd = await abrirAreaOperacoes(page, 'LGPD');
    await painelLgpd.getByLabel('Situação LGPD').selectOption('recebida');
    await painelLgpd.getByRole('button', { name: 'Filtrar' }).click();
    await painelLgpd.getByRole('button', { name: `Ver detalhes ${protocoloLgpdFixture}` }).click();

    await expect(painelLgpd.getByRole('heading', { name: `Detalhe do protocolo ${protocoloLgpdFixture}` })).toBeVisible();
    await expect(painelLgpd.getByRole('button', { name: `Exportar protocolo ${protocoloLgpdFixture}` })).toBeVisible();
    await expect(painelLgpd.getByRole('button', { name: `Preparar resposta ${protocoloLgpdFixture}` })).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);
    // Filtro, paginacao e leitura de detalhe nao podem disparar mutacao.
    expect(chamadas.mutacoes).toEqual([]);
    expect(chamadas.naoMockadas).toEqual([]);
  });

  test('acao critica de encerramento expoe nome acessivel e estado compreensivel', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);

    const painel = await abrirAreaOperacoes(page, 'Onboarding');
    await painel.getByRole('button', { name: 'Encerrar definitivamente' }).click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Clínica Sintética Dois');
    await expect(modal.getByLabel('Protocolo da exportacao entregue')).toBeVisible();
    await expect(modal.getByLabel('Motivo operacional')).toBeVisible();

    const confirmar = modal.getByRole('button', { name: 'Confirmar' });
    await expect(confirmar, 'Confirmar deveria comecar desabilitado sem protocolo e sem confirmacao').toBeDisabled();

    await modal.getByLabel('Protocolo da exportacao entregue').fill('EXP-SINTETICO-001');
    await modal.getByRole('checkbox').check();
    await expect(confirmar).toBeEnabled();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);

    // O fluxo destrutivo nao e executado: sai pelo "Voltar", sem POST.
    await modal.getByRole('button', { name: 'Voltar' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(chamadas.mutacoes).toEqual([]);
    expect(chamadas.naoMockadas).toEqual([]);
  });

  test('mensagem de sucesso apos programar retencao com rota mockada', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);

    const painel = await abrirAreaOperacoes(page, 'LGPD');
    await painel.getByRole('button', { name: 'Programar retenção LGPD' }).click();

    const sucesso = page.getByRole('status').filter({ hasText: 'Retenção LGPD programada' });
    await expect(sucesso).toBeVisible();
    await expect(sucesso).toContainText('RET-SINTETICO-1');

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);

    // A unica chamada mutavel do gate e esta, e ela e servida pelo mock: o
    // Playwright responde localmente e nada chega ao BFF, ao backend ou ao banco.
    expect(chamadas.mutacoes).toEqual(['POST /api/operacoes/lgpd/retencao/programar']);
    expect(chamadas.naoMockadas).toEqual([]);
  });

  test('lista de abas so recebe tabIndex proprio quando o overflow for real', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);

    const tablist = page.getByRole('tablist', { name: 'Áreas de operações' });
    const medidas = await tablist.evaluate((elemento) => ({
      scrollWidth: elemento.scrollWidth,
      clientWidth: elemento.clientWidth,
      scrollHeight: elemento.scrollHeight,
      clientHeight: elemento.clientHeight,
      tabIndex: elemento.getAttribute('tabindex'),
      focalizaveisInternos: elemento.querySelectorAll('[role="tab"]').length
    }));

    const rolavel = medidas.scrollWidth > medidas.clientWidth || medidas.scrollHeight > medidas.clientHeight;
    if (rolavel) {
      // Regiao rolavel de verdade: ja e alcancavel por teclado pelas proprias
      // abas, entao nao precisa (nem deve ganhar) tabIndex proprio - axe so
      // exige foco quando a regiao NAO contem elemento focalizavel.
      expect(medidas.focalizaveisInternos, 'regiao rolavel sem elemento focalizavel interno').toBeGreaterThan(0);
      const abaAtiva = tablist.locator('[role="tab"][aria-selected="true"]');
      await abaAtiva.focus();
      await expect(abaAtiva).toBeFocused();
    } else {
      // Sem overflow comprovado, nao ha regiao rolavel a corrigir.
      expect(medidas.tabIndex, 'tabIndex adicionado a regiao que nao rola').toBeNull();
    }

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PR 27 da governanca: expande o gate de a11y para /gamificacao (metas, adesao,
// comunidade, desafios, badges e ranking).
//
// Todos os dados sao sinteticos e TODAS as chamadas de API sao interceptadas
// pelo Playwright, no mesmo padrao do PR 26: `prepararGamificacao` registra
// primeiro um catch-all `**/api/**` que apenas REGISTRA e bloqueia qualquer
// rota nao mockada (a precedencia do Playwright e a ordem inversa de registro,
// entao ele so recebe o que nenhum mock especifico casou). Os testes conferem
// essa lista vazia, o que prova que nenhuma chamada saiu para backend, banco ou
// integracao, e a lista `mutacoes` prova que nenhuma persistencia real ocorreu.
// ---------------------------------------------------------------------------

const permissoesGamificacao = ['console.acessar', 'gamificacao.gerenciar'];

const configuracaoGamificacaoAtivaFixture = {
  metasBadgesHabilitados: true,
  comunidadeHabilitada: true,
  rankingHabilitado: true
};

const configuracaoGamificacaoDesativadaFixture = {
  metasBadgesHabilitados: false,
  comunidadeHabilitada: false,
  rankingHabilitado: false
};

const profissionaisGamificacaoFixture = [
  {
    id: 'profissional-gamificacao-1',
    tenantId: 'tenant-sintetico',
    usuarioId: 'usuario-sintetico-1',
    nome: 'Equipe Sintética Um',
    especialidade: 'Acompanhamento sintético',
    criadoEm: '2026-08-01T12:00:00.000Z'
  }
];

const pacientesGamificacaoFixture = Array.from({ length: 10 }, (_, indice) => ({
  id: `paciente-gamificacao-${indice + 1}`,
  tenantId: 'tenant-sintetico',
  profissionalResponsavelId: 'profissional-gamificacao-1',
  nome: `Participante Sintético ${indice + 1}`,
  statusAdesao: 'ativo',
  scoreRisco: '0.10',
  criadoEm: '2026-08-01T12:00:00.000Z'
}));

const circulosGamificacaoFixture = [
  {
    id: 'circulo-gamificacao-1',
    tenantId: 'tenant-sintetico',
    profissionalId: 'profissional-gamificacao-1',
    nome: 'Grupo sintético de adesão',
    objetivo: 'Acompanhar a rotina sintética de check-ins do grupo.',
    privado: true,
    criadoEm: '2026-08-02T12:00:00.000Z'
  }
];

const desafiosGamificacaoFixture = [
  {
    id: 'desafio-gamificacao-1',
    tenantId: 'tenant-sintetico',
    profissionalId: 'profissional-gamificacao-1',
    titulo: 'Sete dias de check-in sintético',
    descricao: 'Pontuação sintética por check-ins consecutivos.',
    regraPontuacao: { evento: 'checkin', pontosPorEvento: 10 },
    iniciaEm: '2026-08-02T12:00:00.000Z',
    terminaEm: '2026-08-09T12:00:00.000Z',
    criadoEm: '2026-08-02T12:00:00.000Z'
  }
];

const badgesGamificacaoFixture = [
  {
    id: 'badge-gamificacao-1',
    tenantId: 'tenant-sintetico',
    nome: 'Consistência sintética',
    descricao: 'Conquista sintética de adesão inicial.',
    iconeSvg: 'award',
    regraConquista: { tipo: 'manual' }
  }
];

// Dez participacoes com progresso verboso: e o volume necessario para que a
// regiao `max-h-[340px] ... overflow-auto` do ranking realmente role. O teste
// que usa esta fixture confere `scrollHeight > clientHeight` antes de afirmar
// qualquer coisa sobre overflow.
const rankingGamificacaoFixture = Array.from({ length: 10 }, (_, indice) => ({
  id: `participacao-gamificacao-${indice + 1}`,
  tenantId: 'tenant-sintetico',
  desafioId: 'desafio-gamificacao-1',
  pacienteId: `paciente-gamificacao-${indice + 1}`,
  pontos: String((10 - indice) * 10),
  progresso: {
    checkins: 10 - indice,
    observacao: `Progresso sintético detalhado registrado para o participante ${indice + 1}.`
  }
}));

const circuloCriadoGamificacaoFixture = {
  id: 'circulo-gamificacao-novo',
  tenantId: 'tenant-sintetico',
  profissionalId: 'profissional-gamificacao-1',
  nome: 'Grupo sintético criado no teste',
  objetivo: 'Objetivo sintético do grupo criado no teste.',
  privado: true,
  criadoEm: '2026-08-04T12:00:00.000Z'
};

const desafioCriadoGamificacaoFixture = {
  ...desafiosGamificacaoFixture[0],
  id: 'desafio-gamificacao-novo',
  titulo: 'Desafio sintético criado no teste'
};

const badgeCriadoGamificacaoFixture = {
  ...badgesGamificacaoFixture[0],
  id: 'badge-gamificacao-novo',
  nome: 'Conquista sintética criada no teste'
};

// Tabula pela pagina conferindo que cada elemento focado vem DEPOIS do
// anterior na ordem do documento. Complementa `assertTabPreservaEExibeFoco`
// (que ja cobre foco perdido e indicador visivel) com a parte que falta da
// cobertura minima do PR 27: "ordem de Tab coerente".
async function assertOrdemDeTabSegueDom(page, voltas) {
  await page.locator('nextjs-portal').evaluateAll((elementos) => elementos.forEach((elemento) => elemento.remove()));
  await page.evaluate(() => {
    window.__anteriorTabA11y = null;
  });

  const foraDeOrdem = [];
  for (let volta = 1; volta <= voltas; volta += 1) {
    await page.keyboard.press('Tab');
    const passo = await page.evaluate(() => {
      const ativo = document.activeElement;
      if (!ativo || ativo === document.body) return null;
      const anterior = window.__anteriorTabA11y;
      const posicao = anterior ? anterior.compareDocumentPosition(ativo) : Node.DOCUMENT_POSITION_FOLLOWING;
      window.__anteriorTabA11y = ativo;
      return {
        descricao: `${ativo.tagName}#${ativo.id || '(sem id)'}`,
        segueDom: Boolean(posicao & Node.DOCUMENT_POSITION_FOLLOWING)
      };
    });
    if (!passo) break;
    if (!passo.segueDom) foraDeOrdem.push(`Tab ${volta}: ${passo.descricao}`);
  }

  expect(foraDeOrdem, `Tab saltou para tras na ordem do DOM:\n${foraDeOrdem.join('\n')}`).toEqual([]);
}

function regiaoRankingGamificacao(page) {
  return page.locator('[class*="max-h-[340px]"]');
}

async function medirRolagem(localizador) {
  return localizador.evaluate((elemento) => ({
    scrollHeight: elemento.scrollHeight,
    clientHeight: elemento.clientHeight,
    tabIndex: elemento.getAttribute('tabindex')
  }));
}

async function prepararGamificacao(page, opcoes = {}) {
  const {
    configuracao = {},
    profissionais = {},
    pacientes = {},
    circulos = {},
    desafios = {},
    badges = {},
    ranking = {}
  } = opcoes;

  const configuracaoBase = configuracao.corpo ?? configuracaoGamificacaoAtivaFixture;
  const chamadas = { naoMockadas: [], mutacoes: [] };

  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'SuperAdmin', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/gamificacao'), domain: 'localhost', path: '/' }
  ]);

  // Rede de seguranca: registrada PRIMEIRO, portanto so recebe o que nenhum
  // mock especifico casou. Nada daqui chega ao BFF, ao backend ou ao banco.
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    chamadas.naoMockadas.push(`${route.request().method()} ${url.pathname}`);
    await route.fulfill({ status: 599, contentType: 'text/plain; charset=utf-8', body: 'Rota nao mockada no gate de a11y.' });
  });

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      autenticado: true,
      papel: 'SuperAdmin',
      apiUrl: 'http://localhost:3001',
      tenantSlug: 'clinica-sintetica',
      email: 'gamificacao@octaclin.test',
      expiraEm: '2026-12-31T18:00:00.000Z',
      permissoes: permissoesGamificacao,
      destinoInicial: '/gamificacao'
    })
  }));

  await page.route('**/api/notificacoes**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ naoLidas: 0, itens: [] }) })
  );

  await page.route('**/api/profissionais**', (route) => {
    const itens = profissionais.corpo ?? profissionaisGamificacaoFixture;
    return responderJson(route, { status: profissionais.status ?? 200, corpo: { itens, total: itens.length } });
  });

  await page.route('**/api/pacientes**', (route) => {
    const itens = pacientes.corpo ?? pacientesGamificacaoFixture;
    return responderJson(route, { status: pacientes.status ?? 200, corpo: { itens, total: itens.length } });
  });

  await page.route((url) => url.pathname === '/api/gamificacao/configuracao', async (route) => {
    if (route.request().method() === 'PATCH') {
      chamadas.mutacoes.push('PATCH /api/gamificacao/configuracao');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...configuracaoBase, ...route.request().postDataJSON() })
      });
      return;
    }
    await responderJson(route, { corpo: configuracaoGamificacaoAtivaFixture, ...configuracao });
  });

  await page.route((url) => url.pathname === '/api/gamificacao/circulos', async (route) => {
    if (route.request().method() === 'POST') {
      chamadas.mutacoes.push('POST /api/gamificacao/circulos');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ...circuloCriadoGamificacaoFixture, ...route.request().postDataJSON() })
      });
      return;
    }
    await responderJson(route, { corpo: circulosGamificacaoFixture, ...circulos });
  });

  await page.route((url) => /^\/api\/gamificacao\/circulos\/[^/]+\/membros$/.test(url.pathname), async (route) => {
    chamadas.mutacoes.push('POST /api/gamificacao/circulos/:id/membros');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'membro-gamificacao-novo',
        tenantId: 'tenant-sintetico',
        circuloId: circuloCriadoGamificacaoFixture.id,
        pacienteId: pacientesGamificacaoFixture[0].id,
        entrouEm: '2026-08-04T12:05:00.000Z'
      })
    });
  });

  await page.route((url) => url.pathname === '/api/gamificacao/posts', async (route) => {
    chamadas.mutacoes.push('POST /api/gamificacao/posts');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'post-gamificacao-novo',
        tenantId: 'tenant-sintetico',
        circuloId: circulosGamificacaoFixture[0].id,
        pacienteId: pacientesGamificacaoFixture[0].id,
        conteudo: 'Conteúdo sintético publicado no teste.',
        status: 'pendente_moderacao',
        criadoEm: '2026-08-04T12:10:00.000Z'
      })
    });
  });

  await page.route((url) => url.pathname === '/api/gamificacao/desafios', async (route) => {
    if (route.request().method() === 'POST') {
      chamadas.mutacoes.push('POST /api/gamificacao/desafios');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(desafioCriadoGamificacaoFixture)
      });
      return;
    }
    await responderJson(route, { corpo: desafiosGamificacaoFixture, ...desafios });
  });

  await page.route((url) => url.pathname === '/api/gamificacao/desafios/progresso', async (route) => {
    chamadas.mutacoes.push('POST /api/gamificacao/desafios/progresso');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(rankingGamificacaoFixture[0])
    });
  });

  await page.route((url) => /^\/api\/gamificacao\/desafios\/[^/]+\/ranking$/.test(url.pathname), (route) =>
    responderJson(route, { corpo: [], ...ranking })
  );

  await page.route((url) => url.pathname === '/api/gamificacao/badges', async (route) => {
    if (route.request().method() === 'POST') {
      chamadas.mutacoes.push('POST /api/gamificacao/badges');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(badgeCriadoGamificacaoFixture)
      });
      return;
    }
    await responderJson(route, { corpo: badgesGamificacaoFixture, ...badges });
  });

  await page.route((url) => url.pathname === '/api/gamificacao/badges/concessoes', async (route) => {
    chamadas.mutacoes.push('POST /api/gamificacao/badges/concessoes');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'concessao-gamificacao-nova',
        tenantId: 'tenant-sintetico',
        pacienteId: pacientesGamificacaoFixture[0].id,
        badgeId: badgeCriadoGamificacaoFixture.id,
        conquistadoEm: '2026-08-04T12:15:00.000Z'
      })
    });
  });

  return chamadas;
}

async function abrirPainelGamificacao(page) {
  await page.goto('/gamificacao');
  await expect(page.getByRole('heading', { name: 'Metas e adesão', level: 1 })).toBeVisible();
}

test.describe('gate de acessibilidade - gamificacao (PR 27)', () => {
  test('estado principal carregado com configuracao, participantes, circulos, desafios e badges', async ({ page }) => {
    const chamadas = await prepararGamificacao(page);
    await abrirPainelGamificacao(page);

    await expect(page.getByRole('heading', { name: 'Ativação opcional' })).toBeVisible();
    await expect(page.getByText('1 metas e 1 conquistas individuais')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Post de comunidade' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Desafio', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Badge', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ranking' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Registros persistidos' })).toBeVisible();
    await expect(page.getByText('Grupo sintético de adesão')).toHaveCount(2);
    await expect(page.getByText('Sete dias de check-in sintético')).toBeVisible();
    await expect(page.getByText('Consistência sintética')).toBeVisible();

    await rodarChecagensDeAcessibilidade(page);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('estado vazio sem circulos, desafios, badges e ranking', async ({ page }) => {
    const chamadas = await prepararGamificacao(page, {
      circulos: { corpo: [] },
      desafios: { corpo: [] },
      badges: { corpo: [] },
      ranking: { corpo: [] }
    });
    await abrirPainelGamificacao(page);

    await expect(page.getByText('0 metas e 0 conquistas individuais')).toBeVisible();
    await expect(page.getByText('Nenhum ranking carregado.')).toBeVisible();
    await expect(page.getByText('Nenhum circulo criado.')).toBeVisible();
    await expect(page.getByText('Nenhum desafio criado.')).toBeVisible();
    await expect(page.getByText('Nenhum badge criado.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Atualizar ranking' })).toHaveCount(0);

    const medidas = await medirRolagem(regiaoRankingGamificacao(page));
    expect(medidas.scrollHeight, 'ranking vazio nao deveria ter overflow').toBeLessThanOrEqual(medidas.clientHeight);

    await rodarChecagensDeAcessibilidade(page);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('falha no carregamento inicial expoe mensagem de erro acessivel', async ({ page }) => {
    const chamadas = await prepararGamificacao(page, {
      configuracao: { status: 500, corpo: 'Falha sintética ao carregar a gamificação.' }
    });
    await abrirPainelGamificacao(page);

    // O Next injeta seu proprio `[role="alert"]` vazio (route announcer), que
    // nao pertence ao produto e nao pode ser confundido com o alerta da falha.
    const alerta = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await expect(alerta).toBeVisible();
    await expect(alerta).toContainText('Falha sintética ao carregar a gamificação.');
    await expect(page.getByRole('heading', { name: 'Ranking' })).toHaveCount(0);

    await rodarChecagensDeAcessibilidade(page);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('configuracao desativada esconde comunidade, metas e ranking', async ({ page }) => {
    const chamadas = await prepararGamificacao(page, { configuracao: { corpo: configuracaoGamificacaoDesativadaFixture } });
    await abrirPainelGamificacao(page);

    await expect(page.getByRole('heading', { name: 'Ativação opcional' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ranking' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Post de comunidade' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Registros persistidos' })).toHaveCount(0);

    for (const rotulo of ['Metas e badges', 'Comunidade', 'Ranking']) {
      await expect(page.getByLabel(rotulo, { exact: true })).not.toBeChecked();
    }

    await rodarChecagensDeAcessibilidade(page);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('configuracao ativada marca as tres opcoes e revela as areas dependentes', async ({ page }) => {
    const chamadas = await prepararGamificacao(page);
    await abrirPainelGamificacao(page);

    for (const rotulo of ['Metas e badges', 'Comunidade', 'Ranking']) {
      await expect(page.getByLabel(rotulo, { exact: true })).toBeChecked();
    }
    await expect(page.getByRole('heading', { name: 'Post de comunidade' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ranking' })).toBeVisible();

    await rodarChecagensDeAcessibilidade(page);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('navegacao integral por teclado mantem foco visivel e ordem coerente', async ({ page }) => {
    const chamadas = await prepararGamificacao(page);
    await abrirPainelGamificacao(page);

    await assertCamposComLabelAcessivel(page);
    await assertBotoesComNomeAcessivel(page);
    await assertTabPreservaEExibeFoco(page);
    await assertOrdemDeTabSegueDom(page, 20);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('formularios de ativacao, circulo, post, desafio e badge tem rotulos acessiveis', async ({ page }) => {
    const chamadas = await prepararGamificacao(page);
    await abrirPainelGamificacao(page);

    // Ativacao opcional: tres checkboxes identificados pelo proprio rotulo.
    for (const rotulo of ['Metas e badges', 'Comunidade', 'Ranking']) {
      await expect(page.getByLabel(rotulo, { exact: true })).toHaveAttribute('type', 'checkbox');
    }
    await expect(page.getByLabel('Privado')).toHaveAttribute('type', 'checkbox');

    // Selects identificados: cada um resolve para um unico controle.
    const seletores = [
      '#gamificacao-circulo-profissional',
      '#gamificacao-circulo-paciente',
      '#gamificacao-post-circulo',
      '#gamificacao-post-paciente',
      '#gamificacao-desafio-profissional',
      '#gamificacao-desafio-paciente',
      '#gamificacao-badge-paciente'
    ];
    for (const seletor of seletores) {
      const campo = page.locator(seletor);
      await expect(campo).toHaveJSProperty('tagName', 'SELECT');
      await expect(campo, `${seletor} sem nome acessivel`).not.toHaveAccessibleName('');
    }

    const camposTexto = [
      '#gamificacao-circulo-nome',
      '#gamificacao-circulo-objetivo',
      '#gamificacao-post-conteudo',
      '#gamificacao-desafio-titulo',
      '#gamificacao-desafio-descricao',
      '#gamificacao-desafio-pontos',
      '#gamificacao-badge-nome',
      '#gamificacao-badge-icone',
      '#gamificacao-badge-descricao'
    ];
    for (const seletor of camposTexto) {
      await expect(page.locator(seletor), `${seletor} sem nome acessivel`).not.toHaveAccessibleName('');
    }

    // Botoes de submissao de cada formulario, com nome acessivel proprio.
    await expect(page.getByRole('button', { name: 'Salvar ativação' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar circulo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publicar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar desafio' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Conceder' })).toBeVisible();

    await rodarChecagensDeAcessibilidade(page);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('ranking carregado com overflow comprovado e regiao rolavel focalizavel', async ({ page }) => {
    const chamadas = await prepararGamificacao(page, { ranking: { corpo: rankingGamificacaoFixture } });
    await abrirPainelGamificacao(page);

    await page.getByRole('button', { name: 'Atualizar ranking' }).click();
    await expect(page.getByText('Ranking atualizado.')).toBeVisible();

    const regiao = regiaoRankingGamificacao(page);
    await expect(regiao.getByText('Participante Sintético 1', { exact: true })).toBeVisible();
    await expect(regiao.getByText('100.0 pts')).toBeVisible();
    const medidas = await medirRolagem(regiao);
    // Primeiro provar o overflow; so entao exigir que a regiao seja alcancavel.
    expect(
      medidas.scrollHeight,
      `ranking sem overflow real (scrollHeight ${medidas.scrollHeight} <= clientHeight ${medidas.clientHeight}); aumente a fixture antes de concluir qualquer coisa`
    ).toBeGreaterThan(medidas.clientHeight);

    await regiao.focus();
    await expect(regiao).toBeFocused();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('salvar configuracao usa PATCH mockado e anuncia sucesso de forma acessivel', async ({ page }) => {
    const chamadas = await prepararGamificacao(page);
    await abrirPainelGamificacao(page);

    await page.getByLabel('Ranking', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Salvar ativação' }).click();

    const sucesso = page.getByRole('status').filter({ hasText: 'atualizada' });
    await expect(sucesso).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ranking' })).toHaveCount(0);

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual(['PATCH /api/gamificacao/configuracao']);
  });

  test('criacao representativa de badge usa POST mockado sem persistencia real', async ({ page }) => {
    const chamadas = await prepararGamificacao(page);
    await abrirPainelGamificacao(page);

    await page.locator('#gamificacao-badge-nome').fill('Conquista sintética do teste');
    await page.getByRole('button', { name: 'Conceder' }).click();

    const sucesso = page.getByRole('status').filter({ hasText: 'Badge' });
    await expect(sucesso).toBeVisible();
    await expect(page.getByText('Conquista sintética criada no teste')).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([
      'POST /api/gamificacao/badges',
      'POST /api/gamificacao/badges/concessoes'
    ]);
  });
});

// ---------------------------------------------------------------------------
// PR 28 da governanca: expande o gate de a11y para os estados de PWA e
// funcionamento offline do portal web (pagina /offline, indicador de conexao,
// fila de operacoes pendentes, sincronizacao, instalacao, check-in offline do
// paciente e formulario publico offline-first).
//
// Escopo restrito ao portal web. A rota `/mobile` nao existe mais e NAO e
// reativada aqui; `components/mobile/painel-mobile.tsx` continua orfao e nao e
// tocado nem testado por este PR (ver "Riscos residuais" na PR).
//
// Nada de rede real: `prepararPwaPortal`/`prepararFormularioPwa` registram
// primeiro um catch-all `**/api/**` que apenas REGISTRA e bloqueia qualquer
// rota nao mockada, e cada teste confere essa lista vazia. O estado de conexao
// e o evento de instalacao sao 100% sinteticos (getter de `navigator.onLine`
// instalado por `addInitScript` e evento `beforeinstallprompt` fabricado), de
// modo que nenhum service worker de producao, upload ou instalacao real e
// exercitado.
// ---------------------------------------------------------------------------

// Substitui `navigator.onLine` por um getter controlado pelo teste e expoe
// `window.__definirConexaoPwa`, que tambem dispara o evento correspondente.
// Preferido a `context.setOffline`, que mexeria na camada de rede e poderia
// derrubar os proprios mocks; aqui nada alem do estado observado pela pagina
// muda.
async function instalarControleDeConexaoPwa(page) {
  await page.addInitScript(() => {
    let online = true;
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
    window.__definirConexaoPwa = (novoEstado) => {
      online = novoEstado;
      window.dispatchEvent(new Event(novoEstado ? 'online' : 'offline'));
    };
  });
}

function definirConexaoPwa(page, online) {
  return page.evaluate((estado) => window.__definirConexaoPwa(estado), online);
}

// Le a fila privada direto do IndexedDB. Duplica de proposito o helper de
// pwa-portal.spec.mjs: os dois specs sao independentes e extrair um modulo
// comum seria refatoracao fora do escopo deste PR.
function lerFilaPwa(page) {
  return page.evaluate(async () => {
    const banco = await new Promise((resolve, reject) => {
      const requisicao = indexedDB.open('octaclin-pwa-private-v1', 1);
      requisicao.onsuccess = () => resolve(requisicao.result);
      requisicao.onerror = () => reject(requisicao.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const requisicao = banco.transaction('operacoes').objectStore('operacoes').getAll();
        requisicao.onsuccess = () => resolve(requisicao.result.map((registro) => ({
          id: registro.id,
          tipo: registro.tipo,
          temCifra: registro.cifra instanceof ArrayBuffer && registro.cifra.byteLength > 0,
          // Bytes da cifra como texto: e sobre ISTO que o teste afirma que nao ha
          // payload clinico legivel, e nao sobre uma inspecao visual do codigo.
          cifraComoTexto: new TextDecoder().decode(new Uint8Array(registro.cifra)),
          chaves: Object.keys(registro).sort()
        })));
        requisicao.onerror = () => reject(requisicao.error);
      });
    } finally {
      banco.close();
    }
  });
}

const OBSERVACAO_CLINICA_SINTETICA = 'Observação sintética que não pode aparecer em claro no dispositivo.';

async function prepararPwaPortal(page) {
  const chamadas = { naoMockadas: [], mutacoes: [] };
  let resolverEspera = null;
  const controle = {
    checkinOnline: false,
    espera: null,
    segurarSincronizacao() {
      controle.espera = new Promise((resolve) => {
        resolverEspera = resolve;
      });
    },
    liberarSincronizacao() {
      resolverEspera?.();
      resolverEspera = null;
      controle.espera = null;
    }
  };

  await instalarControleDeConexaoPwa(page);

  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Patient', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/portal'), domain: 'localhost', path: '/' }
  ]);

  // Rede de seguranca: registrada PRIMEIRO, portanto so recebe o que nenhum
  // mock especifico casou.
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    chamadas.naoMockadas.push(`${route.request().method()} ${url.pathname}`);
    await route.fulfill({ status: 599, contentType: 'text/plain; charset=utf-8', body: 'Rota nao mockada no gate de a11y.' });
  });

  await page.route((url) => url.pathname === '/api/portal/paciente', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(portalPacienteFixture) })
  );

  await page.route((url) => url.pathname === '/api/portal/paciente/lgpd/solicitacoes', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        protocolo: 'LGPD-123',
        pacienteId: 'paciente-1',
        tipo: 'retificacao',
        status: 'recebida',
        criadoEm: '2026-07-22T12:10:00.000Z'
      })
    })
  );

  await page.route((url) => url.pathname === '/api/portal/paciente/checkins', async (route) => {
    if (!controle.checkinOnline) {
      // Falha de rede sintetica: o produto deve enfileirar em vez de perder o
      // check-in. Nada sai da maquina.
      await route.abort('internetdisconnected');
      return;
    }
    if (controle.espera) await controle.espera;
    const entrada = route.request().postDataJSON();
    chamadas.mutacoes.push('POST /api/portal/paciente/checkins');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: `checkin-sincronizado-${chamadas.mutacoes.length}`,
        pacienteId: 'paciente-1',
        tipo: 'humor',
        humor: entrada.humor,
        adesaoPlano: entrada.adesaoPlano,
        registradoEm: '2026-08-26T12:00:00.000Z'
      })
    });
  });

  await page.route((url) => url.pathname === '/api/auth/sair', async (route) => {
    chamadas.mutacoes.push('POST /api/auth/sair');
    await page.context().clearCookies();
    await route.fulfill({ status: 204, body: '' });
  });

  return { chamadas, controle };
}

async function abrirCheckinsPwa(page) {
  await page.goto('/portal/checkins');
  await expect(page.getByRole('heading', { name: 'Check-in rapido' })).toBeVisible();
}

async function registrarCheckinPwa(page, observacao) {
  await page.getByLabel('Humor de hoje').selectOption('bem');
  await page.getByLabel('Adesão ao plano').fill('85');
  await page.getByLabel('Observações do dia').fill(observacao);
  await page.getByRole('button', { name: 'Registrar check-in' }).click();
}

function indicadorPwa(page) {
  return page.locator('[aria-live="polite"]').filter({ hasText: /Sem conexão|pendente|Sincronizando/ });
}

async function prepararFormularioPwa(page) {
  const chamadas = { naoMockadas: [], mutacoes: [] };
  const controle = { envioOnline: false };

  await instalarControleDeConexaoPwa(page);

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    chamadas.naoMockadas.push(`${route.request().method()} ${url.pathname}`);
    await route.fulfill({ status: 599, contentType: 'text/plain; charset=utf-8', body: 'Rota nao mockada no gate de a11y.' });
  });

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

  await page.route((url) => url.pathname === '/api/formularios/token-pwa/rascunho', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rascunhoVersao: 1, rascunhoAtualizadoEm: '2026-08-26T12:00:00.000Z' })
    })
  );

  await page.route((url) => url.pathname === '/api/formularios/token-pwa/respostas', async (route) => {
    if (!controle.envioOnline) {
      await route.abort('internetdisconnected');
      return;
    }
    chamadas.mutacoes.push('POST /api/formularios/token-pwa/respostas');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ envioId: 'envio-token-pwa', status: 'respondido', respondidoEm: '2026-08-26T12:05:00.000Z' })
    });
  });

  return { chamadas, controle };
}

test.describe('gate de acessibilidade - pwa e offline (PR 28)', () => {
  test('pagina /offline expoe titulo, mensagem e link de retomada acessiveis', async ({ page }) => {
    await page.goto('/offline');

    await expect(page.getByRole('heading', { name: 'Sem conexão', level: 1 })).toBeVisible();
    await expect(
      page.getByText('Reconecte-se para carregar suas informações. Operações salvas nesta sessão serão enviadas automaticamente.')
    ).toBeVisible();

    const retomar = page.getByRole('link', { name: 'Tentar novamente' });
    await expect(retomar).toHaveAttribute('href', '/portal');

    // A tabulacao vem ANTES do foco manual: a pagina tem um unico elemento
    // focalizavel, e focar antes moveria o ponto de retomada do Tab para o fim
    // da sequencia, derrubando o foco no body por fim de lista (artefato do
    // Chromium headless, nao perda de foco real).
    await rodarChecagensDeAcessibilidade(page);

    await retomar.focus();
    await expect(retomar).toBeFocused();
  });

  test('portal online e sem pendencias nao exibe indicador de PWA', async ({ page }) => {
    const { chamadas } = await prepararPwaPortal(page);
    await abrirCheckinsPwa(page);

    await expect(page.getByText('Sem conexão')).toHaveCount(0);
    await expect(page.getByText(/\d+ pendente/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Instalar' })).toHaveCount(0);
    expect(await lerFilaPwa(page)).toEqual([]);

    await rodarChecagensDeAcessibilidade(page);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('portal offline anuncia "Sem conexão" por texto, nao apenas por cor ou icone', async ({ page }) => {
    const { chamadas } = await prepararPwaPortal(page);
    await abrirCheckinsPwa(page);
    await definirConexaoPwa(page, false);

    const indicador = indicadorPwa(page);
    await expect(indicador).toBeVisible();
    // O estado precisa estar no texto acessivel, nao so no icone ou na cor da
    // borda: um leitor de tela e um usuario com daltonismo tem de receber o
    // mesmo conteudo.
    await expect(indicador).toContainText('Sem conexão');
    await expect(indicador).toHaveAttribute('aria-live', 'polite');
    const textoDoEstado = await page.getByText('Sem conexão').first().innerText();
    expect(textoDoEstado.trim(), 'estado de conexao sem texto proprio').toBe('Sem conexão');

    await rodarChecagensDeAcessibilidade(page);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('fila pendente usa singular com uma operacao e plural com varias', async ({ page }) => {
    const { chamadas } = await prepararPwaPortal(page);
    await abrirCheckinsPwa(page);
    await definirConexaoPwa(page, false);

    await registrarCheckinPwa(page, OBSERVACAO_CLINICA_SINTETICA);
    await expect(indicadorPwa(page)).toContainText('1 pendente');
    await expect(page.getByText('2 pendentes')).toHaveCount(0);

    await registrarCheckinPwa(page, 'Segunda observação sintética do mesmo dia.');
    await expect(indicadorPwa(page)).toContainText('2 pendentes');

    expect(await lerFilaPwa(page)).toHaveLength(2);

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('sincronizacao mostra "Sincronizando", esvazia a fila e anuncia o sucesso', async ({ page }) => {
    const { chamadas, controle } = await prepararPwaPortal(page);
    await abrirCheckinsPwa(page);
    await definirConexaoPwa(page, false);

    await registrarCheckinPwa(page, OBSERVACAO_CLINICA_SINTETICA);
    await expect(indicadorPwa(page)).toContainText('1 pendente');

    controle.checkinOnline = true;
    controle.segurarSincronizacao();
    await definirConexaoPwa(page, true);

    await expect(indicadorPwa(page)).toContainText('Sincronizando');
    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);

    controle.liberarSincronizacao();

    await expect(page.getByRole('status').filter({ hasText: 'Check-in offline sincronizado.' })).toBeVisible();
    await expect.poll(async () => (await lerFilaPwa(page)).length).toBe(0);
    await expect(indicadorPwa(page)).toHaveCount(0);

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual(['POST /api/portal/paciente/checkins']);
  });

  test('instalacao usa evento sintetico e o botao Instalar responde ao teclado', async ({ page }) => {
    const { chamadas } = await prepararPwaPortal(page);
    await abrirCheckinsPwa(page);

    // Evento 100% fabricado: nenhuma instalacao real e oferecida ou executada.
    await page.evaluate(() => {
      window.__promptPwaChamado = 0;
      const evento = new Event('beforeinstallprompt');
      evento.prompt = async () => {
        window.__promptPwaChamado += 1;
      };
      evento.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(evento);
    });

    const instalar = page.getByRole('button', { name: 'Instalar' });
    await expect(instalar).toBeVisible();
    await expect(instalar).not.toHaveAccessibleName('');

    await rodarChecagensDeAcessibilidade(page);

    await instalar.focus();
    await expect(instalar).toBeFocused();
    await page.keyboard.press('Enter');

    await expect.poll(() => page.evaluate(() => window.__promptPwaChamado)).toBe(1);
    await expect(instalar).toHaveCount(0);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('check-in offline guarda operacao cifrada e confirma de forma acessivel', async ({ page }) => {
    const { chamadas, controle } = await prepararPwaPortal(page);
    await abrirCheckinsPwa(page);
    await definirConexaoPwa(page, false);

    await registrarCheckinPwa(page, OBSERVACAO_CLINICA_SINTETICA);

    const confirmacao = page.getByRole('status').filter({ hasText: 'salvo neste dispositivo' });
    await expect(confirmacao).toBeVisible();
    await expect(confirmacao).toContainText('Check-in salvo neste dispositivo. Ele será enviado quando a conexão voltar.');

    const fila = await lerFilaPwa(page);
    expect(fila).toHaveLength(1);
    expect(fila[0].tipo).toBe('checkin');
    expect(fila[0].temCifra, 'registro da fila sem ArrayBuffer de cifra').toBe(true);
    expect(fila[0].chaves).toEqual(['cifra', 'criadoEm', 'id', 'iv', 'tipo']);
    expect(fila[0].cifraComoTexto, 'payload clinico legivel dentro da cifra').not.toContain('Observação sintética');
    expect(fila[0].cifraComoTexto).not.toContain('adesaoPlano');

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);

    controle.checkinOnline = true;
    await definirConexaoPwa(page, true);
    await expect.poll(async () => (await lerFilaPwa(page)).length).toBe(0);
    await expect(page.getByRole('status').filter({ hasText: 'Check-in offline sincronizado.' })).toBeVisible();

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual(['POST /api/portal/paciente/checkins']);
  });

  test('fila privada e purgada no logout', async ({ page }) => {
    const { chamadas } = await prepararPwaPortal(page);
    await abrirCheckinsPwa(page);
    await definirConexaoPwa(page, false);

    await registrarCheckinPwa(page, OBSERVACAO_CLINICA_SINTETICA);
    await expect.poll(async () => (await lerFilaPwa(page)).length).toBe(1);

    await definirConexaoPwa(page, true);
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/login/);

    // O runtime da pagina de login pode recriar o container vazio; o gate de
    // privacidade e nao restar nenhum payload da sessao encerrada.
    await expect.poll(async () => (await lerFilaPwa(page)).length).toBe(0);

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual(['POST /api/auth/sair']);
  });

  test('formulario publico offline salva no dispositivo e envia ao reconectar', async ({ page }) => {
    const { chamadas, controle } = await prepararFormularioPwa(page);
    await page.goto('/formularios/token-pwa');
    await expect(page.getByRole('heading', { name: 'Check-in offline' })).toBeVisible();

    await definirConexaoPwa(page, false);
    await page.getByRole('textbox').fill('Resposta sintética mantida apenas nesta sessão.');
    await page.getByRole('button', { name: 'Enviar respostas' }).click();

    await expect(page.getByRole('heading', { name: 'Respostas salvas neste dispositivo' })).toBeVisible();
    const fila = await lerFilaPwa(page);
    expect(fila).toHaveLength(1);
    expect(fila[0].tipo).toBe('formulario');
    expect(fila[0].temCifra).toBe(true);
    expect(fila[0].cifraComoTexto, 'resposta legivel dentro da cifra').not.toContain('Resposta sintética');

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);

    controle.envioOnline = true;
    await definirConexaoPwa(page, true);

    await expect(page.getByRole('heading', { name: 'Respostas enviadas' })).toBeVisible();
    await expect.poll(async () => (await lerFilaPwa(page)).length).toBe(0);

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual(['POST /api/formularios/token-pwa/respostas']);
  });
});

// ---------------------------------------------------------------------------
// PR 29 da governanca: profundidade nos COMPONENTES COMPARTILHADOS
// (components/ui/*), exercitados por consumidores reais em rotas que ja tem
// mock nesta suite. Nenhuma rota de produto foi criada para testar componente,
// e nenhum design system novo foi inventado.
//
// Consumidores usados:
//   - Modal / ModalConfirmacao -> components/operacoes/area-onboarding.tsx (/operacoes)
//   - Abas                     -> painel-operacoes (/operacoes) e lista-profissionais (/profissionais)
//   - Menu / ItemMenu          -> components/app/sino-notificacoes.tsx (/dashboard)
// ---------------------------------------------------------------------------

// Audita o padrao ARIA tabs olhando o DOM real: cada `[role="tab"]` precisa
// apontar, por `aria-controls`, para um elemento existente e com
// `role="tabpanel"`; e cada tablist precisa ter exatamente uma aba tabulavel e
// uma selecionada (roving tabindex). axe-core classifica `aria-controls` orfao
// como "incomplete", nao como violacao, entao esta checagem cobre o que o gate
// atual deixa passar.
async function auditarPadraoAbas(page) {
  return page.evaluate(() => {
    const problemas = [];

    for (const aba of Array.from(document.querySelectorAll('[role="tab"]'))) {
      const rotulo = aba.textContent?.trim().slice(0, 40) || '(sem rotulo)';
      const alvoId = aba.getAttribute('aria-controls');
      if (!alvoId) {
        // Painel renderizado sob demanda: a aba inativa pode nao ter painel no
        // DOM, e nesse caso omitir a relacao e correto. A aba SELECIONADA, ao
        // contrario, sempre tem painel e precisa declara-lo.
        if (aba.getAttribute('aria-selected') === 'true') {
          problemas.push(`aba selecionada "${rotulo}": sem aria-controls`);
        }
        continue;
      }
      const alvo = document.getElementById(alvoId);
      if (!alvo) {
        problemas.push(`aba "${rotulo}": aria-controls "${alvoId}" nao existe no DOM`);
        continue;
      }
      if (alvo.getAttribute('role') !== 'tabpanel') {
        problemas.push(`aba "${rotulo}": "${alvoId}" existe mas nao tem role="tabpanel"`);
      }
    }

    for (const lista of Array.from(document.querySelectorAll('[role="tablist"]'))) {
      const nome = lista.getAttribute('aria-label') ?? '(tablist sem nome)';
      const abas = Array.from(lista.querySelectorAll('[role="tab"]'));
      if (!abas.length) continue;
      const tabulaveis = abas.filter((aba) => aba.getAttribute('tabindex') !== '-1');
      if (tabulaveis.length !== 1) {
        problemas.push(`tablist "${nome}": ${tabulaveis.length} abas alcancaveis por Tab (esperado 1)`);
      }
      const selecionadas = abas.filter((aba) => aba.getAttribute('aria-selected') === 'true');
      if (selecionadas.length !== 1) {
        problemas.push(`tablist "${nome}": ${selecionadas.length} abas com aria-selected="true" (esperado 1)`);
      }
    }

    return problemas;
  });
}

function descreverFoco(page) {
  return page.evaluate(() => {
    const ativo = document.activeElement;
    if (!ativo || ativo === document.body) return { descricao: 'body', dentroDoDialogo: false, dentroDoMenu: false };
    return {
      descricao: `${ativo.tagName}${ativo.id ? `#${ativo.id}` : ''} "${(ativo.getAttribute('aria-label') ?? ativo.textContent ?? '').trim().slice(0, 40)}"`,
      dentroDoDialogo: Boolean(ativo.closest('[role="dialog"]')),
      dentroDoMenu: Boolean(ativo.closest('[role="menu"]')),
      papel: ativo.getAttribute('role')
    };
  });
}

async function abrirModalCriticoOnboarding(page) {
  const painel = await abrirAreaOperacoes(page, 'Onboarding');
  await painel.getByRole('button', { name: 'Encerrar definitivamente' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  return modal;
}

test.describe('gate de acessibilidade - componentes compartilhados (PR 29)', () => {
  // -------------------------------------------------------------------------
  // Modal (components/ui/modal.tsx)
  // -------------------------------------------------------------------------

  test('modal - nome, descricao, foco inicial e retorno do foco ao gatilho', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);

    const painel = await abrirAreaOperacoes(page, 'Onboarding');
    const gatilho = painel.getByRole('button', { name: 'Encerrar definitivamente' });
    await gatilho.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    await expect(modal).not.toHaveAccessibleName('');
    await expect(modal).not.toHaveAccessibleDescription('');

    const focoInicial = await descreverFoco(page);
    expect(focoInicial.dentroDoDialogo, `foco inicial fora do dialogo: ${focoInicial.descricao}`).toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(gatilho).toBeFocused();

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('modal - digitar em campo controlado nao rouba o foco do usuario', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);
    const modal = await abrirModalCriticoOnboarding(page);

    const motivo = modal.getByLabel('Motivo operacional');
    await motivo.focus();
    await expect(motivo).toBeFocused();

    // Digitacao real, tecla a tecla: cada tecla muda estado controlado do
    // consumidor e re-renderiza o Modal. O foco tem de continuar no campo.
    await page.keyboard.type('Encerramento sintético');

    const foco = await descreverFoco(page);
    expect(foco.descricao, 'o foco saiu do campo enquanto o usuario digitava').toContain('onboarding-motivo');
    await expect(motivo).toHaveValue('Encerramento sintético');

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('modal - Tab e Shift+Tab nao escapam para o conteudo de fundo', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);
    const modal = await abrirModalCriticoOnboarding(page);
    await expect(modal).toBeVisible();

    // Percorre o dialogo inteiro nos dois sentidos; a cada passo o foco tem de
    // continuar dentro dele.
    for (const tecla of ['Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab']) {
      await page.keyboard.press(tecla);
      const foco = await descreverFoco(page);
      expect(foco.dentroDoDialogo, `Tab levou o foco para fora do dialogo: ${foco.descricao}`).toBe(true);
    }
    for (let volta = 0; volta < 8; volta += 1) {
      await page.keyboard.press('Shift+Tab');
      const foco = await descreverFoco(page);
      expect(foco.dentroDoDialogo, `Shift+Tab levou o foco para fora do dialogo: ${foco.descricao}`).toBe(true);
    }

    // Foco perdido (elemento ativo removido ou blur) nao pode virar porta de
    // saida: o proximo Tab tem de voltar para dentro do dialogo.
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    await page.keyboard.press('Tab');
    const focoAposPerda = await descreverFoco(page);
    expect(
      focoAposPerda.dentroDoDialogo,
      `apos perder o foco, o Tab escapou do dialogo: ${focoAposPerda.descricao}`
    ).toBe(true);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  test('modal - confirmacao destrutiva, estado de processamento e fechamento pelo overlay', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);
    const modal = await abrirModalCriticoOnboarding(page);

    const confirmar = modal.getByRole('button', { name: 'Confirmar' });
    await expect(confirmar, 'acao destrutiva deveria comecar bloqueada').toBeDisabled();
    await expect(modal.getByRole('button', { name: 'Fechar' })).not.toHaveAccessibleName('');

    await rodarChecagensDeAcessibilidadeSemNavegacaoPorTeclado(page);

    // Fecha pelo overlay, sem executar o fluxo destrutivo.
    await page.mouse.click(5, 5);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    expect(chamadas.naoMockadas).toEqual([]);
    expect(chamadas.mutacoes).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Abas (components/ui/abas.tsx)
  // -------------------------------------------------------------------------

  test('abas - padrao ARIA integro em /operacoes', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);

    expect(await auditarPadraoAbas(page)).toEqual([]);

    expect(chamadas.naoMockadas).toEqual([]);
  });

  test('abas - padrao ARIA integro em /profissionais', async ({ page }) => {
    await prepararProfissionais(page);
    await page.goto('/profissionais');
    await expect(page.getByRole('tablist', { name: 'Áreas da equipe clínica' })).toBeVisible();

    expect(await auditarPadraoAbas(page)).toEqual([]);
  });

  test('abas - setas, Home e End movem foco e selecao juntos', async ({ page }) => {
    const chamadas = await prepararOperacoes(page);
    await abrirPainelOperacoes(page, chamadas);

    const tablist = page.getByRole('tablist', { name: 'Áreas de operações' });
    const abas = tablist.getByRole('tab');
    const total = await abas.count();
    expect(total).toBeGreaterThan(2);

    // Parte da primeira aba selecionando-a com o teclado (Home), sem depender de
    // qual area o painel abre por padrao.
    await tablist.locator('[role="tab"][aria-selected="true"]').focus();
    await page.keyboard.press('Home');

    const primeira = abas.first();
    await expect(primeira).toBeFocused();
    await expect(primeira).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowRight');
    await expect(abas.nth(1)).toBeFocused();
    await expect(abas.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(primeira).toHaveAttribute('aria-selected', 'false');

    await page.keyboard.press('ArrowLeft');
    await expect(primeira).toBeFocused();

    await page.keyboard.press('End');
    await expect(abas.nth(total - 1)).toBeFocused();
    await expect(abas.nth(total - 1)).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Home');
    await expect(primeira).toBeFocused();
    await expect(primeira).toHaveAttribute('aria-selected', 'true');

    // ArrowDown/ArrowUp seguem a mesma sequencia em tablist horizontal.
    await page.keyboard.press('ArrowDown');
    await expect(abas.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(primeira).toBeFocused();

    expect(await auditarPadraoAbas(page)).toEqual([]);
    expect(chamadas.naoMockadas).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Menu (components/ui/menu.tsx) via o sino de notificacoes
  // -------------------------------------------------------------------------

  test('menu - gatilho declara aria-haspopup e aria-expanded', async ({ page }) => {
    await prepararDashboardMockado(page);
    await page.goto('/dashboard');

    const gatilho = page.getByRole('button', { name: 'Notificações, 2 não lidas' });
    await expect(gatilho).toBeVisible();
    await expect(gatilho).toHaveAttribute('aria-haspopup', 'menu');
    await expect(gatilho).toHaveAttribute('aria-expanded', 'false');

    await gatilho.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(gatilho).toHaveAttribute('aria-expanded', 'true');
  });

  test('menu - aberto move o foco para o primeiro item e navega com setas, Home e End', async ({ page }) => {
    await prepararDashboardMockado(page);
    await page.goto('/dashboard');

    const gatilho = page.getByRole('button', { name: 'Notificações, 2 não lidas' });
    await gatilho.focus();
    await page.keyboard.press('Enter');

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();

    const focoInicial = await descreverFoco(page);
    expect(focoInicial.dentroDoMenu, `menu aberto sem mover o foco para dentro: ${focoInicial.descricao}`).toBe(true);

    const itens = menu.getByRole('menuitem');
    const total = await itens.count();
    expect(total, 'menu sem itens sinteticos para navegar').toBeGreaterThan(0);
    await expect(itens.first()).toBeFocused();

    await page.keyboard.press('End');
    await expect(itens.nth(total - 1)).toBeFocused();

    await page.keyboard.press('Home');
    await expect(itens.first()).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(itens.nth(Math.min(1, total - 1))).toBeFocused();

    await page.keyboard.press('ArrowUp');
    await expect(itens.first()).toBeFocused();
  });

  test('menu - Escape fecha e devolve o foco ao gatilho', async ({ page }) => {
    await prepararDashboardMockado(page);
    await page.goto('/dashboard');

    const gatilho = page.getByRole('button', { name: 'Notificações, 2 não lidas' });
    await gatilho.click();
    await expect(page.getByRole('menu')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(gatilho).toBeFocused();
  });

  test('menu - notificacoes aberto nao introduz violacao de ARIA', async ({ page }) => {
    await prepararDashboardMockado(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Notificações, 2 não lidas' }).click();
    await expect(page.getByRole('menu')).toBeVisible();

    await assertBotoesComNomeAcessivel(page);
    await assertSemViolacoesAxe(page);
  });

  test('menu - conta aberto nao introduz violacao de ARIA e navega por teclado', async ({ page }) => {
    await prepararDashboardMockado(page);
    await page.goto('/dashboard');

    const gatilho = page.getByRole('button', { name: /Abrir menu da conta/ });
    await gatilho.click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();

    const itens = menu.getByRole('menuitem');
    expect(await itens.count(), 'menu da conta sem nenhum item de menu').toBeGreaterThan(0);
    await expect(itens.first()).toBeFocused();

    await assertSemViolacoesAxe(page);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(gatilho).toBeFocused();
  });
});

// ---------------------------------------------------------------------------
// PR 30 da governanca: jornadas completas operadas somente por teclado.
// Cada mutacao fica interceptada no BFF com dados sinteticos. Os testes
// confirmam o payload e o destino da jornada, sem acionar servicos reais.
// ---------------------------------------------------------------------------

async function alcancarComTab(page, alvo, rotulo, maximo = 160) {
  await expect(alvo, `${rotulo} nao ficou visivel`).toBeVisible();
  await page.locator('nextjs-portal').evaluateAll((elementos) => elementos.forEach((elemento) => elemento.remove()));

  for (let passo = 0; passo <= maximo; passo += 1) {
    if (await alvo.evaluate((elemento) => document.activeElement === elemento)) return;
    await page.keyboard.press('Tab');
  }

  const focoAtual = await page.evaluate(() => {
    const ativo = document.activeElement;
    return ativo ? `${ativo.tagName} ${ativo.getAttribute('aria-label') ?? ativo.textContent?.trim().slice(0, 80) ?? ''}` : 'nenhum';
  });
  throw new Error(`Nao foi possivel alcancar ${rotulo} com Tab. Foco atual: ${focoAtual}`);
}

async function substituirTextoPeloTeclado(page, valor) {
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(valor);
}

test.describe('jornadas completas por teclado (PR 30)', () => {
  test('cadastra paciente, preserva foco no erro e conclui a navegacao', async ({ page }) => {
    const pacienteCriado = {
      ...pacienteFixture,
      id: 'paciente-teclado',
      nome: 'Paciente Teclado',
      contato: 'paciente.teclado@example.com',
      dataNascimento: '1992-05-18',
      statusAdesao: 'novo',
      scoreRisco: '0'
    };
    const mutacoes = [];
    let primeiraTentativa = true;

    await prepararSessaoPacientes(page);
    await prepararProntuarioPaciente(page, pacienteCriado);
    await prepararAvaliacoesAntropometricas(page, pacienteCriado.id);
    await page.route((url) => url.pathname === '/api/pacientes', async (route) => {
      expect(route.request().method()).toBe('POST');
      mutacoes.push(route.request().postDataJSON());
      if (primeiraTentativa) {
        primeiraTentativa = false;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Falha sintetica controlada no cadastro.' })
        });
        return;
      }
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(pacienteCriado) });
    });

    await page.goto('/pacientes/novo');
    const nome = page.getByLabel('Nome completo');
    await alcancarComTab(page, nome, 'Nome completo');
    await page.keyboard.insertText(pacienteCriado.nome);

    const nascimento = page.getByLabel('Data de nascimento');
    await alcancarComTab(page, nascimento, 'Data de nascimento');
    await page.keyboard.insertText(pacienteCriado.dataNascimento);

    const contato = page.getByLabel('E-mail ou telefone');
    await alcancarComTab(page, contato, 'E-mail ou telefone');
    await page.keyboard.insertText(pacienteCriado.contato);

    const salvar = page.getByRole('button', { name: 'Cadastrar paciente' });
    await expect(salvar).toBeEnabled();
    await alcancarComTab(page, salvar, 'Cadastrar paciente');
    await page.keyboard.press('Enter');

    await expect(page.getByText('Não foi possível salvar o paciente. O rascunho foi preservado nesta aba. Tente novamente.')).toBeVisible();
    await expect(salvar).toBeFocused();
    await expect(salvar).toBeEnabled();

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/pacientes\/paciente-teclado$/);
    await expect(page.getByRole('heading', { name: 'Prontuário do paciente' })).toBeVisible();
    expect(mutacoes).toHaveLength(2);
    expect(mutacoes[1]).toMatchObject({
      profissionalResponsavelId: 'profissional-1',
      nome: pacienteCriado.nome,
      contato: pacienteCriado.contato
    });
  });

  test('cria, fecha e remarca consulta mantendo o contexto de foco', async ({ page }) => {
    const mutacoes = { criar: [], remarcar: [] };
    const consultas = [];

    await prepararDashboardMockado(page);
    await page.route((url) => url.pathname === '/api/agenda/consultas', async (route) => {
      if (route.request().method() === 'POST') {
        const corpo = route.request().postDataJSON();
        mutacoes.criar.push(corpo);
        const criada = {
          id: 'consulta-teclado', tenantId: 'tenant-1', pacienteId: corpo.pacienteId,
          pacienteNome: 'Ana Souza', profissionalId: corpo.profissionalId,
          profissionalNome: 'Dra. Carla', titulo: 'Consulta por teclado', inicioEm: corpo.inicioEm,
          fimEm: new Date(new Date(corpo.inicioEm).getTime() + corpo.duracaoMinutos * 60_000).toISOString(),
          timezone: 'America/Sao_Paulo', status: 'agendada', modalidade: corpo.modalidade,
          local: corpo.local, notificacoes: {}, payload: {}, criadoEm: '2026-08-26T12:00:00.000Z',
          atualizadoEm: '2026-08-26T12:00:00.000Z'
        };
        consultas.unshift(criada);
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(criada) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(consultas) });
    });
    await page.route((url) => url.pathname === '/api/agenda/consultas/consulta-teclado', async (route) => {
      const corpo = route.request().postDataJSON();
      mutacoes.remarcar.push(corpo);
      consultas[0] = { ...consultas[0], ...corpo, atualizadoEm: '2026-08-26T12:05:00.000Z' };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(consultas[0]) });
    });
    await page.route((url) => url.pathname === '/api/agenda/feed', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
    await page.route((url) => url.pathname === '/api/agenda/agendamento-publico', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
    await page.route((url) => url.pathname === '/api/agenda/solicitacoes', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], total: 0 }) }));
    await page.route((url) => url.pathname === '/api/agenda/google/status', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ conectado: false }) }));
    await page.route((url) => url.pathname === '/api/agenda/google/profissionais/status', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
    await page.route((url) => url.pathname === '/api/agenda/pacotes', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));

    await page.goto('/agenda');
    const abrir = page.getByRole('button', { name: 'Nova consulta' });
    await alcancarComTab(page, abrir, 'Nova consulta');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Nova consulta' })).toBeVisible();

    const local = page.getByRole('textbox', { name: 'Local', exact: true });
    await alcancarComTab(page, local, 'Local da consulta');
    await page.keyboard.insertText('Sala teclado');
    const agendar = page.getByRole('button', { name: 'Agendar' });
    await alcancarComTab(page, agendar, 'Agendar');
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Consulta agendada e horário bloqueado/)).toBeVisible();
    await expect(agendar).toBeFocused();
    expect(mutacoes.criar).toHaveLength(1);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Nova consulta' })).toHaveCount(0);
    await expect(abrir).toBeFocused();

    const artigo = page.locator('#consulta-consulta-teclado');
    const gerenciar = artigo.getByRole('button', { name: 'Gerenciar consulta' });
    await alcancarComTab(page, gerenciar, 'Gerenciar consulta criada');
    await page.keyboard.press('Enter');

    const novoLocal = page.getByLabel('Novo local');
    await alcancarComTab(page, novoLocal, 'Novo local');
    await substituirTextoPeloTeclado(page, 'Sala teclado 2');
    const remarcar = page.getByRole('button', { name: 'Remarcar' });
    await alcancarComTab(page, remarcar, 'Remarcar');
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Consulta remarcada e horário atualizado/)).toBeVisible();
    await expect(remarcar).toBeFocused();
    expect(mutacoes.remarcar).toHaveLength(1);
    expect(mutacoes.remarcar[0]).toMatchObject({ local: 'Sala teclado 2' });
  });

  test('cria formulario e distribui check-in recorrente por teclado', async ({ page }) => {
    const mutacoes = { questionario: [], agendamento: [] };
    const criado = {
      id: 'q-teclado', tenantId: 'tenant-1', profissionalId: 'profissional-1',
      titulo: 'Check-in criado por teclado', descricao: 'Fluxo sintetico completo', status: 'rascunho', versao: 1,
      criadoEm: '2026-08-26T12:00:00.000Z', atualizadoEm: '2026-08-26T12:00:00.000Z'
    };

    await prepararQuestionarios(page);
    await page.route((url) => url.pathname === '/api/questionarios', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ itens: questionariosFixture, total: questionariosFixture.length })
        });
        return;
      }
      const corpo = route.request().postDataJSON();
      mutacoes.questionario.push(corpo);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ...criado, ...corpo }) });
    });
    await page.route((url) => url.pathname === '/api/questionarios/q-teclado/perguntas', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
    await page.route((url) => url.pathname === '/api/agendamentos-questionario', async (route) => {
      const corpo = route.request().postDataJSON();
      mutacoes.agendamento.push(corpo);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'agendamento-teclado', ...corpo }) });
    });

    await page.goto('/questionarios');
    const selecionar = page.getByLabel('Selecionar');
    await alcancarComTab(page, selecionar, 'Selecionar formulario');
    await page.keyboard.press('Home');
    await expect(page.getByRole('button', { name: 'Criar questionário' })).toBeVisible();

    const titulo = page.getByLabel('Título');
    await alcancarComTab(page, titulo, 'Titulo do formulario');
    await page.keyboard.insertText(criado.titulo);
    const descricao = page.getByLabel('Descrição');
    await alcancarComTab(page, descricao, 'Descricao do formulario');
    await page.keyboard.insertText(criado.descricao);

    const criar = page.getByRole('button', { name: 'Criar questionário' });
    await alcancarComTab(page, criar, 'Criar questionario');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Questionário criado.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar questionário' })).toBeVisible();
    expect(mutacoes.questionario).toEqual([{ profissionalId: 'profissional-1', titulo: criado.titulo, descricao: criado.descricao }]);

    const abaFormularios = page.getByRole('tab', { name: 'Formulários' });
    await alcancarComTab(page, abaFormularios, 'Aba Formularios');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Distribuicoes' })).toBeFocused();

    const paciente = page.getByLabel('Paciente do check-in recorrente');
    await alcancarComTab(page, paciente, 'Paciente do check-in recorrente');
    await page.keyboard.press('ArrowDown');
    const distribuir = page.getByRole('button', { name: 'Criar check-in recorrente' });
    await alcancarComTab(page, distribuir, 'Criar check-in recorrente');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Check-in recorrente criado para o paciente selecionado.')).toBeVisible();
    await expect(distribuir).toBeFocused();
    expect(mutacoes.agendamento).toEqual([{
      questionarioId: 'q-teclado', pacienteId: 'paciente-1', regraCron: '0 8 * * 1', timezone: 'America/Sao_Paulo'
    }]);
  });

  test('responde check-in do portal integralmente por teclado', async ({ page }) => {
    const mutacoes = [];
    await prepararSessaoPortalPaciente(page);
    await page.route((url) => url.pathname === '/api/portal/paciente/checkins', async (route) => {
      const corpo = route.request().postDataJSON();
      mutacoes.push(corpo);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'checkin-teclado', pacienteId: 'paciente-1', tipo: 'humor', humor: corpo.humor,
          adesaoPlano: corpo.adesaoPlano, sintomas: corpo.sintomas, observacoes: corpo.observacoes,
          registradoEm: '2026-08-26T12:00:00.000Z'
        })
      });
    });

    await page.goto('/portal/checkins');
    const humor = page.getByLabel('Humor de hoje');
    await alcancarComTab(page, humor, 'Humor de hoje');
    await page.keyboard.press('End');
    const adesao = page.getByLabel('Adesão ao plano');
    await alcancarComTab(page, adesao, 'Adesao ao plano');
    await substituirTextoPeloTeclado(page, '90');
    const sintomas = page.getByLabel('Sintomas ou sinais');
    await alcancarComTab(page, sintomas, 'Sintomas ou sinais');
    await page.keyboard.insertText('Sem sintomas relevantes.');
    const observacoes = page.getByLabel('Observações do dia');
    await alcancarComTab(page, observacoes, 'Observacoes do dia');
    await page.keyboard.insertText('Mantive o plano no cafe da manha.');
    const registrar = page.getByRole('button', { name: 'Registrar check-in' });
    await alcancarComTab(page, registrar, 'Registrar check-in');
    await page.keyboard.press('Enter');

    await expect(page.getByText('Check-in registrado.')).toBeVisible();
    await expect(registrar).toBeFocused();
    expect(mutacoes).toHaveLength(1);
    expect(mutacoes[0]).toMatchObject({
      pacienteIdEsperado: 'paciente-1', humor: 'muito_mal', adesaoPlano: 90,
      sintomas: 'Sem sintomas relevantes.', observacoes: 'Mantive o plano no cafe da manha.'
    });
  });

  test('abre conversa e prepara resposta sem disparar mensagem', async ({ page }) => {
    let envios = 0;
    await prepararComunicacoes(page);
    await page.route('**/api/comunicacoes/mensagens', async (route) => {
      if (route.request().method() === 'POST') {
        envios += 1;
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Envio real bloqueado no teste.' }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mensagensComunicacoesFixture.map((mensagem) => ({
          ...mensagem,
          payload: mensagem.payload.direcao === 'recebida'
            ? { ...mensagem.payload, remetente: mensagem.payload.contato }
            : mensagem.payload
        })))
      });
    });

    await page.goto('/comunicacoes');
    const conversaBruno = page.getByRole('button', { name: /Bruno Lima/ });
    await alcancarComTab(page, conversaBruno, 'Conversa de Bruno Lima');
    await page.keyboard.press('Enter');
    await expect(page.locator('strong', { hasText: 'Bruno Lima' }).first()).toBeVisible();

    const responder = page.getByRole('button', { name: 'Responder' });
    await alcancarComTab(page, responder, 'Responder conversa');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Nova mensagem' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('WhatsApp de destino')).toHaveValue('5511988887777');

    const observacao = page.getByLabel('Observação');
    await alcancarComTab(page, observacao, 'Observacao da resposta');
    await substituirTextoPeloTeclado(page, 'Resposta sintetica preparada por teclado.');
    await expect(observacao).toHaveValue('Resposta sintetica preparada por teclado.');
    expect(envios).toBe(0);
  });
});

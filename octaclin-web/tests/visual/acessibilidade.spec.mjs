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

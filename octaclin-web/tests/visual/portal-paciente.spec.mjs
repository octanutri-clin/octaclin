import { expect, test } from '@playwright/test';

const portalPaciente = {
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
      id: 'mensagem-pendente-1',
      canal: 'whatsapp',
      titulo: 'Lembrete de consulta',
      texto: 'Sua consulta será amanha.',
      status: 'pendente',
      evento: 'agenda.consulta.lembrete',
      criadoEm: '2026-07-21T14:00:00.000Z',
      agendadoPara: '2026-08-09T13:00:00.000Z'
    },
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

async function prepararPortal(page) {
  let registrouCheckin = false;
  let carregamentos = 0;

  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Patient', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/portal'), domain: 'localhost', path: '/' }
  ]);

  await page.route((url) => url.pathname === '/api/portal/paciente', async (route) => {
    carregamentos += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(portalPaciente) });
  });
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
  await page.route((url) => url.pathname === '/api/portal/paciente/lgpd/exportacao', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        formato: 'octaclin.lgpd.exportacao_paciente.v1',
        geradoEm: '2026-07-22T12:00:00.000Z',
        titular: { pacienteId: 'paciente-1', nome: 'Ana Paula', email: 'ana@example.com' },
        escopo: {
          origem: 'portal_paciente',
          categorias: ['perfil', 'consultas', 'formularios', 'comunicacoes', 'acompanhamento', 'lgpd'],
          observacoes: ['Exportacao gerada a partir dos dados vinculados ao usuario autenticado.']
        },
        pacote: {
          perfil: { paciente: portalPaciente.paciente, perfil: portalPaciente.perfil },
          consultas: portalPaciente.consultasProximas,
          formularios: { pendentes: portalPaciente.formulariosPendentes, respondidos: [] },
          comunicacoes: { mensagens: portalPaciente.mensagensRecentes, notificacoes: portalPaciente.notificacoesPaciente },
          acompanhamento: {
            tarefas: portalPaciente.tarefasAcompanhamento,
            materiais: portalPaciente.materiaisDisponiveis,
            diarios: portalPaciente.diariosRecentes
          },
          lgpd: portalPaciente.lgpd
        },
        integridade: {
          algoritmo: 'sha256',
          hash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
        },
        dados: portalPaciente
      })
    });
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

  await page.route((url) => url.pathname === '/api/portal/paciente/checkins', async (route) => {
    const payload = route.request().postDataJSON();
    registrouCheckin =
      payload.humor === 'muito_bem' &&
      payload.adesaoPlano === 90 &&
      payload.sintomas === 'Sem sintomas relevantes.' &&
      payload.observacoes === 'Mantive o plano no cafe da manha.';
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'diario-2',
        pacienteId: 'paciente-1',
        tipo: 'humor',
        humor: 'muito_bem',
        adesaoPlano: 90,
        sintomas: 'Sem sintomas relevantes.',
        observacoes: 'Mantive o plano no cafe da manha.',
        registradoEm: '2026-07-23T12:00:00.000Z'
      })
    });
  });

  return {
    carregamentos: () => carregamentos,
    registrouCheckin: () => registrouCheckin
  };
}

async function prepararSessaoPaciente(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Patient', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/portal'), domain: 'localhost', path: '/' }
  ]);
}

async function assertSemOverflowHorizontal(page) {
  const medidas = await page.evaluate(() => ({
    larguraDocumento: document.documentElement.scrollWidth,
    larguraViewport: document.documentElement.clientWidth
  }));

  expect(medidas.larguraDocumento).toBeLessThanOrEqual(medidas.larguraViewport + 1);
}

test.describe('portal do paciente', () => {
  test('mantem a pagina inicial focada nas tres prioridades e sem scores clinicos', async ({ page }) => {
    const portal = await prepararPortal(page);
    await page.goto('/portal');

    await expect(page.getByRole('heading', { name: 'Portal do paciente' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Seu acompanhamento hoje' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Próxima ação' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Próxima consulta' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Plano em andamento' })).toBeVisible();
    await expect(page.getByText('1 tarefas e 1 materiais')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver plano' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Check-in rapido' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Meu perfil' })).toHaveCount(0);
    await expect(page.getByText(/score\s+87[,.]40/i)).toHaveCount(0);
    expect(portal.carregamentos()).toBe(1);
    await assertSemOverflowHorizontal(page);
  });

  test('mostra a curva de peso sem numero clinico derivado junto', async ({ page }) => {
    await prepararPortal(page);
    await page.goto('/portal/checkins');

    await expect(page.getByRole('heading', { name: 'Sua evolução de peso' })).toBeVisible();
    // Rotulo direto do ultimo ponto.
    const curva = page.getByRole('img', { name: /Evolucao de Peso em kg/ });
    await expect(curva).toBeVisible();

    // A alternativa textual e obrigatoria: o grafico nao pode ser o unico caminho.
    await page.getByText('Ver valores em tabela').click();
    await expect(page.getByRole('cell', { name: '82,4' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '78,6' })).toBeVisible();

    // Regra da Fase 161: peso e do paciente, leitura clinica derivada nao.
    for (const proibido of ['IMC', 'Gordura corporal', 'Massa magra', 'Eutrofia', 'Sobrepeso', 'Risco']) {
      await expect(page.getByText(proibido, { exact: false })).toHaveCount(0);
    }
    await assertSemOverflowHorizontal(page);
  });

  test('navega por rotas reais com um unico carregamento do portal', async ({ page }, testInfo) => {
    const portal = await prepararPortal(page);
    await page.goto('/portal');

    if (testInfo.project.name === 'mobile-chromium') {
      const navegacao = page.getByRole('navigation', { name: 'Navegacao mobile do portal' });
      await expect(navegacao.getByRole('link')).toHaveCount(5);
      await expect(navegacao.getByRole('link', { name: 'Mais', exact: true })).toBeVisible();
      await navegacao.getByRole('link', { name: 'Agenda', exact: true }).click();
    } else {
      await page.getByRole('navigation', { name: 'Navegacao do portal' }).getByRole('link', { name: 'Agenda', exact: true }).click();
    }

    await expect(page).toHaveURL(/\/portal\/agenda$/);
    await expect(page.getByRole('heading', { name: 'Próximas consultas' })).toBeVisible();

    const navegacao = page.getByRole('navigation', {
      name: testInfo.project.name === 'mobile-chromium' ? 'Navegacao mobile do portal' : 'Navegacao do portal'
    });
    await navegacao.getByRole('link', { name: 'Check-ins', exact: true }).click();
    await expect(page).toHaveURL(/\/portal\/checkins$/);
    await expect(page.getByRole('heading', { name: 'Check-in rapido' })).toBeVisible();

    await page.getByLabel('Humor de hoje').selectOption('muito_bem');
    await page.getByLabel('Adesão ao plano').fill('90');
    await page.getByLabel('Sintomas ou sinais').fill('Sem sintomas relevantes.');
    await page.getByLabel('Observações do dia').fill('Mantive o plano no cafe da manha.');
    await page.getByRole('button', { name: 'Registrar check-in' }).click();
    await expect.poll(() => portal.registrouCheckin()).toBe(true);

    await navegacao.getByRole('link', { name: 'Mais', exact: true }).click();
    await expect(page).toHaveURL(/\/portal\/mais$/);
    await page.locator('#conteudo-principal').getByRole('link', { name: 'Formulários', exact: true }).click();
    await expect(page).toHaveURL(/\/portal\/formularios$/);
    await expect(page.getByRole('heading', { name: 'Formulários pendentes' })).toBeVisible();
    await page.getByRole('button', { name: 'Ver respostas' }).click();
    await expect(page.getByText('Mantive boa adesão durante a semana.')).toBeVisible();
    await expect(page.getByText(/score\s+87[,.]40/i)).toHaveCount(0);

    expect(portal.carregamentos()).toBe(1);
    await assertSemOverflowHorizontal(page);
  });

  test('mantem a jornada de privacidade na rota dedicada', async ({ page }) => {
    await prepararPortal(page);
    await page.goto('/portal/privacidade');

    await expect(page.getByRole('heading', { name: 'Privacidade' })).toBeVisible();
    await page.getByRole('button', { name: 'Baixar meus dados' }).click();
    await expect(page.getByText('Exportacao LGPD completa gerada para Ana Paula. Hash 0123456789ab.')).toBeVisible();
    await page.getByLabel('Tipo de solicitação LGPD').selectOption('retificacao');
    await page.getByLabel('Detalhes da solicitação').fill('Atualizar telefone cadastrado.');
    await page.getByRole('button', { name: 'Enviar solicitação LGPD' }).click();
    await expect(page.getByText('Solicitação LGPD registrada: LGPD-123.')).toBeVisible();

    await assertSemOverflowHorizontal(page);
  });

  test('exibe estado de erro acionavel quando o portal nao carrega', async ({ page }) => {
    await prepararSessaoPaciente(page);
    await page.route((url) => url.pathname === '/api/portal/paciente', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ mensagem: 'Servico temporariamente indisponível.' })
      });
    });

    await page.goto('/portal');

    await expect(page.getByRole('heading', { name: 'Portal indisponível' })).toBeVisible();
    await expect(page.getByText('Servico temporariamente indisponível.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });
});

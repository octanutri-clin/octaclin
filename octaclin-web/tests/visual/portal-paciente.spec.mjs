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
      texto: 'Sua consulta sera amanha.',
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

async function prepararPortal(page) {
  let registrouCheckin = false;

  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Patient', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/portal'), domain: 'localhost', path: '/' }
  ]);

  await page.route((url) => url.pathname === '/api/portal/paciente', async (route) => {
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
            valor: 'Mantive boa adesao durante a semana.'
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

  return { registrouCheckin: () => registrouCheckin };
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
  test('renderiza prioridades, perfil e privacidade sem regressao visual', async ({ page }, testInfo) => {
    const portal = await prepararPortal(page);
    await page.goto('/portal');

    await expect(page.getByRole('heading', { name: 'Portal do paciente' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navegacao do portal' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Resumo' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Acoes', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Plano', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Notificacoes', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Historico', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Perfil', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Proximas acoes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Linha do tempo' })).toBeVisible();
    await expect(page.getByText('Agenda', { exact: true })).toBeVisible();
    await expect(page.getByText('Formulario pendente', { exact: true })).toBeVisible();
    await expect(page.getByText('Formulario respondido', { exact: true })).toBeVisible();
    await expect(page.getByText('Mensagem', { exact: true })).toBeVisible();
    await expect(page.getByText('Privacidade').first()).toBeVisible();
    await expect(page.getByText('Responder Check-in semanal')).toBeVisible();
    await expect(page.getByText('Consulta nutricional').first()).toBeVisible();
    await expect(page.getByText('Tarefas', { exact: true })).toBeVisible();
    await expect(page.getByText('Materiais', { exact: true })).toBeVisible();
    await expect(page.getByText('Check-ins', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Check-in rapido' })).toBeVisible();
    await expect(page.getByLabel('Humor de hoje')).toBeVisible();
    await expect(page.getByLabel('Adesao ao plano')).toBeVisible();
    await expect(page.getByLabel('Sintomas ou sinais')).toBeVisible();
    await expect(page.getByLabel('Observacoes do dia')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Diario recente' })).toBeVisible();
    await expect(page.locator('#checkin-rapido').getByText('Humor Bem')).toBeVisible();
    await expect(page.locator('#checkin-rapido').getByText('Adesao 80%')).toBeVisible();
    await expect(page.locator('#checkin-rapido').getByText('Sono leve')).toBeVisible();
    await expect(page.locator('#checkin-rapido').getByText('Consegui seguir o plano no almoco.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Plano de acompanhamento' })).toBeVisible();
    await expect(page.locator('#plano').getByText('Registrar agua diariamente')).toBeVisible();
    await expect(page.locator('#plano').getByText('Meta de 2 litros por dia.')).toBeVisible();
    await expect(page.locator('#plano').getByText('Alta')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Materiais do plano' })).toBeVisible();
    await expect(page.locator('#plano').getByText('Guia de hidratacao')).toBeVisible();
    await expect(page.locator('#plano').getByText('Orientacoes para hidratar melhor.')).toBeVisible();
    await expect(page.locator('#plano').getByText('Ler antes da proxima consulta.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Abrir Guia de hidratacao' })).toHaveAttribute(
      'href',
      'https://materiais.octaclin.test/hidratacao'
    );
    await expect(page.getByRole('heading', { name: 'Notificacoes do paciente' })).toBeVisible();
    await expect(page.locator('#notificacoes').getByText('Pendentes', { exact: true })).toBeVisible();
    await expect(page.locator('#notificacoes').getByText('Historico', { exact: true })).toBeVisible();
    await expect(page.locator('#notificacoes').getByText('Lembrete de consulta').first()).toBeVisible();
    await expect(page.locator('#notificacoes').getByText('Sua consulta sera amanha.').first()).toBeVisible();
    await expect(page.locator('#notificacoes').getByText('WhatsApp').first()).toBeVisible();
    await expect(page.locator('#notificacoes').getByText('Consulta agendada')).toBeVisible();
    await expect(page.locator('#notificacoes').getByText('E-mail')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Privacidade' })).toBeVisible();
    await expect(page.getByText('Documentos legais')).toBeVisible();
    await expect(page.locator('#privacidade').getByText('Termos de uso')).toBeVisible();
    await expect(page.locator('#privacidade').getByText('Politica de privacidade')).toBeVisible();
    await expect(page.locator('#privacidade').getByText('Consentimento LGPD')).toBeVisible();
    await expect(page.locator('#privacidade').getByText('Pendente')).toBeVisible();
    await expect(page.locator('#privacidade').getByText('Aceito').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Baixar meus dados' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar solicitacao LGPD' })).toBeVisible();
    await expect(page.getByText('Meus protocolos LGPD')).toBeVisible();
    await expect(page.getByText('LGPD-123', { exact: true })).toBeVisible();
    await expect(page.getByText('Em tratamento')).toBeVisible();
    await expect(page.getByText('Validando cadastro.')).toBeVisible();
    await expect(page.getByText('Atualizacao da solicitacao LGPD LGPD-123')).toBeVisible();

    await page.getByRole('button', { name: 'Ver respostas' }).click();
    await expect(page.getByText('Mantive boa adesao durante a semana.')).toBeVisible();

    await page.getByRole('button', { name: 'Baixar meus dados' }).click();
    await expect(page.getByText('Exportacao LGPD completa gerada para Ana Paula. Hash 0123456789ab.')).toBeVisible();

    await page.getByLabel('Tipo de solicitacao LGPD').selectOption('retificacao');
    await page.getByLabel('Detalhes da solicitacao').fill('Atualizar telefone cadastrado.');
    await page.getByRole('button', { name: 'Enviar solicitacao LGPD' }).click();
    await expect(page.getByText('Solicitacao LGPD registrada: LGPD-123.')).toBeVisible();

    await page.getByLabel('Humor de hoje').selectOption('muito_bem');
    await page.getByLabel('Adesao ao plano').fill('90');
    await page.getByLabel('Sintomas ou sinais').fill('Sem sintomas relevantes.');
    await page.getByLabel('Observacoes do dia').fill('Mantive o plano no cafe da manha.');
    await page.getByRole('button', { name: 'Registrar check-in' }).click();
    await expect.poll(() => portal.registrouCheckin()).toBe(true);
    await expect(page.getByText('Check-in registrado.')).toBeVisible();
    await assertSemOverflowHorizontal(page);

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach(`${testInfo.project.name}-portal-paciente.png`, { body: screenshot, contentType: 'image/png' });
  });

  test('exibe estado de erro acionavel quando o portal nao carrega', async ({ page }) => {
    await prepararSessaoPaciente(page);
    await page.route((url) => url.pathname === '/api/portal/paciente', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ mensagem: 'Servico temporariamente indisponivel.' })
      });
    });

    await page.goto('/portal');

    await expect(page.getByRole('heading', { name: 'Portal indisponivel' })).toBeVisible();
    await expect(page.getByText('Servico temporariamente indisponivel.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });
});

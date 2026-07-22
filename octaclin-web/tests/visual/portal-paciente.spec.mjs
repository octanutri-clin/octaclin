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
    mensagensRecentes: 1
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
  lgpd: {
    versaoAtual: '2026-07',
    ultimoAceiteEm: '2026-07-10T10:00:00.000Z',
    consentimentos: [
      {
        id: 'consentimento-1',
        tipo: 'primeiro_acesso_paciente',
        versao: '2026-07',
        aceitoEm: '2026-07-10T10:00:00.000Z',
        metadados: { origem: 'primeiro_acesso' }
      }
    ]
  }
};

async function prepararPortal(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Patient', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/portal'), domain: 'localhost', path: '/' }
  ]);

  await page.route('**/api/portal/paciente', async (route) => {
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
  await page.route('**/api/portal/paciente/lgpd/exportacao', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        geradoEm: '2026-07-22T12:00:00.000Z',
        titular: { pacienteId: 'paciente-1', nome: 'Ana Paula', email: 'ana@example.com' },
        dados: portalPaciente
      })
    });
  });
  await page.route('**/api/portal/paciente/lgpd/solicitacoes', async (route) => {
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
    await prepararPortal(page);
    await page.goto('/portal');

    await expect(page.getByRole('heading', { name: 'Portal do paciente' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navegacao do portal' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Resumo' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Acoes' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Historico' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Perfil' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Proximas acoes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Linha do tempo' })).toBeVisible();
    await expect(page.getByText('Agenda', { exact: true })).toBeVisible();
    await expect(page.getByText('Formulario pendente', { exact: true })).toBeVisible();
    await expect(page.getByText('Formulario respondido', { exact: true })).toBeVisible();
    await expect(page.getByText('Mensagem', { exact: true })).toBeVisible();
    await expect(page.getByText('Privacidade').first()).toBeVisible();
    await expect(page.getByText('Responder Check-in semanal')).toBeVisible();
    await expect(page.getByText('Consulta nutricional').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Privacidade' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Baixar meus dados' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar solicitacao LGPD' })).toBeVisible();

    await page.getByRole('button', { name: 'Ver respostas' }).click();
    await expect(page.getByText('Mantive boa adesao durante a semana.')).toBeVisible();

    await page.getByRole('button', { name: 'Baixar meus dados' }).click();
    await expect(page.getByText('Exportacao gerada para Ana Paula.')).toBeVisible();

    await page.getByLabel('Tipo de solicitacao LGPD').selectOption('retificacao');
    await page.getByLabel('Detalhes da solicitacao').fill('Atualizar telefone cadastrado.');
    await page.getByRole('button', { name: 'Enviar solicitacao LGPD' }).click();
    await expect(page.getByText('Solicitacao LGPD registrada: LGPD-123.')).toBeVisible();
    await assertSemOverflowHorizontal(page);

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach(`${testInfo.project.name}-portal-paciente.png`, { body: screenshot, contentType: 'image/png' });
  });

  test('exibe estado de erro acionavel quando o portal nao carrega', async ({ page }) => {
    await prepararSessaoPaciente(page);
    await page.route('**/api/portal/paciente', async (route) => {
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

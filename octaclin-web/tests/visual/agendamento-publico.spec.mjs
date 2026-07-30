import { expect, test } from '@playwright/test';

async function assertSemOverflowHorizontal(page) {
  const medidas = await page.evaluate(() => ({
    larguraDocumento: document.documentElement.scrollWidth,
    larguraViewport: document.documentElement.clientWidth
  }));

  expect(medidas.larguraDocumento).toBeLessThanOrEqual(medidas.larguraViewport + 1);
}

async function prepararPaginaPublica(page) {
  let solicitacaoEnviada = null;

  await page.route('**/api/agendamentos-publicos/token-publico', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

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
            horarios: [
              { inicioEm: '2026-08-03T13:00:00.000Z', rotulo: '10:00' },
              { inicioEm: '2026-08-03T14:00:00.000Z', rotulo: '11:00' }
            ]
          }
        ]
      })
    });
  });

  await page.route('**/api/agendamentos-publicos/token-publico/solicitacoes', async (route) => {
    solicitacaoEnviada = JSON.parse(route.request().postData() ?? '{}');

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'solicitacao-publica-1',
        status: 'pendente',
        inicioEm: '2026-08-03T13:00:00.000Z'
      })
    });
  });

  return {
    solicitacaoEnviada: () => solicitacaoEnviada
  };
}

async function prepararAgendaInterna(page) {
  let aprovouSolicitacao = false;
  let recusouSolicitacao = false;
  let rotacionouLink = false;
  let urlAtual = 'https://octaclin.local/agendar/token-publico';

  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/agenda'), domain: 'localhost', path: '/' }
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
        expiraEm: '2026-08-01T15:00:00.000Z',
        papel: 'Professional',
        permissoes: [
          'dashboard.ler',
          'agenda.consultas.ler',
          'agenda.consultas.criar',
          'pacientes.listar',
          'questionarios.ler',
          'comunicacoes.mensagens.ler'
        ],
        destinoInicial: '/agenda'
      })
    });
  });

  await page.route('**/api/agenda/consultas', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
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
            nome: 'Ana Souza',
            contato: 'ana@exemplo.com',
            profissionalResponsavelId: 'profissional-1',
            criadoEm: '2026-07-20T10:00:00.000Z',
            atualizadoEm: '2026-07-20T10:00:00.000Z'
          }
        ],
        total: 1,
        pagina: 1,
        limite: 25
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
            conselho: 'CRN',
            registro: '12345',
            contato: 'dra.carla@octaclin.local',
            criadoEm: '2026-07-20T10:00:00.000Z',
            atualizadoEm: '2026-07-20T10:00:00.000Z'
          }
        ],
        total: 1,
        pagina: 1,
        limite: 25
      })
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
    if (route.request().method() === 'GET') {
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
          urlPublica: null,
          urlPublicaDisponivel: false,
          requerRotacaoConfirmada: true,
          mensagemUrlPublica:
            'URL atual indisponivel nesta sessao. Por seguranca, o token bruto nao e persistido. Rotacione com confirmacao para gerar uma nova URL publica.'
        })
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/api/agenda/agendamento-publico/rotacionar', async (route) => {
    rotacionouLink = true;
    urlAtual = 'https://octaclin.local/agendar/token-rotacionado';

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
        urlPublica: urlAtual,
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
      body: JSON.stringify({
        itens: [
          {
            id: 'solicitacao-1',
            status: 'pendente',
            nome: 'Ana Silva',
            email: 'ana@exemplo.com',
            whatsapp: '5511999999999',
            observacao: 'Prefiro atendimento online.',
            inicioEm: '2026-08-03T13:00:00.000Z',
            expiraEm: '2026-08-04T13:00:00.000Z'
          },
          {
            id: 'solicitacao-2',
            status: 'pendente',
            nome: 'Marcos Lima',
            email: 'marcos@exemplo.com',
            whatsapp: '',
            observacao: '',
            inicioEm: '2026-08-03T14:00:00.000Z',
            expiraEm: '2026-08-04T14:00:00.000Z'
          }
        ],
        total: 2,
        pagina: 1,
        limite: 25
      })
    });
  });

  await page.route('**/api/agenda/solicitacoes/solicitacao-1/aprovar', async (route) => {
    aprovouSolicitacao = true;
    const corpo = JSON.parse(route.request().postData() ?? '{}');
    expect(corpo).toEqual({ pacienteId: 'paciente-1' });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'solicitacao-1',
        status: 'aprovada',
        pacienteId: 'paciente-1',
        nome: 'Ana Silva',
        email: 'ana@exemplo.com',
        whatsapp: '5511999999999',
        inicioEm: '2026-08-03T13:00:00.000Z'
      })
    });
  });

  await page.route('**/api/agenda/solicitacoes/solicitacao-2/recusar', async (route) => {
    recusouSolicitacao = true;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'solicitacao-2',
        status: 'recusada',
        nome: 'Marcos Lima',
        inicioEm: '2026-08-03T14:00:00.000Z'
      })
    });
  });

  return {
    aprovouSolicitacao: () => aprovouSolicitacao,
    recusouSolicitacao: () => recusouSolicitacao,
    rotacionouLink: () => rotacionouLink
  };
}

test.describe('agendamento publico', () => {
  test('envia solicitacao sem mostrar dados de outros pacientes', async ({ page }) => {
    const pagina = await prepararPaginaPublica(page);

    await page.goto('/agendar/token-publico');

    await expect(page.getByRole('heading', { name: 'Agendar com Dra. Carla' })).toBeVisible();
    await expect(page.getByText('1. Escolha um horario')).toBeVisible();
    await expect(page.getByText('2. Envie sua solicitacao')).toBeVisible();
    await page.getByRole('button', { name: '10:00' }).click();
    await page.getByLabel('Nome completo').fill('Ana Silva');
    await page.getByLabel('Email').fill('ana@exemplo.com');
    await page.getByLabel('WhatsApp').fill('5511999999999');
    await page.getByLabel('Observacoes').fill('Prefiro atendimento online.');
    await page.getByRole('button', { name: 'Enviar solicitacao' }).click();

    await expect.poll(() => pagina.solicitacaoEnviada()).not.toBeNull();
    await expect(page.getByText('Solicitacao enviada para analise.')).toBeVisible();
    await expect(page.getByText('pacienteId')).toHaveCount(0);
    await assertSemOverflowHorizontal(page);
  });

  test('permite rotacionar o link e decidir solicitacoes pendentes na agenda', async ({ page }) => {
    const agenda = await prepararAgendaInterna(page);

    await page.goto('/agenda');

    await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Link publico de agendamento' })).toBeVisible();
    await expect(page.getByText(/token bruto nao e persistido/i)).toBeVisible();
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('invalida a URL publica anterior');
      await dialog.accept();
    });
    await page.getByRole('button', { name: 'Rotacionar link' }).click();

    await expect.poll(() => agenda.rotacionouLink()).toBe(true);
    await expect(page.getByText('https://octaclin.local/agendar/token-rotacionado')).toBeVisible();

    const solicitacaoAna = page.locator('article').filter({ hasText: 'Ana Silva' });
    await expect(solicitacaoAna).toBeVisible();
    await expect(solicitacaoAna.getByLabel('Paciente para aprovar')).toHaveValue('');
    await expect(solicitacaoAna.getByRole('button', { name: 'Aprovar solicitacao' })).toBeDisabled();
    await solicitacaoAna.getByLabel('Paciente para aprovar').selectOption('paciente-1');
    await expect(solicitacaoAna.getByRole('button', { name: 'Aprovar solicitacao' })).toBeEnabled();
    await solicitacaoAna.getByRole('button', { name: 'Aprovar solicitacao' }).click();

    await expect.poll(() => agenda.aprovouSolicitacao()).toBe(true);
    await expect(page.getByText('Solicitacao aprovada e convertida em consulta.')).toBeVisible();

    const solicitacaoMarcos = page.locator('article').filter({ hasText: 'Marcos Lima' });
    await solicitacaoMarcos.getByRole('button', { name: 'Recusar solicitacao' }).click();

    await expect.poll(() => agenda.recusouSolicitacao()).toBe(true);
    await expect(page.getByText('Solicitacao recusada.')).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });
});

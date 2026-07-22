import { expect, test } from '@playwright/test';

const credenciais = {
  apiUrl: process.env.E2E_API_URL ?? 'http://localhost:3001',
  tenantSlug: process.env.E2E_TENANT_SLUG ?? 'clinica-carla',
  email: process.env.E2E_EMAIL ?? 'admin@octaclin.local',
  senha: process.env.E2E_SENHA ?? 'OctaClin@123'
};

const rotas = [
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
  'Questionarios',
  'Comunicacoes',
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
  await expect(page).toHaveURL(/\/operacoes$/);
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

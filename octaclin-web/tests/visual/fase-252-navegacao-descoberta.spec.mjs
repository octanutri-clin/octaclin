import { expect, test } from '@playwright/test';

const webUrl = process.env.E2E_WEB_URL ?? 'http://localhost:3000';

const permissoesPorPapel = {
  SuperAdmin: [
    'console.acessar', 'dashboard.ler', 'agenda.consultas.ler', 'agenda.consultas.criar',
    'pacientes.listar', 'pacientes.ler', 'pacientes.gerenciar', 'questionarios.ler',
    'comunicacoes.mensagens.ler', 'automacoes.gerenciar', 'ia.executar',
    'gamificacao.gerenciar', 'profissionais.ler', 'operacoes.auditoria.ler'
  ],
  Professional: [
    'console.acessar', 'dashboard.ler', 'agenda.consultas.ler', 'agenda.consultas.criar',
    'pacientes.listar', 'pacientes.ler', 'pacientes.gerenciar', 'questionarios.ler',
    'comunicacoes.mensagens.ler', 'automacoes.gerenciar', 'ia.executar',
    'gamificacao.gerenciar', 'profissionais.ler'
  ],
  Collaborator: [
    'console.acessar', 'dashboard.ler', 'agenda.consultas.ler', 'agenda.consultas.criar',
    'pacientes.listar', 'pacientes.ler', 'questionarios.ler', 'comunicacoes.mensagens.ler'
  ]
};

async function responderJson(route, body, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function prepararSessao(page, papel) {
  const permissoes = permissoesPorPapel[papel];
  const destinoInicial = papel === 'Collaborator' ? '/agenda' : '/dashboard';
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'sintetico', url: webUrl },
    { name: 'octaclin_refresh_token', value: 'sintetico', url: webUrl },
    { name: 'octaclin_papel', value: papel, url: webUrl },
    { name: 'octaclin_permissoes', value: encodeURIComponent(JSON.stringify(permissoes)), url: webUrl },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent(destinoInicial), url: webUrl }
  ]);

  await page.route('**/api/**', (route) => responderJson(route, { itens: [], total: 0 }));
  await page.route('**/api/auth/session', (route) => responderJson(route, {
    autenticado: true,
    apiUrl: 'http://backend.sintetico.local',
    tenantSlug: 'clinica-sintetica',
    email: `${papel.toLowerCase()}@example.com`,
    expiraEm: '2026-08-21T18:00:00.000Z',
    papel,
    permissoes,
    destinoInicial
  }));
  await page.route('**/api/notificacoes**', (route) => responderJson(route, { naoLidas: 0, itens: [] }));
  await page.route('**/api/agenda/consultas', (route) => responderJson(route, []));
  await page.route('**/api/agenda/feed?**', (route) => responderJson(route, []));
  await page.route('**/api/agenda/solicitacoes**', (route) => responderJson(route, { itens: [], total: 0 }));
  await page.route('**/api/agenda/google/status', (route) => responderJson(route, { conectado: false }));
  await page.route('**/api/pacientes**', (route) => responderJson(route, { itens: [], total: 0, pagina: 1, limite: 50 }));
  await page.route('**/api/profissionais**', (route) => responderJson(route, { itens: [], total: 0, pagina: 1, limite: 50 }));
  await page.route('**/api/dashboard/clinico?**', (route) => responderJson(route, {
    contexto: { periodo: 'hoje', inicioEm: '2026-08-21T00:00:00.000Z', fimEm: '2026-08-21T23:59:59.999Z' },
    indicadores: {
      consultasHoje: 0, proximas: 0, concluidas: 0, reagendadas: 0, canceladas: 0, faltas: 0,
      semRetorno30: 0, semRetorno60: 0, semRetorno90Mais: 0, formulariosPendentes: 0,
      tarefasVencidas: 0, solicitacoesPendentes: 0, comunicacoesEmAlerta: 0, pacientesRiscoAlto: 0
    },
    atendimentos: [], semRetorno: [], tarefasVencidas: [], formulariosPendentes: [],
    solicitacoesPendentes: [], comunicacoes: [], alertas: [], selecaoObrigatoria: false
  }));
}

async function semOverflowHorizontal(page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  )).toBeLessThanOrEqual(1);
}

test.describe('Fase 252 - navegacao e descoberta', () => {
  test('SuperAdmin encontra todos os grupos e Operacoes pela busca', async ({ page }, testInfo) => {
    await prepararSessao(page, 'SuperAdmin');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/dashboard');

    const navegacao = page.getByRole('navigation', { name: 'Módulos do console', exact: true });
    for (const grupo of ['Clínica', 'Relacionamento', 'Administração']) {
      await expect(navegacao.getByText(grupo, { exact: true })).toBeVisible();
    }
    await expect(navegacao.getByRole('link')).toHaveCount(10);
    await expect(navegacao.getByRole('link', { name: 'Operações', exact: true })).toBeVisible();

    await page.getByRole('button', { name: /Buscar no OctaClin/ }).click();
    await page.getByPlaceholder('Digite uma tela, ação ou paciente').fill('auditoria');
    await expect(page.getByRole('option', { name: /Operações/ })).toBeVisible();
    await semOverflowHorizontal(page);
    await page.screenshot({ path: testInfo.outputPath('superadmin-desktop.png'), fullPage: true });
  });

  test('Professional ve capacidades clinicas sem expor Operacoes', async ({ page }) => {
    await prepararSessao(page, 'Professional');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/dashboard');

    const navegacao = page.getByRole('navigation', { name: 'Módulos do console', exact: true });
    await expect(navegacao.getByRole('link')).toHaveCount(9);
    await expect(navegacao.getByRole('link', { name: 'Operações', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /Buscar no OctaClin/ }).click();
    await page.getByPlaceholder('Digite uma tela, ação ou paciente').fill('auditoria');
    await expect(page.getByRole('option', { name: /Operações/ })).toHaveCount(0);
  });

  test('Collaborator recebe somente rotas delegadas mesmo com dashboard.ler', async ({ page }) => {
    await prepararSessao(page, 'Collaborator');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/agenda$/);

    const navegacao = page.getByRole('navigation', { name: 'Módulos do console', exact: true });
    await expect(navegacao.getByRole('link')).toHaveCount(4);
    for (const rotulo of ['Agenda', 'Pacientes', 'Formulários', 'Comunicações']) {
      await expect(navegacao.getByRole('link', { name: rotulo, exact: true })).toBeVisible();
    }
    await expect(navegacao.getByRole('link', { name: 'Hoje', exact: true })).toHaveCount(0);
    await expect(navegacao.getByRole('link', { name: 'Profissionais', exact: true })).toHaveCount(0);
  });

  test('menu mobile revela todos os grupos por teclado e preserva a pagina atual', async ({ page }, testInfo) => {
    await prepararSessao(page, 'Professional');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');

    const resumo = page.locator('summary').filter({ hasText: 'Módulos' });
    await resumo.focus();
    await page.keyboard.press('Enter');
    const navegacao = page.getByRole('navigation', { name: 'Módulos do console no celular' });
    await expect(navegacao).toBeVisible();
    await expect(navegacao.getByRole('link', { name: 'Hoje', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(navegacao.getByRole('link')).toHaveCount(9);
    await semOverflowHorizontal(page);
    await page.screenshot({ path: testInfo.outputPath('profissional-mobile-menu.png'), fullPage: true });
  });
});

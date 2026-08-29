import { expect, test } from '@playwright/test';

const webUrl = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const permissoes = ['console.acessar', 'agenda.consultas.ler'];

const sessoes = [
  {
    referencia: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    criadaEm: '2026-08-29T09:00:00.000Z',
    ultimaAtividadeEm: '2026-08-29T11:30:00.000Z',
    expiraEm: '2026-09-28T09:00:00.000Z',
    estado: 'ativa',
    atual: true
  },
  {
    referencia: 'f0e9d8c7b6a5948372615043f2e1d0c9',
    criadaEm: '2026-08-20T08:00:00.000Z',
    ultimaAtividadeEm: '2026-08-21T18:10:00.000Z',
    expiraEm: '2026-09-19T08:00:00.000Z',
    estado: 'ativa',
    atual: false
  },
  {
    referencia: '0123456789abcdef0123456789abcdef',
    criadaEm: '2026-07-01T08:00:00.000Z',
    ultimaAtividadeEm: '2026-07-02T08:00:00.000Z',
    expiraEm: '2026-07-31T08:00:00.000Z',
    estado: 'revogada',
    atual: false
  }
];

async function preparar(page, { aoListar } = {}) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', url: webUrl },
    { name: 'octaclin_refresh_token', value: 'fake', url: webUrl },
    { name: 'octaclin_papel', value: 'Professional', url: webUrl },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/agenda'), url: webUrl },
    { name: 'octaclin_permissoes', value: encodeURIComponent(JSON.stringify(permissoes)), url: webUrl }
  ]);
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        autenticado: true,
        apiUrl: 'http://backend.test',
        tenantSlug: 'clinica-sintetica',
        email: 'pro@example.com',
        expiraEm: '2026-08-30T10:00:00.000Z',
        papel: 'Professional',
        permissoes,
        destinoInicial: '/agenda'
      })
    })
  );
  await page.route('**/api/auth/sessoes', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    aoListar?.();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessoes) });
  });
}

test.describe('Sessoes da conta', () => {
  test('lista as sessoes com metadados minimos e marca a atual', async ({ page }) => {
    await preparar(page);
    await page.goto('/conta/sessoes');

    await expect(page.getByRole('heading', { name: 'Segurança da conta' })).toBeVisible();
    await expect(page.getByText(/^Esta sessão/)).toBeVisible();
    await expect(page.getByText(/^Outro acesso/)).toHaveCount(2);

    const corpo = await page.locator('body').innerText();
    for (const sessao of sessoes) {
      expect(corpo).not.toContain(sessao.referencia);
    }
    // Nenhum identificador tecnico chega ao navegador: nem a referencia opaca
    // renderizada como texto, nem hash, nem material de token.
    expect(corpo).not.toMatch(/[0-9a-f]{32}/);
    expect(corpo).not.toMatch(/tokenHash|familiaToken|sessaoId|eyJ[A-Za-z0-9_-]/);
  });

  test('encerra uma sessao especifica e recarrega a lista', async ({ page }) => {
    let listagens = 0;
    await preparar(page, { aoListar: () => (listagens += 1) });

    let encerrada;
    await page.route('**/api/auth/sessoes/*', async (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback();
      encerrada = new URL(route.request().url()).pathname.split('/').pop();
      await route.fulfill({ status: 204, body: '' });
    });

    await page.goto('/conta/sessoes');
    await page.getByRole('button', { name: 'Encerrar', exact: true }).first().click();

    await expect.poll(() => encerrada).toBe('f0e9d8c7b6a5948372615043f2e1d0c9');
    await expect.poll(() => listagens).toBeGreaterThan(1);
    await expect(page.getByText('Sessão encerrada.')).toBeVisible();
  });

  test('encerra as demais sessoes preservando a atual', async ({ page }) => {
    await preparar(page);
    let chamou = false;
    await page.route('**/api/auth/sessoes/encerrar-outras', async (route) => {
      chamou = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ encerradas: 1 }) });
    });

    await page.goto('/conta/sessoes');
    await page.getByRole('button', { name: 'Encerrar outras sessões', exact: true }).click();

    await expect.poll(() => chamou).toBe(true);
    await expect(page.getByText('1 sessão(ões) encerrada(s).')).toBeVisible();
  });

  test('mostra falha sem expor detalhe interno quando o BFF recusa', async ({ page }) => {
    await preparar(page);
    await page.unroute('**/api/auth/sessoes');
    await page.route('**/api/auth/sessoes', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ mensagem: 'Sessao ausente ou expirada.' })
      })
    );

    await page.goto('/conta/sessoes');

    await expect(page.getByText('Sessões indisponíveis')).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(/stack|at Object|node_modules/i);
  });

  test('menu da conta leva a superficie de sessoes', async ({ page }) => {
    await preparar(page);
    await page.goto('/agenda');

    await page.getByRole('button', { name: /Abrir menu da conta/ }).click();
    await page.getByRole('menuitem', { name: 'Sessões e segurança' }).click();

    await expect(page).toHaveURL(/\/conta\/sessoes$/);
  });
});

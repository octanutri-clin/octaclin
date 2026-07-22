import { expect, test } from '@playwright/test';

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
        permissoes: ['cliente.acessar', 'cliente.assinatura.ler', 'cliente.usuarios.gerenciar'],
        destinoInicial: '/cliente'
      })
    });
  });
}

async function assertSemOverflowHorizontal(page) {
  const medidas = await page.evaluate(() => ({
    larguraDocumento: document.documentElement.scrollWidth,
    larguraViewport: document.documentElement.clientWidth
  }));

  expect(medidas.larguraDocumento).toBeLessThanOrEqual(medidas.larguraViewport + 1);
}

test.describe('portal do cliente', () => {
  test('renderiza base de conta sem expor console ou portal do paciente', async ({ page }, testInfo) => {
    await prepararSessaoCliente(page);
    await page.goto('/cliente');

    await expect(page.getByRole('heading', { name: 'Portal do cliente' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navegacao do cliente' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Conta' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Assinatura' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Usuarios' })).toBeVisible();
    const resumoConta = page.locator('#conta');
    await expect(resumoConta.getByText('Resumo da conta')).toBeVisible();
    await expect(resumoConta.getByText('Clinica Carla')).toBeVisible();
    await expect(resumoConta.getByText('Plano gratuito')).toBeVisible();
    await expect(page.getByText('Acesso profissional separado')).toBeVisible();
    await expect(page.getByText('Portal do paciente')).toHaveCount(0);
    await expect(page.getByText('Console clinico')).toHaveCount(0);
    await assertSemOverflowHorizontal(page);

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach(`${testInfo.project.name}-portal-cliente.png`, { body: screenshot, contentType: 'image/png' });
  });
});

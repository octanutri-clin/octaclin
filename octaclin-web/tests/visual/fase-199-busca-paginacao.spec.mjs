import { expect, test } from '@playwright/test';

const sessao = {
  autenticado: true,
  apiUrl: 'http://localhost:3001',
  tenantSlug: 'clinica-teste',
  email: 'profissional@octaclin.test',
  papel: 'Professional',
  permissoes: ['pacientes.ler', 'pacientes.listar', 'pacientes.gerenciar'],
  destinoInicial: '/pacientes'
};

async function preparar(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/pacientes'), domain: 'localhost', path: '/' }
  ]);
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessao) }));
  await page.route('**/api/profissionais*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ itens: [{ id: 'prof-1', tenantId: 'tenant-1', nome: 'Dra. Carla' }], total: 1 })
  }));
  await page.route('**/api/pacientes*', (route) => {
    const url = new URL(route.request().url());
    const busca = url.searchParams.get('busca');
    const pagina = Number(url.searchParams.get('pagina') ?? 1);
    const nome = busca ? 'Beatriz Lima' : pagina === 2 ? 'Paciente 26' : 'Paciente 1';
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        itens: [{ id: `paciente-${pagina}`, tenantId: 'tenant-1', profissionalResponsavelId: 'prof-1', nome, statusAdesao: 'em_acompanhamento', scoreRisco: '20', criadoEm: '2026-08-01T10:00:00.000Z' }],
        total: busca ? 1 : 26
      })
    });
  });
}

test('pagina alem de 25 e busca server-side persistem na URL', async ({ page }) => {
  await preparar(page);
  await page.goto('/pacientes');

  await expect(page.getByRole('link', { name: 'Paciente 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Próxima', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Paciente 26', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/pagina=2/);

  await page.getByLabel('Buscar pacientes').fill('Beatriz');
  await expect(page.getByRole('link', { name: 'Beatriz Lima', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/busca=Beatriz/);
  await expect(page).not.toHaveURL(/pagina=2/);
});

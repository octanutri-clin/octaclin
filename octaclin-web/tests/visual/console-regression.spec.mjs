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

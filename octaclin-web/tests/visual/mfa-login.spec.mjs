import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function assertSemViolacoesAxe(page) {
  const resultado = await new AxeBuilder({ page })
    .exclude('nextjs-portal')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(resultado.violations).toEqual([]);
}

test.describe('MFA no login', () => {
  test('configura TOTP, confirma e exibe recovery codes uma unica vez', async ({ page }) => {
    await page.route('**/api/auth/login', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ mfaObrigatorio: true, modo: 'configurar' })
    }));
    await page.route('**/api/auth/mfa/configuracao-login', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        segredo: 'JBSWY3DPEHPK3PXP',
        uri: 'otpauth://totp/OctaClin:conta-sintetica',
        expiraEm: '2026-08-29T12:05:00.000Z'
      })
    }));
    await page.route('**/api/auth/mfa/concluir-login', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        destinoInicial: '/agenda',
        codigosRecuperacao: ['AAAA-BBBB-CCCC', 'DDDD-EEEE-FFFF']
      })
    }));

    await page.goto('/login');
    await page.getByLabel('Email').fill('profissional@example.test');
    await page.getByLabel('Senha', { exact: true }).fill('SenhaSintetica123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('heading', { name: 'Proteja sua conta' })).toBeVisible();
    await expect(page.getByText('JBSWY3DPEHPK3PXP')).toBeVisible();
    await assertSemViolacoesAxe(page);
    await page.getByLabel('Código de verificação').fill('123456');
    await page.getByRole('button', { name: 'Verificar e entrar' }).click();

    await expect(page.getByRole('heading', { name: 'Códigos de recuperação' })).toBeVisible();
    await expect(page.getByText('AAAA-BBBB-CCCC')).toBeVisible();
  });

  test('verifica TOTP sem expor o desafio assinado na interface', async ({ page }) => {
    await page.route('**/api/auth/login', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ mfaObrigatorio: true, modo: 'verificar' })
    }));
    await page.route('**/api/auth/mfa/concluir-login', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ destinoInicial: '/agenda', codigosRecuperacao: [] })
    }));

    await page.goto('/login');
    await page.getByLabel('Email').fill('profissional@example.test');
    await page.getByLabel('Senha', { exact: true }).fill('SenhaSintetica123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await assertSemViolacoesAxe(page);
    // O endpoint BFF esta mockado no navegador, portanto nao consegue gravar
    // os cookies HttpOnly que gravaria no fluxo real. Estes valores sinteticos
    // existem apenas para permitir que o middleware aceite o redirect final.
    await page.context().addCookies([
      { name: 'octaclin_access_token', value: 'access-sintetico', url: 'http://localhost:3000' },
      { name: 'octaclin_refresh_token', value: 'refresh-sintetico', url: 'http://localhost:3000' },
      { name: 'octaclin_api_url', value: encodeURIComponent('http://backend.test'), url: 'http://localhost:3000' },
      { name: 'octaclin_tenant_slug', value: 'clinica-sintetica', url: 'http://localhost:3000' },
      { name: 'octaclin_email', value: encodeURIComponent('profissional@example.test'), url: 'http://localhost:3000' },
      { name: 'octaclin_access_expira_em', value: '2126-08-29T12:00:00.000Z', url: 'http://localhost:3000' }
    ]);
    await page.getByLabel('Código de verificação').fill('123456');
    await page.getByRole('button', { name: 'Verificar e entrar' }).click();

    await expect(page).toHaveURL(/\/agenda$/);
    expect(await page.locator('body').innerText()).not.toContain('desafioMfa');
  });
});

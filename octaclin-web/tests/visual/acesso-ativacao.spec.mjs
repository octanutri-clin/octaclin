import { expect, test } from '@playwright/test';

test.describe('acesso e ativacao - Fase 191', () => {
  test('login: alterna visibilidade da senha', async ({ page }) => {
    await page.goto('/login');

    const senha = page.locator('#senha');
    await senha.fill('SenhaTeste@123');
    await expect(senha).toHaveAttribute('type', 'password');

    const alternar = page.getByRole('button', { name: 'Mostrar senha' });
    await alternar.click();
    await expect(senha).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Ocultar senha' })).toBeVisible();

    await page.getByRole('button', { name: 'Ocultar senha' }).click();
    await expect(senha).toHaveAttribute('type', 'password');
  });

  test('login: avisa quando Caps Lock esta ativo', async ({ page }) => {
    await page.goto('/login');

    const senha = page.locator('#senha');
    await expect(page.getByText('Caps Lock ativado.')).toHaveCount(0);

    // Playwright nao emula o estado real de trava do Caps Lock do SO, entao o
    // handler e exercitado disparando o mesmo evento nativo que o navegador
    // envia, com getModifierState forcado - testa a logica real do
    // componente sem depender de emulacao de teclado do sistema operacional.
    await senha.evaluate((elemento) => {
      const evento = new KeyboardEvent('keyup', { bubbles: true, key: 'a' });
      Object.defineProperty(evento, 'getModifierState', { value: () => true });
      elemento.dispatchEvent(evento);
    });
    await expect(page.getByText('Caps Lock ativado.')).toBeVisible();

    await senha.evaluate((elemento) => {
      const evento = new KeyboardEvent('keyup', { bubbles: true, key: 'a' });
      Object.defineProperty(evento, 'getModifierState', { value: () => false });
      elemento.dispatchEvent(evento);
    });
    await expect(page.getByText('Caps Lock ativado.')).toHaveCount(0);
  });

  test('recuperar-senha: distingue link expirado de link invalido', async ({ page }) => {
    await page.route('**/api/auth/recuperar-senha/validar', async (route) => {
      await route.fulfill({
        status: 410,
        contentType: 'application/json',
        body: JSON.stringify({ mensagem: 'Token de redefinicao expirado.' })
      });
    });

    await page.goto('/recuperar-senha?token=token-expirado');
    await expect(page.getByRole('heading', { name: 'Link expirado' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Solicitar novo link' })).toHaveAttribute('href', '/esqueci-senha');
  });

  test('recuperar-senha: mostra link invalido separado de expirado', async ({ page }) => {
    await page.route('**/api/auth/recuperar-senha/validar', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ mensagem: 'Token de redefinicao invalido.' })
      });
    });

    await page.goto('/recuperar-senha?token=token-invalido');
    await expect(page.getByRole('heading', { name: 'Link nao encontrado' })).toBeVisible();
  });

  test('recuperar-senha: alterna visibilidade dos dois campos de senha', async ({ page }) => {
    await page.route('**/api/auth/recuperar-senha/validar', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ email: 'paciente@example.com', expiraEm: '2026-08-01T12:00:00.000Z' })
      });
    });

    await page.goto('/recuperar-senha?token=token-valido');
    await expect(page.getByRole('heading', { name: 'Nova senha' })).toBeVisible();

    const novaSenha = page.locator('#nova-senha');
    const confirmar = page.locator('#confirmar-senha');
    await expect(novaSenha).toHaveAttribute('type', 'password');
    await expect(confirmar).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Mostrar senha' }).first().click();
    await expect(novaSenha).toHaveAttribute('type', 'text');
    await expect(confirmar).toHaveAttribute('type', 'password');
  });
});

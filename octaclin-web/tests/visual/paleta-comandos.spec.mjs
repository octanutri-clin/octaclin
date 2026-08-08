import { expect, test } from '@playwright/test';

const sessao = {
  autenticado: true,
  apiUrl: 'http://localhost:3001',
  tenantSlug: 'clinica-sintetica',
  email: 'profissional@octaclin.local',
  expiraEm: '2026-08-08T18:00:00.000Z',
  papel: 'Professional',
  permissoes: [
    'console.acessar',
    'dashboard.ler',
    'agenda.consultas.ler',
    'agenda.consultas.criar',
    'pacientes.listar',
    'pacientes.ler',
    'questionarios.ler',
    'comunicacoes.mensagens.ler',
    'operacoes.auditoria.ler'
  ],
  destinoInicial: '/pacientes'
};

async function preparar(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/pacientes'), domain: 'localhost', path: '/' }
  ]);

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(sessao)
  }));
  await page.route('**/api/notificacoes**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ itens: [], naoLidas: 0 })
  }));
  await page.route('**/api/profissionais**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      itens: [{
        id: 'profissional-1',
        tenantId: 'tenant-1',
        usuarioId: 'usuario-1',
        nome: 'Dra. Sintetica',
        especialidade: 'Nutricao',
        criadoEm: '2026-08-01T10:00:00.000Z'
      }],
      total: 1
    })
  }));
  await page.route('**/api/pacientes**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      itens: [{
        id: 'paciente-1',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1',
        nome: 'Ana Sintetica',
        statusAdesao: 'novo',
        scoreRisco: '0',
        criadoEm: '2026-08-01T10:00:00.000Z'
      }],
      total: 1
    })
  }));
}

test('paleta respeita permissao, busca paciente e funciona por teclado', async ({ page }) => {
  await preparar(page);
  await page.goto('/pacientes');

  await expect(page.getByRole('button', { name: /Buscar no OctaClin/ })).toBeVisible();
  await page.keyboard.press('Control+K');
  const dialogo = page.getByRole('dialog', { name: 'Buscar no OctaClin' });
  const campo = dialogo.getByRole('combobox');
  await expect(dialogo).toBeVisible();
  await expect(campo).toBeFocused();
  await expect(dialogo.getByRole('option', { name: /Operacoes/ })).toHaveCount(0);
  await expect(dialogo.getByRole('option', { name: /Novo paciente/ })).toHaveCount(0);

  await campo.fill('Ana');
  await expect(dialogo.getByRole('option', { name: /Ana Sintetica/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/pacientes\/paciente-1$/);
});

test('gatilho restaura foco, escape fecha e modal nao cria overflow', async ({ page }) => {
  await preparar(page);
  await page.goto('/pacientes');

  const gatilho = page.getByRole('button', { name: /Buscar no OctaClin/ });
  await gatilho.click();
  const dialogo = page.getByRole('dialog', { name: 'Buscar no OctaClin' });
  await expect(dialogo).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();
  await expect(gatilho).toBeFocused();
});

test('sequencia global executa apenas comando permitido', async ({ page }) => {
  await preparar(page);
  await page.goto('/pacientes');

  await page.keyboard.press('g');
  await page.keyboard.press('a');
  await expect(page).toHaveURL(/\/agenda$/);
});

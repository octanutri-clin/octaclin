import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const confirmacao = 'Se os dados estiverem corretos, enviaremos um link de redefinição de senha.';
const privado = 'Detalhe interno sintético não autorizado';
const endpoint = '**/api/auth/recuperar-senha';
const aviso = page => page.locator('form').getByRole('status');
const erro = page => page.locator('form').getByRole('alert');

async function abrir(page, email = 'conta@example.test') {
  await page.goto('/esqueci-senha');
  await page.getByLabel('Email', { exact: true }).fill(email);
}

async function renderizar(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('respostas elegível e não elegível recebem a mesma orientação pública e retry explícito', async ({ page }) => {
  let pedidos = 0;
  await page.route(endpoint, async route => {
    pedidos++;
    await route.fulfill({ json: { mensagem: pedidos === 1 ? 'Conta existe' : 'Conta não existe' } });
  });
  await abrir(page);
  await page.getByRole('button', { name: 'Enviar link', exact: true }).click();
  await expect(aviso(page)).toContainText(confirmacao);
  await expect(aviso(page)).toContainText('spam ou lixo eletrônico');
  await expect(aviso(page)).toBeFocused();
  const primeiraMensagem = await aviso(page).innerText();
  await page.getByLabel('Email', { exact: true }).fill('outra@example.test');
  await page.getByRole('button', { name: 'Enviar link', exact: true }).click();
  await expect(aviso(page)).toContainText(confirmacao);
  expect(await aviso(page).innerText()).toBe(primeiraMensagem);
  expect(pedidos).toBe(2);
  await page.getByRole('button', { name: 'Solicitar novamente', exact: true }).click();
  await expect(aviso(page)).toBeFocused();
  expect(pedidos).toBe(3);
  const axe = await new AxeBuilder({ page }).exclude('nextjs-portal').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);
});

test('corrigir email mantém o campo e remove a confirmação e link de diagnóstico anteriores', async ({ page }) => {
  let pedidos = 0;
  const link = 'http://localhost/recuperar-senha?token=capability-sintetica';
  await page.route(endpoint, async route => { pedidos++; await route.fulfill({ json: { mensagem: 'ok', linkRecuperacao: link } }); });
  await abrir(page);
  await page.getByRole('button', { name: 'Enviar link', exact: true }).click();
  await expect(page.getByText(link, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Corrigir email', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('conta@example.test');
  await expect(aviso(page)).toHaveCount(0);
  await expect(page.getByText(link, { exact: true })).toHaveCount(0);
  expect(pedidos).toBe(1);
});

test('resposta de email anterior não confirma o endereço editado durante o pedido', async ({ page }) => {
  let liberar;
  let pedidos = 0;
  const pendente = new Promise(resolve => { liberar = resolve; });
  await page.route(endpoint, async route => {
    pedidos++;
    if (pedidos === 1) await pendente;
    await route.fulfill({ json: { mensagem: 'ok' } });
  });
  await abrir(page);
  await page.getByRole('button', { name: 'Enviar link', exact: true }).click();
  await expect.poll(() => pedidos).toBe(1);
  await page.getByLabel('Email', { exact: true }).fill('corrigido@example.test');
  liberar();
  await expect(page.getByRole('button', { name: 'Enviar link', exact: true })).toBeEnabled();
  await renderizar(page);
  await expect(aviso(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Enviar link', exact: true }).click();
  await expect(aviso(page)).toContainText(confirmacao);
  expect(pedidos).toBe(2);
});

test('dois submits no mesmo evento geram apenas um pedido pendente', async ({ page }) => {
  let liberar;
  const pendente = new Promise(resolve => { liberar = resolve; });
  let pedidos = 0;
  await page.route(endpoint, async route => { pedidos++; await pendente; await route.fulfill({ json: { mensagem: 'ok' } }); });
  await abrir(page);
  try {
    await page.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await expect.poll(() => pedidos).toBe(1);
    await expect(page.locator('form')).toHaveAttribute('aria-busy', 'true');
  } finally { liberar(); }
  await expect(aviso(page)).toContainText(confirmacao);
  expect(pedidos).toBe(1);
});

test('limite sem prazo informado não inventa contador e permite tentativa manual sujeita ao servidor', async ({ page }) => {
  let pedidos = 0;
  await page.route(endpoint, async route => { pedidos++; await route.fulfill({ status: 429, json: { mensagem: privado } }); });
  await abrir(page);
  await page.getByRole('button', { name: 'Enviar link', exact: true }).click();
  await expect(erro(page)).toHaveText('Muitas solicitações. Aguarde antes de tentar novamente.');
  await expect(erro(page)).toBeFocused();
  await expect(erro(page)).not.toContainText(/\d/);
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(erro(page)).toBeFocused();
  expect(pedidos).toBe(2);
});

for (const modo of ['servidor', 'rede']) {
  test(`falha de ${modo} é pública, mantém email e recupera após tentativa explícita`, async ({ page }) => {
    let pedidos = 0;
    await page.route(endpoint, async route => {
      pedidos++;
      if (pedidos > 1) return route.fulfill({ json: { mensagem: 'ok' } });
      if (modo === 'rede') return route.abort('failed');
      await route.fulfill({ status: 503, json: { mensagem: privado } });
    });
    await abrir(page);
    await page.getByRole('button', { name: 'Enviar link', exact: true }).click();
    await expect(erro(page)).toHaveText('Não foi possível solicitar a recuperação agora. Tente novamente em instantes.');
    await expect(erro(page)).toBeFocused();
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue('conta@example.test');
    await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    await expect(aviso(page)).toContainText(confirmacao);
    expect(pedidos).toBe(2);
  });
}

test('email inválido não é enviado ao servidor', async ({ page }) => {
  let pedidos = 0;
  await page.route(endpoint, async route => { pedidos++; await route.fulfill({ json: { mensagem: 'ok' } }); });
  await abrir(page, 'email-invalido');
  await page.getByRole('button', { name: 'Enviar link', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
  await renderizar(page);
  expect(pedidos).toBe(0);
});

test('email aceito pelo navegador mas rejeitado pelo servidor recebe orientação segura para conferência', async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ status: 400, json: { mensagem: privado } }));
  await abrir(page, 'conta@example');
  await page.getByRole('button', { name: 'Enviar link', exact: true }).click();
  await expect(erro(page)).toHaveText('Não foi possível concluir a solicitação. Confira o email informado e tente novamente.');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('conta@example');
  await expect(erro(page)).not.toContainText(privado);
});

test('resposta malformada não apresenta confirmação de uma solicitação válida', async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ json: { inesperado: true } }));
  await abrir(page);
  await page.getByRole('button', { name: 'Enviar link', exact: true }).click();
  await expect(erro(page)).toHaveText('Não foi possível solicitar a recuperação agora. Tente novamente em instantes.');
  await expect(aviso(page)).toHaveCount(0);
});

test('sair da página não recebe confirmação do pedido antigo', async ({ page }) => {
  let liberar;
  let recebido;
  const iniciou = new Promise(resolve => { recebido = resolve; });
  const pendente = new Promise(resolve => { liberar = resolve; });
  await page.route(endpoint, async route => { recebido(); await pendente; await route.fulfill({ json: { mensagem: 'ok' } }); });
  await abrir(page);
  await page.getByRole('button', { name: 'Enviar link', exact: true }).click();
  await iniciou;
  await page.getByRole('link', { name: 'Voltar para login' }).click();
  await expect(page).toHaveURL(/\/login$/);
  const terminou = page.waitForEvent('requestfinished', request => request.url().endsWith('/api/auth/recuperar-senha'));
  liberar();
  await terminou;
  await renderizar(page);
  await expect(page.getByText(confirmacao, { exact: true })).toHaveCount(0);
});

for (const motivo of ['expirado', 'usado', 'revogado']) {
  test(`link ${motivo} com HTTP410 tem saída genérica sem detalhe privado`, async ({ page }) => {
    await page.route('**/api/auth/recuperar-senha/validar', route => route.fulfill({ status: 410, json: { mensagem: `${privado}: ${motivo}` } }));
    await page.goto('/recuperar-senha?token=capability-sintetica');
    await expect(page.getByRole('heading', { name: 'Link indisponível', exact: true })).toBeVisible();
    await expect(page.getByText(privado, { exact: false })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Solicitar novo link' })).toHaveAttribute('href', '/esqueci-senha');
  });
}

test('falha na redefinição não exibe detalhe do servidor nem muda o payload de senha', async ({ page }) => {
  await page.route('**/api/auth/recuperar-senha/validar', route => route.fulfill({ json: { email: 'conta@example.test', expiraEm: '2099-01-01T00:00:00Z' } }));
  await page.route('**/api/auth/redefinir-senha', async route => {
    expect(route.request().postDataJSON()).toEqual({ token: 'capability-sintetica', senha: 'SenhaSintetica123' });
    await route.fulfill({ status: 503, json: { mensagem: privado } });
  });
  await page.goto('/recuperar-senha?token=capability-sintetica');
  await page.getByLabel('Nova senha', { exact: true }).fill('SenhaSintetica123');
  await page.getByLabel('Confirmar senha', { exact: true }).fill('SenhaSintetica123');
  await page.getByRole('button', { name: 'Redefinir senha', exact: true }).click();
  await expect(erro(page)).toHaveText('Não foi possível redefinir a senha agora. Confira os campos e tente novamente.');
  await expect(page.getByText(privado, { exact: true })).toHaveCount(0);
});

test('teclado e texto ampliado mantêm orientação, correção e navegação utilizáveis', async ({ page }, testInfo) => {
  await page.route(endpoint, route => route.fulfill({ json: { mensagem: 'ok' } }));
  await abrir(page);
  await page.keyboard.press('Enter');
  await expect(aviso(page)).toBeFocused();
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await aviso(page).screenshot({ path: testInfo.outputPath('orientacao-recuperacao.png') });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Solicitar novamente', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Corrigir email', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
});

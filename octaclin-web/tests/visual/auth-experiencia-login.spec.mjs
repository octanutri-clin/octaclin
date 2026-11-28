import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function preencher(page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('conta@example.test');
  await page.getByLabel('Senha', { exact: true }).fill(' SenhaSintetica123 ');
}

async function falhar(route, status = 401) {
  await route.fulfill({ status, json: { mensagem: 'Detalhe interno sintético não autorizado' } });
}

test('falha segura recebe foco, mantém os campos e compõe a descrição com Caps Lock', async ({ page }) => {
  await page.route('**/api/auth/login', route => falhar(route, 500));
  await preencher(page);
  const senha = page.getByLabel('Senha', { exact: true });
  await senha.dispatchEvent('keydown', { key: 'A', modifierCapsLock: true });
  await expect(page.getByText('Caps Lock ativado.')).toBeVisible();
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const aviso = page.locator('form').getByRole('alert');
  await expect(aviso).toHaveText('Não foi possível acessar o serviço agora. Tente novamente em instantes.');
  await expect(aviso).toBeFocused();
  await expect(senha).toHaveValue(' SenhaSintetica123 ');
  const idErro = await aviso.getAttribute('id');
  await expect(senha).toHaveAttribute('aria-describedby', `${idErro} senha-caps-lock`);
  await senha.focus();
  await senha.press('ArrowLeft');
  await expect(senha).toBeFocused();
  await expect(page.locator('form').getByRole('alert')).toBeVisible();
  await expect(senha).toHaveAttribute('aria-describedby', idErro);
  const axe = await new AxeBuilder({ page }).exclude('nextjs-portal').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);
});

test('falhas de credenciais não distinguem conta nem alteram a senha enviada', async ({ page }) => {
  let tentativas = 0;
  await page.route('**/api/auth/login', async route => {
    expect(route.request().postDataJSON()).toEqual({ email: 'conta@example.test', senha: ' SenhaSintetica123 ' });
    tentativas += 1;
    await route.fulfill({ status: 401, json: { mensagem: tentativas === 1 ? 'Conta inexistente' : 'Senha incorreta' } });
  });
  await preencher(page);
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText('Não foi possível entrar. Confira os dados de acesso e tente novamente.');
    await expect(page.locator('form').getByRole('alert')).toBeFocused();
    await page.getByLabel('Email', { exact: true }).focus();
  }
  expect(tentativas).toBe(2);
});

test('submissões simultâneas fazem uma tentativa e informam espera', async ({ page }) => {
  let liberar;
  const resposta = new Promise(resolve => { liberar = resolve; });
  let tentativas = 0;
  await page.route('**/api/auth/login', async route => {
    tentativas++;
    await resposta;
    await falhar(route);
  });
  await preencher(page);
  try {
    await page.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await expect.poll(() => tentativas).toBe(1);
    await expect(page.locator('form')).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('button', { name: 'Entrando' })).toBeDisabled();
  } finally { liberar(); }
  await expect(page.locator('form').getByRole('alert')).toBeVisible();
  expect(tentativas).toBe(1);
});

test('limite do servidor orienta esperar sem inventar prazo', async ({ page }) => {
  await page.route('**/api/auth/login', route => falhar(route, 429));
  await preencher(page);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('form').getByRole('alert')).toHaveText('Muitas tentativas. Aguarde antes de tentar novamente.');
});

test('falha ao preparar MFA mantém uma forma utilizável de tentar novamente', async ({ page }) => {
  let configuracoes = 0;
  await page.route('**/api/auth/login', route => route.fulfill({ json: { mfaObrigatorio: true, modo: 'configurar' } }));
  await page.route('**/api/auth/mfa/configuracao-login', async route => {
    configuracoes++;
    if (configuracoes === 1) return falhar(route, 503);
    await route.fulfill({ json: { segredo: 'CHAVE-SINTETICA', uri: '', expiraEm: '2099-01-01T00:00:00Z' } });
  });
  await preencher(page);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('form').getByRole('alert')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('');
  await page.getByLabel('Senha', { exact: true }).fill('SenhaSintetica123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Proteja sua conta' })).toBeVisible();
  await expect(page.getByLabel('Código de verificação')).toBeVisible();
  expect(configuracoes).toBe(2);
});

test('MFA orienta nova conferência sem expor erros internos e preserva normalização', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.fulfill({ json: { mfaObrigatorio: true, modo: 'verificar' } }));
  await page.route('**/api/auth/mfa/concluir-login', async route => {
    expect(route.request().postDataJSON()).toEqual({ codigo: 'AAAA-BBBB-CCCC' });
    await falhar(route);
  });
  await preencher(page);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const codigo = page.getByLabel('Código de verificação');
  await codigo.fill(' aaaa-bbbb-cccc ');
  await page.getByRole('button', { name: 'Verificar e entrar' }).click();
  const aviso = page.locator('form').getByRole('alert');
  await expect(aviso).toHaveText('Não foi possível verificar o código. Confira o código do aplicativo ou um código de recuperação e tente novamente.');
  await expect(aviso).toBeFocused();
  await expect(codigo).toHaveAttribute('aria-describedby', await aviso.getAttribute('id'));
});

test('validação nativa impede envio incompleto e mantém autocomplete', async ({ page }) => {
  let tentativas = 0;
  await page.route('**/api/auth/login', async route => { tentativas++; await falhar(route); });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Email', { exact: true })).toHaveAttribute('autocomplete', 'email');
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('autocomplete', 'current-password');
  expect(tentativas).toBe(0);
});

test('falha de rede permite tentar novamente sem detalhe técnico', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.abort('failed'));
  await preencher(page);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('form').getByRole('alert')).toHaveText('Não foi possível concluir a solicitação. Tente novamente.');
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
});

test('sucesso conserva a proteção contra redirecionamento externo', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.fulfill({ json: { destinoInicial: '/esqueci-senha' } }));
  await preencher(page);
  await page.goto('/login?redirect=https%3A%2F%2Fexample.test%2Ffora');
  await page.getByLabel('Email', { exact: true }).fill('conta@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('SenhaSintetica123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/esqueci-senha$/);
});

test('resposta tardia depois de sair do login não redireciona a nova página', async ({ page }) => {
  let responder;
  let recebida;
  const inicio = new Promise(resolve => { recebida = resolve; });
  const fim = new Promise(resolve => { responder = resolve; });
  await page.route('**/api/auth/login', async route => {
    recebida();
    await fim;
    await route.fulfill({ json: { destinoInicial: '/login?resposta-antiga=1' } });
  });
  await preencher(page);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await inicio;
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
  await expect(page).toHaveURL(/\/esqueci-senha$/);
  const concluida = page.waitForEvent('requestfinished', request => request.url().endsWith('/api/auth/login'));
  responder();
  await concluida;
  // Esperar o processamento da resposta e dois frames, sem espera arbitrária.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page).toHaveURL(/\/esqueci-senha$/);
});

test('teclado e texto ampliado preservam campos, foco e mensagem sem rolagem horizontal', async ({ page }, testInfo) => {
  await page.route('**/api/auth/login', route => falhar(route));
  await preencher(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const senha = page.getByLabel('Senha', { exact: true });
  await senha.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Mostrar senha', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(senha).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Entrar', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('form').getByRole('alert')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('login-texto-ampliado.png'), fullPage: true });
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const chave = 'CHAVE-SINTETICA-SEM-VALIDADE';
const codigos = ['AAAA-BBBB-CCCC', 'DDDD-EEEE-FFFF'];
const webUrl = process.env.E2E_WEB_URL ?? 'http://localhost:3000';

async function processarRenderizacao(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function clipboard(page, modo = 'pendente') {
  await page.addInitScript(({ modo }) => {
    window.__copiaTeste = { chamadas: [], resolver: undefined };
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: modo === 'ausente' ? undefined : {
        writeText(texto) {
          window.__copiaTeste.chamadas.push(texto);
          if (modo === 'sincrono') throw new DOMException('Detalhe sintético privado', 'SecurityError');
          if (modo === 'negado') return Promise.reject(new DOMException('Detalhe sintético privado', 'NotAllowedError'));
          return new Promise((resolve, reject) => { window.__copiaTeste.resolver = resolve; window.__copiaTeste.rejeitar = reject; });
        }
      }
    });
  }, { modo });
}

async function login(page, tipo = 'chave') {
  await page.route('**/api/auth/login', route => route.fulfill({ json: { mfaObrigatorio: true, modo: 'configurar' } }));
  await page.route('**/api/auth/mfa/configuracao-login', route => route.fulfill({ json: { segredo: chave, uri: '', expiraEm: '2099-01-01T00:00:00Z' } }));
  await page.route('**/api/auth/mfa/concluir-login', route => route.fulfill({ json: { codigosRecuperacao: codigos, destinoInicial: '/esqueci-senha' } }));
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('conta@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('SenhaSintetica123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Proteja sua conta' })).toBeVisible();
  if (tipo === 'codigos') {
    await page.getByLabel('Código de verificação').fill('123456');
    await page.getByRole('button', { name: 'Verificar e entrar' }).click();
    await expect(page.getByRole('heading', { name: 'Códigos de recuperação' })).toBeVisible();
  }
}

async function confirmarIdentidade(page) {
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Confirme sua senha').fill('SenhaSintetica123');
  await modal.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(modal).not.toBeVisible();
}

async function conta(page, tipo = 'chave') {
  const permissoes = ['console.acessar', 'agenda.consultas.ler'];
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', url: webUrl },
    { name: 'octaclin_refresh_token', value: 'fake', url: webUrl },
    { name: 'octaclin_papel', value: 'Professional', url: webUrl },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/agenda'), url: webUrl },
    { name: 'octaclin_permissoes', value: encodeURIComponent(JSON.stringify(permissoes)), url: webUrl }
  ]);
  await page.route('**/api/auth/session', route => route.fulfill({ json: {
    autenticado: true, papel: 'Professional', permissoes, destinoInicial: '/agenda',
    apiUrl: 'http://backend.test', tenantSlug: 'clinica-sintetica', email: 'conta@example.test', expiraEm: '2099-01-01T00:00:00Z'
  } }));
  await page.route('**/api/auth/sessoes*', route => route.fulfill({ json: { itens: [], pagina: 1, limite: 5, total: 0, totalPaginas: 1 } }));
  await page.route('**/api/auth/mfa', route => route.fulfill({ json: { obrigatorio: true, habilitado: true, codigosRecuperacaoDisponiveis: 2 } }));
  await page.route('**/api/auth/reautenticar', route => route.fulfill({ json: { confirmado: true, expiraEmSegundos: 300 } }));
  await page.route('**/api/auth/mfa/configuracao', route => route.fulfill({ json: { segredo: chave, uri: '', expiraEm: '2099-01-01T00:00:00Z' } }));
  await page.route('**/api/auth/mfa/configuracao/confirmar', route => route.fulfill({ json: { codigosRecuperacao: codigos } }));
  await page.goto('/conta/sessoes');
  await page.getByRole('button', { name: 'Trocar aplicativo' }).click();
  await confirmarIdentidade(page);
  await expect(page.getByText(chave, { exact: true })).toBeVisible();
  if (tipo === 'codigos') {
    await page.getByLabel('Código gerado').fill('123456');
    await page.getByRole('button', { name: 'Confirmar configuração' }).click();
    await expect(page.getByLabel('Novos códigos de recuperação')).toBeVisible();
  }
}

for (const [contexto, preparar] of [['login', login], ['conta', conta]]) {
  for (const tipo of ['chave', 'codigos']) {
    test(`${contexto}: ${tipo} só anuncia cópia após confirmação e preserva foco`, async ({ page }) => {
      await clipboard(page);
      await preparar(page, tipo);
      const rotulo = tipo === 'chave' ? 'Copiar chave' : 'Copiar códigos';
      const sucesso = tipo === 'chave' ? 'Chave copiada.' : 'Códigos copiados.';
      const botao = page.getByRole('button', { name: rotulo, exact: true });
      await botao.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('status').filter({ hasText: /^Copiando/ })).toBeVisible();
      await expect(page.getByText(sucesso, { exact: true })).toHaveCount(0);
      await expect(botao).toHaveAttribute('aria-busy', 'true');
      // Mesmo um segundo evento no botão não deve criar nova cópia pendente.
      await botao.dispatchEvent('click');
      expect(await page.evaluate(() => window.__copiaTeste.chamadas)).toEqual([tipo === 'chave' ? chave : codigos.join('\n')]);
      await page.evaluate(() => window.__copiaTeste.resolver());
      await expect(page.getByRole('status').filter({ hasText: sucesso })).toHaveText(sucesso);
      await expect(botao).toBeFocused();
      await expect(botao).toBeEnabled();
      await botao.click();
      await expect(page.getByRole('status').filter({ hasText: /^Copiando/ })).toBeVisible();
      await page.evaluate(() => window.__copiaTeste.resolver());
      await expect(page.getByRole('status').filter({ hasText: sucesso })).toHaveText(sucesso);
      expect(await page.evaluate(() => window.__copiaTeste.chamadas.length)).toBe(2);
      const resultado = await new AxeBuilder({ page }).exclude('nextjs-portal').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(resultado.violations).toEqual([]);
    });
  }
  for (const tipo of ['chave', 'codigos']) {
    for (const modo of ['negado', 'ausente', 'sincrono']) {
      test(`${contexto}: ${tipo} clipboard ${modo} orienta cópia manual sem detalhes privados`, async ({ page }, testInfo) => {
        const erros = [];
        page.on('pageerror', erro => erros.push(erro.message));
        await clipboard(page, modo);
        await preparar(page, tipo);
        const botao = page.getByRole('button', { name: tipo === 'chave' ? 'Copiar chave' : 'Copiar códigos', exact: true });
        await botao.click();
        const aviso = page.getByRole('status').filter({ hasText: 'Não foi possível copiar.' });
        await expect(aviso).toHaveText(`Não foi possível copiar. Selecione e copie manualmente ${tipo === 'chave' ? 'a chave exibida' : 'os códigos exibidos'}.`);
        await expect(aviso).not.toContainText(chave);
        await expect(page.getByText('Detalhe sintético privado')).toHaveCount(0);
        await expect(botao).toBeEnabled();
        await expect(page.getByText(tipo === 'chave' ? chave : codigos[0], { exact: true })).toBeVisible();
        expect(erros).toEqual([]);
        if (contexto === 'login' && tipo === 'chave' && modo === 'ausente') {
          await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        }
        await botao.locator('..').screenshot({ path: testInfo.outputPath('copia-manual.png') });
      });
    }
  }
}

test('login: concluir MFA descarta resposta de cópia da etapa anterior', async ({ page }) => {
  await clipboard(page);
  await login(page);
  await page.getByRole('button', { name: 'Copiar chave', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__copiaTeste.chamadas.length)).toBe(1);
  await page.getByLabel('Código de verificação').fill('123456');
  await page.getByRole('button', { name: 'Verificar e entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Códigos de recuperação' })).toBeVisible();
  await page.evaluate(() => window.__copiaTeste.resolver());
  await processarRenderizacao(page);
  await expect(page.getByText('Chave copiada.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Copiar códigos', exact: true }).click();
  await page.evaluate(() => window.__copiaTeste.resolver());
  await expect(page.getByRole('status').filter({ hasText: 'Códigos copiados.' })).toBeVisible();
});

test('conta: regenerar códigos invalida cópia antiga sem bloquear a nova', async ({ page }) => {
  await clipboard(page);
  await conta(page, 'codigos');
  const novos = ['GGGG-HHHH-IIII'];
  await page.route('**/api/auth/mfa/codigos-recuperacao', route => route.fulfill({ json: { codigosRecuperacao: novos } }));
  await page.getByRole('button', { name: 'Copiar códigos', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__copiaTeste.chamadas.length)).toBe(1);
  await page.evaluate(() => { window.__resolverAntigo = window.__copiaTeste.resolver; });
  await page.getByRole('button', { name: 'Gerar novos códigos', exact: true }).click();
  await confirmarIdentidade(page);
  await expect(page.getByText(novos[0], { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Copiar códigos', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__copiaTeste.chamadas.length)).toBe(2);
  await page.evaluate(() => window.__resolverAntigo());
  await processarRenderizacao(page);
  await expect(page.getByText('Códigos copiados.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: /^Copiando/ })).toBeVisible();
  await page.evaluate(() => window.__copiaTeste.resolver());
  await expect(page.getByRole('status').filter({ hasText: 'Códigos copiados.' })).toBeVisible();
});

test('conta: rejeição tardia da cópia anterior não substitui resultado atual', async ({ page }) => {
  const erros = [];
  page.on('pageerror', erro => erros.push(erro.message));
  await clipboard(page);
  await conta(page, 'codigos');
  await page.route('**/api/auth/mfa/codigos-recuperacao', route => route.fulfill({ json: { codigosRecuperacao: ['JJJJ-KKKK-LLLL'] } }));
  await page.getByRole('button', { name: 'Copiar códigos', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__copiaTeste.chamadas.length)).toBe(1);
  await page.evaluate(() => { window.__rejeitarAntigo = window.__copiaTeste.rejeitar; });
  await page.getByRole('button', { name: 'Gerar novos códigos', exact: true }).click();
  await confirmarIdentidade(page);
  await expect(page.getByText('JJJJ-KKKK-LLLL', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Copiar códigos', exact: true }).click();
  await page.evaluate(() => window.__copiaTeste.resolver());
  await expect(page.getByRole('status').filter({ hasText: 'Códigos copiados.' })).toBeVisible();
  await page.evaluate(() => window.__rejeitarAntigo(new Error('Detalhe sintético privado')));
  await processarRenderizacao(page);
  await expect(page.getByRole('status').filter({ hasText: 'Códigos copiados.' })).toBeVisible();
  await expect(page.getByText('Não foi possível copiar.', { exact: false })).toHaveCount(0);
  expect(erros).toEqual([]);
});

test('login: navegação durante cópia não anuncia resultado na página seguinte', async ({ page }) => {
  await clipboard(page);
  await login(page, 'codigos');
  await page.getByRole('button', { name: 'Copiar códigos', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__copiaTeste.chamadas.length)).toBe(1);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page).toHaveURL(/\/esqueci-senha$/);
  await page.evaluate(() => window.__copiaTeste.resolver());
  await processarRenderizacao(page);
  await expect(page.getByText('Códigos copiados.', { exact: true })).toHaveCount(0);
});

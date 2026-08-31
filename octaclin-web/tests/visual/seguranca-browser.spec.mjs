import { expect, test } from '@playwright/test';

const payloadXss = '<img src=x onerror="window.__octaclinXss=true">';

function diretivaCsp(politica, nome) {
  return politica
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${nome} `)) ?? '';
}

test.describe('PR 45 - navegador, BFF e cabecalhos', () => {
  test('CSP bloqueante usa nonce sem impedir a hidratacao autorizada', async ({ page }) => {
    const violacoes = [];
    page.on('console', (mensagem) => {
      if (/content security policy|refused to (execute|load|apply)/i.test(mensagem.text())) {
        violacoes.push(mensagem.text());
      }
    });

    const resposta = await page.goto('/login');
    expect(resposta).not.toBeNull();
    const politica = resposta.headers()['content-security-policy'] ?? '';
    const scriptSrc = diretivaCsp(politica, 'script-src');
    const nonce = scriptSrc.match(/'nonce-([^']+)'/)?.[1];

    expect(nonce).toBeTruthy();
    expect(scriptSrc).not.toContain("'unsafe-inline'");

    const scriptsInline = await page.locator('script:not([src])').evaluateAll((scripts) =>
      scripts
        .filter((script) => script.textContent?.trim())
        .map((script) => script.nonce)
    );
    expect(scriptsInline.length).toBeGreaterThan(0);
    expect(scriptsInline.every((valor) => valor === nonce)).toBe(true);

    await page.getByLabel('Email').fill('profissional.sintetico@example.test');
    await expect(page.getByLabel('Email')).toHaveValue('profissional.sintetico@example.test');
    expect(violacoes).toEqual([]);
  });

  test('navegador bloqueia CSRF e leitura CORS sem impedir mutacao same-origin', async ({ page }) => {
    await page.goto('/login');
    const mesmaOrigem = await page.evaluate(async () => {
      const resposta = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      return resposta.status;
    });
    expect(mesmaOrigem).toBe(400);

    const respostaCrossSite = await page.request.post('/api/auth/login', {
      data: {},
      headers: {
        Origin: 'https://ataque.example',
        'Sec-Fetch-Site': 'cross-site'
      }
    });

    expect(respostaCrossSite.status()).toBe(403);
    expect(respostaCrossSite.headers()['access-control-allow-origin']).toBeUndefined();
  });

  test('BFF e tela autenticada recusada nunca entram em cache compartilhado', async ({ request }) => {
    const sessao = await request.get('/api/auth/session');
    expect(sessao.status()).toBe(401);
    expect(sessao.headers()['cache-control']).toContain('no-store');
    expect(sessao.headers()['access-control-allow-origin']).toBeUndefined();

    const dashboard = await request.get('/dashboard', { maxRedirects: 0 });
    expect([307, 308]).toContain(dashboard.status());
    expect(dashboard.headers()['cache-control']).toContain('no-store');
  });

  test('mensagem hostil permanece texto e nao executa XSS', async ({ page }) => {
    await page.route('**/api/auth/login', (route) => route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ mensagem: payloadXss })
    }));
    await page.goto('/login');
    await page.getByLabel('Email').fill('profissional.sintetico@example.test');
    await page.locator('#senha').fill('senha-sintetica');
    await page.getByRole('button', { name: /entrar/i }).click();

    await expect(page.locator('form [role="alert"]')).toContainText(payloadXss);
    expect(await page.evaluate(() => window.__octaclinXss)).toBeUndefined();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
  });

  test('destino hostil devolvido pelo login nao navega para origem externa', async ({ page }) => {
    let tentouOrigemExterna = false;
    await page.route('https://ataque.example/**', (route) => {
      tentouOrigemExterna = true;
      return route.abort();
    });
    await page.route('**/api/auth/login', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        email: 'profissional.sintetico@example.test',
        tenantSlug: 'tenant-sintetico',
        apiUrl: 'https://api.example.test',
        expiraEmSegundos: 900,
        destinoInicial: 'https://ataque.example/roubo'
      })
    }));
    await page.goto('/login');
    await page.getByLabel('Email').fill('profissional.sintetico@example.test');
    await page.locator('#senha').fill('senha-sintetica');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForTimeout(300);

    expect(tentouOrigemExterna).toBe(false);
    expect(new URL(page.url()).hostname).not.toBe('ataque.example');
  });
});

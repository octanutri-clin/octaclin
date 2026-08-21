import { expect, test } from '@playwright/test';

const webUrl = process.env.E2E_WEB_URL ?? 'http://localhost:3000';

async function responderJson(route, body, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function prepararPainel(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', url: webUrl },
    { name: 'octaclin_refresh_token', value: 'fake', url: webUrl },
    { name: 'octaclin_papel', value: 'Professional', url: webUrl },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/dashboard'), url: webUrl }
  ]);

  await page.route('**/api/auth/session', (route) => responderJson(route, {
    autenticado: true,
    apiUrl: 'http://backend.sintetico.local',
    tenantSlug: 'clinica-sintetica',
    email: 'profissional.sintetico@example.com',
    expiraEm: '2026-08-21T12:00:00.000Z',
    papel: 'Professional',
    permissoes: ['console.acessar', 'dashboard.ler'],
    destinoInicial: '/dashboard'
  }));
  await page.route('**/api/notificacoes**', (route) => responderJson(route, { naoLidas: 0, itens: [] }));
  await page.route('**/api/dashboard/clinico?**', (route) => responderJson(route, {
    contexto: { periodo: 'hoje', inicioEm: '2026-08-20T00:00:00.000Z', fimEm: '2026-08-20T23:59:59.999Z' },
    indicadores: {
      consultasHoje: 0, proximas: 0, concluidas: 0, reagendadas: 0, canceladas: 0, faltas: 0,
      semRetorno30: 0, semRetorno60: 0, semRetorno90Mais: 0, formulariosPendentes: 0,
      tarefasVencidas: 0, solicitacoesPendentes: 0, comunicacoesEmAlerta: 0, pacientesRiscoAlto: 0
    },
    atendimentos: [], semRetorno: [], tarefasVencidas: [], formulariosPendentes: [],
    solicitacoesPendentes: [], comunicacoes: [], alertas: [], selecaoObrigatoria: false
  }));
}

async function conferirFocoVisivel(page) {
  await page.keyboard.press('Tab');
  const foco = await page.evaluate(() => {
    const elemento = document.activeElement;
    if (!elemento || elemento === document.body) return null;
    const estilo = getComputedStyle(elemento);
    return { outline: estilo.outlineStyle, largura: estilo.outlineWidth, sombra: estilo.boxShadow };
  });
  expect(foco).not.toBeNull();
  expect((foco.outline !== 'none' && foco.largura !== '0px') || foco.sombra !== 'none').toBe(true);
}

test.describe('Fase 251 - linguagem e microcopy', () => {
  test('painel profissional usa voz canônica em desktop e celular', async ({ page }, testInfo) => {
    await prepararPainel(page);

    for (const viewport of [{ nome: 'desktop', width: 1440, height: 1000 }, { nome: 'mobile', width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Painel clínico', exact: true })).toBeVisible();
      await expect(page.getByText('Prioridades diárias, pendências e próximos atendimentos.')).toBeVisible();
      await expect(page.locator('body')).not.toContainText(/\b(Dashboard|Status|Nao|Formulario|Proximos|Comunicacoes)\b/);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await conferirFocoVisivel(page);
      await page.screenshot({ path: testInfo.outputPath(`painel-${viewport.nome}.png`), fullPage: true });
    }
  });
});

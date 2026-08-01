import { expect, test } from '@playwright/test';

const perguntaId = '11111111-1111-4111-8111-111111111111';

async function prepararFormulario(page) {
  let rascunho = [];
  let versao = 0;
  let respostaFinal = null;

  await page.route('**/api/formularios/token-publico', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        envioId: 'envio-1',
        titulo: 'Check-in semanal',
        status: 'enviado',
        rascunhoVersao: versao,
        respostasRascunho: rascunho,
        perguntas: [{
          id: perguntaId,
          tipo: 'sim_nao',
          enunciado: 'Conseguiu seguir o plano?',
          obrigatoria: true,
          configuracao: { rotuloSim: 'Sim', rotuloNao: 'Nao' },
          opcoes: [],
          ordem: 1
        }]
      })
    });
  });

  await page.route('**/api/formularios/token-publico/rascunho', async (route) => {
    const corpo = route.request().postDataJSON();
    expect(corpo.versaoBase).toBe(versao);
    rascunho = corpo.respostas;
    versao += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rascunhoVersao: versao, rascunhoAtualizadoEm: new Date().toISOString() })
    });
  });

  await page.route('**/api/formularios/token-publico/respostas', async (route) => {
    respostaFinal = route.request().postDataJSON();
    rascunho = [];
    versao = 0;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ envioId: 'envio-1', status: 'respondido', respondidoEm: new Date().toISOString() })
    });
  });

  return { respostaFinal: () => respostaFinal };
}

test.describe('formulario publico com rascunho', () => {
  test('salva, retoma e finaliza sem armazenamento local', async ({ page }) => {
    const formulario = await prepararFormulario(page);
    await page.goto('/formularios/token-publico');

    await page.getByRole('button', { name: 'Sim' }).click();
    await expect(page.getByText('Rascunho salvo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sim' })).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(page.getByRole('button', { name: 'Sim' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);

    await page.getByRole('button', { name: 'Enviar respostas' }).click();
    await expect.poll(() => formulario.respostaFinal()).toEqual({
      respostas: [{ perguntaId, valor: true }]
    });
    await expect(page.getByRole('heading', { name: 'Respostas enviadas' })).toBeVisible();
  });
});

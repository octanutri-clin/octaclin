import { expect, test } from '@playwright/test';

const perguntaId = '11111111-1111-4111-8111-111111111111';
const perguntaUploadId = '22222222-2222-4222-8222-222222222222';

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

  test('envia arquivo real e responde com o id confirmado', async ({ page }) => {
    let respostaFinal = null;
    await page.route('**/api/formularios/token-upload', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        envioId: 'envio-1', titulo: 'Envio de exame', status: 'enviado', rascunhoVersao: 0, respostasRascunho: [],
        perguntas: [{ id: perguntaUploadId, tipo: 'upload_midia', enunciado: 'Anexe o exame', obrigatoria: true, configuracao: { tiposAceitos: ['application/pdf'], maxArquivos: 1 }, opcoes: [], ordem: 1 }]
      }) });
    });
    await page.route('**/api/formularios/token-upload/anexos', async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
        arquivo: { id: '33333333-3333-4333-8333-333333333333' }, uploadUrl: 'https://upload.example/exame', uploadHeaders: { 'Content-Type': 'application/pdf' }
      }) });
    });
    await page.route('https://upload.example/**', async (route) => route.fulfill({ status: 200, body: '' }));
    await page.route('**/api/formularios/token-upload/anexos/*/confirmacao', async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: '33333333-3333-4333-8333-333333333333' }) });
    });
    await page.route('**/api/formularios/token-upload/rascunho', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rascunhoVersao: 1, rascunhoAtualizadoEm: new Date().toISOString() }) });
    });
    await page.route('**/api/formularios/token-upload/respostas', async (route) => {
      respostaFinal = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ envioId: 'envio-1', status: 'respondido', respondidoEm: new Date().toISOString() }) });
    });

    await page.goto('/formularios/token-upload');
    await page.getByLabel('Anexe o exame').setInputFiles({ name: 'exame.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 sintetico') });
    await expect(page.getByText('1 arquivo(s) anexado(s)')).toBeVisible();
    await page.getByRole('button', { name: 'Enviar respostas' }).click();

    await expect.poll(() => respostaFinal).toEqual({ respostas: [{ perguntaId: perguntaUploadId, valor: ['33333333-3333-4333-8333-333333333333'] }] });
  });
});

test.describe('formulario publico - indisponibilidade e recuperacao', () => {
  test('mostra mensagem segura ao falhar o carregamento e recupera com Tentar novamente', async ({ page }) => {
    // `permitirSucesso` (nao uma contagem de tentativas) decide a resposta:
    // o React 19/Next dev dispara o efeito de carregamento duas vezes por
    // montagem (comportamento conhecido do modo de desenvolvimento, nao do
    // clique do usuario), e uma contagem fixa de tentativas correria contra
    // essa segunda chamada automatica. Com uma flag, as duas chamadas do
    // carregamento inicial falham igualmente; so a chamada apos o clique
    // explicito em "Tentar novamente" (que so ocorre depois que o teste
    // libera a flag) tem sucesso.
    let permitirSucesso = false;
    let totalChamadas = 0;
    await page.route('**/api/formularios/token-instavel', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      totalChamadas += 1;
      if (!permitirSucesso) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ statusCode: 500, message: 'Internal server error' })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          envioId: 'envio-1',
          titulo: 'Check-in semanal',
          status: 'enviado',
          rascunhoVersao: 0,
          respostasRascunho: [],
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

    await page.goto('/formularios/token-instavel');

    // A mensagem exibida ao paciente nunca deve repetir o corpo/mensagem cru
    // devolvido pelo backend (ex.: "Internal server error"): isso vazaria
    // detalhe interno e quebraria a voz em portugues do produto.
    await expect(page.getByText('Não foi possível carregar o formulário agora.')).toBeVisible();
    await expect(page.getByText('Internal server error')).toHaveCount(0);
    expect(totalChamadas).toBeGreaterThan(0);

    const botaoTentarNovamente = page.getByRole('button', { name: 'Tentar novamente' });
    await expect(botaoTentarNovamente).toBeVisible();
    permitirSucesso = true;
    await botaoTentarNovamente.click();

    await expect(page.getByRole('heading', { name: 'Check-in semanal' })).toBeVisible();
  });
});

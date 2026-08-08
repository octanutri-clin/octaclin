import { expect, test } from '@playwright/test';

const portalVazio = {
  paciente: { id: 'paciente-1', nome: 'Paciente Teste', statusAdesao: 'aderente' },
  perfil: {
    email: 'paciente@example.test',
    preferenciasContato: {
      email: true,
      whatsapp: false,
      canalPreferido: 'email',
      horarioPermitido: { inicio: '08:00', fim: '20:00', timezone: 'America/Sao_Paulo' }
    },
    profissionalResponsavelId: 'profissional-1'
  },
  resumo: { consultasProximas: 0, formulariosPendentes: 0, formulariosRespondidos: 0, mensagensRecentes: 0 },
  consultasProximas: [],
  formulariosPendentes: [],
  formulariosRespondidos: [],
  mensagensRecentes: [],
  diariosRecentes: [],
  lgpd: { versaoAtual: '2026-08', documentosLegais: [], consentimentos: [], solicitacoes: [] }
};

async function prepararPortal(page) {
  let falharCheckin = true;
  let sincronizados = 0;
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Patient', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/portal'), domain: 'localhost', path: '/' }
  ]);
  await page.route((url) => url.pathname === '/api/portal/paciente', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(portalVazio)
  }));
  await page.route((url) => url.pathname === '/api/portal/paciente/checkins', async (route) => {
    if (falharCheckin) return route.abort('internetdisconnected');
    sincronizados += 1;
    const entrada = route.request().postDataJSON();
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'checkin-sincronizado', pacienteId: 'paciente-1', tipo: 'humor',
        humor: entrada.humor, adesaoPlano: entrada.adesaoPlano, registradoEm: new Date().toISOString()
      })
    });
  });
  await page.route((url) => url.pathname === '/api/auth/sair', async (route) => {
    await page.context().clearCookies();
    await route.fulfill({ status: 204, body: '' });
  });
  return {
    liberar: () => { falharCheckin = false; },
    bloquear: () => { falharCheckin = true; },
    sincronizados: () => sincronizados
  };
}

async function preencherCheckin(page, observacao) {
  await page.getByLabel('Humor de hoje').selectOption('bem');
  await page.getByLabel('Adesao ao plano').fill('85');
  await page.getByLabel('Observacoes do dia').fill(observacao);
  await page.getByRole('button', { name: 'Registrar check-in' }).click();
}

async function lerFila(page) {
  return page.evaluate(async () => {
    const banco = await new Promise((resolve, reject) => {
      const requisicao = indexedDB.open('octaclin-pwa-private-v1', 1);
      requisicao.onsuccess = () => resolve(requisicao.result);
      requisicao.onerror = () => reject(requisicao.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const requisicao = banco.transaction('operacoes').objectStore('operacoes').getAll();
        requisicao.onsuccess = () => resolve(requisicao.result);
        requisicao.onerror = () => reject(requisicao.error);
      });
    } finally {
      banco.close();
    }
  });
}

test('manifest e service worker publicos estao disponiveis', async ({ request }) => {
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).start_url).toBe('/portal');
  const sw = await request.get('/sw.js');
  expect(sw.ok()).toBeTruthy();
  expect(sw.headers()['cache-control']).toContain('no-store');
});

test('check-in offline fica cifrado, sincroniza uma vez e e purgado no logout', async ({ page }) => {
  const controle = await prepararPortal(page);
  await page.goto('/portal/checkins');
  await expect(page.getByRole('heading', { name: 'Check-in rapido' })).toBeVisible();

  await preencherCheckin(page, 'Dado clinico que nao pode aparecer em claro.');
  await expect(page.getByText(/salvo neste dispositivo/i)).toBeVisible();
  const fila = await lerFila(page);
  expect(fila).toHaveLength(1);
  expect(JSON.stringify(fila)).not.toContain('Dado clinico');
  expect(fila[0]).toHaveProperty('cifra');

  controle.liberar();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => controle.sincronizados()).toBe(1);
  await expect.poll(async () => (await lerFila(page)).length).toBe(0);

  controle.bloquear();
  await preencherCheckin(page, 'Outro dado privado temporario.');
  await expect.poll(async () => (await lerFila(page)).length).toBe(1);
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login/);
  // O runtime global da pagina de login pode recriar o conteiner vazio. O gate
  // de privacidade e nao restar nenhum payload da sessao encerrada.
  await expect.poll(async () => (await lerFila(page)).length).toBe(0);
});

test('formulario sem anexo pode ser finalizado offline e sincroniza ao reconectar', async ({ page }) => {
  let falharEnvio = true;
  let enviosConcluidos = 0;
  await page.route((url) => url.pathname === '/api/formularios/token-pwa', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      envioId: 'envio-pwa', titulo: 'Check-in offline', status: 'enviado', rascunhoVersao: 0,
      perguntas: [{
        id: 'pergunta-1', tipo: 'texto_longo', enunciado: 'Como voce esta?', obrigatoria: true,
        configuracao: { secao: 'Hoje', limiteCaracteres: 500 }, opcoes: [], ordem: 1
      }]
    })
  }));
  await page.route((url) => url.pathname === '/api/formularios/token-pwa/rascunho', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ rascunhoVersao: 1, rascunhoAtualizadoEm: new Date().toISOString() })
  }));
  await page.route((url) => url.pathname === '/api/formularios/token-pwa/respostas', async (route) => {
    if (falharEnvio) return route.abort('internetdisconnected');
    enviosConcluidos += 1;
    return route.fulfill({
      status: 201, contentType: 'application/json',
      body: JSON.stringify({ envioId: 'envio-pwa', status: 'respondido', respondidoEm: new Date().toISOString() })
    });
  });

  await page.goto('/formularios/token-pwa');
  await page.getByRole('textbox').fill('Resposta privada mantida apenas nesta sessao.');
  await page.getByRole('button', { name: 'Enviar respostas' }).click();
  await expect(page.getByRole('heading', { name: 'Respostas salvas neste dispositivo' })).toBeVisible();
  const fila = await lerFila(page);
  expect(fila).toHaveLength(1);
  expect(JSON.stringify(fila)).not.toContain('Resposta privada');

  falharEnvio = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => enviosConcluidos).toBe(1);
  await expect(page.getByRole('heading', { name: 'Respostas enviadas' })).toBeVisible();
  await expect.poll(async () => (await lerFila(page)).length).toBe(0);
});

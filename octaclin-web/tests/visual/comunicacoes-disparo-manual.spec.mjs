import { expect, test } from '@playwright/test';

async function prepararConsoleComunicacoes(page, { pacienteOptOutWhatsapp = false } = {}) {
  let chamouDisparo = 0;
  let ultimoCorpoDisparo = null;

  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/comunicacoes'), domain: 'localhost', path: '/' }
  ]);

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        autenticado: true,
        apiUrl: 'http://localhost:3001',
        tenantSlug: 'clinica-carla',
        email: 'dra.carla@octaclin.local',
        expiraEm: '2026-07-22T15:00:00.000Z',
        papel: 'Professional',
        permissoes: ['comunicacoes.mensagens.ler', 'comunicacoes.mensagens.enviar'],
        destinoInicial: '/comunicacoes'
      })
    });
  });

  await page.route('**/api/comunicacoes/canais', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'canal-whatsapp-1', tipo: 'whatsapp', nome: 'WhatsApp OctaClin', ativo: true, configuracao: {} }
      ])
    });
  });

  await page.route('**/api/comunicacoes/templates', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'template-whatsapp-1',
          canal: 'whatsapp',
          codigoExterno: 'hello_world',
          nome: 'Lembrete WhatsApp',
          conteudo: { idioma: 'pt_BR' },
          aprovado: true
        }
      ])
    });
  });

  await page.route('**/api/comunicacoes/mensagens', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      return;
    }
    chamouDisparo += 1;
    ultimoCorpoDisparo = route.request().postDataJSON();
    if (pacienteOptOutWhatsapp && !ultimoCorpoDisparo.ignorarOptOut) {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 409,
          message: 'O paciente optou por nao receber mensagens neste canal. Confirme para enviar mesmo assim.',
          error: 'Conflict'
        })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'mensagem-nova-1',
        tenantId: 'tenant-1',
        pacienteId: 'paciente-1',
        canalId: 'canal-whatsapp-1',
        templateId: 'template-whatsapp-1',
        status: 'pendente',
        payload: { destino: '5511999999999' },
        criadoEm: '2026-07-22T12:00:00.000Z'
      })
    });
  });

  await page.route('**/api/pacientes**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        itens: [
          { id: 'paciente-1', tenantId: 'tenant-1', nome: 'Ana Souza', statusAdesao: 'aderente', scoreRisco: '10', criadoEm: '2026-07-01T10:00:00.000Z' }
        ],
        total: 1
      })
    });
  });

  await page.route('**/api/profissionais**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        itens: [{ id: 'profissional-1', tenantId: 'tenant-1', nome: 'Dra. Carla', criadoEm: '2026-07-01T10:00:00.000Z' }],
        total: 1
      })
    });
  });

  return {
    chamouDisparo: () => chamouDisparo,
    ultimoCorpoDisparo: () => ultimoCorpoDisparo
  };
}

test.describe('disparo manual de mensagens - opt-out', () => {
  test('exige confirmacao explicita quando o paciente optou por nao receber no canal, e permite confirmar o envio', async ({ page }) => {
    const console_ = await prepararConsoleComunicacoes(page, { pacienteOptOutWhatsapp: true });
    await page.goto('/comunicacoes');

    await page.getByRole('tab', { name: 'Nova mensagem' }).click();
    await page.getByLabel('Paciente').selectOption('paciente-1');
    await page.getByLabel('Canal').selectOption('canal-whatsapp-1');
    await page.getByLabel('Template').selectOption('template-whatsapp-1');
    await page.getByLabel('WhatsApp de destino').fill('5511999999999');
    await page.getByRole('button', { name: 'Disparar' }).click();

    const dialogo = page.getByRole('dialog', { name: 'Paciente optou por não receber neste canal' });
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByText('Confirme para enviar mesmo assim.')).toBeVisible();
    expect(console_.chamouDisparo()).toBe(1);

    await dialogo.getByRole('button', { name: 'Enviar mesmo assim' }).click();

    await expect.poll(() => console_.chamouDisparo()).toBe(2);
    expect(console_.ultimoCorpoDisparo().ignorarOptOut).toBe(true);
    await expect(dialogo).toHaveCount(0);
    await expect(page.getByText(/Mensagem aguardando envio\./)).toBeVisible();
  });

  test('cancelar a confirmacao de opt-out nao envia a mensagem', async ({ page }) => {
    const console_ = await prepararConsoleComunicacoes(page, { pacienteOptOutWhatsapp: true });
    await page.goto('/comunicacoes');

    await page.getByRole('tab', { name: 'Nova mensagem' }).click();
    await page.getByLabel('Paciente').selectOption('paciente-1');
    await page.getByLabel('Canal').selectOption('canal-whatsapp-1');
    await page.getByLabel('Template').selectOption('template-whatsapp-1');
    await page.getByLabel('WhatsApp de destino').fill('5511999999999');
    await page.getByRole('button', { name: 'Disparar' }).click();

    const dialogo = page.getByRole('dialog', { name: 'Paciente optou por não receber neste canal' });
    await expect(dialogo).toBeVisible();

    await dialogo.getByRole('button', { name: 'Cancelar' }).click();

    await expect(dialogo).toHaveCount(0);
    expect(console_.chamouDisparo()).toBe(1);
  });

  test('paciente que autorizou o canal nao aciona confirmacao de opt-out', async ({ page }) => {
    const console_ = await prepararConsoleComunicacoes(page, { pacienteOptOutWhatsapp: false });
    await page.goto('/comunicacoes');

    await page.getByRole('tab', { name: 'Nova mensagem' }).click();
    await page.getByLabel('Paciente').selectOption('paciente-1');
    await page.getByLabel('Canal').selectOption('canal-whatsapp-1');
    await page.getByLabel('Template').selectOption('template-whatsapp-1');
    await page.getByLabel('WhatsApp de destino').fill('5511999999999');
    await page.getByRole('button', { name: 'Disparar' }).click();

    await expect(page.getByText(/Mensagem aguardando envio\./)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(console_.chamouDisparo()).toBe(1);
  });
});

import { expect, test } from '@playwright/test';

async function prepararSessao(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'SuperAdmin', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/dashboard'), domain: 'localhost', path: '/' }
  ]);

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      autenticado: true,
      papel: 'SuperAdmin',
      apiUrl: 'http://localhost:3001',
      tenantSlug: 'clinica-octa',
      email: 'admin@octaclin.local',
      expiraEm: '2026-08-01T18:00:00.000Z',
      permissoes: ['comunicacoes.mensagens.ler', 'comunicacoes.mensagens.enviar', 'comunicacoes.canais.gerenciar', 'comunicacoes.templates.gerenciar', 'profissionais.ler', 'profissionais.gerenciar'],
      destinoInicial: '/dashboard'
    })
  }));

  await page.route('**/api/pacientes**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ itens: [{ id: 'paciente-1', nome: 'Ana Souza', contato: '5511999999999' }], total: 1 })
  }));
  await page.route('**/api/comunicacoes/canais', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: 'canal-1', tenantId: 'tenant-1', tipo: 'whatsapp', nome: 'WhatsApp principal', configuracao: {}, ativo: true }])
  }));
  await page.route('**/api/comunicacoes/templates', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: 'template-1', tenantId: 'tenant-1', canal: 'whatsapp', codigoExterno: 'hello_world', nome: 'Resposta padrao', conteudo: { corpo: 'Ola, {{nome}}.' }, aprovado: true }])
  }));
  await page.route('**/api/comunicacoes/mensagens', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'mensagem-3', tenantId: 'tenant-1', pacienteId: 'paciente-1', canalId: 'canal-1', templateId: 'template-1', status: 'pendente', payload: route.request().postDataJSON().payload, criadoEm: '2026-08-01T15:00:00.000Z' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'mensagem-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', canalId: 'canal-1', status: 'recebido', payload: { direcao: 'recebida', contato: '5511999999999', texto: 'Posso trocar o horário?' }, criadoEm: '2026-08-01T13:00:00.000Z' },
        { id: 'mensagem-2', tenantId: 'tenant-1', pacienteId: 'paciente-1', canalId: 'canal-1', templateId: 'template-1', status: 'falhou', erro: 'Falha de entrega', payload: { destino: '5511999999999' }, criadoEm: '2026-08-01T13:05:00.000Z' }
      ])
    });
  });

  await page.route('**/api/agenda/google/profissionais/status', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ profissionalId: 'profissional-1', conectado: true }])
  }));
  await page.route('**/api/profissionais**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ itens: [{ id: 'profissional-1', tenantId: 'tenant-1', nome: 'Dra. Carla', especialidade: 'Nutricao', criadoEm: '2026-07-20T10:00:00.000Z' }], total: 1 })
  }));
}

test.describe('Fase 196 - comunicacoes e equipe', () => {
  test.beforeEach(async ({ page }) => prepararSessao(page));

  test('prioriza conversas e leva resposta ou falha para a composicao', async ({ page }) => {
    await page.goto('/comunicacoes');

    const areas = page.getByRole('tablist', { name: 'Áreas de comunicação' });
    await expect(areas.getByRole('tab', { name: 'Conversas' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Inbox WhatsApp' })).toBeVisible();
    await expect(page.getByText('Novo canal')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Responder' })).toBeVisible();
    await expect(page.getByText('Falha de entrega')).toHaveCount(0);
    await expect(page.getByText('Não foi possível concluir o envio.').first()).toBeVisible();

    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(areas.getByRole('tab', { name: 'Nova mensagem' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Disparo manual')).toBeVisible();
    await expect(page.getByLabel('WhatsApp de destino')).toHaveValue('5511999999999');
    await expect(page.getByLabel('Template')).toHaveValue('template-1');

    await areas.getByRole('tab', { name: 'Configurações' }).click();
    await expect(page.getByText('Novo canal')).toBeVisible();
    await expect(page.getByText('Novo template')).toBeVisible();
  });

  test('separa diretorio, disponibilidade e integracoes da equipe clinica', async ({ page }) => {
    await page.goto('/profissionais');

    const areas = page.getByRole('tablist', { name: 'Áreas da equipe clínica' });
    await expect(areas.getByRole('tab', { name: 'Diretório' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Dra. Carla')).toBeVisible();

    await areas.getByRole('tab', { name: 'Disponibilidade' }).click();
    await expect(page.getByRole('link', { name: 'Abrir agenda de Dra. Carla' })).toHaveAttribute('href', '/agenda?profissionalId=profissional-1');

    await areas.getByRole('tab', { name: 'Integrações' }).click();
    await expect(page.getByText('Google Agenda conectada')).toBeVisible();
    await expect(page.getByText('Convites e permissões ficam na área Equipe da conta.')).toBeVisible();
  });
});

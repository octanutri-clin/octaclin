import { expect, test } from '@playwright/test';

const canaisFixture = [
  { id: 'canal-whatsapp-1', tenantId: 'tenant-1', tipo: 'whatsapp', nome: 'WhatsApp OctaClin', configuracao: {}, ativo: true },
  { id: 'canal-email-1', tenantId: 'tenant-1', tipo: 'email', nome: 'Email OctaClin', configuracao: {}, ativo: true }
];

const templatesFixture = [
  { id: 'template-whatsapp-1', tenantId: 'tenant-1', canal: 'whatsapp', codigoExterno: 'hello_world', nome: 'Lembrete WhatsApp', conteudo: {}, aprovado: true },
  { id: 'template-email-1', tenantId: 'tenant-1', canal: 'email', nome: 'Lembrete Email', conteudo: { assunto: 'Lembrete' }, aprovado: true }
];

const pacientesFixture = [
  { id: 'paciente-ana', tenantId: 'tenant-1', nome: 'Ana Souza', profissionalResponsavelId: 'profissional-carla', contato: '5511999999999', statusAdesao: 'aderente', scoreRisco: '10', criadoEm: '2026-07-01T10:00:00.000Z' },
  { id: 'paciente-bruno', tenantId: 'tenant-1', nome: 'Bruno Lima', profissionalResponsavelId: 'profissional-paulo', contato: '5511988887777', statusAdesao: 'aderente', scoreRisco: '10', criadoEm: '2026-07-01T10:00:00.000Z' },
  { id: 'paciente-carla', tenantId: 'tenant-1', nome: 'Carla Dias', profissionalResponsavelId: 'profissional-carla', contato: 'carla.dias@example.com', statusAdesao: 'aderente', scoreRisco: '10', criadoEm: '2026-07-01T10:00:00.000Z' }
];

const profissionaisFixture = [
  { id: 'profissional-carla', tenantId: 'tenant-1', nome: 'Dra. Carla', criadoEm: '2026-07-01T10:00:00.000Z' },
  { id: 'profissional-paulo', tenantId: 'tenant-1', nome: 'Dr. Paulo', criadoEm: '2026-07-01T10:00:00.000Z' }
];

const mensagensFixture = [
  {
    id: 'mensagem-ana-whatsapp',
    tenantId: 'tenant-1',
    pacienteId: 'paciente-ana',
    canalId: 'canal-whatsapp-1',
    status: 'recebido',
    payload: { direcao: 'recebida', contato: '5511999999999', texto: 'Posso remarcar minha consulta?' },
    criadoEm: '2026-08-01T12:00:00.000Z'
  },
  {
    id: 'mensagem-ana-email',
    tenantId: 'tenant-1',
    pacienteId: 'paciente-ana',
    canalId: 'canal-email-1',
    templateId: 'template-email-1',
    status: 'enviado',
    payload: { destino: 'ana@example.com' },
    criadoEm: '2026-08-01T13:00:00.000Z'
  },
  {
    id: 'mensagem-bruno-whatsapp',
    tenantId: 'tenant-1',
    pacienteId: 'paciente-bruno',
    canalId: 'canal-whatsapp-1',
    templateId: 'template-whatsapp-1',
    status: 'enviado',
    payload: { destino: '5511988887777' },
    criadoEm: '2026-08-01T11:00:00.000Z'
  },
  {
    id: 'mensagem-carla-email',
    tenantId: 'tenant-1',
    pacienteId: 'paciente-carla',
    canalId: 'canal-email-1',
    templateId: 'template-email-1',
    status: 'enviado',
    payload: { destino: 'carla.dias@example.com' },
    criadoEm: '2026-08-01T14:00:00.000Z'
  }
];

async function prepararConsoleComunicacoes(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'SuperAdmin', domain: 'localhost', path: '/' },
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
        email: 'admin@octaclin.local',
        expiraEm: '2026-12-31T18:00:00.000Z',
        papel: 'SuperAdmin',
        permissoes: ['comunicacoes.mensagens.ler', 'comunicacoes.mensagens.enviar'],
        destinoInicial: '/comunicacoes'
      })
    });
  });

  await page.route('**/api/comunicacoes/canais', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(canaisFixture) })
  );
  await page.route('**/api/comunicacoes/templates', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(templatesFixture) })
  );
  await page.route('**/api/comunicacoes/mensagens', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mensagensFixture) })
  );
  await page.route('**/api/pacientes**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: pacientesFixture, total: pacientesFixture.length }) })
  );
  await page.route('**/api/profissionais**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: profissionaisFixture, total: profissionaisFixture.length }) })
  );
}

test.describe('visao unificada de conversas (Fase 258, Incremento 4)', () => {
  test('agrupa mensagens de WhatsApp e email do mesmo paciente numa unica conversa, com canal identificado por mensagem', async ({ page }) => {
    await prepararConsoleComunicacoes(page);
    await page.goto('/comunicacoes');

    const conversaAna = page.getByRole('button', { name: /Ana Souza/ });
    await expect(conversaAna).toBeVisible();
    await expect(conversaAna.getByText('whatsapp', { exact: true })).toBeVisible();
    await expect(conversaAna.getByText('email', { exact: true })).toBeVisible();

    await conversaAna.click();
    await expect(page.getByText('Posso remarcar minha consulta?').first()).toBeVisible();
    await expect(page.getByText('Lembrete Email').first()).toBeVisible();
  });

  test('conversa so com email nao mostra as acoes exclusivas de WhatsApp (Responder e Nota interna)', async ({ page }) => {
    await prepararConsoleComunicacoes(page);
    await page.goto('/comunicacoes');

    await page.getByRole('button', { name: /Carla Dias/ }).click();
    await expect(page.getByText('Lembrete Email').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Responder' })).toHaveCount(0);
    await expect(page.getByLabel('Nota interna')).toHaveCount(0);
  });

  test('filtro de responsavel restringe as conversas ao profissional selecionado', async ({ page }) => {
    await prepararConsoleComunicacoes(page);
    await page.goto('/comunicacoes');

    await expect(page.getByRole('button', { name: /Ana Souza/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Bruno Lima/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Carla Dias/ })).toBeVisible();

    await page.getByLabel('Filtrar conversas por profissional responsável').selectOption({ label: 'Dra. Carla' });

    await expect(page.getByRole('button', { name: /Ana Souza/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Carla Dias/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Bruno Lima/ })).toHaveCount(0);

    await page.getByLabel('Filtrar conversas por profissional responsável').selectOption({ label: 'Dr. Paulo' });

    await expect(page.getByRole('button', { name: /Bruno Lima/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ana Souza/ })).toHaveCount(0);
  });
});

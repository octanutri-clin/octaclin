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
  await page.route('**/api/comunicacoes/portal-paciente**', async (route) => {
    const url = new URL(route.request().url());
    const pagina = Number(url.searchParams.get('pagina') ?? 0);
    const status = url.searchParams.get('status') ?? 'aguardando_clinica';
    if (status !== 'aguardando_clinica') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          itens: [{
            id: `conversa-${status}`, pacienteId: 'paciente-3', pacienteNome: 'Camila Respondida', status,
            ultimaMensagemEm: '2026-09-30T10:00:00.000Z', atrasada: false, mensagens: []
          }],
          pagina,
          temMais: false
        })
      });
      return;
    }
    const pacienteNome = pagina === 0 ? 'Ana Resposta' : 'Bruno Resposta';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        itens: pagina === 0 ? [{
          id: 'conversa-1', pacienteId: 'paciente-1', pacienteNome, status: 'aguardando_clinica',
          ultimaMensagemEm: '2026-09-30T12:00:00.000Z', prazoRespostaEm: '2026-10-01T12:00:00.000Z',
          atrasada: false, mensagens: []
        }] : [{
          id: 'conversa-2', pacienteId: 'paciente-2', pacienteNome, status: 'aguardando_clinica',
          ultimaMensagemEm: '2026-09-30T11:00:00.000Z', prazoRespostaEm: '2026-10-01T11:00:00.000Z',
          atrasada: false, mensagens: []
        }],
        pagina,
        temMais: pagina === 0
      })
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

  test('mantem Comunicacoes acessivel quando a fila do portal retorna formato invalido', async ({ page }) => {
    await page.route('**/api/comunicacoes/portal-paciente**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    }));

    await page.goto('/comunicacoes');
    await expect(page.getByRole('heading', { name: 'Comunicações', level: 1 })).toBeVisible();
    await expect(page.getByText('Resposta inválida da fila do portal.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Conversas' })).toBeVisible();
  });

  test('prioriza conversas e leva resposta ou falha para a composicao', async ({ page }) => {
    await page.goto('/comunicacoes');

    const areas = page.getByRole('tablist', { name: 'Áreas de comunicação' });
    await expect(areas.getByRole('tab', { name: 'Conversas' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Conversas' })).toBeVisible();
    await expect(page.getByText('Novo canal')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Responder' })).toBeVisible();
    await expect(page.getByText('Falha de entrega')).toHaveCount(0);
    await expect(page.getByText('Não foi possível concluir o envio.').first()).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Respostas do portal' })).toBeVisible();
    await expect(page.getByText('Ana Resposta')).toBeVisible();
    await page.getByRole('button', { name: 'Carregar mais respostas' }).click();
    await expect(page.getByText('Bruno Resposta')).toBeVisible();
    await page.getByLabel('Status das respostas do portal').selectOption('aguardando_paciente');
    await expect(page.getByText('Camila Respondida')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Carregar mais respostas' })).toHaveCount(0);
    await expect(page.getByLabel('Somente atrasadas')).toBeDisabled();

    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(areas.getByRole('tab', { name: 'Nova mensagem' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Disparo manual')).toBeVisible();
    await expect(page.getByLabel('WhatsApp de destino')).toHaveValue('5511999999999');
    await expect(page.getByLabel('Template')).toHaveValue('template-1');

    await areas.getByRole('tab', { name: 'Configurações' }).click();
    await expect(page.getByText('Novo canal')).toBeVisible();
    await expect(page.getByText('Novo template')).toBeVisible();
    await expect(page.locator('#canal-tipo').getByRole('option', { name: 'Push' })).toHaveCount(0);
    await expect(page.locator('#template-canal').getByRole('option', { name: 'Push' })).toHaveCount(0);
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

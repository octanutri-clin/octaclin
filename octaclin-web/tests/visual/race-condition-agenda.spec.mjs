import { expect, test } from '@playwright/test';

async function prepararSessaoAgenda(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/agenda'), domain: 'localhost', path: '/' }
  ]);

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        autenticado: true,
        apiUrl: 'http://localhost:3001',
        tenantSlug: 'clinica-carla',
        email: 'profissional@octaclin.local',
        expiraEm: '2026-12-31T15:00:00.000Z',
        papel: 'Professional',
        permissoes: ['agenda.ler', 'agenda.gerenciar'],
        destinoInicial: '/agenda'
      })
    });
  });

  await page.route('**/api/agenda/consultas', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/pacientes*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], total: 0 }) })
  );
  await page.route('**/api/profissionais*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        itens: [
          { id: 'profissional-1', tenantId: 'tenant-1', nome: 'Dra. Carla' },
          { id: 'profissional-2', tenantId: 'tenant-1', nome: 'Dr. Bruno' }
        ],
        total: 2
      })
    })
  );
  await page.route('**/api/agenda/agendamento-publico', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  );
  await page.route('**/api/agenda/solicitacoes', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], total: 0 }) })
  );
  await page.route('**/api/agenda/google/status', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ conectado: false }) })
  );
}

function itemFeed(rotulo) {
  const inicio = new Date();
  inicio.setHours(13, 0, 0, 0);
  const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
  return [
    {
      id: `bloqueio-${rotulo}`,
      tipo: 'bloqueio_manual',
      // Fixo em profissional-1 (o valor final selecionado) para isolar o teste da guarda de
      // sequencia, sem depender do filtro por profissional tambem excluir a resposta atrasada.
      profissionalId: 'profissional-1',
      inicioEm: inicio.toISOString(),
      fimEm: fim.toISOString(),
      rotulo
    }
  ];
}

test('troca rapida de profissional nao deixa resposta antiga sobrescrever a mais recente', async ({ page }) => {
  await prepararSessaoAgenda(page);

  let faseAtual = 'inicial';
  await page.route('**/api/agenda/feed*', async (route) => {
    const profissionalId = new URL(route.request().url()).searchParams.get('profissionalId');
    if (profissionalId === 'profissional-2') {
      // Requisicao disparada pela troca para o profissional-2: atrasada de proposito.
      // Nao deve aparecer, mesmo chegando depois da requisicao seguinte (profissional-1).
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(itemFeed('Rodada profissional-2 (atrasada, nao deveria aparecer)')) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(itemFeed(`Rodada ${faseAtual}`)) });
  });

  await page.goto('/agenda');

  const agendaInterna = page.getByRole('region', { name: 'Agenda interna semanal' });
  await expect(agendaInterna).toBeVisible();
  await agendaInterna.getByRole('button', { name: 'lista' }).click();
  await expect(agendaInterna.getByText('Rodada inicial')).toBeVisible();

  const seletorProfissional = agendaInterna.getByLabel('Agenda de');
  const requisicaoLenta = page.waitForRequest((requisicao) => requisicao.url().includes('profissionalId=profissional-2'));
  await seletorProfissional.selectOption('profissional-2');
  await requisicaoLenta;
  faseAtual = 'final';
  await seletorProfissional.selectOption('profissional-1');

  await expect(agendaInterna.getByText('Rodada final')).toBeVisible();
  await expect(agendaInterna.getByText('Rodada profissional-2 (atrasada, nao deveria aparecer)')).toHaveCount(0);
});

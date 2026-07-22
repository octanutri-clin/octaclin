import { expect, test } from '@playwright/test';

const tokenPrimeiroAcesso = 'tenant-1.token-primeiro-acesso';

const portalPaciente = {
  paciente: {
    id: 'paciente-1',
    nome: 'Ana Paula',
    statusAdesao: 'novo',
    scoreRisco: '0',
    ultimoCheckinEm: null
  },
  perfil: {
    contato: 'ana@example.com',
    email: 'ana@example.com',
    whatsapp: '',
    preferenciasContato: { email: true, whatsapp: true },
    dataNascimento: null,
    profissionalResponsavelId: 'profissional-1',
    ultimoCheckinEm: null
  },
  resumo: {
    consultasProximas: 0,
    formulariosPendentes: 0,
    formulariosRespondidos: 0,
    mensagensRecentes: 0
  },
  consultasProximas: [],
  formulariosPendentes: [],
  formulariosRespondidos: [],
  mensagensRecentes: [],
  lgpd: {
    versaoAtual: '2026-07',
    ultimoAceiteEm: '2026-07-22T12:00:00.000Z',
    consentimentos: [
      {
        id: 'consentimento-1',
        tipo: 'primeiro_acesso_paciente',
        versao: '2026-07',
        aceitoEm: '2026-07-22T12:00:00.000Z',
        metadados: { origem: 'primeiro_acesso' }
      }
    ]
  }
};

async function prepararOnboarding(page) {
  await page.route(`**/api/pacientes/convites-acesso/${encodeURIComponent(tokenPrimeiroAcesso)}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pacienteId: 'paciente-1',
        nomePaciente: 'Ana Paula',
        email: 'ana@example.com',
        status: 'pendente',
        expiraEm: '2026-08-01T12:00:00.000Z'
      })
    });
  });

  await page.route('**/api/pacientes/convites-acesso/ativar', async (route) => {
    await page.context().addCookies([
      { name: 'octaclin_access_token', value: 'fake-access-token', domain: 'localhost', path: '/' },
      { name: 'octaclin_refresh_token', value: 'fake-refresh-token', domain: 'localhost', path: '/' },
      { name: 'octaclin_papel', value: 'Patient', domain: 'localhost', path: '/' },
      { name: 'octaclin_destino_inicial', value: encodeURIComponent('/portal'), domain: 'localhost', path: '/' }
    ]);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pacienteId: 'paciente-1',
        usuarioId: 'usuario-1',
        tenantId: 'tenant-1',
        email: 'ana@example.com',
        destinoInicial: '/portal'
      })
    });
  });

  await page.route('**/api/portal/paciente', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(portalPaciente) });
  });
}

test.describe('primeiro acesso do paciente', () => {
  test('ativa convite e abre o portal do paciente sem login manual', async ({ page }) => {
    await prepararOnboarding(page);
    await page.goto(`/primeiro-acesso?token=${encodeURIComponent(tokenPrimeiroAcesso)}`);

    await expect(page.getByRole('heading', { name: 'Primeiro acesso' })).toBeVisible();
    await expect(page.getByText('Ana Paula')).toBeVisible();

    await page.locator('input[type="password"]').nth(0).fill('SenhaPaciente@123');
    await page.locator('input[type="password"]').nth(1).fill('SenhaPaciente@123');
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Ativar acesso' }).click();

    await expect(page).toHaveURL(/\/portal$/);
    await expect(page.getByRole('heading', { name: 'Portal do paciente' })).toBeVisible();
    await expect(page.getByText('Nenhuma acao pendente para hoje.')).toBeVisible();
  });
});

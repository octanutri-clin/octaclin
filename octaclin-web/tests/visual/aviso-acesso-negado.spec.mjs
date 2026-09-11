import { expect, test } from '@playwright/test';

const portalPacienteVazio = {
  paciente: { id: 'paciente-1', nome: 'Ana Paula', statusAdesao: 'novo', scoreRisco: '0', ultimoCheckinEm: null },
  perfil: {
    contato: 'ana@example.com',
    email: 'ana@example.com',
    whatsapp: '',
    preferenciasContato: { email: true, whatsapp: true },
    dataNascimento: null,
    profissionalResponsavelId: 'profissional-1',
    ultimoCheckinEm: null
  },
  resumo: { consultasProximas: 0, formulariosPendentes: 0, formulariosRespondidos: 0, mensagensRecentes: 0 },
  consultasProximas: [],
  formulariosPendentes: [],
  formulariosRespondidos: [],
  mensagensRecentes: [],
  lgpd: { versaoAtual: '2026-07', ultimoAceiteEm: '2026-07-22T12:00:00.000Z', documentosLegais: [], consentimentos: [], solicitacoes: [] }
};

async function prepararSessaoPaciente(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Patient', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/portal'), domain: 'localhost', path: '/' }
  ]);
  await page.route('**/api/portal/paciente', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(portalPacienteVazio) });
  });
}

test.describe('aviso de acesso negado (Fase 259, Incremento 3)', () => {
  test('tentar acessar rota fora do proprio papel mostra aviso apos o redirecionamento', async ({ page }) => {
    await prepararSessaoPaciente(page);

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/portal$/);
    await expect(page.getByText('Você não tem permissão para acessar aquela página.')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Você não tem permissão para acessar aquela página.')).toHaveCount(0);
  });

  test('acessar uma rota permitida nao mostra o aviso', async ({ page }) => {
    await prepararSessaoPaciente(page);

    await page.goto('/portal');

    await expect(page).toHaveURL(/\/portal$/);
    await expect(page.getByText('Você não tem permissão para acessar aquela página.')).toHaveCount(0);
  });

  test('fechar o aviso o remove da tela', async ({ page }) => {
    await prepararSessaoPaciente(page);

    await page.goto('/dashboard');
    const aviso = page.getByText('Você não tem permissão para acessar aquela página.');
    await expect(aviso).toBeVisible();

    await page.getByRole('button', { name: 'Fechar aviso' }).click();
    await expect(aviso).toHaveCount(0);
  });
});

import { expect, test } from '@playwright/test';

const registroId = '00000000-0000-4000-8000-000000000111';

test('revisão de hábitos exige leitura antes da confirmação', async ({ page }) => {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_permissoes', value: encodeURIComponent(JSON.stringify(['questionarios.ler', 'pacientes.ler', 'pacientes.gerenciar'])), domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/questionarios'), domain: 'localhost', path: '/' }
  ]);
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ autenticado: true, papel: 'Professional', permissoes: ['questionarios.ler', 'pacientes.ler', 'pacientes.gerenciar'],
      destinoInicial: '/questionarios', email: 'profissional@exemplo.test', tenantSlug: 'clinica-teste' }) }));
  let revisado = false;
  await page.route('**/api/checkins/revisoes/pendentes?*', (route) => route.fulfill({ status: 200,
    contentType: 'application/json', body: JSON.stringify({ pagina: 1, tamanho: 20, total: revisado ? 0 : 1,
      itens: revisado ? [] : [{ id: registroId, pacienteId: '00000000-0000-4000-8000-000000000222', pacienteNome: 'Paciente fictício',
        registradoEm: '2026-09-30T12:00:00Z' }] }) }));
  await page.route(`**/api/checkins/revisoes/${registroId}`, async (route) => {
    if (route.request().method() === 'PATCH') {
      expect((await route.request().postDataJSON()).comprovanteLeitura).toBe('recibo-sintetico');
      revisado = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: registroId,
        revisadoEm: '2026-09-30T13:00:00Z' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: registroId,
      pacienteId: '00000000-0000-4000-8000-000000000222', pacienteNome: 'Paciente fictício',
      registradoEm: '2026-09-30T12:00:00Z', humor: 'bem', adesaoPlano: 75,
      sintomas: 'Exemplo sintético', comprovanteLeitura: 'recibo-sintetico' }) });
  });

  await page.goto('/checkins/revisoes');
  const confirmar = page.getByRole('button', { name: 'Confirmar revisão' });
  await expect(confirmar).toHaveCount(0);
  await page.getByRole('button', { name: /Paciente fictício/ }).click();
  await expect(page.getByText('Exemplo sintético')).toBeVisible();
  await expect(confirmar).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Li o registro e confirmo a revisão.' }).check();
  await confirmar.click();
  await expect(page.getByText(/Visto pela equipe em/)).toBeVisible();
  await expect(page.getByText('Nenhum registro pendente nesta página.')).toBeVisible();
});

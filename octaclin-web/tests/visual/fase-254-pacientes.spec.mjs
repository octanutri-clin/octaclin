import { expect, test } from '@playwright/test';

const webUrl = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const permissoes = ['console.acessar', 'pacientes.listar', 'pacientes.ler', 'pacientes.gerenciar', 'profissionais.ler'];
const profissional = { id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-1', nome: 'Dra. Sintética', criadoEm: '2026-08-22T10:00:00.000Z' };
const paciente = { id: 'paciente-1', tenantId: 'tenant-1', profissionalResponsavelId: profissional.id, nome: 'Ana Sintética', contato: 'ana@example.com', dataNascimento: '1990-04-15', statusAdesao: 'em_acompanhamento', scoreRisco: '35', criadoEm: '2026-08-22T10:00:00.000Z' };

async function preparar(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', url: webUrl },
    { name: 'octaclin_refresh_token', value: 'fake', url: webUrl },
    { name: 'octaclin_papel', value: 'Professional', url: webUrl },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/pacientes'), url: webUrl },
    { name: 'octaclin_permissoes', value: encodeURIComponent(JSON.stringify(permissoes)), url: webUrl }
  ]);
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ autenticado: true, apiUrl: 'http://backend.test', tenantSlug: 'clinica-sintetica', email: 'pro@example.com', expiraEm: '2026-08-23T10:00:00.000Z', papel: 'Professional', permissoes, destinoInicial: '/pacientes' }) }));
  await page.route('**/api/profissionais?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [profissional], total: 1 }) }));
}

test.describe('Fase 254 - rotas e formulario de pacientes', () => {
  test('preserva rascunho de novo paciente apenas na sessao da aba e limpa apos sucesso', async ({ page }) => {
    await preparar(page);
    let criado;
    await page.route(/\/api\/pacientes(?:\?.*)?$/, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      criado = await route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ...paciente, ...criado, id: 'paciente-novo', statusAdesao: 'novo', scoreRisco: '0' }) });
    });

    await page.goto('/pacientes/novo');
    await page.getByLabel('Nome completo').fill('Bruno Sintético');
    await page.getByLabel('E-mail ou telefone').fill('bruno@example.com');
    await page.reload();
    await expect(page.getByText('Rascunho desta aba restaurado.')).toBeVisible();
    await expect(page.getByLabel('Nome completo')).toHaveValue('Bruno Sintético');
    await page.getByRole('button', { name: 'Cadastrar paciente' }).click();
    await expect.poll(() => criado?.nome).toBe('Bruno Sintético');
    await expect(page).toHaveURL(/\/pacientes\/paciente-novo$/);
    const rascunhos = await page.evaluate(() => Object.keys(sessionStorage).filter((chave) => chave.startsWith('octaclin:rascunho-paciente:')));
    expect(rascunhos).toEqual([]);
  });

  test('carrega a edicao pelo BFF e envia somente o formulario confirmado', async ({ page }) => {
    await preparar(page);
    let atualizado;
    await page.route('**/api/pacientes/paciente-1', async (route) => {
      if (route.request().method() === 'PATCH') {
        atualizado = await route.request().postDataJSON();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...paciente, ...atualizado }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paciente) });
    });

    await page.goto('/pacientes/paciente-1/editar');
    await expect(page.getByLabel('Nome completo')).toHaveValue('Ana Sintética');
    await page.getByLabel('Situação do acompanhamento').selectOption('aderente');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect.poll(() => atualizado?.statusAdesao).toBe('aderente');
    await expect(page).toHaveURL(/\/pacientes\/paciente-1$/);
  });
});

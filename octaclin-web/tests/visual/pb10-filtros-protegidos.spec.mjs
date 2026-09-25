import { expect, test } from '@playwright/test';

const webUrl = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const permissoes = ['console.acessar', 'pacientes.listar', 'pacientes.ler', 'profissionais.ler'];

test('filtros de perfil seguem no POST e ficam fora da URL e das visoes salvas', async ({ page }) => {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', url: webUrl },
    { name: 'octaclin_refresh_token', value: 'fake', url: webUrl },
    { name: 'octaclin_papel', value: 'Professional', url: webUrl },
    { name: 'octaclin_permissoes', value: encodeURIComponent(JSON.stringify(permissoes)), url: webUrl }
  ]);
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    autenticado: true, apiUrl: 'http://backend.test', tenantSlug: 'clinica-sintetica',
    email: 'profissional@example.com', expiraEm: '2030-01-01T00:00:00.000Z',
    permissoes, papel: 'Professional', destinoInicial: '/pacientes'
  }) }));
  await page.route('**/api/profissionais?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], total: 0 }) }));
  await page.route('**/api/pacientes/filtros-salvos', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [] }) }));
  await page.route('**/api/pacientes?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], total: 0 }) }));
  const enviados = [];
  await page.route('**/api/pacientes/buscar', (route) => {
    enviados.push({ url: route.request().url(), metodo: route.request().method(), corpo: route.request().postDataJSON() });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], total: 0 }) });
  });

  await page.goto('/pacientes');
  await page.getByLabel('Categoria exata').fill('Primeira consulta');
  await page.getByLabel('Origem exata').fill('Indicação');
  await page.getByLabel('Etiqueta exata').fill('Retorno');
  await expect.poll(() => enviados.at(-1)?.corpo).toMatchObject({ categoria: 'Primeira consulta', origem: 'Indicação', tag: 'Retorno' });
  expect(enviados.at(-1).metodo).toBe('POST');
  expect(enviados.at(-1).url).not.toMatch(/Primeira|Indica|Retorno/);
  await expect(page).toHaveURL(/\/pacientes(?:\?|$)/);
  expect(page.url()).not.toMatch(/Primeira|Indica|Retorno/);
  await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Salvar visão' })).toBeDisabled();
});

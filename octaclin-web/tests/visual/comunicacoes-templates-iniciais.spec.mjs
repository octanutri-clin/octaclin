import { expect, test } from '@playwright/test';

test('clínica instala modelos iniciais, visualiza prévia e edita a própria cópia', async ({ page }) => {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/comunicacoes'), domain: 'localhost', path: '/' }
  ]);
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    autenticado: true, apiUrl: 'http://backend.test', tenantSlug: 'clinica-sintetica', email: 'operador@example.test',
    expiraEm: '2026-12-31T10:00:00.000Z', papel: 'Professional',
    permissoes: ['comunicacoes.mensagens.ler', 'comunicacoes.canais.gerenciar', 'comunicacoes.templates.gerenciar'],
    destinoInicial: '/comunicacoes'
  }) }));
  await page.route('**/api/comunicacoes/canais', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/comunicacoes/mensagens', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/pacientes?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"itens":[],"total":0}' }));
  await page.route('**/api/profissionais?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"itens":[],"total":0}' }));

  let templates = [];
  let atualizacao;
  await page.route('**/api/comunicacoes/templates', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(templates) }));
  await page.route('**/api/comunicacoes/templates/iniciais', async (route) => {
    templates = [{ id: 'template-1', canal: 'email', codigoExterno: 'octaclin_inicial_boas_vindas', nome: 'Boas-vindas à clínica',
      conteudo: { assunto: 'Boas-vindas', corpo: 'Olá {{nome}}, acesso disponível.' }, aprovado: false }];
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{"quantidadeCriada":1}' });
  });
  await page.route('**/api/comunicacoes/templates/template-1', async (route) => {
    atualizacao = route.request().postDataJSON();
    templates = [{ ...templates[0], ...atualizacao }];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(templates[0]) });
  });

  await page.goto('/comunicacoes');
  await page.getByRole('tab', { name: 'Configurações' }).click();
  await page.getByRole('button', { name: 'Adicionar modelos iniciais' }).click();
  await expect(page.getByText('1 modelo(s) inicial(is) adicionado(s).')).toBeVisible();
  await page.getByLabel('Template para editar').selectOption('template-1');
  await page.getByRole('button', { name: 'Editar template' }).click();
  await page.getByLabel('Corpo', { exact: true }).fill('Olá {{nome}}, texto revisado.');
  await expect(page.getByRole('region', { name: 'Prévia do template' })).toContainText('Olá Paciente exemplo, texto revisado.');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect.poll(() => atualizacao?.conteudo?.corpo).toBe('Olá {{nome}}, texto revisado.');
  await expect(page.getByText('Template atualizado.')).toBeVisible();
});

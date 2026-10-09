import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const webUrl = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const preferencias = {
  modos: { formulario_respondido: 'imediato', tarefa_concluida: 'diario', automacao_executada: 'semanal' },
  timezone: 'America/Sao_Paulo', emailResumo: false,
  classesElegiveis: ['formulario_respondido', 'tarefa_concluida', 'automacao_executada'],
  tiposObrigatorios: ['mensagem_recebida', 'solicitacao_agendamento', 'falha_envio']
};

async function preparar(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', url: webUrl },
    { name: 'octaclin_refresh_token', value: 'fake', url: webUrl },
    { name: 'octaclin_papel', value: 'Professional', url: webUrl },
    { name: 'octaclin_api_url', value: encodeURIComponent('http://backend.test'), url: webUrl },
    { name: 'octaclin_tenant_slug', value: encodeURIComponent('clinica-sintetica'), url: webUrl },
    { name: 'octaclin_email', value: encodeURIComponent('profissional@example.test'), url: webUrl },
    { name: 'octaclin_access_expira_em', value: '2030-08-13T15:00:00.000Z', url: webUrl },
    { name: 'octaclin_permissoes', value: encodeURIComponent(JSON.stringify(['console.acessar'])), url: webUrl }
  ]);
  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ autenticado: true, apiUrl: 'http://backend.test', tenantSlug: 'clinica-sintetica', email: 'profissional@example.test', expiraEm: '2030-08-13T15:00:00.000Z', papel: 'Professional', permissoes: ['console.acessar'] })
  }));
}

test.describe('Fase 309 · notificações', () => {
  test('mantém obrigatórias fixas, salva preferência futura e passa axe', async ({ page }) => {
    await preparar(page);
    let corpoSalvo;
    await page.route('**/api/notificacoes/preferencias', async (route) => {
      if (route.request().method() === 'PUT') {
        corpoSalvo = route.request().postDataJSON();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...preferencias, ...corpoSalvo }) });
      } else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(preferencias) });
    });
    await page.route('**/api/notificacoes/resumos/gerar', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"gerado":false}' }));
    await page.route('**/api/notificacoes?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"naoLidas":0,"itens":[],"resumos":[]}' }));
    await page.route('**/api/notificacoes/lidas', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"marcadas":0,"resumosMarcados":0}' }));

    await page.goto('/conta/notificacoes');
    await expect(page.getByRole('heading', { name: 'Preferências de notificações' })).toBeVisible();
    await expect(page.getByText('Mensagens recebidas')).toBeVisible();
    await expect(page.getByText('Solicitações de agendamento', { exact: true })).toBeVisible();
    await expect(page.getByText('Falhas de envio', { exact: true })).toBeVisible();
    await page.getByLabel('Tarefas concluídas').selectOption('semanal');
    await page.getByLabel('Enviar também por e-mail quando um resumo for gerado').check();
    await page.getByRole('button', { name: 'Salvar preferências' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Preferências salvas.' })).toBeVisible();
    await expect.poll(() => corpoSalvo?.modos?.tarefa_concluida).toBe('semanal');
    await expect.poll(() => corpoSalvo?.emailResumo).toBe(true);
    expect(corpoSalvo).toEqual({ modos: expect.any(Object), timezone: 'America/Sao_Paulo', emailResumo: true });

    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations).toEqual([]);
  });

  test('sino mostra o digest e permite marcar somente o resumo', async ({ page }) => {
    await preparar(page);
    await page.route('**/api/notificacoes/preferencias', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(preferencias) }));
    await page.route('**/api/notificacoes/resumos/gerar', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"gerado":false}' }));
    await page.route('**/api/notificacoes?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ naoLidas: 1, itens: [], resumos: [{ id: '00000000-0000-4000-8000-000000000309', periodoInicioEm: '2026-09-01T12:00:00Z', periodoFimEm: '2026-09-02T12:00:00Z', geradoEm: '2026-09-02T12:00:00Z', lidoEm: null, contagens: { tarefa_concluida: 2 }, estadoEmail: 'incerto' }] }) }));
    let enviado;
    await page.route('**/api/notificacoes/lidas', async (route) => {
      enviado = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"marcadas":0,"resumosMarcados":1}' });
    });
    await page.goto('/conta/notificacoes');
    await page.getByRole('button', { name: /Notificações, 1 não lidas/ }).click();
    await expect(page.getByText('E-mail: envio não confirmado')).toBeVisible();
    await expect(page.getByRole('menuitem', { name: '2 tarefas concluídas' })).toHaveAttribute('href', '/pacientes');
    await page.getByRole('menuitem', { name: 'Marcar lido' }).click();
    await expect.poll(() => enviado?.idsResumos?.[0]).toBe('00000000-0000-4000-8000-000000000309');
  });

  test('Collaborator vê as classes obrigatórias e não pode configurar as opcionais', async ({ page }) => {
    await preparar(page);
    await page.context().addCookies([{ name: 'octaclin_papel', value: 'Collaborator', url: webUrl }]);
    await page.unroute('**/api/auth/session');
    await page.route('**/api/auth/session', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ autenticado: true, apiUrl: 'http://backend.test', tenantSlug: 'clinica-sintetica', email: 'colaborador@example.test', expiraEm: '2030-08-13T15:00:00.000Z', papel: 'Collaborator', permissoes: ['console.acessar'] })
    }));
    const colaborador = { ...preferencias, emailResumo: false, classesElegiveis: [] };
    await page.route('**/api/notificacoes/preferencias', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(colaborador) }));
    await page.route('**/api/notificacoes/resumos/gerar', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"gerado":false}' }));
    await page.route('**/api/notificacoes?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"naoLidas":0,"itens":[],"resumos":[]}' }));
    await page.goto('/conta/notificacoes');
    await expect(page.getByText('As notificações opcionais não estão disponíveis para seu perfil.')).toBeVisible();
    await expect(page.getByLabel('Tarefas concluídas')).toBeDisabled();
    await expect(page.getByLabel('Enviar também por e-mail quando um resumo for gerado')).toBeDisabled();
    await expect(page.getByText('Mensagens recebidas')).toBeVisible();
    await expect(page.getByText('Solicitações de agendamento', { exact: true })).toBeVisible();
    await expect(page.getByText('Falhas de envio', { exact: true })).toBeVisible();
  });
});

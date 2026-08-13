import { expect, test } from '@playwright/test';

const agora = '2026-08-01T15:00:00.000Z';
const pacienteId = '11111111-1111-4111-8111-111111111111';
const profissionalId = '22222222-2222-4222-8222-222222222222';
const regraId = '33333333-3333-4333-8333-333333333333';
const analiseId = '44444444-4444-4444-8444-444444444444';

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
      tenantSlug: 'clinica-teste',
      email: 'admin@octaclin.test',
      expiraEm: agora,
      permissoes: [
        'dashboard.ler', 'agenda.consultas.ler', 'pacientes.listar', 'pacientes.ler',
        'questionarios.ler', 'comunicacoes.mensagens.ler', 'automacoes.gerenciar',
        'ia.executar', 'profissionais.ler', 'operacoes.auditoria.ler'
      ],
      destinoInicial: '/dashboard'
    })
  }));
  await page.route('**/api/pacientes**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ itens: [{ id: pacienteId, nome: 'Paciente Teste' }], total: 1 })
  }));
  await page.route('**/api/profissionais**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ itens: [{ id: profissionalId, nome: 'Profissional Teste' }], total: 1 })
  }));
}

test.describe('Fase 197 - modulos avancados', () => {
  test.beforeEach(async ({ page }) => prepararSessao(page));

  test('exige revisao humana antes de liberar a sugestao de IA', async ({ page }) => {
    const analise = {
      id: analiseId,
      tenantId: 'tenant-1',
      pacienteId,
      modelo: 'heuristica-local',
      ansiedadeScore: '20',
      frustracaoScore: '75',
      motivacaoScore: '40',
      confusaoScore: '10',
      explicacao: { provedor: 'heuristica-local', limitacoes: ['Analise lexical sem prontuario completo.'] },
      alertaDisparado: false,
      revisaoHumana: { status: 'pendente' },
      criadoEm: agora
    };
    await page.route('**/api/ia/sentimento', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([analise]) }));
    await page.route('**/api/ia/reconhecimento-alimentar', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route(`**/api/ia/sentimento/${analiseId}/revisao`, async (route) => {
      const corpo = route.request().postDataJSON();
      expect(corpo).toEqual({ decisao: 'editada', conteudoEditado: { interpretacaoProfissional: 'Frustracao pontual, sem indicio de risco atual.' } });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...analise, revisaoHumana: { status: 'editada', conteudoEditado: corpo.conteudoEditado } })
      });
    });

    await page.goto('/ia');
    await expect(page.getByText('Revisao pendente')).toBeVisible();
    await expect(page.getByText('Aguardando revisao')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Abrir prontuario' })).toHaveCount(0);
    await page.getByPlaceholder('Informe a interpretacao clinica corrigida').fill('Frustracao pontual, sem indicio de risco atual.');
    await page.getByRole('button', { name: 'Editar e aceitar' }).click();
    await expect(page.getByText('Editada pelo profissional')).toBeVisible();
    await expect(page.getByText(/Resultado revisado:.*Frustracao pontual/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Abrir prontuario' })).toHaveAttribute('href', `/pacientes/${pacienteId}`);
  });

  test('simula regra rascunho antes de permitir ativacao', async ({ page }) => {
    const regra = {
      id: regraId,
      tenantId: 'tenant-1',
      profissionalId,
      nome: 'Retomar check-in atrasado',
      gatilho: { tipo: 'checkin.atrasado' },
      condicoes: [{ campo: 'checkinsPerdidos', operador: 'maior_ou_igual', valor: 3 }],
      acoes: [{ tipo: 'notificar_profissional' }],
      ativa: false,
      criadoEm: agora
    };
    await page.route('**/api/automacoes/regras', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([regra]) }));
    await page.route('**/api/automacoes/avaliacoes', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/automacoes/simulacoes', (route) => route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: '55555555-5555-4555-8555-555555555555', tenantId: 'tenant-1', regraId, pacienteId, status: 'executado', resultado: { simulacao: true, executar: true }, criadoEm: agora })
    }));
    await page.route(`**/api/automacoes/regras/${regraId}/ativacao`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...regra, ativa: true })
    }));

    await page.goto('/automacoes');
    await expect(page.getByText('Quando:')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ativar Retomar check-in atrasado' })).toBeDisabled();
    await page.getByRole('button', { name: 'Simular sem executar' }).click();
    await expect(page.getByText('Simulacao concluida: a regra seria executada.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ativar Retomar check-in atrasado' })).toBeEnabled();
    await page.getByRole('button', { name: 'Ativar Retomar check-in atrasado' }).click();
    await expect(page.getByText('Regra ativada.')).toBeVisible();
  });

  test('organiza operacoes em sete areas e move sync mobile para filas', async ({ page }) => {
    await page.route('**/api/operacoes/**', (route) => {
      const url = route.request().url();
      let corpo;
      if (url.includes('/tenants')) corpo = { itens: [], total: 0 };
      else if (url.includes('/alertas')) corpo = { status: 'ok', geradoEm: agora, resumo: { total: 0, criticos: 0, atencao: 0, informativos: 0 }, itens: [] };
      else if (url.includes('/resumo')) corpo = { outbox: { pendente: 0, processando: 0, processado: 0, falhou: 0 }, mobile: { sincronizado: 1, erro: 0 } };
      else if (url.includes('/mobile/sincronizacoes')) corpo = [{ id: 'sync-1', tenantId: 'tenant-1', idLocal: 'local-1', tipo: 'checkin', status: 'sincronizado', criadoEm: agora }];
      else if (url.includes('/lgpd/retencao')) corpo = { versao: '1', geradoEm: agora, politicas: [], resumo: { totalVencidos: 0, itens: [] } };
      else if (url.includes('/comunicacoes/falhas')) corpo = { itens: [], total: 0, pagina: 1, limite: 25, resumo: { total: 0, email: 0, whatsapp: 0, googleCalendar: 0, outbox: 0, outras: 0, reprocessaveis: 0 } };
      else if (url.includes('/paginada') || url.includes('/solicitacoes')) corpo = { itens: [], total: 0, pagina: 1, limite: 25 };
      else corpo = [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) });
    });

    await page.goto('/operacoes');
    const areas = page.getByRole('tablist', { name: 'Areas de operacoes' });
    await expect(areas.getByRole('tab')).toHaveCount(7);
    await areas.getByRole('tab', { name: 'Onboarding' }).click();
    await expect(page.getByText('Nova clinica', { exact: true })).toBeVisible();
    await areas.getByRole('tab', { name: 'Incidentes' }).click();
    await expect(page.getByRole('heading', { name: 'Alertas operacionais' })).toBeVisible();
    await areas.getByRole('tab', { name: 'Comunicacoes' }).click();
    await expect(page.getByRole('heading', { name: 'Central de comunicacao' })).toBeVisible();
    await areas.getByRole('tab', { name: 'LGPD' }).click();
    await expect(page.getByRole('heading', { name: 'Solicitacoes LGPD' })).toBeVisible();
    await areas.getByRole('tab', { name: 'Auditoria' }).click();
    await expect(page.getByRole('heading', { name: 'Auditoria sensivel' })).toBeVisible();
    await areas.getByRole('tab', { name: 'Filas' }).click();
    await expect(page.getByRole('heading', { name: 'Sync mobile' })).toBeVisible();
  });
});

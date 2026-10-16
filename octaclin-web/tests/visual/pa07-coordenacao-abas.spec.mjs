import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pacienteId = 'pa07-paciente-sintetico';
const planoId = 'pa07-plano-sintetico';
const instante = '2026-10-16T12:00:00.000Z';
const permissoes = ['console.acessar', 'pacientes.listar', 'pacientes.ler', 'pacientes.gerenciar', 'profissionais.ler', 'planos_alimentares.ler', 'planos_alimentares.gerenciar'];

async function preparar(context) {
  let falharLeituraDetalhe = false;
  let detalhe = {
    id: planoId, pacienteId, profissionalId: 'pa07-profissional-sintetico', titulo: 'Plano sintético PA07',
    criadoEm: instante, atualizadoEm: instante, ativoParaPaciente: true, ativacaoRevisao: 1,
    draft: { id: 'pa07-rascunho-sintetico', numero: 1, status: 'rascunho', criadoEm: instante, atualizadoEm: instante,
      rascunhoRevisao: 1, objetivos: 'Objetivo sintético salvo', observacoes: '', refeicoes: [],
      ativoParaPaciente: true, ativacaoRevisao: 1, ativacaoEdicao: [], ativacaoRefeicoes: [] }, historico: []
  };
  const escritas = [];
  await context.addCookies([
    { name: 'octaclin_access_token', value: 'synthetic', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'synthetic', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/pacientes'), domain: 'localhost', path: '/' }
  ]);
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url()); const caminho = url.pathname;
    if (falharLeituraDetalhe && caminho === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}`) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Falha sintética de leitura' }) });
      return;
    }
    let corpo = { itens: [], total: 0, pagina: 1, limite: 25 };
    if (caminho === '/api/auth/session') corpo = { autenticado: true, tenantSlug: 'pa07-clinica-sintetica', email: 'profissional@example.test', apiUrl: 'http://localhost:3001', expiraEm: '2026-10-30T12:00:00.000Z', papel: 'Professional', permissoes, destinoInicial: '/pacientes' };
    else if (caminho.endsWith('/prontuario')) corpo = {
      paciente: { id: pacienteId, tenantId: 'pa07-tenant-sintetico', profissionalResponsavelId: detalhe.profissionalId, nome: 'Paciente Sintético', statusAdesao: 'aderente' },
      resumo: { consultas: 0, formulariosPendentes: 0, respostas: 0, checkinsRapidos: 0, mensagens: 0, evolucoes: 0, tarefasPendentes: 0, indicadoresRecentes: [], leituraClinica: { deltaUltimaAvaliacao: [], deltaDesdeInicio: [], condutasVencendo: [] } }, linhaDoTempo: []
    };
    else if (caminho.endsWith('/prioridade-acompanhamento')) corpo = { pacienteId, apurado: false, valorCalculado: { score: 0, faixa: 'baixa', fatores: [] }, valorEfetivo: { faixa: 'baixa', origem: 'calculado' } };
    else if (caminho.endsWith('/avaliacoes-antropometricas')) corpo = { avaliacoes: [], deltaUltimas: [] };
    else if (caminho === '/api/profissionais') corpo = { itens: [{ id: detalhe.profissionalId, nome: 'Profissional Sintético' }], total: 1 };
    else if (caminho === `/api/pacientes/${pacienteId}/planos-alimentares`) corpo = { itens: [detalhe], total: 1, pagina: 1, limite: 25 };
    else if (caminho === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}`) corpo = detalhe;
    else if (caminho.endsWith('/edicao')) {
      const body = route.request().postDataJSON(); escritas.push(body);
      detalhe = { ...detalhe, draft: { ...detalhe.draft, rascunhoRevisao: body.rascunhoRevisaoEsperada + 1, documentoEdicao: body.documento, edicaoEstado: 'pendente' } };
      corpo = detalhe.draft;
    } else if (caminho === '/api/notificacoes') corpo = { naoLidas: 0, itens: [], resumos: [] };
    else if (caminho.endsWith('/resumos/gerar')) corpo = { gerado: false };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) });
  });
  return { escritas, definirFalhaLeituraDetalhe: (falhar) => { falharLeituraDetalhe = falhar; } };
}
async function abrir(page) {
  await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeVisible({ timeout: 30_000 });
}

test('PA07 segunda aba consulta sem habilitar edição nem autosave; aba original conserva conteúdo local', async ({ context, page }) => {
  const { escritas } = await preparar(context); await abrir(page);
  const objetivo = page.getByRole('textbox', { name: 'Objetivo clínico', exact: true }); await expect(objetivo).toBeEditable();
  await objetivo.fill('Alteração sintética somente local');
  const segunda = await context.newPage(); await segunda.clock.install(); await abrir(segunda);
  await expect(segunda.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeDisabled();
  await expect(segunda.getByRole('status').filter({ hasText: 'Salvamento automático pausado nesta aba.' })).toBeVisible();
  await expect(segunda.getByRole('button', { name: 'Expandir todas' })).toBeEnabled();
  await segunda.clock.fastForward(120_000);
  await expect(objetivo).toHaveValue('Alteração sintética somente local');
  expect(escritas).toHaveLength(0);
});

test('PA07 segunda aba informa consulta e oferece retomada acessível sem alterar a origem', async ({ context, page }) => {
  await preparar(context); await abrir(page);
  const objetivo = page.getByRole('textbox', { name: 'Objetivo clínico', exact: true });
  await objetivo.fill('Alteração sintética preservada na origem');

  const segunda = await context.newPage(); await segunda.clock.install(); await abrir(segunda);
  await expect(segunda.getByText('A edição está em outra aba. Esta aba está em modo de consulta.')).toBeVisible();
  const retomar = segunda.getByRole('button', { name: 'Editar nesta aba' });
  await expect(retomar).toBeVisible();
  await expect(retomar).toBeEnabled();
  const acessibilidade = await new AxeBuilder({ page: segunda }).include('[data-pa07-aviso]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(acessibilidade.violations).toEqual([]);
  const objetivoSegunda = segunda.getByRole('textbox', { name: 'Objetivo clínico', exact: true });
  await expect(objetivoSegunda).toBeDisabled();
  await expect(segunda.getByRole('switch', { name: 'Plano alimentar para o paciente: visível para o paciente' })).toBeEnabled();
  await expect(objetivo).toHaveValue('Alteração sintética preservada na origem');

  await retomar.focus();
  await retomar.press('Enter');
  await expect(objetivoSegunda).toBeEditable({ timeout: 15_000 });
  await expect(objetivo).toBeDisabled();
  await expect(objetivoSegunda).toHaveValue('Objetivo sintético salvo');
});

test('PA07 falha ao reconferir mantém edição bloqueada e oferece recarga explícita', async ({ context, page }) => {
  const { definirFalhaLeituraDetalhe } = await preparar(context); await abrir(page);
  const segunda = await context.newPage(); await segunda.clock.install(); await abrir(segunda);
  definirFalhaLeituraDetalhe(true);

  await segunda.getByRole('button', { name: 'Editar nesta aba' }).press('Enter');
  await expect(segunda.getByRole('alert').filter({ hasText: 'O rascunho precisa ser reconferido' })).toBeVisible({ timeout: 15_000 });
  await expect(segunda.getByRole('button', { name: 'Recarregar rascunho' })).toBeEnabled();
  await expect(segunda.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeDisabled();
  const acessibilidade = await new AxeBuilder({ page: segunda }).include('[data-pa07-aviso]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(acessibilidade.violations).toEqual([]);
});

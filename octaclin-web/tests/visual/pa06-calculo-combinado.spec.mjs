import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pacienteId = 'paciente-pa06-sintetico';
const planoIds = ['plano-pa06-a', 'plano-pa06-b'];
const idsRefeicoes = ['refeicao-pa06-a', 'refeicao-pa06-b'];
const permissoes = ['console.acessar', 'pacientes.listar', 'pacientes.ler', 'pacientes.gerenciar', 'profissionais.ler', 'planos_alimentares.ler', 'planos_alimentares.gerenciar'];

function resumo(id, titulo, versaoId, ativoParaPaciente = true) {
  return { id, pacienteId, profissionalId: 'profissional-sintetico', titulo, ativoParaPaciente, ativacaoRevisao: 1,
    criadoEm: '2026-10-15T12:00:00.000Z', atualizadoEm: '2026-10-15T12:00:00.000Z',
    current: { id: versaoId, numero: 1, status: 'publicada', publicadoEm: '2026-10-15T12:00:00.000Z', criadoEm: '2026-10-15T12:00:00.000Z', atualizadoEm: '2026-10-15T12:00:00.000Z', refeicoes: [] },
    historico: [{ id: versaoId, numero: 1, status: 'publicada', publicadoEm: '2026-10-15T12:00:00.000Z' }] };
}

function resultado(itens, ferroEstado = 'parcial') {
  const codigos = ['energiaKcal','proteinasG','carboidratosG','gordurasG','fibrasG','sodioMg','calcioMg','magnesioMg','manganesMg','fosforoMg','ferroMg','potassioMg','cobreMg','zincoMg','selenioMcg','retinolMcg','vitaminaAReMcg','vitaminaARaeMcg','tiaminaMg','riboflavinaMg','vitaminaB6Mg','niacinaMg','niacinaNeMg','vitaminaB12Mcg','folatoDfeMcg','vitaminaDMcg','vitaminaEAlfaTocoferolMg','vitaminaCMg'];
  const nutrientes = Object.fromEntries(codigos.map(codigo => [codigo, {
    codigo, unidade: codigo.endsWith('Mcg') ? 'mcg' : codigo === 'energiaKcal' ? 'kcal' : codigo.endsWith('Mg') ? 'mg' : 'g',
    estado: codigo === 'energiaKcal' || codigo === 'calcioMg' ? 'completo' : 'indisponivel',
    ...(codigo === 'energiaKcal' ? { total: itens * 100 } : codigo === 'calcioMg' ? { total: 0 } : {}),
    ...(codigo === 'ferroMg' && ferroEstado === 'parcial' ? { estado: 'parcial', quantidadeConhecida: 1.2, itensComValor: 1, itensIncluidos: itens } : { itensComValor: 0, itensIncluidos: itens })
  }]));
  return { motorVersao: 'pa06-combinado-v1', estado: itens ? 'calculado' : 'sem_itens_incluidos', itensIncluidos: itens, nutrientes, exclusoes: [], calculadoEm: '2026-10-16T12:00:00.000Z', publicacoes: [] };
}

async function prepararConsole(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/pacientes'), domain: 'localhost', path: '/' }
  ]);
  await page.route(url => url.pathname === '/api/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ autenticado: true, apiUrl: 'http://localhost:3001', tenantSlug: 'clinica-sintetica', email: 'profissional@example.test', expiraEm: '2026-10-30T12:00:00.000Z', papel: 'Professional', permissoes, destinoInicial: '/pacientes' }) }));
  await page.route(url => url.pathname === '/api/profissionais', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [{ id: 'profissional-sintetico', nome: 'Profissional sintético' }], total: 1 }) }));
  await page.route(url => url.pathname === `/api/pacientes/${pacienteId}/prontuario`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    paciente: { id: pacienteId, tenantId: 'tenant-sintetico', profissionalResponsavelId: 'profissional-sintetico', nome: 'Paciente sintético', statusAdesao: 'aderente' },
    resumo: { consultas: 0, formulariosPendentes: 0, respostas: 0, checkinsRapidos: 0, mensagens: 0, evolucoes: 0, tarefasPendentes: 0, indicadoresRecentes: [], leituraClinica: { deltaUltimaAvaliacao: [], deltaDesdeInicio: [], condutasVencendo: [] } }, linhaDoTempo: []
  }) }));
  await page.route(url => url.pathname === `/api/pacientes/${pacienteId}/avaliacoes-antropometricas`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ avaliacoes: [], deltaUltimas: [] }) }));
  await page.route(url => ['/api/planos-alimentares/modelos', '/api/planos-alimentares/receitas'].includes(url.pathname), route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], total: 0, pagina: 1, limite: 100 }) }));
  const planos = [resumo(planoIds[0], 'Plano A sintético', 'versao-a'), resumo(planoIds[1], 'Plano B sintético', 'versao-b'), resumo('plano-pa06-off', 'Plano desativado sintético', 'versao-off', false)];
  await page.route(url => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: planos, total: planos.length, pagina: 1, limite: 25 }) }));
  await page.route(url => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/${planoIds[0]}` || url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/${planoIds[1]}`, route => {
    const caminho = new URL(route.request().url()).pathname;
    const plan = planos.find(item => caminho.endsWith(item.id));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...plan, current: { ...plan.current, apresentacaoEstado: 'configurada', preferenciasApresentacao: { schemaVersao: 1, profissional: {}, paciente: {} }, ativacaoRevisao: 1, ativoParaPaciente: true, ativacaoRefeicoes: [], resumoRefeicoesAtivas: { estado: 'completo', energiaKcal: 0, proteinasG: 0, carboidratosG: 0, gordurasG: 0 }, totais: { energiaKcal: 0, proteinasG: 0, carboidratosG: 0, gordurasG: 0 }, calculo: { metaEnergeticaKcal: 1800, metasMacronutrientes: { carboidratosG: 225, proteinasG: 90, gordurasG: 60 } }, refeicoes: [] } }) });
  });
}

test('PA06 combina dois planos, mantém a seleção após desmarcar refeição e mostra parcial versus zero conhecido', async ({ page }) => {
  await prepararConsole(page);
  const selecoesRecebidas = [];
  await page.route(url => url.pathname.endsWith('/selecao-calculo'), route => {
    const caminho = new URL(route.request().url()).pathname;
    const planoId = caminho.includes(planoIds[0]) ? planoIds[0] : planoIds[1];
    const index = planoIds.indexOf(planoId);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ planoId, ativoParaPaciente: true, ativacaoRevisao: 1, versao: { id: `versao-${index ? 'b' : 'a'}`, numero: 1, publicadaEm: '2026-10-15T12:00:00.000Z' }, refeicoes: [{ identidadeId: idsRefeicoes[index], nome: `Refeição ${index ? 'B' : 'A'}`, ordem: 0, ativa: true }] }) });
  });
  await page.route(url => url.pathname.endsWith('/calculo-combinado'), async route => {
    const body = route.request().postDataJSON();
    selecoesRecebidas.push(body);
    const itens = body.selecoes.reduce((total, item) => total + item.identidadesRefeicoes.length, 0);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resultado(itens)) });
  });

  await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Adicionar plano desta página')).not.toContainText('Plano desativado sintético');
  await page.getByLabel('Adicionar plano desta página').selectOption(planoIds[0]);
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText('100 kcal')).toBeVisible();
  await expect(page.locator('#calculo-combinado-titulo').locator('xpath=../..')).toContainText('Versão publicada 1 em 15/10/2026');
  await page.getByLabel('Adicionar plano desta página').selectOption(planoIds[1]);
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText('200 kcal')).toBeVisible();
  await expect(page.getByText('1,2 conhecido mg')).toBeVisible();
  await expect(page.getByText('Cálcio (mg)').locator('..')).toContainText('0 mg');

  const refeicaoA = page.getByRole('checkbox', { name: 'Refeição A' });
  await refeicaoA.focus();
  await page.keyboard.press('Space');
  await expect(page.getByText('100 kcal')).toBeVisible();
  expect(selecoesRecebidas.at(-1).selecoes[0].identidadesRefeicoes).toEqual([]);
  expect(selecoesRecebidas.at(-1).selecoes[1].identidadesRefeicoes).toEqual([idsRefeicoes[1]]);
  expect(selecoesRecebidas.flatMap(item => item.selecoes).every(item => !('nutrientes' in item))).toBe(true);
  const acessibilidade = await new AxeBuilder({ page }).include('section[aria-labelledby="calculo-combinado-titulo"]').analyze();
  expect(acessibilidade.violations).toEqual([]);
});

test('PA06 conflito limpa o total e atualização mantém somente refeições escolhidas que ainda existem', async ({ page }) => {
  await prepararConsole(page);
  let leitura = 0;
  await page.route(url => url.pathname.endsWith('/selecao-calculo'), route => {
    leitura += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ planoId: planoIds[0], ativoParaPaciente: true, ativacaoRevisao: leitura > 1 ? 2 : 1, versao: { id: leitura > 1 ? 'versao-a2' : 'versao-a', numero: leitura > 1 ? 2 : 1, publicadaEm: '2026-10-15T12:00:00.000Z' }, refeicoes: [
      { identidadeId: idsRefeicoes[0], nome: 'Refeição A', ordem: 0, ativa: true },
      ...(leitura > 1 ? [{ identidadeId: 'refeicao-nova', nome: 'Refeição adicionada', ordem: 1, ativa: true }] : [])
    ] }) });
  });
  let requests = 0;
  await page.route(url => url.pathname.endsWith('/calculo-combinado'), route => {
    requests += 1;
    return requests === 1
      ? route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ statusCode: 409, message: 'Conflito sintético' }) })
      : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resultado(1, 'indisponivel')) });
  });
  await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Adicionar plano desta página').selectOption(planoIds[0]);
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.locator('#calculo-combinado-titulo').locator('xpath=../..').getByRole('alert')).toContainText('mudaram');
  await expect(page.getByRole('button', { name: 'Atualizar seleção' })).toBeVisible();
  await page.getByRole('button', { name: 'Atualizar seleção' }).click();
  await expect(page.getByRole('checkbox', { name: 'Refeição adicionada' })).not.toBeChecked();
  await expect(page.getByText('100 kcal')).toBeVisible();
  expect(requests).toBe(2);
});

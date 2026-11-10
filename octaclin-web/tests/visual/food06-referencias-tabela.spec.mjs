import { ajudaSintetica } from '../../scripts/fixtures/ajuda-dietetica.ts';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pacienteId, planoIds, idsRefeicoes, resultado, prepararConsole } from './fixtures/console-pa06.mjs';

// FOOD06 T4a: comparação com a DRI na tabela. Dados sintéticos; o servidor é simulado por rotas.
const VERSAO = 'dri-hc-2025-11-19-adulto-v1';
const MACROS = new Set(['energiaKcal', 'proteinasG', 'carboidratosG', 'gordurasG', 'fibrasG', 'sodioMg']);
function cobertura(incluidos) {
  const nutrientes = Object.fromEntries(Object.entries(resultado(0).nutrientes).filter(([c]) => !MACROS.has(c)).map(([codigo, n]) => [codigo, {
    codigo, unidade: n.unidade, estado: incluidos ? 'DESCONHECIDO' : 'INDISPONIVEL', contagens: { incluidos, conhecidos: 0, semComposicao: incluidos, incompativeis: 0, naoResolvidos: 0 },
    causas: [{ codigo: incluidos ? 'ausente' : 'sem_componentes', quantidade: incluidos }]
  }]));
  if (incluidos) {
    Object.assign(nutrientes.calcioMg, { estado: 'COMPLETO', total: 500, contagens: { incluidos, conhecidos: incluidos, semComposicao: 0, incompativeis: 0, naoResolvidos: 0 }, causas: [] });
    Object.assign(nutrientes.ferroMg, { estado: 'PARCIAL', quantidadeConhecida: 1.2, contagens: { incluidos, conhecidos: 1, semComposicao: incluidos - 1, incompativeis: 0, naoResolvidos: 0 }, causas: [{ codigo: 'ausente', quantidade: incluidos - 1 }] });
  }
  return nutrientes;
}
function comparacoes(nutrientes, { elegivel = true, motivos = [] } = {}) {
  const ind = motivo => ({ estado: 'indisponivel', motivo });
  const comp = (tipo, valor, extra = {}) => ({ estado: 'comparavel', tipo, referenciaId: 'sintetica', referenciaVersao: VERSAO, quantidadePlanejada: 500, unidadePlanejada: 'mg', valorReferencia: valor, unidadeReferencia: 'mg', percentual: 500 / valor * 100, diferencaNaUnidadePlanejada: 500 - valor, diferencaArredondada: false, ...extra });
  return {
    estado: 'calculado', fonteReferencias: { autoridade: 'Health Canada', modificadaEm: '2025-11-19', licenca: 'OGL-Canada', licencaId: 'ca-ogl-lgo', urls: [] },
    versaoReferencias: VERSAO, contextoElegivel: elegivel, motivosContexto: motivos,
    nutrientes: Object.keys(nutrientes).map(codigo => {
      if (!elegivel) return { codigo, referencia: ind('contexto_nao_elegivel'), ul: ind('contexto_nao_elegivel') };
      if (codigo === 'calcioMg') return { codigo, referencia: comp('RDA', 1000), ul: comp('UL', 2500, { posicao: 'abaixo' }) };
      if (codigo === 'ferroMg') return { codigo, referencia: ind('dados_incompletos'), ul: ind('dados_incompletos') };
      return { codigo, referencia: ind('dados_incompletos'), ul: ind('nao_estabelecido') };
    })
  };
}
function analise(entrada, opcoes) {
  const incluidos = entrada.selecoes.reduce((n, s) => n + s.identidadesRefeicoes.length * 2, 0), nutrientes = cobertura(incluidos);
  const pediu = entrada.incluirReferencias === true;
  return {
    ajuda: ajudaSintetica(), schemaVersao: 1, motorVersao: 'food06-factual-v1', calculadoEm: '2026-10-31T12:00:00.000Z',
    publicacoes: entrada.selecoes.map(s => ({ planoId: s.planoId, versaoId: s.versaoIdEsperada, ativacaoRevisao: s.ativacaoRevisaoEsperada })),
    comparacoes: pediu && incluidos ? comparacoes(nutrientes, opcoes) : { estado: 'indisponivel', motivo: 'referencias_nao_habilitadas' }, cobertura: { schemaVersao: 1, nutrientes }
  };
}
async function preparar(page, resposta = analise) {
  const corpos = [];
  await prepararConsole(page);
  await page.route(url => url.pathname.endsWith('/analise-micronutrientes'), route => { const corpo = route.request().postDataJSON(); corpos.push(corpo); return resposta(corpo, route); });
  await page.route(url => url.pathname.endsWith('/selecao-calculo'), route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ planoId: planoIds[0], ativoParaPaciente: true, ativacaoRevisao: 1, versao: { id: 'versao-a', numero: 1, publicadaEm: '2026-10-15T12:00:00.000Z' }, refeicoes: [{ identidadeId: idsRefeicoes[0], nome: 'Refeição A', ordem: 0, ativa: true }] }) }));
  await page.route(url => url.pathname.endsWith('/calculo-combinado'), route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resultado(route.request().postDataJSON().selecoes.reduce((n, s) => n + s.identidadesRefeicoes.length * 2, 0))) }));
  await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Adicionar plano desta página').selectOption(planoIds[0]);
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(page.getByText('200 kcal')).toBeVisible();
  await page.getByRole('button', { name: 'Ver micronutrientes e cobertura', exact: true }).click();
  return corpos;
}
const regiao = page => page.getByRole('region', { name: 'Micronutrientes da seleção', exact: true });
const bloco = page => regiao(page).getByRole('region', { name: 'Comparação com referências DRI', exact: true });
async function responder(page, { gestacao = 'Não', lactacao = 'Não', tabagismo = 'Não fuma', dia = true, abrir = true } = {}) {
  const b = bloco(page);
  if (abrir) await b.getByRole('button', { name: 'Comparar com referências', exact: true }).click();
  await b.getByLabel(/^Gestação/).selectOption({ label: gestacao });
  await b.getByLabel(/^Lactação/).selectOption({ label: lactacao });
  await b.getByLabel('População de referência para o cálculo').selectOption({ label: 'Feminina' });
  await b.getByRole('checkbox', { name: /Conferi a população/ }).check();
  await b.getByLabel('Aplicabilidade da população').selectOption({ label: 'Confirmada para esta análise' });
  await b.getByLabel(/^Tabagismo/).selectOption({ label: tabagismo });
  if (dia) await b.getByRole('checkbox', { name: /formam o dia completo/ }).check();
}
const linhaCalcio = page => regiao(page).getByRole('row', { name: /Cálcio/ });

test('FOOD06 T4a sem pedido a tabela é a de sempre: "Não solicitada" e nenhuma flag no corpo', async ({ page }, testInfo) => {
  const corpos = await preparar(page, (c, r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(analise(c)) }));
  await expect(linhaCalcio(page)).toContainText('Não solicitada');
  await expect(regiao(page)).toContainText('A comparação com referências (RDA, AI e UL) não foi solicitada.');
  await expect(regiao(page)).not.toContainText('Referência (total planejado do dia)');
  expect(corpos.length).toBeGreaterThan(0);
  for (const c of corpos) expect(Object.keys(c)).toEqual(['selecoes']);
  expect((await new AxeBuilder({ page }).include('[aria-label="Micronutrientes da seleção"]').analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('sem-pedido.png'), fullPage: false });
});

test('FOOD06 T4a aplica só com tudo respondido, envia só as 7 confirmações e mostra o texto factual', async ({ page }, testInfo) => {
  const corpos = await preparar(page, (c, r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(analise(c)) }));
  const b = bloco(page);
  await b.getByRole('button', { name: 'Comparar com referências', exact: true }).click();
  // Nada vem respondido: o botão fica desabilitado e a lista diz o que falta.
  await expect(b.getByRole('button', { name: 'Aplicar comparação', exact: true })).toBeDisabled();
  await expect(b).toContainText('Falta responder: gestação, lactação, população de referência, aplicabilidade, dia completo.');
  await responder(page, { abrir: false });
  await expect(b.getByRole('button', { name: 'Aplicar comparação', exact: true })).toBeEnabled();
  const antes = corpos.length;
  await b.getByRole('button', { name: 'Aplicar comparação', exact: true }).click();
  await expect(linhaCalcio(page)).toContainText('Planejado: 500 mg = 50% da RDA (1.000 mg)');
  await expect(linhaCalcio(page)).toContainText('Limite superior (UL): total planejado abaixo de 2.500 mg');
  await expect(regiao(page).getByRole('columnheader', { name: 'Referência (total planejado do dia)' })).toBeVisible();
  await expect(regiao(page).getByRole('row', { name: /Ferro/ })).toContainText('Não comparável: faltam dados de alguns alimentos do plano');
  await expect(regiao(page)).toContainText('Comparado em 1 de 22 nutrientes. Faltam dados de alguns alimentos do plano em 21.');
  await expect(b).toContainText('Referências DRI ativas: população de referência feminina, sem gestação nem lactação, não fuma. Dia completo confirmado.');
  const enviado = corpos.slice(antes).find(c => c.incluirReferencias === true);
  expect(enviado.confirmacoes).toEqual({ populacaoReferencia: 'feminina', populacaoConfirmada: true, gestacao: 'nao', lactacao: 'nao', aplicabilidade: 'confirmada', mesmoDiaPlanejado: true, tabagismo: 'nao' });
  expect(JSON.stringify(enviado)).not.toMatch(/"(nascimento|dataAnalise|idadeAnos|elegivel)"/);
  // Nada de cor de diagnóstico: o texto da célula não carrega estilo próprio de alerta.
  expect(await linhaCalcio(page).locator('td').last().evaluate(e => e.className)).not.toMatch(/red|amber|yellow|green|alerta|perigo/);
  // "Como ler" e fonte, uma vez acima da tabela.
  await regiao(page).getByText('Como ler esta comparação', { exact: true }).click();
  await expect(regiao(page)).toContainText('Fonte: Health Canada, tabela de 19/11/2025, licença OGL-Canada.');
  await expect(regiao(page).getByText('Como ler esta comparação')).toHaveCount(1);
  expect((await new AxeBuilder({ page }).include('[aria-label="Micronutrientes da seleção"]').analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('comparacao-ativa.png'), fullPage: false });
  // Desativar volta à tabela de sempre, sem pedir nada ao servidor com a flag.
  await b.getByRole('button', { name: 'Desativar comparação', exact: true }).click();
  await expect(linhaCalcio(page)).toContainText('Não solicitada');
  expect(corpos.at(-1).incluirReferencias).toBeUndefined();
});

test('FOOD06 T4a gestação ou lactação confirmadas ficam fora do escopo sem consultar o servidor', async ({ page }) => {
  const corpos = await preparar(page, (c, r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(analise(c)) }));
  await responder(page, { gestacao: 'Sim' });
  const b = bloco(page);
  await expect(b).toContainText('Fora do escopo: a comparação cobre apenas adultos sem gestação ou lactação.');
  await expect(b.getByRole('button', { name: 'Aplicar comparação', exact: true })).toBeDisabled();
  // O texto não sugere mudar a resposta para "passar".
  await expect(b).not.toContainText(/altere|mude a resposta|tente novamente com/i);
  // O pedido simples da análise sai depois de um debounce: contar pedidos seria frágil. O que importa é que nenhum pedia comparação.
  expect(corpos.filter(c => c.incluirReferencias === true)).toHaveLength(0);
});

test('FOOD06 T4a aplicabilidade não aplicável é fora do escopo e a conferência da população entra na lista de pendências', async ({ page }) => {
  const corpos = await preparar(page, (c, r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(analise(c)) }));
  const b = bloco(page);
  await responder(page, { dia: true });
  await b.getByLabel('Aplicabilidade da população').selectOption({ label: 'Não aplicável' });
  await expect(b).toContainText('A população não é aplicável a esta comparação. Os valores factuais continuam disponíveis.');
  await expect(b.getByRole('button', { name: 'Aplicar comparação', exact: true })).toBeDisabled();
  await b.getByLabel('Aplicabilidade da população').selectOption({ label: 'Confirmada para esta análise' });
  await b.getByRole('checkbox', { name: /Conferi a população/ }).uncheck();
  await expect(b).toContainText('Falta responder: conferência da população.');
  await expect(b.getByRole('button', { name: 'Aplicar comparação', exact: true })).toBeDisabled();
  // O pedido simples da análise sai depois de um debounce: contar pedidos seria frágil. O que importa é que nenhum pedia comparação.
  expect(corpos.filter(c => c.incluirReferencias === true)).toHaveLength(0);
});

test('FOOD06 T4a a linha de status usa os rótulos do formulário e avisa o efeito de tabagismo não informado', async ({ page }) => {
  await preparar(page, (c, r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(analise(c)) }));
  await responder(page, { tabagismo: 'Não informado' });
  await bloco(page).getByRole('button', { name: 'Aplicar comparação', exact: true }).click();
  await expect(bloco(page)).toContainText('tabagismo não informado (a vitamina C fica sem comparação)');
  await bloco(page).getByRole('button', { name: 'Alterar respostas', exact: true }).click();
  await bloco(page).getByLabel(/^Tabagismo/).selectOption({ label: 'Fuma' });
  await bloco(page).getByRole('button', { name: 'Aplicar comparação', exact: true }).click();
  await expect(bloco(page)).toContainText('sem gestação nem lactação, fuma. Dia completo confirmado.');
});

test('FOOD06 T4a UL de forma restrita não fica em silêncio: a célula diz que não é comparável com o total de alimentos', async ({ page }) => {
  await preparar(page, (c, r) => {
    const corpo = analise(c);
    if (corpo.comparacoes.estado === 'calculado') {
      Object.assign(corpo.cobertura.nutrientes.magnesioMg, { estado: 'COMPLETO', total: 300, contagens: { incluidos: 2, conhecidos: 2, semComposicao: 0, incompativeis: 0, naoResolvidos: 0 }, causas: [] });
      const n = corpo.comparacoes.nutrientes.find(x => x.codigo === 'magnesioMg');
      n.referencia = { estado: 'comparavel', tipo: 'RDA', referenciaId: 'x', referenciaVersao: VERSAO, quantidadePlanejada: 300, unidadePlanejada: 'mg', valorReferencia: 320, unidadeReferencia: 'mg', percentual: 93.75, diferencaNaUnidadePlanejada: -20, diferencaArredondada: false };
      n.ul = { estado: 'indisponivel', motivo: 'abrangencia_ul_incompativel' };
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) });
  });
  await responder(page);
  await bloco(page).getByRole('button', { name: 'Aplicar comparação', exact: true }).click();
  const linha = regiao(page).getByRole('row', { name: /Magnésio/ });
  await expect(linha).toContainText('Planejado: 300 mg = 94% da RDA (320 mg)');
  await expect(linha).toContainText('UL não comparável: o limite vale para uma forma específica');
  // UL "não estabelecido" continua sem linha própria (o "Como ler" explica); aqui só o cálcio tem UL comparável.
  // (O detalhe da linha, dentro de "Cobertura e detalhes", traz o motivo por extenso; a célula de Referência não.)
  await expect(regiao(page).getByRole('row', { name: /Zinco/ }).locator('td').last()).not.toContainText('UL');
  await expect(regiao(page).getByRole('row', { name: /Zinco/ })).toContainText('A fonte não estabelece limite superior para este nutriente e grupo.');
});

test('FOOD06 T4a resposta atrasada da comparação não aparece depois de mudar a seleção', async ({ page }) => {
  let liberar; const barreira = new Promise(resolve => { liberar = resolve; }); let pedidosComReferencia = 0;
  await preparar(page, async (c, r) => {
    const corpo = analise(c);
    if (c.incluirReferencias === true) { pedidosComReferencia++; await barreira; }
    try { await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) }); } catch { /* Pedido sintético abortado após mudar a seleção. */ }
  });
  await responder(page);
  await bloco(page).getByRole('button', { name: 'Aplicar comparação', exact: true }).click();
  await expect.poll(() => pedidosComReferencia).toBe(1);
  await page.getByRole('checkbox', { name: 'Refeição A' }).uncheck();
  await expect(regiao(page)).toContainText('Nenhum alimento ativo incluído');
  await expect(bloco(page)).toContainText('A seleção mudou.');
  liberar();
  // O resultado da seleção anterior nunca é pintado sobre a seleção atual.
  await expect(regiao(page)).not.toContainText('50% da RDA');
  await expect(regiao(page)).not.toContainText('Comparado em 1 de 22');
  await expect(linhaCalcio(page)).not.toContainText('RDA');
});

test('FOOD06 T4a contexto inelegível no servidor: aviso único e células sem repetir o motivo', async ({ page }) => {
  const corpos = await preparar(page, (c, r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(analise(c, { elegivel: false, motivos: ['nascimento_nao_informado'] })) }));
  await responder(page);
  await bloco(page).getByRole('button', { name: 'Aplicar comparação', exact: true }).click();
  await expect(regiao(page).getByText('Sem comparação com referências para este contexto.')).toHaveCount(1);
  await expect(regiao(page)).toContainText('O nascimento do paciente não está cadastrado.');
  await expect(regiao(page).getByText('O nascimento do paciente não está cadastrado.')).toHaveCount(1);
  await expect(linhaCalcio(page)).toContainText('Não comparável');
  await expect(linhaCalcio(page)).not.toContainText('nascimento');
  expect(corpos.some(c => c.incluirReferencias === true)).toBe(true);
});

test('FOOD06 T4a mudar a seleção desativa a comparação e só o dia completo é reconfirmado', async ({ page }) => {
  const corpos = await preparar(page, (c, r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(analise(c)) }));
  const b = bloco(page);
  await responder(page);
  await b.getByRole('button', { name: 'Aplicar comparação', exact: true }).click();
  await expect(linhaCalcio(page)).toContainText('50% da RDA');
  await page.getByRole('checkbox', { name: 'Refeição A' }).uncheck();
  await expect(regiao(page)).toContainText('Nenhum alimento ativo incluído');
  await expect(b).toContainText('A seleção mudou. Confirme de novo que as refeições formam o dia completo para comparar.');
  // O resultado anterior não fica visível, e as respostas do paciente continuam na tela.
  await expect(regiao(page)).not.toContainText('50% da RDA');
  await expect(b.getByLabel(/^Gestação/)).toHaveValue('nao');
  await expect(b.getByLabel('População de referência para o cálculo')).toHaveValue('feminina');
  await expect(b.getByRole('checkbox', { name: /formam o dia completo/ })).not.toBeChecked();
  await expect(b.getByRole('button', { name: 'Aplicar comparação', exact: true })).toBeDisabled();
  expect(corpos.at(-1).incluirReferencias).toBeUndefined();
});

test('FOOD06 T4a mudar uma resposta desativa a comparação até aplicar de novo (nunca números de outra premissa)', async ({ page }) => {
  const corpos = await preparar(page, (c, r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(analise(c)) }));
  const b = bloco(page);
  await responder(page);
  await b.getByRole('button', { name: 'Aplicar comparação', exact: true }).click();
  await expect(linhaCalcio(page)).toContainText('50% da RDA');
  await b.getByRole('button', { name: 'Alterar respostas', exact: true }).click();
  await b.getByLabel(/^Tabagismo/).selectOption({ label: 'Fuma' });
  await expect(linhaCalcio(page)).toContainText('Não solicitada');
  await expect(regiao(page)).not.toContainText('50% da RDA');
  await expect(b.getByLabel(/^Tabagismo/)).toBeVisible();
  const antes = corpos.length;
  await b.getByRole('button', { name: 'Aplicar comparação', exact: true }).click();
  await expect(linhaCalcio(page)).toContainText('50% da RDA');
  expect(corpos.slice(antes).find(c => c.incluirReferencias === true).confirmacoes.tabagismo).toBe('sim');
});

test('FOOD06 T4a falha com a comparação ativa mantém as respostas e oferece nova tentativa', async ({ page }) => {
  let falhar = false;
  await preparar(page, (c, r) => falhar && c.incluirReferencias ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"erro interno"}' }) : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(analise(c)) }));
  await responder(page);
  falhar = true;
  await bloco(page).getByRole('button', { name: 'Aplicar comparação', exact: true }).click();
  await expect(regiao(page).getByRole('alert')).toContainText('Não foi possível carregar uma análise válida');
  await expect(regiao(page)).not.toContainText('50% da RDA');
  await expect(regiao(page)).not.toContainText('erro interno');
  falhar = false;
  // O histórico (não simulado aqui) também tem "Tentar novamente"; o da tabela vem antes no documento.
  await regiao(page).getByRole('button', { name: 'Tentar novamente', exact: true }).first().click();
  await expect(linhaCalcio(page)).toContainText('50% da RDA');
});

test('FOOD06 T4a resposta incoerente com a cobertura não apresenta comparação nem erro interno', async ({ page }) => {
  await preparar(page, (c, r) => {
    const corpo = analise(c);
    // Percentual sobre nutriente parcial: o servidor nunca deveria enviar, a tela falha fechada.
    if (corpo.comparacoes.estado === 'calculado') corpo.comparacoes.nutrientes.find(n => n.codigo === 'ferroMg').referencia = { ...corpo.comparacoes.nutrientes.find(n => n.codigo === 'calcioMg').referencia };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) });
  });
  await responder(page);
  await bloco(page).getByRole('button', { name: 'Aplicar comparação', exact: true }).click();
  await expect(regiao(page).getByRole('alert')).toContainText('Não foi possível carregar uma análise válida');
  await expect(regiao(page)).not.toContainText('% da RDA');
});

test('FOOD06 T4a o registro reaproveita as respostas da comparação ativa em vez de perguntar de novo', async ({ page }) => {
  await preparar(page, (c, r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(analise(c)) }));
  const registro = regiao(page).getByRole('region', { name: 'Salvar análise factual', exact: true });
  await expect(registro.getByRole('checkbox', { name: 'Registrar contexto desta análise' })).toBeVisible();
  await responder(page);
  await bloco(page).getByRole('button', { name: 'Aplicar comparação', exact: true }).click();
  await expect(linhaCalcio(page)).toContainText('50% da RDA');
  await expect(registro.getByRole('checkbox', { name: 'Registrar contexto desta análise' })).toHaveCount(0);
  await expect(registro.locator('[data-contexto-compartilhado="true"]')).toContainText('sem repetir as respostas');
  await expect(registro.locator('[data-contexto-compartilhado="true"]')).toContainText('População: feminina');
});

test('FOOD06 T4a teclado e celular: bloco recolhido por padrão, operável por teclado, sem rolagem horizontal da página', async ({ page }) => {
  await preparar(page, (c, r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(analise(c)) }));
  const b = bloco(page);
  const abrir = b.getByRole('button', { name: 'Comparar com referências', exact: true });
  await expect(abrir).toHaveAttribute('aria-expanded', 'false');
  await expect(b.getByLabel(/^Gestação/)).toBeHidden();
  await abrir.focus();
  await page.keyboard.press('Enter');
  await expect(b.getByRole('button', { name: 'Fechar respostas', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(b.getByLabel(/^Gestação/)).toBeVisible();
  await page.locator('html').evaluate(e => { e.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include('[aria-label="Comparação com referências DRI"]').analyze()).violations).toEqual([]);
});

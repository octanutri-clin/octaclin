import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pacienteId, planoIds, idsRefeicoes, resultado, prepararConsole } from './fixtures/console-pa06.mjs';
import { CAMPOS_MICRONUTRIENTES_PLANO } from '../../lib/micronutrientes-plano.ts';

// FOOD06 T4b: comparação com referências DRI no relatório impresso, só por escolha explícita. Dados sintéticos.
const id = '20000000-0000-4000-8000-000000000097';
const VERSAO = 'dri-hc-2025-11-19-adulto-v1';
const contexto = { schemaVersao: 1, dataAnalise: '2026-11-06', idadeAnos: 36, populacaoReferencia: 'feminina', mesmoDiaPlanejado: true, tabagismo: 'nao', motivos: [] };
function nutrientes(ferro) {
  return Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c => [c.codigo, {
    codigo: c.codigo, unidade: c.unidade, estado: c.codigo === 'ferroMg' ? 'COMPLETO' : 'DESCONHECIDO', ...(c.codigo === 'ferroMg' ? { total: ferro } : {}),
    contagens: { incluidos: 2, conhecidos: c.codigo === 'ferroMg' ? 2 : 0, semComposicao: c.codigo === 'ferroMg' ? 0 : 2, incompativeis: 0, naoResolvidos: 0 },
    causas: c.codigo === 'ferroMg' ? [] : [{ codigo: 'ausente', quantidade: 2 }]
  }]));
}
function registroHistorico() {
  return {
    schemaVersao: 1, registro: { id, criadoEm: '2026-11-06T12:00:00.000Z' }, origem: { planoId: planoIds[0], versaoId: 'versao-a', numero: 1, status: 'publicada', registradaEm: '2026-10-15T12:00:00.000Z' },
    motorVersao: 'food06-v1', referencias: { estado: 'indisponivel', motivo: 'referencias_nao_habilitadas' }, bases: { planejamentoDocumentado: true, composicaoDocumentada: true, contextoDocumentado: true },
    comparacaoAnterior: { planejamento: 'SEM_REGISTRO_ANTERIOR', composicaoFonte: 'SEM_REGISTRO_ANTERIOR', referencia: 'SEM_REGISTRO_ANTERIOR', contexto: 'SEM_REGISTRO_ANTERIOR', cobertura: Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c => [c.codigo, 'SEM_REGISTRO_ANTERIOR'])) },
    nutrientes: nutrientes(0)
  };
}
function comparacao(ferro) {
  const ind = motivo => ({ estado: 'indisponivel', motivo });
  const comp = (tipo, valor, extra = {}) => ({ estado: 'comparavel', tipo, referenciaId: 'x', referenciaVersao: VERSAO, quantidadePlanejada: ferro, unidadePlanejada: 'mg', valorReferencia: valor, unidadeReferencia: 'mg', percentual: ferro / valor * 100, diferencaNaUnidadePlanejada: ferro - valor, diferencaArredondada: false, ...extra });
  return {
    estado: 'calculado', fonteReferencias: { autoridade: 'Health Canada', modificadaEm: '2025-11-19', licenca: 'OGL-Canada', licencaId: 'ca-ogl-lgo', urls: [] }, versaoReferencias: VERSAO, contextoElegivel: true, motivosContexto: [],
    nutrientes: CAMPOS_MICRONUTRIENTES_PLANO.map(c => c.codigo === 'ferroMg'
      ? { codigo: c.codigo, referencia: comp('RDA', 18), ul: comp('UL', 45, { posicao: ferro > 45 ? 'acima' : ferro === 45 ? 'igual' : 'abaixo' }) }
      : { codigo: c.codigo, referencia: ind('dados_incompletos'), ul: ind('dados_incompletos') })
  };
}
function relatorio(ferro, referencias) {
  const h = registroHistorico();
  return {
    schemaVersao: 2, motorVersao: 'food06-relatorio-factual-v2', geradoEm: '2026-11-06T14:00:00.000Z', registro: h.registro, origem: h.origem, referencias,
    contextoClinico: { estado: 'resumo_documentado', resumo: contexto }, fontesComposicao: { estado: 'nao_projetadas_neste_contrato' }, avisos: [],
    limites: ['alimentacao_planejada_nao_consumo_real', 'ausencia_nao_equivale_a_zero', 'sem_diagnostico_ou_recomendacao', 'composicao_congelada_sem_catalogo_atual'],
    selecao: { planoAtivo: true, planoSelecionado: true, refeicoes: [{ identidadeId: idsRefeicoes[0], ativa: true, selecionada: true }] },
    analise: {
      calculo: { nutrientes: Object.fromEntries(['energiaKcal', 'proteinasG', 'carboidratosG', 'gordurasG'].map(c => [c, { codigo: c, unidade: c === 'energiaKcal' ? 'kcal' : 'g', estado: 'completo', total: c === 'energiaKcal' ? 200 : 10, itensIncluidos: 2, itensComValor: 2 }])) },
      cobertura: { schemaVersao: 1, nutrientes: nutrientes(ferro) }
    }
  };
}
/** modo: 'normal' (registro v2), 'sem_referencias' (registro antigo), 'acima' (ferro acima do UL) ou 'falha' (primeira busca com a escolha falha). */
async function abrir(page, testInfo, modo = 'normal') {
  const pedidos = [], ferro = modo === 'acima' ? 50 : 9;
  let textoPdf = '';
  const pdfReal = process.env.FOOD06_PDF_REAL === 'true';
  if (pdfReal) {
    const { execFileSync } = await import('node:child_process');
    await page.exposeFunction('__pdfReferencias', async () => {
      const caminho = testInfo.outputPath(`referencias-${modo}.pdf`);
      await page.pdf({ path: caminho, format: 'A4', tagged: true, printBackground: true });
      textoPdf = execFileSync('pdftotext', ['-layout', caminho, '-']).toString();
    });
  }
  await page.addInitScript(pdf => { window.print = async () => { window.__impressoes = (window.__impressoes ?? 0) + 1; if (pdf) await window.__pdfReferencias(); window.dispatchEvent(new Event('afterprint')); }; }, pdfReal);
  await prepararConsole(page);
  await page.route(u => u.pathname.endsWith('/selecao-calculo'), r => r.fulfill({ status: 200, json: { planoId: planoIds[0], ativoParaPaciente: true, ativacaoRevisao: 1, versao: { id: 'versao-a', numero: 1, publicadaEm: '2026-10-15T12:00:00.000Z' }, refeicoes: [{ identidadeId: idsRefeicoes[0], nome: 'Refeição A', ordem: 0, ativa: true }] } }));
  await page.route(u => u.pathname.endsWith('/calculo-combinado'), r => r.fulfill({ status: 200, json: resultado(2) }));
  await page.route(u => u.pathname.endsWith('/analises-factuais/historico'), r => { const b = r.request().postDataJSON(); return r.fulfill({ status: 200, json: { schemaVersao: 1, itens: [{ ...registroHistorico(), ...(b.incluirContexto ? { contextoConfirmado: contexto } : {}) }], temMais: false } }); });
  await page.route(u => u.pathname.endsWith('/analises-factuais/relatorio'), r => {
    const b = r.request().postDataJSON(); pedidos.push(b);
    if (modo === 'falha' && b.incluirReferencias && pedidos.filter(p => p.incluirReferencias).length === 1) return r.fulfill({ status: 500, json: { message: 'CANARIO_INTERNO' } });
    const referencias = !b.incluirReferencias ? { estado: 'indisponivel', motivo: 'referencias_nao_habilitadas' }
      : modo === 'sem_referencias' ? { estado: 'indisponivel', motivo: 'registro_sem_referencias' } : comparacao(ferro);
    return r.fulfill({ status: 200, json: relatorio(ferro, referencias) });
  });
  await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Adicionar plano desta página').selectOption(planoIds[0]);
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  // Espera o cálculo inicial: um recálculo pendente revalida a leitura e fecha o relatório aberto (comportamento de proteção já existente).
  await expect(page.getByText('200 kcal')).toBeVisible();
  await page.getByRole('button', { name: 'Ver histórico de micronutrientes', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Carregar contextos registrados', exact: true }).check();
  const detalhes = page.getByRole('row', { name: /^Análise 1/ }).getByText('Contexto registrado', { exact: true });
  await detalhes.focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Conferir relatório com contexto da análise 1', exact: true }).click();
  const previa = page.getByRole('region', { name: 'Prévia do relatório factual', exact: true });
  await expect(previa).toContainText('Contexto registrado nesta análise');
  // O pdftotext quebra linhas no meio das frases: compara com espaços normalizados (as páginas seguem separadas por \f).
  return { previa, pedidos, pdfReal, textoPdf: () => textoPdf.split('\f').map(p => p.replace(/\s+/g, ' ')).join('\f') };
}
const caixa = previa => previa.getByRole('checkbox', { name: 'Incluir comparação com referências DRI nesta folha', exact: true });
const folha = previa => previa.locator('article');
async function imprimir(page, previa) {
  const antes = await page.evaluate(() => window.__impressoes ?? 0);
  await previa.getByRole('button', { name: 'Imprimir / salvar PDF', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__impressoes ?? 0)).toBe(antes + 1);
}

test('FOOD06 T4b desligada por padrão: folha de sempre, pedido sem a flag e lembrete ao profissional', async ({ page }, testInfo) => {
  const { previa, pedidos, pdfReal, textoPdf } = await abrir(page, testInfo);
  await expect(caixa(previa)).not.toBeChecked();
  await expect(previa).toContainText('A folha impressa pode ser lida pelo paciente sem você por perto.');
  await expect(folha(previa)).not.toContainText('Comparação com referências DRI');
  await expect(folha(previa)).toContainText('Referências RDA/AI/UL e percentuais indisponíveis.');
  await imprimir(page, previa);
  for (const p of pedidos) expect(p.incluirReferencias).toBeUndefined();
  if (pdfReal) {
    await expect.poll(textoPdf).not.toBe('');
    expect(textoPdf()).not.toMatch(/Comparação com referências|Converse com seu nutricionista|pode ser lida pelo paciente/);
  }
  expect((await new AxeBuilder({ page }).include('[data-food06-exportacao]').analyze()).violations).toEqual([]);
});

test('FOOD06 T4b com a escolha: seção em página própria com "Como ler", fonte e frase fixa na mesma página da tabela', async ({ page }, testInfo) => {
  const { previa, pedidos, pdfReal, textoPdf } = await abrir(page, testInfo);
  await caixa(previa).check();
  const secao = folha(previa).locator('[data-folha-referencias="true"]');
  await expect(secao).toContainText('Comparação com referências DRI (total planejado do dia)');
  await expect(secao).toContainText('Como ler esta comparação');
  await expect(secao).toContainText('Fonte: Health Canada, tabela de 19/11/2025, licença OGL-Canada.');
  await expect(secao).toContainText('Dúvidas sobre estes números? Converse com seu nutricionista.');
  await expect(secao.getByRole('row', { name: /^Ferro/ })).toContainText('Planejado: 9 mg = 50% da RDA (18 mg)');
  await expect(secao.getByRole('row', { name: /^Ferro/ })).toContainText('Limite superior (UL): total planejado abaixo de 45 mg');
  await expect(folha(previa)).toContainText('A comparação usa a versão de referência registrada nesta análise.');
  // Tabagismo (dado de saúde) não vai para a folha, nem no contexto nem na célula.
  await expect(folha(previa)).not.toContainText(/Tabagismo|fuma/);
  await expect(folha(previa)).not.toContainText('Referências RDA/AI/UL e percentuais indisponíveis.');
  // Lembrete e controles ficam fora da folha.
  await expect(folha(previa)).not.toContainText('pode ser lida pelo paciente');
  await imprimir(page, previa);
  expect(pedidos.at(-1)).toEqual({ registroId: id, versaoRelatorio: 2, incluirOrigem: true, incluirReferencias: true });
  expect(pedidos.at(-2)).toEqual(pedidos.at(-1));
  if (pdfReal) {
    await expect.poll(textoPdf).not.toBe('');
    const paginas = textoPdf().split('\f');
    const pagina = paginas.find(p => p.includes('Como ler esta comparação'));
    expect(pagina).toBeTruthy();
    // "Como ler" e a frase fixa na mesma página do início da tabela.
    expect(pagina).toContain('Converse com seu nutricionista');
    expect(pagina).toMatch(/Cálcio/);
    expect(textoPdf()).toContain('Planejado: 9 mg = 50% da RDA (18 mg)');
    expect(textoPdf()).not.toMatch(/Tabagismo|tabagismo|fuma/);
    expect(textoPdf()).not.toMatch(/pode ser lida pelo paciente|Incluir comparação|Atualizando/);
    // A tabela continua em outra página: cabeçalho e rodapé ("não é diagnóstico" + conversa) se repetem em cada uma.
    const daSecao = paginas.filter(p => p.includes('Comparação (total planejado do dia)'));
    expect(daSecao.length).toBeGreaterThanOrEqual(2);
    for (const p of daSecao) { expect(p).toContain('não é diagnóstico'); expect(p).toContain('Converse com seu nutricionista'); }
  }
  expect((await new AxeBuilder({ page }).include('[data-food06-exportacao]').analyze()).violations).toEqual([]);
  // Desligar volta à folha de sempre.
  await caixa(previa).uncheck();
  await expect(folha(previa)).not.toContainText('Comparação com referências DRI');
  await expect(folha(previa)).toContainText('Referências RDA/AI/UL e percentuais indisponíveis.');
});

test('FOOD06 T4b registro sem referências: explicação só na tela, nada no papel', async ({ page }, testInfo) => {
  const { previa, pdfReal, textoPdf } = await abrir(page, testInfo, 'sem_referencias');
  await caixa(previa).check();
  await expect(previa).toContainText('Este registro não tem referências');
  await expect(folha(previa)).not.toContainText('Comparação com referências DRI');
  await expect(folha(previa)).not.toContainText('não tem referências');
  await imprimir(page, previa);
  if (pdfReal) {
    await expect.poll(textoPdf).not.toBe('');
    expect(textoPdf()).not.toMatch(/não tem referências|não registradas|Comparação com referências/);
  }
});

test('FOOD06 T4b total acima do UL: aviso só ao profissional, folha com o texto factual', async ({ page }, testInfo) => {
  const { previa, pdfReal, textoPdf } = await abrir(page, testInfo, 'acima');
  await caixa(previa).check();
  await expect(previa).toContainText('Há nutrientes com total planejado acima do limite superior (UL). Confira antes de entregar a folha.');
  await expect(folha(previa)).not.toContainText('Confira antes de entregar');
  await expect(folha(previa).getByRole('row', { name: /^Ferro/ }).last()).toContainText('Limite superior (UL): total planejado acima de 45 mg');
  await imprimir(page, previa);
  if (pdfReal) {
    await expect.poll(textoPdf).not.toBe('');
    expect(textoPdf()).toContain('total planejado acima de 45 mg');
    expect(textoPdf()).not.toContain('Confira antes de entregar');
    expect(textoPdf()).not.toMatch(/\b(seguro|excesso|risco|perigo|reduza|evite)\b/i);
  }
});

test('FOOD06 T4b falha ao buscar com a escolha: erro na tela, nada imprimível e nova tentativa', async ({ page }, testInfo) => {
  const { previa } = await abrir(page, testInfo, 'falha');
  await caixa(previa).check();
  await expect(previa.getByRole('alert')).toContainText('Não foi possível atualizar a prévia com a sua escolha. Nada foi enviado à impressão.');
  await expect(previa).not.toContainText('CANARIO_INTERNO');
  await expect(previa.getByRole('button', { name: 'Imprimir / salvar PDF', exact: true })).toBeDisabled();
  await expect(folha(previa)).not.toContainText('Comparação com referências DRI');
  await previa.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(folha(previa).locator('[data-folha-referencias="true"]')).toContainText('Como ler esta comparação');
  await expect(previa.getByRole('button', { name: 'Imprimir / salvar PDF', exact: true })).toBeEnabled();
});

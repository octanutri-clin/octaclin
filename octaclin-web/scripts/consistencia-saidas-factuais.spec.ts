import assert from 'node:assert/strict';
import test from 'node:test';
import { lerAnaliseMicronutrientesFactual } from '../lib/micronutrientes-factuais';
import { CAMPOS_MICRONUTRIENTES_PLANO } from '../lib/micronutrientes-plano';
import { lerRelatorioFactual } from '../lib/relatorio-factual';
import { resumirComparacao, type ComparacaoNutrienteFactual, type ReferenciasFactuais } from '../lib/referencias-dieteticas-factuais';
import {
  MOTIVO_COMPARACAO_CURTO, MOTIVO_COMPARACAO_LONGO, MOTIVO_CONTEXTO_TEXTO, textoFonteReferencias, textoReferencia, textoResumoComparacao, textoUl
} from '../lib/textos-referencias-dieteticas';

/**
 * FOOD06 T6 (M03-C2): uma única análise sintética passa pelos leitores da tabela ao vivo e do relatório
 * registrado; tabela, detalhes e folha precisam mostrar os mesmos números e motivos, e nenhum campo extra
 * (canário) pode atravessar leitores, textos ou mensagens de erro. Só dados sintéticos.
 */
const VERSAO = 'dri-hc-2025-11-19-adulto-v1';
const CANARIO = 'CANARIO_T6_NAO_VAZAR';
type Solto = Record<string, unknown>;
type Comparavel = Extract<ComparacaoNutrienteFactual, { estado: 'comparavel' }>;
const entrada = { selecoes: [{ planoId: 'p1', versaoIdEsperada: 'v1', ativacaoRevisaoEsperada: 2, identidadesRefeicoes: ['r1'] }] };

const TOTAIS: Record<string, number> = { calcioMg: 500, vitaminaCMg: 90, zincoMg: 60 };
const PARCIAL = 'ferroMg';

function cobertura(): Solto {
  const nutrientes = Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c => {
    const total = TOTAIS[c.codigo];
    if (total !== undefined) return [c.codigo, { codigo: c.codigo, unidade: c.unidade, estado: 'COMPLETO', total, contagens: { incluidos: 2, conhecidos: 2, semComposicao: 0, incompativeis: 0, naoResolvidos: 0 }, causas: [] }];
    if (c.codigo === PARCIAL) return [c.codigo, { codigo: c.codigo, unidade: c.unidade, estado: 'PARCIAL', quantidadeConhecida: 2, contagens: { incluidos: 2, conhecidos: 1, semComposicao: 1, incompativeis: 0, naoResolvidos: 0 }, causas: [{ codigo: 'ausente', quantidade: 1 }] }];
    return [c.codigo, { codigo: c.codigo, unidade: c.unidade, estado: 'DESCONHECIDO', contagens: { incluidos: 2, conhecidos: 0, semComposicao: 2, incompativeis: 0, naoResolvidos: 0 }, causas: [{ codigo: 'ausente', quantidade: 2 }] }];
  }));
  return { schemaVersao: 1, nutrientes };
}
const ind = (motivo: string) => ({ estado: 'indisponivel', motivo });
const comp = (tipo: string, q: number, ref: number, pct: number, extra: Solto = {}) => ({ estado: 'comparavel', tipo, referenciaId: CANARIO, referenciaVersao: VERSAO, quantidadePlanejada: q, unidadePlanejada: 'mg', valorReferencia: ref, unidadeReferencia: 'mg', percentual: pct, diferencaNaUnidadePlanejada: q - ref, diferencaArredondada: false, ...extra });
function comparacoes(): Solto {
  return {
    estado: 'calculado', fonteReferencias: { autoridade: 'Health Canada', modificadaEm: '2025-11-19', licenca: 'OGL-Canada', licencaId: 'ca-ogl-lgo', urls: [CANARIO] },
    versaoReferencias: VERSAO, contextoElegivel: true, motivosContexto: [],
    nutrientes: CAMPOS_MICRONUTRIENTES_PLANO.map(c => {
      if (c.codigo === 'calcioMg') return { codigo: c.codigo, referencia: comp('RDA', 500, 1000, 50), ul: comp('UL', 500, 2500, 20, { posicao: 'abaixo' }) };
      if (c.codigo === 'vitaminaCMg') return { codigo: c.codigo, referencia: comp('RDA', 90, 125, 72, { ajusteTabagismoMg: 35 }), ul: comp('UL', 90, 2000, 4.5, { posicao: 'abaixo' }) };
      if (c.codigo === 'zincoMg') return { codigo: c.codigo, referencia: comp('RDA', 60, 11, 545.45), ul: comp('UL', 60, 40, 150, { posicao: 'acima' }) };
      if (c.codigo === PARCIAL) return { codigo: c.codigo, referencia: ind('dados_incompletos'), ul: ind('dados_incompletos') };
      return { codigo: c.codigo, referencia: ind('dados_incompletos'), ul: ind('nao_estabelecido') };
    })
  };
}
function analiseAoVivo(): Solto {
  return { schemaVersao: 1, motorVersao: 'food06-factual-v1', calculadoEm: '2026-10-31T12:00:00.000Z', publicacoes: [{ planoId: 'p1', versaoId: 'v1', ativacaoRevisao: 2 }], cobertura: cobertura(), comparacoes: comparacoes() };
}
function relatorio(): Solto {
  const macros = Object.fromEntries(['energiaKcal', 'proteinasG', 'carboidratosG', 'gordurasG'].map(c => [c, { codigo: c, unidade: c === 'energiaKcal' ? 'kcal' : 'g', estado: c === 'energiaKcal' ? 'completo' : 'indisponivel', ...(c === 'energiaKcal' ? { total: 800 } : {}), itensIncluidos: 2, itensComValor: c === 'energiaKcal' ? 2 : 0 }]));
  return {
    schemaVersao: 2, motorVersao: 'food06-relatorio-factual-v2', geradoEm: '2026-11-05T14:00:00.000Z', registro: { id: 'registro', criadoEm: '2026-11-05T12:00:00.000Z' },
    origem: { planoId: 'plano', versaoId: 'versao', numero: 2, status: 'publicada', registradaEm: '2026-11-04T12:00:00.000Z' },
    referencias: comparacoes(), contextoClinico: { estado: 'nao_registrado' }, fontesComposicao: { estado: 'nao_projetadas_neste_contrato' }, avisos: [],
    limites: ['alimentacao_planejada_nao_consumo_real', 'ausencia_nao_equivale_a_zero', 'sem_diagnostico_ou_recomendacao', 'composicao_congelada_sem_catalogo_atual'],
    selecao: { planoAtivo: true, planoSelecionado: true, refeicoes: [{ identidadeId: 'refeicao', ativa: true, selecionada: true }] },
    analise: { calculo: { nutrientes: macros }, cobertura: cobertura() }
  };
}
function referenciasDeAmbas(): { vivo: ReferenciasFactuais; folha: ReferenciasFactuais } {
  const vivo = lerAnaliseMicronutrientesFactual(analiseAoVivo(), entrada, { referencias: true }).referencias;
  const r = lerRelatorioFactual(relatorio(), 'registro', { referencias: true }).referencias;
  assert.ok(vivo && r && r.estado === 'calculado');
  return { vivo, folha: r.dados };
}
/** Texto que a tabela mostra por nutriente (mesmo helper da célula): RDA/AI e UL ou o motivo. */
function textosDoNutriente(codigo: string, n: { referencia: ComparacaoNutrienteFactual; ul: ComparacaoNutrienteFactual }, paraFolha: boolean): string[] {
  const saida: string[] = [];
  for (const c of [n.referencia, n.ul]) {
    if (c.estado === 'comparavel') saida.push(c.tipo === 'UL' ? textoUl(codigo, c) : textoReferencia(codigo, c as Comparavel, paraFolha));
    else saida.push(`${MOTIVO_COMPARACAO_CURTO[c.motivo]}|${MOTIVO_COMPARACAO_LONGO[c.motivo]}`);
  }
  return saida;
}

test('tabela ao vivo e relatório registrado projetam exatamente as mesmas referências para a mesma análise', () => {
  const { vivo, folha } = referenciasDeAmbas();
  assert.deepEqual(folha, vivo);
  assert.equal(textoFonteReferencias(folha), textoFonteReferencias(vivo));
  assert.equal(textoResumoComparacao(resumirComparacao(folha)), textoResumoComparacao(resumirComparacao(vivo)));
});

test('os mesmos números e motivos aparecem na tabela, nos detalhes e na folha, nutriente por nutriente', () => {
  const { vivo, folha } = referenciasDeAmbas();
  assert.deepEqual(Object.keys(folha.nutrientes).sort(), CAMPOS_MICRONUTRIENTES_PLANO.map(c => c.codigo).sort());
  for (const codigo of Object.keys(vivo.nutrientes)) {
    // O ajuste de tabagismo é a única diferença permitida: a folha não diz o motivo.
    assert.deepEqual(textosDoNutriente(codigo, folha.nutrientes[codigo], false), textosDoNutriente(codigo, vivo.nutrientes[codigo], false), codigo);
    assert.deepEqual(textosDoNutriente(codigo, folha.nutrientes[codigo], true), textosDoNutriente(codigo, vivo.nutrientes[codigo], true), codigo);
  }
  const calcio = textosDoNutriente('calcioMg', vivo.nutrientes.calcioMg, false);
  assert.match(calcio[0], /500 mg = 50% da RDA \(1\.000 mg\)/);
  assert.match(calcio[1], /abaixo de 2\.500 mg/);
  assert.match(textosDoNutriente('zincoMg', vivo.nutrientes.zincoMg, false)[1], /acima de 40 mg/);
  assert.match(textosDoNutriente(PARCIAL, vivo.nutrientes[PARCIAL], false)[0], /faltam dados/);
  assert.doesNotMatch(textosDoNutriente(PARCIAL, vivo.nutrientes[PARCIAL], false).join(' '), /\d+%/);
});

test('tabagismo aparece com motivo só na tela; a folha mantém o mesmo número sem o motivo', () => {
  const { vivo, folha } = referenciasDeAmbas();
  const tela = textoReferencia('vitaminaCMg', vivo.nutrientes.vitaminaCMg.referencia as Comparavel, false);
  const impresso = textoReferencia('vitaminaCMg', folha.nutrientes.vitaminaCMg.referencia as Comparavel, true);
  assert.match(tela, /tabagismo/);
  assert.doesNotMatch(impresso, /tabagismo/i);
  assert.match(impresso, /\+35 mg/);
  assert.equal(tela.split(', com ')[0], impresso.split(', com ')[0]);
});

test('os totais mostrados na comparação são os da cobertura da mesma resposta (nunca recalculados)', () => {
  const { vivo } = referenciasDeAmbas();
  for (const [codigo, total] of Object.entries(TOTAIS)) {
    const c = vivo.nutrientes[codigo].referencia as Comparavel;
    assert.equal(c.quantidadePlanejada, total, codigo);
  }
  const adulterado = analiseAoVivo() as { comparacoes: { nutrientes: { codigo: string; referencia: Solto }[] } };
  adulterado.comparacoes.nutrientes.find(n => n.codigo === 'calcioMg')!.referencia.quantidadePlanejada = 501;
  assert.throws(() => lerAnaliseMicronutrientesFactual(adulterado, entrada, { referencias: true }));
  const folhaAdulterada = relatorio() as { referencias: { nutrientes: { codigo: string; referencia: Solto }[] } };
  folhaAdulterada.referencias.nutrientes.find(n => n.codigo === 'calcioMg')!.referencia.quantidadePlanejada = 501;
  assert.throws(() => lerRelatorioFactual(folhaAdulterada, 'registro', { referencias: true }));
});

test('canários em campos extras não atravessam leitores, textos nem mensagens de erro', () => {
  const vivoBruto = analiseAoVivo() as { comparacoes: Solto };
  const folhaBruta = relatorio() as { referencias: Solto };
  for (const alvo of [vivoBruto.comparacoes, folhaBruta.referencias] as { nutrientes: Solto[]; fonteReferencias: Solto }[]) {
    Object.assign(alvo, { segredo: CANARIO });
    Object.assign(alvo.fonteReferencias, { observacao: CANARIO });
    Object.assign(alvo.nutrientes[0], { nota: CANARIO });
    Object.assign((alvo.nutrientes[0] as { referencia: Solto }).referencia, { origem: CANARIO });
  }
  const vivo = lerAnaliseMicronutrientesFactual(vivoBruto, entrada, { referencias: true });
  const folha = lerRelatorioFactual(folhaBruta, 'registro', { referencias: true });
  const textos = Object.entries(vivo.referencias!.nutrientes).flatMap(([codigo, n]) => textosDoNutriente(codigo, n, false)).join('\n');
  for (const saida of [JSON.stringify(vivo), JSON.stringify(folha), textos, textoFonteReferencias(vivo.referencias!)]) assert.ok(!saida.includes('CANARIO'), 'campo extra vazou');
  // Mensagens de erro não ecoam o conteúdo recebido.
  const invalida = relatorio() as { referencias: Solto };
  Object.assign(invalida.referencias, { versaoReferencias: `${CANARIO} invalida` });
  assert.throws(() => lerRelatorioFactual(invalida, 'registro', { referencias: true }), (e: Error) => !e.message.includes('CANARIO'));
  assert.throws(() => lerAnaliseMicronutrientesFactual({ ...analiseAoVivo(), comparacoes: { estado: 'calculado', canario: CANARIO } }, entrada, { referencias: true }), (e: Error) => !e.message.includes('CANARIO'));
});

test('contexto fora do escopo: tabela e folha mostram o mesmo motivo e nenhum número', () => {
  const fora = comparacoes() as { contextoElegivel: boolean; motivosContexto: string[]; nutrientes: Solto[] };
  fora.contextoElegivel = false; fora.motivosContexto = ['gestacao_fora_do_escopo'];
  fora.nutrientes = CAMPOS_MICRONUTRIENTES_PLANO.map(c => ({ codigo: c.codigo, referencia: ind('contexto_nao_elegivel'), ul: ind('contexto_nao_elegivel') }));
  const vivo = lerAnaliseMicronutrientesFactual({ ...analiseAoVivo(), comparacoes: fora }, entrada, { referencias: true }).referencias!;
  const r = lerRelatorioFactual({ ...relatorio(), referencias: fora }, 'registro', { referencias: true }).referencias!;
  assert.equal(r.estado, 'calculado');
  if (r.estado !== 'calculado') return;
  assert.deepEqual(r.dados, vivo);
  assert.deepEqual(vivo.motivosContexto.map(m => MOTIVO_CONTEXTO_TEXTO[m]), r.dados.motivosContexto.map(m => MOTIVO_CONTEXTO_TEXTO[m]));
  assert.equal(resumirComparacao(vivo).comparados, 0);
  for (const [codigo, n] of Object.entries(vivo.nutrientes)) assert.doesNotMatch(textosDoNutriente(codigo, n, false).join(' '), /\d+%/);
});

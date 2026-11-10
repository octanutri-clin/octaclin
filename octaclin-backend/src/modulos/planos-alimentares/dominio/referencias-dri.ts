import type { ReferenciaDieteticaCalculo } from './comparacao-dietetica';
import { MICRONUTRIENTES, type CodigoMicronutriente } from './micronutrientes';

/**
 * Referencias DRI adultas versionadas (FOOD06, tarefa T1). Dominio puro: sem
 * rota, persistencia ou leitura de arquivo em runtime.
 *
 * Fonte e escopo ratificados em 2026-10-31 (CL01-CL08,
 * docs/product/FICHA_VALIDACAO_CLINICA_FOOD06.md) sobre o quadro
 * docs/product/VALORES_CANDIDATOS_DRI_FOOD06.md, reconferido em 2026-11-09 contra
 * as tabelas Health Canada modificadas em 2025-11-19. O teste `referencias-dri.spec.ts`
 * le esse quadro e compara cada celula com esta tabela.
 *
 * Escopo: adultos 19+ aparentemente saudaveis, sem gestacao/lactacao. Criancas,
 * gestacao e lactacao exigem nova ratificacao e nova versao.
 *
 * Regras que esta tabela codifica (a aritmetica fica em `comparacao-dietetica.ts`):
 * - ND nunca vira zero: UL nao estabelecido e `{ estado: 'nao_estabelecido' }`.
 * - retinol, vitamina A em RE e niacina sem NE nao tem referencia propria.
 * - UL restrito a formas/fracoes (magnesio, niacina, folato, vitamina A, vitamina
 *   E) leva a abrangencia publicada; o comparador o torna indisponivel para o
 *   total alimentar (CL05/CL08).
 * - Vitamina C guarda o valor basal; o acrescimo de 35 mg por tabagismo
 *   confirmado e aplicado pelo comparador, so na RDA (CL07).
 * - Cobre fica na unidade publicada (mcg); a conversao para o total PA06 em mg e
 *   exata no comparador.
 *
 * Imutavel: mudar qualquer valor exige nova VERSAO (o teste fixa o hash do
 * conteudo da v1). Registros que gravarem a versao precisam continuar
 * reprodutiveis com ela.
 *
 * Atribuicao exigida pela licenca: "Contem informacoes licenciadas sob a Licenca
 * de Governo Aberto - Canada (Health Canada, Dietary Reference Intakes)". Sem
 * alegacao de endosso.
 */
export const VERSAO_REFERENCIAS_DRI_ADULTO = 'dri-hc-2025-11-19-adulto-v1' as const;

export const FONTE_REFERENCIAS_DRI_ADULTO = Object.freeze({
  autoridade: 'Health Canada',
  modificadaEm: '2025-11-19',
  licenca: 'OGL-Canada',
  licencaId: 'ca-ogl-lgo',
  urls: Object.freeze([
    'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-elements.html',
    'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-vitamins.html'
  ] as const),
  populacao: 'adultos_19_mais_sem_gestacao_lactacao'
} as const);

/** Faixas na ordem do quadro: 19-30, 31-50, 51-70, 71+ anos completos. */
export const FAIXAS_ETARIAS_DRI_ADULTO = Object.freeze(['19-30', '31-50', '51-70', '71-mais'] as const);
export type FaixaEtariaDriAdulto = 0 | 1 | 2 | 3;
export type PopulacaoReferenciaDri = 'masculina' | 'feminina';

type ValoresPorFaixa = readonly [number, number, number, number];
type PorPopulacao = Readonly<Record<PopulacaoReferenciaDri, ValoresPorFaixa>>;
type AbrangenciaUl = 'total' | 'farmacologica' | 'sintetica' | 'preformada' | 'suplementar';

export interface LinhaReferenciaDriAdulto {
  readonly codigo: CodigoMicronutriente;
  readonly tipo: 'RDA' | 'AI';
  readonly unidade: 'mg' | 'mcg';
  readonly qualificador?: ReferenciaDieteticaCalculo['qualificador'];
  readonly valores: PorPopulacao;
  readonly ul: Readonly<{ estado: 'nao_estabelecido' }> | Readonly<{
    estado: 'definido'; unidade: 'mg' | 'mcg'; abrangencia: AbrangenciaUl; valores: PorPopulacao;
  }>;
}

const ND = Object.freeze({ estado: 'nao_estabelecido' as const });
const iguais = (v: number): ValoresPorFaixa => [v, v, v, v];
const porSexo = (masculina: ValoresPorFaixa, feminina: ValoresPorFaixa): PorPopulacao => ({ masculina, feminina });
const ul = (unidade: 'mg' | 'mcg', abrangencia: AbrangenciaUl, valores: PorPopulacao) =>
  ({ estado: 'definido' as const, unidade, abrangencia, valores });

// Transcricao do quadro ratificado. Ordem e nomes seguem a tabela do documento.
const LINHAS: LinhaReferenciaDriAdulto[] = [
  { codigo: 'calcioMg', tipo: 'RDA', unidade: 'mg', valores: porSexo([1000, 1000, 1000, 1200], [1000, 1000, 1200, 1200]),
    ul: ul('mg', 'total', porSexo([2500, 2500, 2000, 2000], [2500, 2500, 2000, 2000])) },
  // UL farmacologico/suplementar, nao o magnesio alimentar natural.
  { codigo: 'magnesioMg', tipo: 'RDA', unidade: 'mg', valores: porSexo([400, 420, 420, 420], [310, 320, 320, 320]),
    ul: ul('mg', 'farmacologica', porSexo(iguais(350), iguais(350))) },
  { codigo: 'manganesMg', tipo: 'AI', unidade: 'mg', valores: porSexo(iguais(2.3), iguais(1.8)),
    ul: ul('mg', 'total', porSexo(iguais(11), iguais(11))) },
  { codigo: 'fosforoMg', tipo: 'RDA', unidade: 'mg', valores: porSexo(iguais(700), iguais(700)),
    ul: ul('mg', 'total', porSexo([4000, 4000, 4000, 3000], [4000, 4000, 4000, 3000])) },
  // Dieta mista assumida pela tabela; sem ajuste automatico por dieta/menstruacao.
  { codigo: 'ferroMg', tipo: 'RDA', unidade: 'mg', valores: porSexo(iguais(8), [18, 18, 8, 8]),
    ul: ul('mg', 'total', porSexo(iguais(45), iguais(45))) },
  // Revisao de 2019; UL nao estabelecido (ausencia de UL nao prova seguranca).
  { codigo: 'potassioMg', tipo: 'AI', unidade: 'mg', valores: porSexo(iguais(3400), iguais(2600)), ul: ND },
  // Publicado em mcg; o total PA06 e em mg (conversao exata no comparador).
  { codigo: 'cobreMg', tipo: 'RDA', unidade: 'mcg', valores: porSexo(iguais(900), iguais(900)),
    ul: ul('mcg', 'total', porSexo(iguais(10000), iguais(10000))) },
  { codigo: 'zincoMg', tipo: 'RDA', unidade: 'mg', valores: porSexo(iguais(11), iguais(8)),
    ul: ul('mg', 'total', porSexo(iguais(40), iguais(40))) },
  { codigo: 'selenioMcg', tipo: 'RDA', unidade: 'mcg', valores: porSexo(iguais(55), iguais(55)),
    ul: ul('mcg', 'total', porSexo(iguais(400), iguais(400))) },
  // RDA em RAE; UL so da fracao pre-formada (nao RAE total).
  { codigo: 'vitaminaARaeMcg', tipo: 'RDA', unidade: 'mcg', qualificador: 'RAE', valores: porSexo(iguais(900), iguais(700)),
    ul: ul('mcg', 'preformada', porSexo(iguais(3000), iguais(3000))) },
  { codigo: 'tiaminaMg', tipo: 'RDA', unidade: 'mg', valores: porSexo(iguais(1.2), iguais(1.1)), ul: ND },
  { codigo: 'riboflavinaMg', tipo: 'RDA', unidade: 'mg', valores: porSexo(iguais(1.3), iguais(1.1)), ul: ND },
  // UL DRI de 100 mg difere do EFSA 2023 (12 mg); sem troca de autoridade (CL08).
  { codigo: 'vitaminaB6Mg', tipo: 'RDA', unidade: 'mg', valores: porSexo([1.3, 1.3, 1.7, 1.7], [1.3, 1.3, 1.5, 1.5]),
    ul: ul('mg', 'total', porSexo(iguais(100), iguais(100))) },
  // RDA em NE; UL em mg das formas sinteticas abrangidas, nao mg NE.
  { codigo: 'niacinaNeMg', tipo: 'RDA', unidade: 'mg', qualificador: 'NE', valores: porSexo(iguais(16), iguais(14)),
    ul: ul('mg', 'sintetica', porSexo(iguais(35), iguais(35))) },
  { codigo: 'vitaminaB12Mcg', tipo: 'RDA', unidade: 'mcg', valores: porSexo(iguais(2.4), iguais(2.4)), ul: ND },
  // RDA em DFE; UL em mcg de acido folico/formas abrangidas, nao DFE.
  { codigo: 'folatoDfeMcg', tipo: 'RDA', unidade: 'mcg', qualificador: 'DFE', valores: porSexo(iguais(400), iguais(400)),
    ul: ul('mcg', 'sintetica', porSexo(iguais(1000), iguais(1000))) },
  // Coluna em mcg, nunca IU.
  { codigo: 'vitaminaDMcg', tipo: 'RDA', unidade: 'mcg', valores: porSexo([15, 15, 15, 20], [15, 15, 15, 20]),
    ul: ul('mcg', 'total', porSexo(iguais(100), iguais(100))) },
  // Exige formas 2R; o total PA06 nao identifica a fracao: comparacao bloqueada (CL08).
  { codigo: 'vitaminaEAlfaTocoferolMg', tipo: 'RDA', unidade: 'mg', qualificador: '2R', valores: porSexo(iguais(15), iguais(15)),
    ul: ul('mg', 'suplementar', porSexo(iguais(1000), iguais(1000))) },
  // Valor basal; +35 mg so na RDA e so com tabagismo confirmado, no comparador (CL07).
  { codigo: 'vitaminaCMg', tipo: 'RDA', unidade: 'mg', valores: porSexo(iguais(90), iguais(75)),
    ul: ul('mg', 'total', porSexo(iguais(2000), iguais(2000))) }
];

function congelarLinha(linha: LinhaReferenciaDriAdulto): LinhaReferenciaDriAdulto {
  const valores = Object.freeze({
    masculina: Object.freeze([...linha.valores.masculina]) as unknown as ValoresPorFaixa,
    feminina: Object.freeze([...linha.valores.feminina]) as unknown as ValoresPorFaixa
  });
  const ulCongelado = linha.ul.estado === 'definido'
    ? Object.freeze({ ...linha.ul, valores: Object.freeze({
      masculina: Object.freeze([...linha.ul.valores.masculina]) as unknown as ValoresPorFaixa,
      feminina: Object.freeze([...linha.ul.valores.feminina]) as unknown as ValoresPorFaixa
    }) })
    : ND;
  return Object.freeze({ ...linha, valores, ul: ulCongelado });
}

export const TABELA_REFERENCIAS_DRI_ADULTO: readonly LinhaReferenciaDriAdulto[] = Object.freeze(LINHAS.map(congelarLinha));

/** Faixa por anos completos (data civil da clinica, calculada fora deste modulo). */
export function faixaEtariaDriAdulto(idadeAnos: number): FaixaEtariaDriAdulto | undefined {
  if (typeof idadeAnos !== 'number' || !Number.isSafeInteger(idadeAnos) || idadeAnos < 19) return undefined;
  if (idadeAnos <= 30) return 0;
  if (idadeAnos <= 50) return 1;
  if (idadeAnos <= 70) return 2;
  return 3;
}

const SIGLA_POPULACAO: Record<PopulacaoReferenciaDri, string> = { masculina: 'm', feminina: 'f' };

function construirReferencia(linha: LinhaReferenciaDriAdulto, populacao: PopulacaoReferenciaDri, faixa: FaixaEtariaDriAdulto): ReferenciaDieteticaCalculo {
  const id = `${VERSAO_REFERENCIAS_DRI_ADULTO}:${linha.codigo.toLowerCase()}:${SIGLA_POPULACAO[populacao]}:${FAIXAS_ETARIAS_DRI_ADULTO[faixa]}`;
  const ulReferencia = linha.ul.estado === 'definido'
    ? Object.freeze({ estado: 'definido' as const, valor: linha.ul.valores[populacao][faixa], unidade: linha.ul.unidade, abrangencia: linha.ul.abrangencia })
    : ND;
  return Object.freeze({
    id, versao: VERSAO_REFERENCIAS_DRI_ADULTO, codigo: linha.codigo, tipo: linha.tipo,
    valor: linha.valores[populacao][faixa], unidade: linha.unidade,
    ...(linha.qualificador ? { qualificador: linha.qualificador } : {}),
    ul: ulReferencia
  });
}

// Pre-construidas e congeladas: a consulta nunca devolve objeto mutavel compartilhado.
const REFERENCIAS = new Map<string, ReferenciaDieteticaCalculo>();
for (const linha of TABELA_REFERENCIAS_DRI_ADULTO) {
  for (const populacao of ['masculina', 'feminina'] as const) {
    for (const faixa of [0, 1, 2, 3] as const) {
      REFERENCIAS.set(`${linha.codigo}|${populacao}|${faixa}`, construirReferencia(linha, populacao, faixa));
    }
  }
}

/**
 * Referencia DRI adulta para um codigo PA06, ou `undefined` quando nao ha
 * referencia aplicavel: codigo sem referencia propria, populacao da referencia
 * nao confirmada, idade fora de 19+ ou invalida. Recebe o mesmo formato de
 * `ContextoDieteticoResolvido` (populacao so vem preenchida quando confirmada).
 *
 * Nao decide elegibilidade: gestacao, lactacao, aplicabilidade e mesmo dia
 * planejado continuam no contexto e no comparador.
 */
export function referenciaDriAdulto(
  codigo: CodigoMicronutriente,
  contexto: { populacaoReferencia?: PopulacaoReferenciaDri; idadeAnos?: number } | undefined
): ReferenciaDieteticaCalculo | undefined {
  if (typeof codigo !== 'string' || !Object.hasOwn(MICRONUTRIENTES, codigo)) return undefined;
  if (!contexto || typeof contexto !== 'object') return undefined;
  const populacao = contexto.populacaoReferencia;
  if (populacao !== 'masculina' && populacao !== 'feminina') return undefined;
  const faixa = faixaEtariaDriAdulto(contexto.idadeAnos as number);
  if (faixa === undefined) return undefined;
  return REFERENCIAS.get(`${codigo}|${populacao}|${faixa}`);
}

import type { ResultadoNutrienteCombinado } from './calculo-combinado';
import type { CodigoMicronutriente } from './micronutrientes';
import { MICRONUTRIENTES, decimalComoRazao, decimalParaEscala8, numeroDaEscala8 } from './micronutrientes';

export interface ReferenciaDieteticaCalculo {
  id: string; versao: string; codigo: CodigoMicronutriente;
  tipo: 'RDA' | 'AI'; valor: number; unidade: 'mg' | 'mcg';
  qualificador?: 'RE' | 'RAE' | 'NE' | 'DFE' | '2R';
  ul?: { estado: 'nao_estabelecido' } | {
    estado: 'definido'; valor: number; unidade: 'mg' | 'mcg';
    qualificador?: 'RE' | 'RAE' | 'NE' | 'DFE' | '2R';
    abrangencia: 'total' | 'farmacologica' | 'sintetica' | 'preformada' | 'suplementar';
  };
}
export interface ContextoComparacaoDietetica {
  elegivel: boolean; mesmoDiaPlanejado: boolean;
  tabagismo: 'sim' | 'nao' | 'nao_informado';
}
export type MotivoComparacaoIndisponivel = 'contexto_nao_elegivel' | 'dia_nao_confirmado' |
  'dados_incompletos' | 'valor_invalido' | 'referencia_indisponivel' |
  'definicao_incompativel' | 'unidade_incompativel' | 'abrangencia_ul_incompativel' |
  'tabagismo_nao_informado' | 'nao_estabelecido' | 'limite_precisao';
export type ComparacaoDietetica = { estado: 'indisponivel'; motivo: MotivoComparacaoIndisponivel } | {
  estado: 'comparavel'; tipo: 'RDA' | 'AI' | 'UL'; referenciaId: string; referenciaVersao: string;
  quantidadePlanejada: number; unidadePlanejada: 'mg' | 'mcg';
  valorReferencia: number; unidadeReferencia: 'mg' | 'mcg'; percentual: number;
  diferencaNaUnidadePlanejada: number; diferencaArredondada: boolean; ajusteTabagismoMg?: 35;
};
export interface ConfrontoDietetico { referencia: ComparacaoDietetica; ul: ComparacaoDietetica }

const ESCALA = 100_000_000n;
// A PA06 não identifica as formas/frações necessárias a essas comparações.
const SEM_DEFINICAO_RDA = new Set<CodigoMicronutriente>([
  'retinolMcg', 'vitaminaAReMcg', 'niacinaMg', 'vitaminaEAlfaTocoferolMg'
]);
const UL_REQUER_FRACAO = new Set<CodigoMicronutriente>([
  'magnesioMg', 'vitaminaARaeMcg', 'niacinaNeMg', 'folatoDfeMcg', 'vitaminaEAlfaTocoferolMg'
]);
function indisponivel(motivo: MotivoComparacaoIndisponivel): ComparacaoDietetica {
  return { estado: 'indisponivel', motivo };
}
function ambos(motivo: MotivoComparacaoIndisponivel): ConfrontoDietetico {
  return { referencia: indisponivel(motivo), ul: indisponivel(motivo) };
}
function unidadeValida(unidade: unknown): unidade is 'mg' | 'mcg' {
  return unidade === 'mg' || unidade === 'mcg';
}
function identidadeValida(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[a-z0-9][a-z0-9_.:-]{0,99}$/.test(valor);
}
function arredondarRazao(numerador: bigint, denominador: bigint): bigint {
  return (numerador * 2n + denominador) / (denominador * 2n);
}
function numeroComSinal(valor: bigint): number {
  return valor < 0n ? -numeroDaEscala8(-valor) : numeroDaEscala8(valor);
}

/** As conversões são razões exatas. Só a saída é arredondada para escala8. */
function confrontoNumerico(
  total: ResultadoNutrienteCombinado, referencia: ReferenciaDieteticaCalculo,
  valor: number, unidade: 'mg' | 'mcg', tipo: 'RDA' | 'AI' | 'UL', ajusteMg?: 35
): ComparacaoDietetica {
  if (!unidadeValida(unidade)) return indisponivel('unidade_incompativel');
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) return indisponivel('valor_invalido');
  try {
    // A escala8 aqui limita a magnitude da saída, nunca substitui a razão de entrada.
    decimalParaEscala8(total.total);
    const adicional = ajusteMg ? (unidade === 'mg' ? ajusteMg : ajusteMg * 1000) : 0;
    decimalParaEscala8(valor + adicional);
    const porcao = decimalComoRazao(total.total);
    const base = decimalComoRazao(valor);
    const baseNumerador = base.numerador + BigInt(adicional) * base.denominador;
    const numeradorUnidade = unidade === 'mg' && total.unidade === 'mcg' ? 1000n : 1n;
    const denominadorUnidade = unidade === 'mcg' && total.unidade === 'mg' ? 1000n : 1n;
    const referenciaNumerador = baseNumerador * numeradorUnidade * porcao.denominador;
    const quantidadeNumerador = porcao.numerador * base.denominador * denominadorUnidade;
    const diferencaNumerador = quantidadeNumerador - referenciaNumerador;
    const diferencaDenominador = porcao.denominador * base.denominador * denominadorUnidade;
    const diferencaMagnitude = arredondarRazao((diferencaNumerador < 0n ? -diferencaNumerador : diferencaNumerador) * ESCALA, diferencaDenominador);
    return {
      estado: 'comparavel', tipo, referenciaId: referencia.id, referenciaVersao: referencia.versao,
      quantidadePlanejada: total.total as number, unidadePlanejada: total.unidade as 'mg' | 'mcg',
      valorReferencia: valor + adicional, unidadeReferencia: unidade,
      percentual: numeroDaEscala8(arredondarRazao(quantidadeNumerador * 100n * ESCALA, referenciaNumerador)),
      diferencaNaUnidadePlanejada: numeroComSinal(diferencaNumerador < 0n ? -diferencaMagnitude : diferencaMagnitude),
      diferencaArredondada: diferencaMagnitude * diferencaDenominador !== (diferencaNumerador < 0n ? -diferencaNumerador : diferencaNumerador) * ESCALA,
      ...(ajusteMg ? { ajusteTabagismoMg: ajusteMg } : {})
    };
  } catch { return indisponivel('limite_precisao'); }
}

/**
 * Núcleo sem tabela, rota ou registro de módulo. O serviço futuro deve resolver
 * referências/contexto no servidor após autorização e gates; não aceitar esta
 * estrutura como payload de cliente nem tratar `elegivel` como autorização.
 */
export function compararNutrientePlanejado(
  total: ResultadoNutrienteCombinado, referencia: ReferenciaDieteticaCalculo | undefined,
  contexto: ContextoComparacaoDietetica
): ConfrontoDietetico {
  if (contexto?.elegivel !== true) return ambos('contexto_nao_elegivel');
  if (contexto.mesmoDiaPlanejado !== true) return ambos('dia_nao_confirmado');
  if (!total || !Object.hasOwn(MICRONUTRIENTES, total.codigo)) return ambos('definicao_incompativel');
  if (total.estado !== 'completo' || !Number.isSafeInteger(total.itensIncluidos) || total.itensIncluidos <= 0 ||
      total.itensComValor !== total.itensIncluidos) return ambos('dados_incompletos');
  if (typeof total.total !== 'number' || !Number.isFinite(total.total) || total.total < 0) return ambos('valor_invalido');
  const codigo = total.codigo as CodigoMicronutriente;
  const definicao = MICRONUTRIENTES[codigo];
  if (total.unidade !== definicao.unidade) return ambos('unidade_incompativel');
  if (!referencia || !identidadeValida(referencia.id) || !identidadeValida(referencia.versao)) return ambos('referencia_indisponivel');
  if (referencia.codigo !== codigo || SEM_DEFINICAO_RDA.has(codigo)) return ambos('definicao_incompativel');
  const qualificador = 'qualificador' in definicao ? definicao.qualificador : undefined;
  if (referencia.qualificador !== qualificador) return ambos('definicao_incompativel');
  if (referencia.tipo !== 'RDA' && referencia.tipo !== 'AI') return ambos('referencia_indisponivel');

  const tabagismoConhecido = contexto.tabagismo === 'sim' || contexto.tabagismo === 'nao';
  const rdaVitaminaC = codigo === 'vitaminaCMg' && referencia.tipo === 'RDA';
  const comparacaoReferencia = rdaVitaminaC && !tabagismoConhecido
    ? indisponivel('tabagismo_nao_informado')
    : confrontoNumerico(total, referencia, referencia.valor, referencia.unidade, referencia.tipo,
      rdaVitaminaC && contexto.tabagismo === 'sim' ? 35 : undefined);
  let ul: ComparacaoDietetica;
  if (!referencia.ul) ul = indisponivel('referencia_indisponivel');
  else if (referencia.ul.estado === 'nao_estabelecido') ul = indisponivel('nao_estabelecido');
  else if (referencia.ul.estado !== 'definido') ul = indisponivel('referencia_indisponivel');
  else if (UL_REQUER_FRACAO.has(codigo) || referencia.ul.abrangencia !== 'total') ul = indisponivel('abrangencia_ul_incompativel');
  else if (referencia.ul.qualificador !== qualificador) ul = indisponivel('definicao_incompativel');
  else ul = confrontoNumerico(total, referencia, referencia.ul.valor, referencia.ul.unidade, 'UL');
  return { referencia: comparacaoReferencia, ul };
}

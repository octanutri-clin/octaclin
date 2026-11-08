/** Identidades e unidades fixas; RE/RAE/NE/DFE não são intercambiáveis. */
export const MAPEAMENTO_MICRONUTRIENTES = 'octaclin-micronutrientes-v1' as const;
export const MICRONUTRIENTES = {
  calcioMg: { unidade: 'mg', rotulo: 'Cálcio' },
  magnesioMg: { unidade: 'mg', rotulo: 'Magnésio' },
  manganesMg: { unidade: 'mg', rotulo: 'Manganês' },
  fosforoMg: { unidade: 'mg', rotulo: 'Fósforo' },
  ferroMg: { unidade: 'mg', rotulo: 'Ferro' },
  potassioMg: { unidade: 'mg', rotulo: 'Potássio' },
  cobreMg: { unidade: 'mg', rotulo: 'Cobre' },
  zincoMg: { unidade: 'mg', rotulo: 'Zinco' },
  selenioMcg: { unidade: 'mcg', rotulo: 'Selênio' },
  retinolMcg: { unidade: 'mcg', rotulo: 'Retinol' },
  vitaminaAReMcg: { unidade: 'mcg', rotulo: 'Vitamina A', qualificador: 'RE' },
  vitaminaARaeMcg: { unidade: 'mcg', rotulo: 'Vitamina A', qualificador: 'RAE' },
  tiaminaMg: { unidade: 'mg', rotulo: 'Tiamina (B1)' },
  riboflavinaMg: { unidade: 'mg', rotulo: 'Riboflavina (B2)' },
  vitaminaB6Mg: { unidade: 'mg', rotulo: 'Vitamina B6' },
  niacinaMg: { unidade: 'mg', rotulo: 'Niacina' },
  niacinaNeMg: { unidade: 'mg', rotulo: 'Niacina', qualificador: 'NE' },
  vitaminaB12Mcg: { unidade: 'mcg', rotulo: 'Vitamina B12' },
  folatoDfeMcg: { unidade: 'mcg', rotulo: 'Folato', qualificador: 'DFE' },
  vitaminaDMcg: { unidade: 'mcg', rotulo: 'Vitamina D (D2 + D3)' },
  vitaminaEAlfaTocoferolMg: { unidade: 'mg', rotulo: 'Vitamina E (alfa-tocoferol)' },
  vitaminaCMg: { unidade: 'mg', rotulo: 'Vitamina C' }
} as const;
export type CodigoMicronutriente = keyof typeof MICRONUTRIENTES;
export const CODIGOS_MICRONUTRIENTES = Object.keys(MICRONUTRIENTES) as CodigoMicronutriente[];
export type MicronutrientesPor100gEntrada = Partial<Record<CodigoMicronutriente, number>>;
export type EstadoMicronutriente = 'conhecido' | 'ausente' | 'traco' | 'nao_analisado' | 'em_reavaliacao' | 'abaixo_loq' | 'unidade_incompativel' | 'duplicado' | 'invalido' | 'definicao_incompativel';
export interface ValorMicronutrienteOrigem { estado: EstadoMicronutriente; valor?: number }
export type ValoresMicronutrientesOrigem = Partial<Record<CodigoMicronutriente, ValorMicronutrienteOrigem>>;
export interface ValorMicronutrienteSnapshot { estado: EstadoMicronutriente; valorOrigem?: number; por100g?: number; porcao?: number }
export interface SnapshotMicronutrientesV1 {
  schemaVersao: 1;
  mapeamentoVersao: typeof MAPEAMENTO_MICRONUTRIENTES;
  baseGramasOrigem: number;
  porcaoGramas: number;
  nutrientes: Record<CodigoMicronutriente, ValorMicronutrienteSnapshot>;
}
export class LimitePrecisaoNutricionalError extends Error {
  constructor() { super('Limite técnico de precisão nutricional excedido.'); }
}
const ESCALA = 100_000_000n;
const MAXIMO = BigInt(Number.MAX_SAFE_INTEGER);
function dividirHalfUp(numerador: bigint, denominador: bigint): bigint {
  return (numerador * 2n + denominador) / (denominador * 2n);
}
/** Razão decimal exata; nenhuma etapa de normalização arredonda a origem. */
export function decimalComoRazao(valor: unknown): { numerador: bigint; denominador: bigint } {
  if ((typeof valor !== 'number' && typeof valor !== 'string') ||
      (typeof valor === 'number' && (!Number.isFinite(valor) || valor < 0))) {
    throw new Error('Valor nutricional inválido.');
  }
  const texto = String(valor);
  const partes = texto.length <= 64 ? /^(\d+)(?:\.(\d+))?(?:e([+-]?\d{1,3}))?$/i.exec(texto) : null;
  if (!partes) throw new Error('Valor nutricional inválido.');
  const fracao = partes[2] ?? '';
  const deslocamento = Number(partes[3] ?? 0) - fracao.length;
  const inteiro = BigInt(partes[1] + fracao);
  return deslocamento >= 0
    ? { numerador: inteiro * (10n ** BigInt(deslocamento)), denominador: 1n }
    : { numerador: inteiro, denominador: 10n ** BigInt(-deslocamento) };
}
/** Decimal explícito evita o erro binário da multiplicação de floats por 1e8. */
export function decimalParaEscala8(valor: unknown): bigint {
  const { numerador, denominador } = decimalComoRazao(valor);
  const escalado = dividirHalfUp(numerador * ESCALA, denominador);
  if (escalado > MAXIMO) throw new LimitePrecisaoNutricionalError();
  return escalado;
}
export function numeroDaEscala8(valor: bigint): number {
  if (valor < 0n || valor > MAXIMO) throw new LimitePrecisaoNutricionalError();
  return Number(valor) / Number(ESCALA);
}
/** Normalização única da razão decimal original; usada na composição custom. */
export function normalizarNutrientePor100g(valor: number, baseGramas: number): number {
  decimalParaEscala8(valor);
  const v = decimalComoRazao(valor), b = decimalComoRazao(baseGramas);
  if (!b.numerador) throw new Error('Base inválida.');
  return numeroDaEscala8(dividirHalfUp(v.numerador * 100n * b.denominador * ESCALA, v.denominador * b.numerador));
}
export function somarEscala8(valores: readonly number[]): number {
  return numeroDaEscala8(valores.reduce((soma, valor) => soma + decimalParaEscala8(valor), 0n));
}
export function validarMicronutrientesManuais(valor: unknown): MicronutrientesPor100gEntrada {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(valor))) {
    throw new Error('Micronutrientes manuais inválidos.');
  }
  const resultado: MicronutrientesPor100gEntrada = {};
  for (const [codigo, quantidade] of Object.entries(valor)) {
    if (!Object.hasOwn(MICRONUTRIENTES, codigo) || typeof quantidade !== 'number') {
      throw new Error('Micronutrientes manuais inválidos.');
    }
    decimalParaEscala8(quantidade);
    resultado[codigo as CodigoMicronutriente] = quantidade;
  }
  return resultado;
}
export function criarSnapshotMicronutrientes(
  valores: ValoresMicronutrientesOrigem, baseGramas: number, porcaoGramas: number
): SnapshotMicronutrientesV1 {
  const base = decimalParaEscala8(baseGramas);
  const porcao = decimalParaEscala8(porcaoGramas);
  if (!base || !porcao) throw new Error('Base e porção devem ser positivas.');
  const baseExata = decimalComoRazao(baseGramas);
  const porcaoExata = decimalComoRazao(porcaoGramas);
  const nutrientes = Object.fromEntries(CODIGOS_MICRONUTRIENTES.map(codigo => {
    const origem = valores[codigo];
    if (!origem || origem.estado !== 'conhecido') return [codigo, { estado: origem?.estado ?? 'ausente' }];
    try {
      decimalParaEscala8(origem.valor); // Mantém a proteção técnica da entrada.
      const valor = decimalComoRazao(origem.valor);
      const denominador = valor.denominador * baseExata.numerador;
      const por100g = dividirHalfUp(valor.numerador * 100n * baseExata.denominador * ESCALA, denominador);
      const naPorcao = dividirHalfUp(valor.numerador * porcaoExata.numerador * baseExata.denominador * ESCALA,
        denominador * porcaoExata.denominador);
      return [codigo, { estado: 'conhecido', valorOrigem: origem.valor, por100g: numeroDaEscala8(por100g), porcao: numeroDaEscala8(naPorcao) }];
    } catch (erro) {
      if (erro instanceof LimitePrecisaoNutricionalError) throw erro;
      return [codigo, { estado: 'invalido' }];
    }
  })) as Record<CodigoMicronutriente, ValorMicronutrienteSnapshot>;
  return { schemaVersao: 1, mapeamentoVersao: MAPEAMENTO_MICRONUTRIENTES, baseGramasOrigem: baseGramas, porcaoGramas, nutrientes };
}

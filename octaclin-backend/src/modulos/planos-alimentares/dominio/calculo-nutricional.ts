export const FORMULAS_ENERGETICAS = [
  'mifflin_st_jeor_1990',
  'harris_benedict_revisada_1984',
  'fao_oms_unu_1985'
] as const;

export type FormulaEnergetica = (typeof FORMULAS_ENERGETICAS)[number];
export type SexoCalculoEnergetico = 'masculino' | 'feminino';

export interface EntradaEstimativaEnergetica {
  formula: FormulaEnergetica;
  sexo: SexoCalculoEnergetico;
  idadeAnos: number;
  pesoKg: number;
  alturaCm: number;
  fatorAtividade: number;
}

export interface ResultadoEstimativaEnergetica {
  metabolismoRepousoKcal: number;
  gastoEnergeticoTotalKcal: number;
  formulaCodigo: FormulaEnergetica;
  formulaVersao: '1';
  formulaAplicada: string;
  fonte: string;
  aviso: string;
}

export interface DistribuicaoMacrosBasisPoints {
  carboidratosBasisPoints: number;
  proteinasBasisPoints: number;
  gordurasBasisPoints: number;
}

export interface NutrientesPor100g {
  energiaKcal: number;
  proteinasG: number;
  carboidratosG: number;
  gordurasG: number;
  fibrasG?: number;
  sodioMg?: number;
}

const AVISO_ESTIMATIVA =
  'Estimativa baseada em equacao populacional. Revise os dados e a aplicabilidade antes de definir ou publicar uma meta.';

function arredondar4(valor: number): number {
  return Math.round((valor + 1e-10) * 10_000) / 10_000;
}

function validarEntrada(entrada: EntradaEstimativaEnergetica): void {
  if (!Number.isFinite(entrada.pesoKg) || entrada.pesoKg < 1 || entrada.pesoKg > 500) {
    throw new Error('Peso deve estar entre 1 e 500 kg.');
  }
  if (!Number.isFinite(entrada.alturaCm) || entrada.alturaCm < 30 || entrada.alturaCm > 250) {
    throw new Error('Altura deve estar entre 30 e 250 cm.');
  }
  if (!Number.isInteger(entrada.idadeAnos) || entrada.idadeAnos < 18 || entrada.idadeAnos > 120) {
    throw new Error('Calculo automatico disponivel somente para adultos entre 18 e 120 anos.');
  }
  if (!Number.isFinite(entrada.fatorAtividade) || entrada.fatorAtividade < 1.4 || entrada.fatorAtividade > 2.4) {
    throw new Error('Fator de atividade deve estar entre 1,40 e 2,40.');
  }
  const imc = entrada.pesoKg / (entrada.alturaCm / 100) ** 2;
  if (imc < 8 || imc > 100) {
    throw new Error('Peso e altura resultam em IMC implausivel para calculo automatico.');
  }
}

function calcularMifflin(entrada: EntradaEstimativaEnergetica) {
  if (entrada.idadeAnos < 19 || entrada.idadeAnos > 78) {
    throw new Error('Mifflin-St Jeor automatico e restrito a faixa estudada de 19 a 78 anos.');
  }
  const constanteSexo = entrada.sexo === 'masculino' ? 5 : -161;
  return {
    valor: 10 * entrada.pesoKg + 6.25 * entrada.alturaCm - 5 * entrada.idadeAnos + constanteSexo,
    formula:
      entrada.sexo === 'masculino'
        ? 'Mifflin-St Jeor 1990: 10 x peso + 6,25 x altura - 5 x idade + 5'
        : 'Mifflin-St Jeor 1990: 10 x peso + 6,25 x altura - 5 x idade - 161',
    fonte: 'Mifflin et al. Am J Clin Nutr. 1990;51(2):241-247. DOI 10.1093/ajcn/51.2.241'
  };
}

function calcularHarrisRevisada(entrada: EntradaEstimativaEnergetica) {
  if (entrada.sexo === 'masculino') {
    return {
      valor: 88.362 + 13.397 * entrada.pesoKg + 4.799 * entrada.alturaCm - 5.677 * entrada.idadeAnos,
      formula: 'Harris-Benedict revisada por Roza-Shizgal 1984: 88,362 + 13,397 x peso + 4,799 x altura - 5,677 x idade',
      fonte: 'Roza e Shizgal. Am J Clin Nutr. 1984;40(1):168-182. PMID 6741850'
    };
  }
  return {
    valor: 447.593 + 9.247 * entrada.pesoKg + 3.098 * entrada.alturaCm - 4.33 * entrada.idadeAnos,
    formula: 'Harris-Benedict revisada por Roza-Shizgal 1984: 447,593 + 9,247 x peso + 3,098 x altura - 4,330 x idade',
    fonte: 'Roza e Shizgal. Am J Clin Nutr. 1984;40(1):168-182. PMID 6741850'
  };
}

function calcularFao(entrada: EntradaEstimativaEnergetica) {
  const faixa = entrada.idadeAnos < 30 ? '18-29' : entrada.idadeAnos < 60 ? '30-59' : '60+';
  const coeficientes = {
    masculino: {
      '18-29': [15.3, 679],
      '30-59': [11.6, 879],
      '60+': [13.5, 487]
    },
    feminino: {
      '18-29': [14.7, 496],
      '30-59': [8.7, 829],
      '60+': [10.5, 596]
    }
  } as const;
  const [multiplicador, constante] = coeficientes[entrada.sexo][faixa];
  return {
    valor: multiplicador * entrada.pesoKg + constante,
    formula: `FAO/OMS/UNU 1985 (${faixa} anos): ${multiplicador.toLocaleString('pt-BR')} x peso + ${constante}`,
    fonte: 'WHO Technical Report Series 724, 1985, Table 5'
  };
}

export function calcularEstimativaEnergetica(entrada: EntradaEstimativaEnergetica): ResultadoEstimativaEnergetica {
  validarEntrada(entrada);

  const calculo =
    entrada.formula === 'mifflin_st_jeor_1990'
      ? calcularMifflin(entrada)
      : entrada.formula === 'harris_benedict_revisada_1984'
        ? calcularHarrisRevisada(entrada)
        : calcularFao(entrada);
  const metabolismoRepousoKcal = arredondar4(calculo.valor);

  return {
    metabolismoRepousoKcal,
    gastoEnergeticoTotalKcal: arredondar4(calculo.valor * entrada.fatorAtividade),
    formulaCodigo: entrada.formula,
    formulaVersao: '1',
    formulaAplicada: calculo.formula,
    fonte: calculo.fonte,
    aviso: AVISO_ESTIMATIVA
  };
}

export function calcularMetasMacronutrientes(
  metaEnergeticaKcal: number,
  distribuicao: DistribuicaoMacrosBasisPoints
) {
  if (!Number.isFinite(metaEnergeticaKcal) || metaEnergeticaKcal <= 0 || metaEnergeticaKcal > 20_000) {
    throw new Error('Meta energetica deve estar entre 1 e 20.000 kcal.');
  }
  const valores = [
    distribuicao.carboidratosBasisPoints,
    distribuicao.proteinasBasisPoints,
    distribuicao.gordurasBasisPoints
  ];
  if (valores.some((valor) => !Number.isInteger(valor) || valor < 0 || valor > 10_000)) {
    throw new Error('Percentuais de macronutrientes devem ser inteiros em basis points.');
  }
  if (valores.reduce((soma, valor) => soma + valor, 0) !== 10_000) {
    throw new Error('A distribuicao de macronutrientes deve totalizar 10.000 basis points.');
  }

  return {
    carboidratosG: arredondar4((metaEnergeticaKcal * distribuicao.carboidratosBasisPoints) / 10_000 / 4),
    proteinasG: arredondar4((metaEnergeticaKcal * distribuicao.proteinasBasisPoints) / 10_000 / 4),
    gordurasG: arredondar4((metaEnergeticaKcal * distribuicao.gordurasBasisPoints) / 10_000 / 9)
  };
}

export function calcularNutrientesDaPorcao(nutrientes: NutrientesPor100g, quantidadeGramas: number) {
  if (!Number.isFinite(quantidadeGramas) || quantidadeGramas <= 0 || quantidadeGramas > 10_000) {
    throw new Error('Quantidade deve estar entre 0 e 10.000 gramas.');
  }
  if (Object.values(nutrientes).some((valor) => valor !== undefined && (!Number.isFinite(valor) || valor < 0))) {
    throw new Error('Nutrientes por 100 g devem ser numeros nao negativos quando informados.');
  }
  const fator = quantidadeGramas / 100;
  return {
    energiaKcal: arredondar4(nutrientes.energiaKcal * fator),
    proteinasG: arredondar4(nutrientes.proteinasG * fator),
    carboidratosG: arredondar4(nutrientes.carboidratosG * fator),
    gordurasG: arredondar4(nutrientes.gordurasG * fator),
    fibrasG: nutrientes.fibrasG === undefined ? undefined : arredondar4(nutrientes.fibrasG * fator),
    sodioMg: nutrientes.sodioMg === undefined ? undefined : arredondar4(nutrientes.sodioMg * fator)
  };
}

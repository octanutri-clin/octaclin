import type { EntradaAlimentoPersonalizadoApi, MicronutrientesPor100gApi, NutrientesPor100gApi } from './plano-alimentar-api';

export interface FormularioAlimentoPersonalizadoApi {
  nome: string;
  preparacao: string;
  referenciaComposicao: string;
  escopo: 'pessoal' | 'clinica';
  tipoBase: 'por100g' | 'porcao';
  pesoGramas: string;
  nutrientes: Partial<Record<keyof NutrientesPor100gApi, string>>;
  micronutrientes: Partial<Record<keyof MicronutrientesPor100gApi, string>>;
}

function lerNumero(valor: string, rotulo: string): number | undefined {
  const texto = valor.trim().replace(',', '.');
  if (!texto) return undefined;
  if (!/^\d{1,12}(?:\.\d{1,8})?$/.test(texto)) throw new Error(`${rotulo}: informe um número válido ou limpe o campo.`);
  const numero = Number(texto);
  if (!Number.isFinite(numero) || numero < 0) throw new Error(`${rotulo}: informe um número não negativo.`);
  return numero;
}

function lerCampos<T extends Record<string, string | undefined>>(campos: T, nomes: Record<keyof T, string>): Partial<Record<keyof T, number>> {
  return Object.fromEntries(Object.entries(campos).flatMap(([codigo, texto]) => {
    const numero = lerNumero(texto ?? '', nomes[codigo as keyof T]);
    return numero === undefined ? [] : [[codigo, numero]];
  })) as Partial<Record<keyof T, number>>;
}

const NOMES_MACROS: Record<keyof NutrientesPor100gApi, string> = {
  energiaKcal: 'Energia', proteinasG: 'Proteínas', carboidratosG: 'Carboidratos', gordurasG: 'Gorduras', fibrasG: 'Fibras', sodioMg: 'Sódio'
};
const NOMES_MICROS: Record<keyof MicronutrientesPor100gApi, string> = {
  calcioMg: 'Cálcio', magnesioMg: 'Magnésio', manganesMg: 'Manganês', fosforoMg: 'Fósforo', ferroMg: 'Ferro', potassioMg: 'Potássio', cobreMg: 'Cobre', zincoMg: 'Zinco',
  selenioMcg: 'Selênio', retinolMcg: 'Retinol', vitaminaAReMcg: 'Vitamina A RE', vitaminaARaeMcg: 'Vitamina A RAE', tiaminaMg: 'Tiamina', riboflavinaMg: 'Riboflavina', vitaminaB6Mg: 'Vitamina B6', niacinaMg: 'Niacina', niacinaNeMg: 'Niacina NE', vitaminaB12Mcg: 'Vitamina B12', folatoDfeMcg: 'Folato DFE', vitaminaDMcg: 'Vitamina D', vitaminaEAlfaTocoferolMg: 'Vitamina E', vitaminaCMg: 'Vitamina C'
};

/** Valida sem transformar campos vazios em zero e preserva a base originalmente informada. */
export function montarComposicaoAlimentoPersonalizado(formulario: FormularioAlimentoPersonalizadoApi) {
  const nome = formulario.nome.trim();
  if (!nome || nome.length > 240) throw new Error('Informe o nome do alimento (até 240 caracteres).');
  const nutrientes = lerCampos(formulario.nutrientes, NOMES_MACROS);
  const micronutrientes = lerCampos(formulario.micronutrientes, NOMES_MICROS);
  const base = formulario.tipoBase === 'por100g' ? { tipo: 'por100g' as const } : {
    tipo: 'porcao' as const,
    pesoGramas: lerNumero(formulario.pesoGramas, 'Peso da porção')
  };
  if (base.tipo === 'porcao' && (base.pesoGramas === undefined || base.pesoGramas <= 0 || base.pesoGramas > 10000 || !/^\d{1,5}(?:[.,]\d{1,3})?$/.test(formulario.pesoGramas.trim()))) {
    throw new Error('Informe o peso explícito da porção em gramas, entre 0,001 e 10.000, com até três casas decimais.');
  }
  const composicao = {
    nome,
    ...(formulario.preparacao.trim() ? { preparacao: formulario.preparacao.trim() } : {}),
    ...(formulario.referenciaComposicao.trim() ? { referenciaComposicao: formulario.referenciaComposicao.trim() } : {}),
    base,
    nutrientes,
    ...(Object.keys(micronutrientes).length ? { micronutrientes } : {})
  };
  return composicao;
}

export function montarCriacaoAlimentoPersonalizado(formulario: FormularioAlimentoPersonalizadoApi, chaveIdempotencia: string): EntradaAlimentoPersonalizadoApi {
  return { ...montarComposicaoAlimentoPersonalizado(formulario), chaveIdempotencia, escopo: formulario.escopo };
}

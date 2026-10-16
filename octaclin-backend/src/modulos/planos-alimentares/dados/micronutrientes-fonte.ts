import {
  CodigoMicronutriente, ValoresMicronutrientesOrigem, ValorMicronutrienteOrigem,
  decimalParaEscala8, CODIGOS_MICRONUTRIENTES, MAPEAMENTO_MICRONUTRIENTES
} from '../dominio/micronutrientes';

const USDA: Partial<Record<CodigoMicronutriente, number>> = {
  calcioMg: 1087, magnesioMg: 1090, manganesMg: 1101, fosforoMg: 1091,
  ferroMg: 1089, potassioMg: 1092, cobreMg: 1098, zincoMg: 1095,
  selenioMcg: 1103, retinolMcg: 1105, vitaminaARaeMcg: 1106,
  tiaminaMg: 1165, riboflavinaMg: 1166, vitaminaB6Mg: 1175, niacinaMg: 1167,
  vitaminaB12Mcg: 1178, folatoDfeMcg: 1190, vitaminaDMcg: 1114,
  vitaminaEAlfaTocoferolMg: 1109, vitaminaCMg: 1162
};
const IBGE: Partial<Record<CodigoMicronutriente, string>> = {
  calcioMg: 'CÁLCIO (mg)', magnesioMg: 'MAGNÉSIO (mg)', manganesMg: 'MANGANÊS (mg)',
  fosforoMg: 'FÓSFORO (mg)', ferroMg: 'FERRO (mg)', potassioMg: 'POTÁSSIO (mg)',
  cobreMg: 'COBRE (mg)', zincoMg: 'ZINCO (mg)', selenioMcg: 'SELÊNIO (mcg)',
  retinolMcg: 'RETINOL (mcg)', vitaminaARaeMcg: 'VITAMINA A (EQUIVALENTE DE ATIVIDADE DE RETINOL) (mcg)',
  tiaminaMg: 'TIAMINA (VITAMINA B1) (mg)', riboflavinaMg: 'RIBOFLAVINA (VITAMINA B2) (mg)',
  vitaminaB6Mg: 'PIRIDOXINA (VITAMINA B6) (mg)', niacinaMg: 'NIACINA (VITAMINA B3) (mg)',
  niacinaNeMg: 'EQUIVALENTE DE NIACINA (VITAMINA B3) (mg)', vitaminaB12Mcg: 'COBALAMINA (VITAMINA B12) (mcg)',
  folatoDfeMcg: 'FOLATO (EQUIVALENTE DIETÉTICO DE FOLATO) (mcg)',
  vitaminaEAlfaTocoferolMg: 'VITAMINA E (TOTAL DE ALPHA-TOCOPHEROL) (mg)', vitaminaCMg: 'VITAMINA C (mg)'
};
function objeto(valor: unknown): Record<string, unknown> | undefined {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : undefined;
}
function normalizarChave(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}
/** Normalizador exclusivo do bloco novo; não altera a convenção Tr->0 dos macros TACO. */
export function interpretarMicronutrienteCelula(valor: unknown): ValorMicronutrienteOrigem {
  if (valor === undefined || valor === null || valor === '' || valor === '-') return { estado: 'ausente' };
  if (typeof valor === 'string') {
    const texto = valor.trim();
    if (!texto || texto === '-') return { estado: 'ausente' };
    if (/^tr$/i.test(texto)) return { estado: 'traco' };
    if (/^na$/i.test(texto)) return { estado: 'nao_analisado' };
    if (texto === '*') return { estado: 'em_reavaliacao' };
    if (texto.length > 64 || !/^\d+(?:[.,]\d+)?(?:e[+-]?\d{1,3})?$/i.test(texto)) return { estado: 'invalido' };
    valor = Number(texto.replace(',', '.'));
  }
  try {
    if (typeof valor !== 'number') return { estado: 'invalido' };
    decimalParaEscala8(valor);
    return { estado: 'conhecido', valor };
  } catch { return { estado: 'invalido' }; }
}

/** Recebe somente a estrutura preservada pelo importador da fonte/esquema conhecidos. */
export function extrairMicronutrientesFonte(codigo: string, esquema: string, metadata: unknown): ValoresMicronutrientesOrigem {
  const valores: ValoresMicronutrientesOrigem = {};
  if (codigo === 'taco_nepa_unicamp' && esquema === 'octaclin-composicao-v2-micros1') {
    const bloco = objeto(metadata);
    const nutrientes = objeto(bloco?.nutrientes);
    if (bloco?.mapeamentoVersao !== MAPEAMENTO_MICRONUTRIENTES || !nutrientes) return valores;
    for (const chave of CODIGOS_MICRONUTRIENTES) {
      const item = objeto(nutrientes[chave]);
      if (!item) continue;
      if (item.estado === 'conhecido') valores[chave] = typeof item.valor === 'number' ? interpretarMicronutrienteCelula(item.valor) : { estado: 'invalido' };
      else valores[chave] = { estado: ['ausente', 'traco', 'nao_analisado', 'em_reavaliacao'].includes(String(item.estado)) ? item.estado as ValorMicronutrienteOrigem['estado'] : 'invalido' };
    }
    return valores;
  }
  const origem = objeto(objeto(metadata)?.metadadosOrigem);
  if (!origem || esquema !== 'octaclin-composicao-v1') return valores;
  if (codigo === 'usda_fdc_foundation' || codigo === 'usda_fdc_sr_legacy') {
    if (!Array.isArray(origem.nutrientsOriginal)) return valores;
    const itens = origem.nutrientsOriginal.map(objeto);
    for (const [campo, id] of Object.entries(USDA)) {
      const candidatos = itens.filter(item => objeto(item?.nutrient)?.id === id);
      if (!candidatos.length) continue;
      const chave = campo as CodigoMicronutriente;
      if (candidatos.length !== 1) { valores[chave] = { estado: 'duplicado' }; continue; }
      const item = candidatos[0]!;
      const unidade = objeto(item.nutrient)?.unitName;
      const esperada = campo.endsWith('Mcg') ? 'UG' : 'MG';
      if (typeof unidade !== 'string' || unidade.trim().toUpperCase() !== esperada) {
        valores[chave] = { estado: 'unidade_incompativel' }; continue;
      }
      const loq = item.loq;
      if (loq !== undefined && loq !== null && (typeof loq !== 'number' || !Number.isFinite(loq) || loq < 0)) {
        valores[chave] = { estado: 'invalido' }; continue;
      }
      if (item.amount === 0 && typeof loq === 'number' && loq > 0) {
        valores[chave] = { estado: 'abaixo_loq' }; continue;
      }
      valores[chave] = typeof item.amount === 'string' ? { estado: 'invalido' } : interpretarMicronutrienteCelula(item.amount);
    }
  } else if (codigo === 'ibge_pof_2008_2009') {
    const campos = objeto(origem.nutrientesOriginais);
    if (!campos) return valores;
    for (const [campo, header] of Object.entries(IBGE)) {
      const candidatos = Object.entries(campos).filter(([nome]) => normalizarChave(nome) === normalizarChave(header));
      if (!candidatos.length) continue;
      valores[campo as CodigoMicronutriente] = candidatos.length !== 1
        ? { estado: 'duplicado' } : interpretarMicronutrienteCelula(candidatos[0][1]);
    }
    // O cabeçalho não demonstra equivalência com D2+D3; não inferir pela unidade.
    valores.vitaminaDMcg = { estado: 'definicao_incompativel' };
  }
  return valores;
}

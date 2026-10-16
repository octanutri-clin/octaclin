import {
  CODIGOS_MICRONUTRIENTES, MICRONUTRIENTES, MAPEAMENTO_MICRONUTRIENTES,
  decimalParaEscala8, somarEscala8
} from './micronutrientes';
export interface EntradaPlanoCombinado {
  planoId: string; ativo: boolean; selecionado: boolean;
  refeicoes: { identidadeId: string; ativa: boolean; selecionada: boolean; itens: unknown[] }[];
}
const CAMPOS_LEGADOS = { energiaKcal: 'kcal', proteinasG: 'g', carboidratosG: 'g', gordurasG: 'g', fibrasG: 'g', sodioMg: 'mg' } as const;
export type CodigoNutrienteCombinado = keyof typeof CAMPOS_LEGADOS | keyof typeof MICRONUTRIENTES;
export interface ResultadoNutrienteCombinado {
  codigo: CodigoNutrienteCombinado; unidade: string;
  estado: 'completo' | 'parcial' | 'indisponivel';
  total?: number; quantidadeConhecida?: number;
  itensComValor: number; itensIncluidos: number;
}
export interface ResultadoCalculoCombinado {
  motorVersao: 'pa06-combinado-v1';
  estado: 'sem_selecao' | 'sem_itens_incluidos' | 'calculado';
  itensIncluidos: number;
  nutrientes: Record<CodigoNutrienteCombinado, ResultadoNutrienteCombinado>;
  exclusoes: { planoId: string; identidadeRefeicao?: string; motivo: 'plano_desativado' | 'refeicao_desativada' }[];
}
function objeto(valor: unknown): Record<string, unknown> | undefined {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : undefined;
}
function valorConhecido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0;
}
/** Só valores de porção congelados. Não multiplica quantidade, não consulta catálogo. */
export function calcularNutrientesCombinados(planos: EntradaPlanoCombinado[]): ResultadoCalculoCombinado {
  const itens: unknown[] = [];
  const exclusoes: ResultadoCalculoCombinado['exclusoes'] = [];
  for (const plano of planos) {
    if (!plano.selecionado) continue;
    if (!plano.ativo) { exclusoes.push({ planoId: plano.planoId, motivo: 'plano_desativado' }); continue; }
    for (const refeicao of plano.refeicoes) {
      if (!refeicao.selecionada) continue;
      if (!refeicao.ativa) {
        exclusoes.push({ planoId: plano.planoId, identidadeRefeicao: refeicao.identidadeId, motivo: 'refeicao_desativada' }); continue;
      }
      itens.push(...refeicao.itens);
      if (itens.length > 10000) throw new Error('Limite de itens do cálculo combinado excedido.');
    }
  }
  const codigos = [...Object.keys(CAMPOS_LEGADOS), ...CODIGOS_MICRONUTRIENTES] as CodigoNutrienteCombinado[];
  const nutrientes = Object.fromEntries(codigos.map(codigo => {
    const valores: number[] = [];
    for (const item of itens) {
      const snapshot = objeto(item);
      let valor: unknown;
      if (Object.hasOwn(CAMPOS_LEGADOS, codigo)) valor = objeto(snapshot?.nutrientesPorcao)?.[codigo];
      else {
        const micros = objeto(snapshot?.micronutrientes);
        if (micros?.schemaVersao === 1 && micros.mapeamentoVersao === MAPEAMENTO_MICRONUTRIENTES) {
          const nutriente = objeto(objeto(micros.nutrientes)?.[codigo]);
          if (nutriente?.estado === 'conhecido') valor = nutriente.porcao;
        }
      }
      if (valorConhecido(valor)) {
        // Valor finito acima do teto técnico é erro explícito, não ausência silenciosa.
        decimalParaEscala8(valor);
        valores.push(valor);
      }
    }
    const completo = itens.length > 0 && valores.length === itens.length;
    const unidade = Object.hasOwn(CAMPOS_LEGADOS, codigo)
      ? CAMPOS_LEGADOS[codigo as keyof typeof CAMPOS_LEGADOS]
      : MICRONUTRIENTES[codigo as keyof typeof MICRONUTRIENTES].unidade;
    const resultado: ResultadoNutrienteCombinado = {
      codigo, unidade, estado: completo ? 'completo' : valores.length ? 'parcial' : 'indisponivel',
      itensComValor: valores.length, itensIncluidos: itens.length
    };
    if (completo) resultado.total = somarEscala8(valores);
    else if (valores.length) resultado.quantidadeConhecida = somarEscala8(valores);
    return [codigo, resultado];
  })) as ResultadoCalculoCombinado['nutrientes'];
  return {
    motorVersao: 'pa06-combinado-v1',
    estado: !planos.some(p => p.selecionado) ? 'sem_selecao' : itens.length ? 'calculado' : 'sem_itens_incluidos',
    itensIncluidos: itens.length, nutrientes, exclusoes
  };
}

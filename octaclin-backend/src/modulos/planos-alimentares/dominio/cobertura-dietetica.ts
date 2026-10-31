import { calcularNutrientesCombinados, selecionarItensCombinados, type EntradaPlanoCombinado } from './calculo-combinado';
import { CODIGOS_MICRONUTRIENTES, MAPEAMENTO_MICRONUTRIENTES, MICRONUTRIENTES, type CodigoMicronutriente } from './micronutrientes';

export type EstadoCoberturaDietetica = 'COMPLETO' | 'PARCIAL' | 'DESCONHECIDO' | 'INCOMPATIVEL' | 'INDISPONIVEL';
export type CausaCobertura = 'sem_componentes' | 'snapshot_indisponivel' | 'legado_sem_composicao' |
  'schema_nao_suportado' | 'ausente' | 'traco' | 'nao_analisado' | 'abaixo_loq' |
  'em_reavaliacao' | 'duplicado' | 'invalido' | 'unidade_incompativel' | 'definicao_incompativel' | 'estado_nao_suportado';
export interface CoberturaNutrienteDietetica {
  codigo: CodigoMicronutriente;
  unidade: 'mg' | 'mcg';
  estado: EstadoCoberturaDietetica;
  contagens: { incluidos: number; conhecidos: number; semComposicao: number; incompativeis: number; naoResolvidos: number };
  causas: { codigo: CausaCobertura; quantidade: number }[];
  total?: number;
  quantidadeConhecida?: number;
}
export interface CoberturaDietetica {
  schemaVersao: 1;
  nutrientes: Record<CodigoMicronutriente, CoberturaNutrienteDietetica>;
}
type Contagem = Exclude<keyof CoberturaNutrienteDietetica['contagens'], 'incluidos'>;
interface Classificacao { contagem: Contagem; causa?: CausaCobertura; impedimentoTecnico?: true }
function objeto(valor: unknown): Record<string, unknown> | undefined {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : undefined;
}
function classificar(item: unknown, codigo: CodigoMicronutriente): Classificacao {
  const snapshot = objeto(item);
  if (!snapshot) return { contagem: 'naoResolvidos', causa: 'snapshot_indisponivel', impedimentoTecnico: true };
  if (snapshot.micronutrientes === undefined) return { contagem: 'semComposicao', causa: 'legado_sem_composicao' };
  const micros = objeto(snapshot.micronutrientes);
  const nutrientes = objeto(micros?.nutrientes);
  if (micros?.schemaVersao !== 1 || micros.mapeamentoVersao !== MAPEAMENTO_MICRONUTRIENTES || !nutrientes) {
    return { contagem: 'naoResolvidos', causa: 'schema_nao_suportado', impedimentoTecnico: true };
  }
  if (!Object.hasOwn(nutrientes, codigo)) return { contagem: 'semComposicao', causa: 'ausente' };
  const nutriente = objeto(nutrientes[codigo]);
  if (!nutriente) return { contagem: 'naoResolvidos', causa: 'invalido' };
  if (nutriente.estado === 'ausente') return { contagem: 'semComposicao', causa: 'ausente' };
  switch (nutriente.estado) {
    case 'conhecido':
      return typeof nutriente.porcao === 'number' && Number.isFinite(nutriente.porcao) && nutriente.porcao >= 0
        ? { contagem: 'conhecidos' } : { contagem: 'naoResolvidos', causa: 'invalido' };
    case 'traco': case 'nao_analisado': case 'abaixo_loq':
      return { contagem: 'semComposicao', causa: nutriente.estado };
    case 'unidade_incompativel': case 'definicao_incompativel':
      return { contagem: 'incompativeis', causa: nutriente.estado };
    case 'em_reavaliacao': case 'duplicado': case 'invalido':
      return { contagem: 'naoResolvidos', causa: nutriente.estado };
    default:
      return { contagem: 'naoResolvidos', causa: 'estado_nao_suportado' };
  }
}
/** Projeção interna aditiva. Usa a soma PA06; não resolve fontes, direitos ou contexto clínico. */
export function analisarCoberturaDietetica(planos: EntradaPlanoCombinado[]): CoberturaDietetica {
  const base = calcularNutrientesCombinados(planos);
  const { itens } = selecionarItensCombinados(planos);
  const nutrientes = Object.fromEntries(CODIGOS_MICRONUTRIENTES.map(codigo => {
    const contagens: CoberturaNutrienteDietetica['contagens'] = {
      incluidos: itens.length, conhecidos: 0, semComposicao: 0, incompativeis: 0, naoResolvidos: 0
    };
    const causas = new Map<CausaCobertura, number>();
    let impedimentoTecnico = !itens.length;
    if (!itens.length) causas.set('sem_componentes', 0);
    for (const item of itens) {
      const classificacao = classificar(item, codigo);
      contagens[classificacao.contagem]++;
      if (classificacao.causa) causas.set(classificacao.causa, (causas.get(classificacao.causa) ?? 0) + 1);
      impedimentoTecnico ||= classificacao.impedimentoTecnico === true;
    }
    const estado: EstadoCoberturaDietetica = impedimentoTecnico ? 'INDISPONIVEL'
      : contagens.incompativeis ? 'INCOMPATIVEL'
      : contagens.conhecidos === itens.length ? 'COMPLETO'
      : contagens.conhecidos ? 'PARCIAL' : 'DESCONHECIDO';
    const resultado: CoberturaNutrienteDietetica = {
      codigo, unidade: MICRONUTRIENTES[codigo].unidade, estado, contagens,
      causas: [...causas].map(([causa, quantidade]) => ({ codigo: causa, quantidade }))
    };
    const soma = base.nutrientes[codigo];
    if (estado === 'COMPLETO') resultado.total = soma.total;
    else if (soma.quantidadeConhecida !== undefined) resultado.quantidadeConhecida = soma.quantidadeConhecida;
    return [codigo, resultado];
  })) as CoberturaDietetica['nutrientes'];
  return { schemaVersao: 1, nutrientes };
}

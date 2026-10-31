import { selecionarRefeicoesCombinadas, type EntradaPlanoCombinado } from './calculo-combinado';
import { analisarCoberturaDietetica, type CoberturaNutrienteDietetica } from './cobertura-dietetica';
import { CODIGOS_MICRONUTRIENTES, decimalParaEscala8, numeroDaEscala8, type CodigoMicronutriente } from './micronutrientes';

export interface ContribuicaoItemDietetica {
  /** Posição interna nesta leitura; não é identidade persistente nem capability. */
  indiceItem: number;
  cobertura: CoberturaNutrienteDietetica;
  participacaoSelecaoPercentual?: number;
  participacaoRefeicaoPercentual?: number;
}
export interface ContribuicaoRefeicaoDietetica {
  planoId: string;
  identidadeRefeicao: string;
  cobertura: CoberturaNutrienteDietetica;
  participacaoSelecaoPercentual?: number;
  itens: ContribuicaoItemDietetica[];
}
export interface ContribuicoesDieteticas {
  schemaVersao: 1;
  codigo: CodigoMicronutriente;
  cobertura: CoberturaNutrienteDietetica;
  refeicoes: ContribuicaoRefeicaoDietetica[];
}
/** Participação factual; oito casas, half-up, não percentual de RDA/AI/UL. */
function participacao(parcela: CoberturaNutrienteDietetica, denominador: CoberturaNutrienteDietetica): number | undefined {
  if (parcela.estado !== 'COMPLETO' || denominador.estado !== 'COMPLETO' ||
      parcela.total === undefined || denominador.total === undefined) return undefined;
  const total = decimalParaEscala8(denominador.total);
  if (total === 0n) return undefined;
  const valor = decimalParaEscala8(parcela.total) * 100n * 100_000_000n;
  return numeroDaEscala8((valor + total / 2n) / total);
}
function coberturaItens(itens: unknown[], codigo: CodigoMicronutriente): CoberturaNutrienteDietetica {
  // Mesmo classificador/somador de porções congeladas; nenhuma resolução de catálogo.
  return analisarCoberturaDietetica([{
    planoId: '', ativo: true, selecionado: true,
    refeicoes: [{ identidadeId: '', ativa: true, selecionada: true, itens }]
  }]).nutrientes[codigo];
}
/**
 * Decomposição interna, não DTO público nem camada de autorização.
 * Ordem original preservada para junção server-side com identidades autorizadas.
 * Não interpreta a seleção como um dia sem confirmação do profissional.
 */
export function decomporContribuicoesDieteticas(planos: EntradaPlanoCombinado[], codigo: CodigoMicronutriente): ContribuicoesDieteticas {
  if (!CODIGOS_MICRONUTRIENTES.includes(codigo)) throw new Error('Micronutriente inválido.');
  const { refeicoes } = selecionarRefeicoesCombinadas(planos);
  const cobertura = analisarCoberturaDietetica(planos).nutrientes[codigo];
  return {
    schemaVersao: 1, codigo, cobertura,
    refeicoes: refeicoes.map(refeicao => {
      const coberturaRefeicao = coberturaItens(refeicao.itens, codigo);
      const percentual = participacao(coberturaRefeicao, cobertura);
      return {
        planoId: refeicao.planoId, identidadeRefeicao: refeicao.identidadeRefeicao,
        cobertura: coberturaRefeicao,
        ...(percentual !== undefined ? { participacaoSelecaoPercentual: percentual } : {}),
        itens: Array.from(refeicao.itens, (item, indiceItem) => {
          const coberturaItem = coberturaItens([item], codigo);
          const percentualSelecao = participacao(coberturaItem, cobertura);
          const percentualRefeicao = participacao(coberturaItem, coberturaRefeicao);
          return {
            indiceItem, cobertura: coberturaItem,
            ...(percentualSelecao !== undefined ? { participacaoSelecaoPercentual: percentualSelecao } : {}),
            ...(percentualRefeicao !== undefined ? { participacaoRefeicaoPercentual: percentualRefeicao } : {})
          };
        })
      };
    })
  };
}

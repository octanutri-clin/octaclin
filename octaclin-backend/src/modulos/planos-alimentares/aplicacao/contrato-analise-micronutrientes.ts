import type {AjudaDieteticaProjetada} from './projecao-ajuda-dietetica';
import type { ResultadoCalculoCombinado } from '../dominio/calculo-combinado';
import type { CoberturaDietetica } from '../dominio/cobertura-dietetica';
import type { FontesPorNutrienteDietetica } from '../dominio/fontes-por-nutriente';
import type { ResultadoComparacaoReferencias } from '../dominio/comparacao-referencias';
import type { FONTE_REFERENCIAS_DRI_ADULTO } from '../dominio/referencias-dri';
export interface PublicacaoAnaliseFactual {
  planoId: string;
  versaoId: string;
  ativacaoRevisao: number;
}
/**
 * Comparação com referências DRI, só quando o cliente pede `incluirReferencias`
 * (FOOD06 T3a). Sem o pedido, `comparacoes` continua o placeholder de sempre.
 */
export type ComparacoesAnaliseFactual =
  | { estado: 'indisponivel'; motivo: 'referencias_nao_habilitadas' }
  | ({ estado: 'calculado'; fonteReferencias: typeof FONTE_REFERENCIAS_DRI_ADULTO } & ResultadoComparacaoReferencias);
/** Projeção factual; comparações clínicas só por opt-in explícito. */
export interface AnaliseFactualMicronutrientes {
  ajuda:AjudaDieteticaProjetada;
  schemaVersao: 1;
  motorVersao: 'food06-factual-v1';
  calculadoEm: string;
  publicacoes: PublicacaoAnaliseFactual[];
  calculo: ResultadoCalculoCombinado;
  cobertura: CoberturaDietetica;
  /** Origem registrada dos contribuintes conhecidos; aditivo, sem alterar cálculo ou cobertura. */
  fontes: FontesPorNutrienteDietetica;
  comparacoes: ComparacoesAnaliseFactual;
}

import type {AjudaDieteticaProjetada} from './projecao-ajuda-dietetica';
import type { ResultadoCalculoCombinado } from '../dominio/calculo-combinado';
import type { CoberturaDietetica } from '../dominio/cobertura-dietetica';
import type { FontesPorNutrienteDietetica } from '../dominio/fontes-por-nutriente';
export interface PublicacaoAnaliseFactual {
  planoId: string;
  versaoId: string;
  ativacaoRevisao: number;
}
/** Projeção factual, sem coeficientes ou comparações clínicas habilitados. */
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
  comparacoes: { estado: 'indisponivel'; motivo: 'referencias_nao_habilitadas' };
}

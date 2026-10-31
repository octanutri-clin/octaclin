import type { ResultadoCalculoCombinado } from '../dominio/calculo-combinado';
import type { CoberturaDietetica } from '../dominio/cobertura-dietetica';
export interface PublicacaoAnaliseFactual {
  planoId: string;
  versaoId: string;
  ativacaoRevisao: number;
}
/** Projeção factual, sem coeficientes ou comparações clínicas habilitados. */
export interface AnaliseFactualMicronutrientes {
  schemaVersao: 1;
  motorVersao: 'food06-factual-v1';
  calculadoEm: string;
  publicacoes: PublicacaoAnaliseFactual[];
  calculo: ResultadoCalculoCombinado;
  cobertura: CoberturaDietetica;
  comparacoes: { estado: 'indisponivel'; motivo: 'referencias_nao_habilitadas' };
}

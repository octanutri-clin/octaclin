/** Configuração visual por versão. Nunca representa autorização ou liberação clínica. */
export interface PreferenciasExibicaoRefeicoesApi {
  horario: boolean;
  macros: boolean;
  medidasCaseiras: boolean;
  orientacoes: boolean;
  substituicoesExpandidas: boolean;
  modoCompacto: boolean;
}
export interface PreferenciasApresentacaoPlanoApi {
  schemaVersao: 1;
  profissional: PreferenciasExibicaoRefeicoesApi;
  paciente: PreferenciasExibicaoRefeicoesApi;
}
export type EstadoApresentacaoPlanoApi = 'legado' | 'configurada' | 'indisponivel';

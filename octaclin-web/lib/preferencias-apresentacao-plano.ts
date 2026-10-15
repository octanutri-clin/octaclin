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

/** Preserva a apresentacao atual e inicia as substituicoes recolhidas. */
export function novasPreferenciasApresentacaoPlano(): PreferenciasApresentacaoPlanoApi {
  const conjunto: PreferenciasExibicaoRefeicoesApi = {
    horario: true,
    macros: true,
    medidasCaseiras: true,
    orientacoes: true,
    substituicoesExpandidas: false,
    modoCompacto: false
  };
  return { schemaVersao: 1, profissional: { ...conjunto }, paciente: { ...conjunto } };
}

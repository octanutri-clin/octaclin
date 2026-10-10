export interface ReferenciaGestacaoApi {
  pesoKg?: number; alturaCm?: number; origem?: 'pre_gestacional_medido'|'pre_gestacional_informado'|'inicio_gestacao_medido'|'peso_habitual_informado';
  dataPeso?: string; semanasMedida?: number; diasMedida?: number; pesoHabitualAnteriorConfirmado?: boolean;
}
export interface ContextoGestacaoApi {
  gestacaoId?: string; referenciaNumero?: number; semanas?: number; dias?: number;
  tipo?: 'unica'|'multipla'|'nao_informada'; risco?: 'habitual'|'alto'|'nao_informado';
  origemIdadeGestacional?: 'pre_natal'|'ultrassonografia'|'dum'|'nao_informada';
  dataFonteIdadeGestacional?: string; idadeGestacionalInconsistente?: boolean;
}
export interface ResultadoGestacionalApi {
  condicao: 'gestante'|'nao_gestante'|'nao_informada'; origemCondicao: 'confirmada'|'perfil_legado';
  source_id: string; algorithm_version: string; gestacaoId?: string; referenciaNumero?: number;
  referencia?: ReferenciaGestacaoApi; contexto?: ContextoGestacaoApi;
  imcReferencia?: number; grupo?: string; ganhoKg?: number; semanaCurva?: number;
  faixa?: { minimo: number; maximo: number }; classificacao?: 'abaixo'|'dentro'|'acima'; motivos: string[];
}
export interface GestacaoApi { id: string; status: 'ativa'|'encerrada'; versao: number; compartilhada: boolean; geracaoCompartilhamento: number; numero: number; referencia: ReferenciaGestacaoApi; criadoEm: string }
export interface AvaliacaoGestacaoApi { id: string; avaliadaEm: string; referenciaNumero: number; pesoKg?: number; alturaCm?: number; gestacional?: ResultadoGestacionalApi; ilegivel: boolean }
export interface SerieReferenciaGestacaoApi { numero: number; source_id: string; faixas: Array<{ semana: number; minimo: number; maximo: number }> }
export interface DetalheGestacaoApi extends GestacaoApi { seriesReferencia: SerieReferenciaGestacaoApi[]; avaliacoes: AvaliacaoGestacaoApi[]; proximoCursor: string|null }
export type DetalheGestacaoPortalApi = Pick<DetalheGestacaoApi,'id'|'status'|'seriesReferencia'|'avaliacoes'|'proximoCursor'>;
export interface ConviteGestacaoApi { id: string; geracao: number; termoVersao: string; termo: string; consentimentoVersao: number; aceito: boolean }
export interface PaginaGestacoesApi<T> { itens: T[]; proximoCursor: string|null }
export async function solicitarGestacao<T>(url: string, method = 'GET', dados?: unknown, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url,{ method,cache: 'no-store',signal,headers: { 'Content-Type': 'application/json' },...(dados === undefined ? {} : { body: JSON.stringify(dados) }) });
  if (!r.ok) {
    const erro = await r.json().catch(() => null) as { mensagem?: string; message?: string|string[] }|null;
    throw new Error(erro?.mensagem ?? (typeof erro?.message === 'string' ? erro.message : 'Nao foi possivel concluir a operacao.'));
  }
  return r.json() as Promise<T>;
}
export function urlGestacoes(pacienteId: string) { return `/api/pacientes/${encodeURIComponent(pacienteId)}/gestacoes`; }

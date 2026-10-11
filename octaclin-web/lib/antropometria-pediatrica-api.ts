import { solicitarGestacao } from './gestacoes-paciente-api';
export interface ContextoPediatricoApi {
  confirmado: true;
  nascimento?: string;
  sexoCurva: 'masculino'|'feminino'|'nao_informado';
  tecnica: 'deitado'|'em_pe'|'nao_informada';
  edema: 'sim'|'nao'|'desconhecido';
  nascimentoTipo: 'a_termo'|'prematuro'|'nao_informado';
  semanasNascimento?: number; diasNascimento?: number;
  origemGestacional?: 'documentada'|'informada'|'nao_informada';
  tipoMedida: 'nascimento'|'pos_natal'|'nao_informado';
}
export interface SnapshotPediatricoApi {
  versao: 'pediatrico-medidas-v1'; estado: 'protocolos_bloqueados'; avaliadaEm: string;
  contexto: ContextoPediatricoApi;
  idade?: { dias: number; mesesEstatisticos: number; anosCompletos: number };
  idadePosMenstrualDias?: number; idadeCorrigidaDias?: number;
  medidas: { pesoKg?: number; alturaCm?: number };
  indicadores: Array<{ indicador: 'imc_idade'|'estatura_idade'|'peso_idade'|'peso_estatura'; estado: 'bloqueado'; motivo: 'protocolo_nao_ratificado'|'medida_ausente' }>;
}
export interface PaginaPediatricaApi { itens: Array<{ id: string; snapshot: SnapshotPediatricoApi }>; registrosExaminados: number; itensExibidos: number; temMaisHistorico: boolean; proximoCursor?: string }
export function listarPediatria(pacienteId: string, cursor?: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ limite: '50' });
  if (cursor) query.set('cursor',cursor);
  return solicitarGestacao<PaginaPediatricaApi>(`/api/pacientes/${encodeURIComponent(pacienteId)}/acompanhamento-pediatrico?${query}`, 'GET', undefined, signal);
}

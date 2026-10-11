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
  gestacaoUnica?: 'sim'|'nao'|'desconhecido';
  malformacaoImportante?: 'sim'|'nao'|'desconhecido';
  restricaoCrescimentoFetal?: 'sim'|'nao'|'desconhecido';
  morbidadePosNatalGrave?: 'sim'|'nao'|'desconhecido';
  origemElegibilidade?: 'documentada'|'informada'|'nao_informada';
}
export interface SnapshotPediatricoApi {
  versao: 'pediatrico-medidas-v1'|'pediatrico-medidas-v2'; protocoloG02?: 'g02-rev9-3dd197df'; estado: 'protocolos_bloqueados'; avaliadaEm: string;
  contexto: ContextoPediatricoApi;
  idade?: { dias: number; mesesEstatisticos: number; anosCompletos: number };
  idadePosMenstrualDias?: number; idadeCorrigidaDias?: number;
  medidas: { pesoKg?: number; alturaCm?: number };
  indicadores: Array<{ indicador: 'imc_idade'|'estatura_idade'|'peso_idade'|'peso_estatura'; estado: 'bloqueado'; motivo: 'protocolo_nao_ratificado'|'validacao_computacional_e_direitos_pendentes'|'medida_ausente' }>;
}
export interface PaginaPediatricaApi { itens: Array<{ id: string; snapshot: SnapshotPediatricoApi }>; registrosExaminados: number; itensExibidos: number; temMaisHistorico: boolean; proximoCursor?: string }
export function listarPediatria(pacienteId: string, cursor?: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ limite: '50' });
  if (cursor) query.set('cursor',cursor);
  return solicitarGestacao<PaginaPediatricaApi>(`/api/pacientes/${encodeURIComponent(pacienteId)}/acompanhamento-pediatrico?${query}`, 'GET', undefined, signal);
}

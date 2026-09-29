export const EVENTO_REAGENDAMENTO_APOS_FALTA = 'agenda.consulta.reagendamento_proativo';
export const PRAZO_REAGENDAMENTO_MS = 7 * 24 * 60 * 60 * 1000;

export type EstadoReagendamentoAposFalta =
  | 'pendente' | 'aprovado' | 'reprovado' | 'enfileirado' | 'suprimido' | 'expirado';

export interface ReagendamentoAposFalta {
  estado: EstadoReagendamentoAposFalta;
  registradoEm: string;
  decididoEm?: string;
  mensagemId?: string;
  motivo?: string;
  proximaTentativaEm?: string;
}

export function lerReagendamentoAposFalta(payload: Record<string, unknown> | undefined): ReagendamentoAposFalta | undefined {
  const valor = payload?.reagendamentoAposFalta;
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return undefined;
  const registro = valor as Record<string, unknown>;
  if (!['pendente', 'aprovado', 'reprovado', 'enfileirado', 'suprimido', 'expirado'].includes(String(registro.estado))) return undefined;
  if (typeof registro.registradoEm !== 'string' || !Number.isFinite(Date.parse(registro.registradoEm))) return undefined;
  return registro as unknown as ReagendamentoAposFalta;
}

export function prazoReagendamentoVencido(fimConsultaEm: Date, agora: Date): boolean {
  return agora.getTime() >= fimConsultaEm.getTime() + PRAZO_REAGENDAMENTO_MS;
}

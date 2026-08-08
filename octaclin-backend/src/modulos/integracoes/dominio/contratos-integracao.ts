export const ESCOPOS_API_PUBLICA = [
  'pacientes:ler',
  'pacientes:escrever',
  'agenda:ler',
  'agenda:escrever'
] as const;

export type EscopoApiPublica = (typeof ESCOPOS_API_PUBLICA)[number];

export const EVENTOS_WEBHOOK = [
  'paciente.criado',
  'consulta.criada',
  'consulta.cancelada',
  'formulario.respondido'
] as const;

export type EventoWebhook = (typeof EVENTOS_WEBHOOK)[number];

export interface ContextoApiPublica {
  tenantId: string;
  chaveId: string;
  criadoPorUsuarioId?: string;
  escopos: EscopoApiPublica[];
}

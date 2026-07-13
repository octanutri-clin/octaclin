export type TipoCanalNotificacao = 'whatsapp' | 'email' | 'push';

export type StatusMensagemNotificacao = 'pendente' | 'processando' | 'enviado' | 'falhou' | 'recebido';

export interface ResultadoEnvioNotificacao {
  idExterno?: string;
  metadados?: Record<string, unknown>;
}

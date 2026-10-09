import type { TipoNotificacao } from './tipo-notificacao';

export const TIPOS_NOTIFICACAO_OBRIGATORIOS = [
  'mensagem_recebida',
  'solicitacao_agendamento',
  'falha_envio'
] as const satisfies readonly TipoNotificacao[];

export const TIPOS_NOTIFICACAO_CONFIGURAVEIS = [
  'formulario_respondido',
  'tarefa_concluida',
  'automacao_executada'
] as const satisfies readonly TipoNotificacao[];

export type TipoNotificacaoConfiguravel = (typeof TIPOS_NOTIFICACAO_CONFIGURAVEIS)[number];
export type ModoEntregaNotificacao = 'imediato' | 'diario' | 'semanal' | 'silenciado';

export const MODO_ENTREGA_PADRAO: ModoEntregaNotificacao = 'imediato';
export const TIMEZONE_NOTIFICACAO_PADRAO = 'America/Sao_Paulo';

export function tipoNotificacaoConfiguravel(tipo: TipoNotificacao): tipo is TipoNotificacaoConfiguravel {
  return (TIPOS_NOTIFICACAO_CONFIGURAVEIS as readonly string[]).includes(tipo);
}

/** Os tipos obrigatórios sempre vencem valores inválidos ou legados do banco. */
export function obterModoEntregaNotificacao(
  tipo: TipoNotificacao,
  preferencia?: ModoEntregaNotificacao | null
): ModoEntregaNotificacao {
  if (!tipoNotificacaoConfiguravel(tipo)) return 'imediato';
  if (
    preferencia === 'imediato' ||
    preferencia === 'diario' ||
    preferencia === 'semanal' ||
    preferencia === 'silenciado'
  ) return preferencia;
  return MODO_ENTREGA_PADRAO;
}

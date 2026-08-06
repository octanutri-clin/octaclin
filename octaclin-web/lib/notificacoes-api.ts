export type TipoNotificacao =
  | 'mensagem_recebida'
  | 'solicitacao_agendamento'
  | 'formulario_respondido'
  | 'falha_envio';

export interface NotificacaoApi {
  id: string;
  tipo: TipoNotificacao;
  pacienteId?: string | null;
  pacienteNome?: string;
  recursoTipo: string;
  recursoId: string;
  lidoEm?: string | null;
  criadoEm: string;
}

export interface CentralNotificacoesApi {
  naoLidas: number;
  itens: NotificacaoApi[];
}

const rotulos: Record<TipoNotificacao, string> = {
  mensagem_recebida: 'Nova mensagem recebida',
  solicitacao_agendamento: 'Nova solicitacao de agendamento',
  formulario_respondido: 'Formulario respondido',
  falha_envio: 'Falha no envio de mensagem'
};

const destinos: Record<TipoNotificacao, string> = {
  mensagem_recebida: '/comunicacoes',
  solicitacao_agendamento: '/agenda',
  formulario_respondido: '/questionarios',
  falha_envio: '/comunicacoes'
};

export function rotuloNotificacao(tipo: TipoNotificacao) {
  return rotulos[tipo] ?? 'Notificacao';
}

export function destinoNotificacao(tipo: TipoNotificacao) {
  return destinos[tipo] ?? '/dashboard';
}

export async function listarNotificacoes(limite = 20): Promise<CentralNotificacoesApi> {
  const resposta = await fetch(`/api/notificacoes?limite=${limite}`, { cache: 'no-store' });
  if (!resposta.ok) throw new Error(`Falha HTTP ${resposta.status}`);
  return resposta.json() as Promise<CentralNotificacoesApi>;
}

export async function marcarNotificacoesLidas(ids?: string[]): Promise<{ marcadas: number }> {
  const resposta = await fetch('/api/notificacoes/lidas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ids?.length ? { ids } : {})
  });
  if (!resposta.ok) throw new Error(`Falha HTTP ${resposta.status}`);
  return resposta.json() as Promise<{ marcadas: number }>;
}

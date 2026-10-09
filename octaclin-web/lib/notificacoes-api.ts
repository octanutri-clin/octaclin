export type TipoNotificacao =
  | 'mensagem_recebida'
  | 'solicitacao_agendamento'
  | 'formulario_respondido'
  | 'falha_envio'
  | 'tarefa_concluida'
  | 'automacao_executada';

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
  resumos?: ResumoNotificacaoApi[];
}

export interface ResumoNotificacaoApi {
  id: string;
  periodoInicioEm: string;
  periodoFimEm: string;
  geradoEm: string;
  lidoEm?: string | null;
  contagens: Partial<Record<TipoNotificacao, number>>;
  estadoEmail: 'nao_solicitado' | 'pendente' | 'reservado' | 'enviado' | 'incerto' | 'falhou' | 'cancelado';
}

export type ModoEntregaNotificacaoApi = 'imediato' | 'diario' | 'semanal' | 'silenciado';
export interface PreferenciasNotificacaoApi {
  modos: Record<'formulario_respondido' | 'tarefa_concluida' | 'automacao_executada', ModoEntregaNotificacaoApi>;
  timezone: string;
  emailResumo: boolean;
  classesElegiveis: Array<'formulario_respondido' | 'tarefa_concluida' | 'automacao_executada'>;
  tiposObrigatorios: Array<'mensagem_recebida' | 'solicitacao_agendamento' | 'falha_envio'>;
}

const rotulos: Record<TipoNotificacao, string> = {
  mensagem_recebida: 'Nova mensagem recebida',
  solicitacao_agendamento: 'Nova solicitacao de agendamento',
  formulario_respondido: 'Formulario respondido',
  falha_envio: 'Falha no envio de mensagem',
  tarefa_concluida: 'Tarefa concluída pelo paciente',
  automacao_executada: 'Automação executada'
};

const destinos: Record<TipoNotificacao, string> = {
  mensagem_recebida: '/comunicacoes',
  solicitacao_agendamento: '/agenda',
  formulario_respondido: '/questionarios',
  falha_envio: '/comunicacoes',
  tarefa_concluida: '/pacientes',
  automacao_executada: '/automacoes'
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

export async function marcarResumoLido(id: string): Promise<void> {
  const resposta = await fetch('/api/notificacoes/lidas', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idsResumos: [id] })
  });
  if (!resposta.ok) throw new Error(`Falha HTTP ${resposta.status}`);
}

export async function obterPreferenciasNotificacoes(): Promise<PreferenciasNotificacaoApi> {
  const resposta = await fetch('/api/notificacoes/preferencias', { cache: 'no-store' });
  if (!resposta.ok) throw new Error(`Falha HTTP ${resposta.status}`);
  return resposta.json() as Promise<PreferenciasNotificacaoApi>;
}

export async function salvarPreferenciasNotificacoes(preferencias: PreferenciasNotificacaoApi): Promise<PreferenciasNotificacaoApi> {
  const { modos, timezone, emailResumo } = preferencias;
  const resposta = await fetch('/api/notificacoes/preferencias', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modos, timezone, emailResumo })
  });
  if (!resposta.ok) throw new Error(`Falha HTTP ${resposta.status}`);
  return resposta.json() as Promise<PreferenciasNotificacaoApi>;
}

export async function gerarResumoNotificacoes(): Promise<boolean> {
  const resposta = await fetch('/api/notificacoes/resumos/gerar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  });
  if (!resposta.ok) throw new Error(`Falha HTTP ${resposta.status}`);
  const resultado = await resposta.json() as { gerado: boolean };
  return resultado.gerado;
}

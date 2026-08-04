import {
  aprovarSolicitacaoAgendaPublica,
  LinkAgendamentoPublicoApi,
  listarSolicitacoesAgendaPublica,
  obterLinkAgendamentoPublico,
  recusarSolicitacaoAgendaPublica,
  rotacionarLinkAgendamentoPublico,
  SolicitacaoAgendaPublicaApi
} from './agendamento-publico-api';
import { PacienteResumo, ProfissionalResumo, RespostaPaginada, listarPacientes, listarProfissionais } from './cadastros-api';

export interface DetalheNotificacaoAgenda {
  status?: string;
  motivo?: string;
  erro?: string;
}

export interface NotificacoesConsultaAgenda {
  email?: DetalheNotificacaoAgenda;
  whatsapp?: DetalheNotificacaoAgenda;
  googleCalendar?: DetalheNotificacaoAgenda;
  lembrete24h?: DetalheNotificacaoAgenda;
  confirmacaoPaciente?: DetalheNotificacaoAgenda;
}

export type ModalidadeConsulta = 'presencial' | 'online';

export interface ConsultaAgendaApi {
  id: string;
  tenantId: string;
  pacienteId: string;
  pacienteNome?: string;
  profissionalId?: string;
  profissionalNome?: string;
  titulo: string;
  inicioEm: string;
  fimEm: string;
  timezone: string;
  status: 'agendada' | 'reagendada' | 'concluida' | 'falta' | 'cancelada';
  modalidade: ModalidadeConsulta;
  linkTeleconsulta?: string;
  local?: string;
  observacoes?: string;
  googleCalendarId?: string;
  googleEventId?: string;
  googleEventHtmlLink?: string;
  notificacoes: NotificacoesConsultaAgenda;
  payload: Record<string, unknown>;
  criadoEm: string;
  atualizadoEm: string;
}

export type ItemFeedAgendaApi =
  | (ConsultaAgendaApi & { tipo: 'consulta' })
  | {
      id: string;
      tipo: 'google_indisponivel';
      profissionalId: string;
      inicioEm: string;
      fimEm: string;
      rotulo: 'Indisponivel';
    }
  | {
      id: string;
      tipo: 'bloqueio_manual';
      profissionalId: string;
      inicioEm: string;
      fimEm: string;
      rotulo: 'Intervalo' | 'Reuniao' | 'Ferias';
    };

export interface ConsultarFeedAgendaEntrada {
  inicioEm: string;
  fimEm: string;
  profissionalId?: string;
}

export interface CriarBloqueioManualAgendaEntrada {
  profissionalId?: string;
  tipo: 'intervalo' | 'reuniao' | 'ferias';
  inicioEm: string;
  fimEm: string;
}

export interface CriarConsultaAgendaEntrada {
  pacienteId: string;
  profissionalId?: string;
  inicioEm: string;
  fimEm?: string;
  duracaoMinutos?: number;
  modalidade?: ModalidadeConsulta;
  linkTeleconsulta?: string;
  local?: string;
  observacoes?: string;
  emailContato?: string;
  whatsappContato?: string;
  enviarNotificacoes?: boolean;
}

export interface RemarcarConsultaAgendaEntrada {
  inicioEm: string;
  fimEm?: string;
  duracaoMinutos?: number;
  modalidade?: ModalidadeConsulta;
  linkTeleconsulta?: string;
  local?: string;
  observacoes?: string;
}

export interface CancelarConsultaAgendaEntrada {
  motivo?: string;
}

export type DesfechoConsultaAgenda = 'concluida' | 'falta' | 'cancelada';

export interface BootstrapAgenda {
  consultas: ConsultaAgendaApi[];
  pacientes: RespostaPaginada<PacienteResumo>;
  profissionais: RespostaPaginada<ProfissionalResumo>;
  linkPublico: LinkAgendamentoPublicoApi | null;
  solicitacoes: RespostaPaginada<SolicitacaoAgendaPublicaApi>;
}

class ErroApiAgenda extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiAgenda';
  }
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers
    }
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new ErroApiAgenda(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }

  return resposta.json() as Promise<T>;
}

export async function listarConsultasAgenda(): Promise<ConsultaAgendaApi[]> {
  return requisitar<ConsultaAgendaApi[]>('/api/agenda/consultas');
}

export async function listarFeedAgenda(
  entrada: ConsultarFeedAgendaEntrada,
  opcoes?: { signal?: AbortSignal }
): Promise<ItemFeedAgendaApi[]> {
  const parametros = new URLSearchParams({ inicioEm: entrada.inicioEm, fimEm: entrada.fimEm });
  if (entrada.profissionalId) parametros.set('profissionalId', entrada.profissionalId);
  return requisitar<ItemFeedAgendaApi[]>(`/api/agenda/feed?${parametros.toString()}`, { signal: opcoes?.signal });
}

export async function criarBloqueioManualAgenda(
  entrada: CriarBloqueioManualAgendaEntrada
): Promise<ItemFeedAgendaApi> {
  return requisitar<ItemFeedAgendaApi>('/api/agenda/bloqueios-manuais', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function removerBloqueioManualAgenda(bloqueioId: string): Promise<void> {
  await requisitar<{ id: string }>(`/api/agenda/bloqueios-manuais/${encodeURIComponent(bloqueioId)}`, {
    method: 'DELETE'
  });
}

export async function criarConsultaAgenda(entrada: CriarConsultaAgendaEntrada): Promise<ConsultaAgendaApi> {
  return requisitar<ConsultaAgendaApi>('/api/agenda/consultas', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function remarcarConsultaAgenda(consultaId: string, entrada: RemarcarConsultaAgendaEntrada): Promise<ConsultaAgendaApi> {
  return requisitar<ConsultaAgendaApi>(`/api/agenda/consultas/${encodeURIComponent(consultaId)}`, {
    method: 'PATCH',
    body: JSON.stringify(entrada)
  });
}

export async function cancelarConsultaAgenda(consultaId: string, entrada: CancelarConsultaAgendaEntrada): Promise<ConsultaAgendaApi> {
  return requisitar<ConsultaAgendaApi>(`/api/agenda/consultas/${encodeURIComponent(consultaId)}`, {
    method: 'DELETE',
    body: JSON.stringify(entrada)
  });
}

export async function registrarDesfechoConsulta(
  consultaId: string,
  status: DesfechoConsultaAgenda
): Promise<ConsultaAgendaApi> {
  return requisitar<ConsultaAgendaApi>(`/api/agenda/consultas/${encodeURIComponent(consultaId)}/desfecho`, {
    method: 'POST',
    body: JSON.stringify({ status })
  });
}

export async function carregarBootstrapAgenda(): Promise<BootstrapAgenda> {
  const [consultas, pacientes, profissionais, linkPublico, solicitacoes] = await Promise.all([
    listarConsultasAgenda(),
    listarPacientes(),
    listarProfissionais(),
    obterLinkAgendamentoPublico(),
    listarSolicitacoesAgendaPublica()
  ]);
  return { consultas, pacientes, profissionais, linkPublico, solicitacoes };
}

export interface ConexaoGoogleAgendaStatus {
  conectado: boolean;
}

export interface ConexaoGoogleProfissionalStatus extends ConexaoGoogleAgendaStatus {
  profissionalId: string;
}

export async function obterStatusGoogleAgenda(): Promise<ConexaoGoogleAgendaStatus> {
  return requisitar<ConexaoGoogleAgendaStatus>('/api/agenda/google/status');
}

export async function listarStatusGoogleProfissionais(): Promise<ConexaoGoogleProfissionalStatus[]> {
  return requisitar<ConexaoGoogleProfissionalStatus[]>('/api/agenda/google/profissionais/status');
}

export function conectarGoogleAgenda(): void {
  window.location.href = '/api/agenda/google/conectar';
}

export async function desconectarGoogleAgenda(): Promise<void> {
  await requisitar<{ desconectado: boolean }>('/api/agenda/google/desconectar', { method: 'POST' });
}

export async function obterLinkPublicoAgenda(): Promise<LinkAgendamentoPublicoApi | null> {
  return obterLinkAgendamentoPublico();
}

export async function rotacionarLinkPublicoAgenda(): Promise<LinkAgendamentoPublicoApi> {
  return rotacionarLinkAgendamentoPublico();
}

export async function listarSolicitacoesPublicasAgenda(): Promise<RespostaPaginada<SolicitacaoAgendaPublicaApi>> {
  return listarSolicitacoesAgendaPublica();
}

export async function aprovarSolicitacaoPublicaAgenda(
  solicitacaoId: string,
  pacienteId: string
): Promise<SolicitacaoAgendaPublicaApi> {
  return aprovarSolicitacaoAgendaPublica(solicitacaoId, pacienteId);
}

export async function recusarSolicitacaoPublicaAgenda(
  solicitacaoId: string,
  motivo?: string
): Promise<SolicitacaoAgendaPublicaApi> {
  return recusarSolicitacaoAgendaPublica(solicitacaoId, motivo);
}

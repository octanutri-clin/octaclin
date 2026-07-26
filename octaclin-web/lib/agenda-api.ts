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
  status: 'agendada' | 'cancelada';
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

export interface CriarConsultaAgendaEntrada {
  pacienteId: string;
  profissionalId?: string;
  inicioEm: string;
  fimEm?: string;
  duracaoMinutos?: number;
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
  local?: string;
  observacoes?: string;
}

export interface CancelarConsultaAgendaEntrada {
  motivo?: string;
}

export interface BootstrapAgenda {
  consultas: ConsultaAgendaApi[];
  pacientes: RespostaPaginada<PacienteResumo>;
  profissionais: RespostaPaginada<ProfissionalResumo>;
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

export async function carregarBootstrapAgenda(): Promise<BootstrapAgenda> {
  const [consultas, pacientes, profissionais] = await Promise.all([
    listarConsultasAgenda(),
    listarPacientes(),
    listarProfissionais()
  ]);
  return { consultas, pacientes, profissionais };
}

export interface ConexaoGoogleAgendaStatus {
  conectado: boolean;
}

export async function obterStatusGoogleAgenda(): Promise<ConexaoGoogleAgendaStatus> {
  return requisitar<ConexaoGoogleAgendaStatus>('/api/agenda/google/status');
}

export function conectarGoogleAgenda(): void {
  window.location.href = '/api/agenda/google/conectar';
}

export async function desconectarGoogleAgenda(): Promise<void> {
  await requisitar<{ desconectado: boolean }>('/api/agenda/google/desconectar', { method: 'POST' });
}

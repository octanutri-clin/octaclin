import { RespostaPaginada } from './cadastros-api';

export interface HorarioAgendaPublicaApi {
  inicioEm: string;
  rotulo: string;
}

export interface DiaAgendaPublicaApi {
  data: string;
  rotulo: string;
  horarios: HorarioAgendaPublicaApi[];
}

export interface AgendaPublicaApi {
  clinica: {
    nome: string;
    corPrimaria: string;
  };
  profissional: {
    nomeExibicao: string;
  };
  timezone: string;
  duracaoMinutos: number;
  dias: DiaAgendaPublicaApi[];
}

export interface CriarSolicitacaoAgendaPublicaEntrada {
  nome: string;
  email: string;
  whatsapp?: string;
  observacao?: string;
  inicioEm: string;
}

export interface ResultadoSolicitacaoAgendaPublicaApi {
  id?: string;
  status: 'pendente';
  inicioEm?: string;
}

export interface LinkAgendamentoPublicoApi {
  id: string;
  profissionalId: string;
  duracaoMinutos: number;
  /** PB-18 (Fase 276): tipo de atendimento escolhido ao rotacionar, opcional. */
  tipoAtendimentoId?: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  urlPublica: string | null;
  urlPublicaDisponivel: boolean;
  requerRotacaoConfirmada: boolean;
  mensagemUrlPublica: string;
}

/** PB-18 (Fase 276): tipo de atendimento por tenant, com duracao propria. */
export interface TipoAtendimentoApi {
  id: string;
  nome: string;
  duracaoMinutos: number;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

/** PB-18 (Fase 276): uma faixa de horario da jornada semanal de um profissional. */
export interface FaixaExpedienteApi {
  id: string;
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
}

export interface SolicitacaoAgendaPublicaApi {
  id: string;
  profissionalId: string;
  inicioEm: string;
  fimEm: string;
  nome: string;
  email?: string;
  whatsapp?: string;
  observacao?: string;
  status: 'pendente' | 'processando' | 'aprovada' | 'recusada' | 'expirada';
  expiraEm: string;
  decididaEm?: string | null;
  decididaPorUsuarioId?: string | null;
  pacienteId?: string | null;
  consultaId?: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

class ErroApiAgendamentoPublico extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiAgendamentoPublico';
  }
}

async function lerMensagemErro(resposta: Response) {
  const detalhe = await resposta.text();
  try {
    const corpo = JSON.parse(detalhe) as { mensagem?: string; message?: string };
    return corpo.mensagem ?? corpo.message ?? detalhe;
  } catch {
    return detalhe;
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
    throw new ErroApiAgendamentoPublico(resposta.status, (await lerMensagemErro(resposta)) || `Falha HTTP ${resposta.status}`);
  }

  if (resposta.status === 204) {
    return undefined as T;
  }

  return resposta.json() as Promise<T>;
}

export async function carregarAgendaPublica(token: string): Promise<AgendaPublicaApi> {
  return requisitar<AgendaPublicaApi>(`/api/agendamentos-publicos/${encodeURIComponent(token)}`);
}

export async function criarSolicitacaoAgendaPublica(
  token: string,
  entrada: CriarSolicitacaoAgendaPublicaEntrada
): Promise<ResultadoSolicitacaoAgendaPublicaApi> {
  return requisitar<ResultadoSolicitacaoAgendaPublicaApi>(
    `/api/agendamentos-publicos/${encodeURIComponent(token)}/solicitacoes`,
    {
      method: 'POST',
      body: JSON.stringify(entrada)
    }
  );
}

export async function obterLinkAgendamentoPublico(): Promise<LinkAgendamentoPublicoApi | null> {
  return requisitar<LinkAgendamentoPublicoApi | null>('/api/agenda/agendamento-publico');
}

export async function rotacionarLinkAgendamentoPublico(tipoAtendimentoId?: string): Promise<LinkAgendamentoPublicoApi> {
  return requisitar<LinkAgendamentoPublicoApi>('/api/agenda/agendamento-publico/rotacionar', {
    method: 'POST',
    body: tipoAtendimentoId ? JSON.stringify({ tipoAtendimentoId }) : undefined
  });
}

export async function listarSolicitacoesAgendaPublica(): Promise<RespostaPaginada<SolicitacaoAgendaPublicaApi>> {
  return requisitar<RespostaPaginada<SolicitacaoAgendaPublicaApi>>('/api/agenda/solicitacoes');
}

export async function aprovarSolicitacaoAgendaPublica(
  solicitacaoId: string,
  pacienteId: string
): Promise<SolicitacaoAgendaPublicaApi> {
  return requisitar<SolicitacaoAgendaPublicaApi>(
    `/api/agenda/solicitacoes/${encodeURIComponent(solicitacaoId)}/aprovar`,
    {
      method: 'POST',
      body: JSON.stringify({ pacienteId })
    }
  );
}

export async function recusarSolicitacaoAgendaPublica(
  solicitacaoId: string,
  motivo?: string
): Promise<SolicitacaoAgendaPublicaApi> {
  return requisitar<SolicitacaoAgendaPublicaApi>(
    `/api/agenda/solicitacoes/${encodeURIComponent(solicitacaoId)}/recusar`,
    {
      method: 'POST',
      body: JSON.stringify(motivo ? { motivo } : {})
    }
  );
}

// PB-18 (Fase 276): tipos de atendimento e expediente por profissional.

export async function listarTiposAtendimento(): Promise<TipoAtendimentoApi[]> {
  return requisitar<TipoAtendimentoApi[]>('/api/agenda/tipos-atendimento');
}

export async function criarTipoAtendimento(entrada: { nome: string; duracaoMinutos: number }): Promise<TipoAtendimentoApi> {
  return requisitar<TipoAtendimentoApi>('/api/agenda/tipos-atendimento', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function arquivarTipoAtendimento(tipoId: string): Promise<{ id: string }> {
  return requisitar<{ id: string }>(`/api/agenda/tipos-atendimento/${encodeURIComponent(tipoId)}`, {
    method: 'DELETE'
  });
}

export async function obterExpediente(profissionalId?: string): Promise<FaixaExpedienteApi[]> {
  const parametros = new URLSearchParams();
  if (profissionalId) parametros.set('profissionalId', profissionalId);
  const query = parametros.toString();
  return requisitar<FaixaExpedienteApi[]>(`/api/agenda/expediente${query ? `?${query}` : ''}`);
}

export async function salvarExpediente(entrada: {
  profissionalId?: string;
  faixas: Array<{ diaSemana: number; horaInicio: string; horaFim: string }>;
}): Promise<FaixaExpedienteApi[]> {
  return requisitar<FaixaExpedienteApi[]>('/api/agenda/expediente', {
    method: 'PUT',
    body: JSON.stringify(entrada)
  });
}

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
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  urlPublica: string | null;
  urlPublicaDisponivel: boolean;
  requerRotacaoConfirmada: boolean;
  mensagemUrlPublica: string;
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

export async function rotacionarLinkAgendamentoPublico(): Promise<LinkAgendamentoPublicoApi> {
  return requisitar<LinkAgendamentoPublicoApi>('/api/agenda/agendamento-publico/rotacionar', {
    method: 'POST'
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

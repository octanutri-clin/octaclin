import { PacienteResumo, ProfissionalResumo, RespostaPaginada, listarPacientes, listarProfissionais } from './cadastros-api';

export interface RegraAutomacaoApi {
  id: string;
  tenantId: string;
  profissionalId: string;
  nome: string;
  gatilho: Record<string, unknown>;
  condicoes: Array<Record<string, unknown>>;
  acoes: Array<Record<string, unknown>>;
  ativa: boolean;
  criadoEm: string;
}

export interface ExecucaoRegraApi {
  id: string;
  tenantId: string;
  regraId: string;
  pacienteId?: string;
  status: 'pendente' | 'processando' | 'executado' | 'ignorado' | 'falhou';
  resultado: Record<string, unknown>;
  erro?: string;
  criadoEm: string;
}

export interface CriarRegraAutomacaoEntrada {
  profissionalId: string;
  nome: string;
  gatilho: Record<string, unknown>;
  condicoes: Array<Record<string, unknown>>;
  acoes: Array<Record<string, unknown>>;
  ativa?: boolean;
}

export interface AvaliarRegraEntrada {
  regraId: string;
  pacienteId?: string;
  contexto?: Record<string, unknown>;
}

export interface BootstrapAutomacoes {
  regras: RegraAutomacaoApi[];
  execucoes: ExecucaoRegraApi[];
  profissionais: RespostaPaginada<ProfissionalResumo>;
  pacientes: RespostaPaginada<PacienteResumo>;
}

class ErroApiAutomacoes extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiAutomacoes';
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
    throw new ErroApiAutomacoes(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }

  return resposta.json() as Promise<T>;
}

export async function listarRegrasAutomacao(): Promise<RegraAutomacaoApi[]> {
  return requisitar<RegraAutomacaoApi[]>('/api/automacoes/regras');
}

export async function criarRegraAutomacao(entrada: CriarRegraAutomacaoEntrada): Promise<RegraAutomacaoApi> {
  return requisitar<RegraAutomacaoApi>('/api/automacoes/regras', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function avaliarRegraAutomacao(entrada: AvaliarRegraEntrada): Promise<ExecucaoRegraApi> {
  return requisitar<ExecucaoRegraApi>('/api/automacoes/avaliacoes', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function simularRegraAutomacao(entrada: AvaliarRegraEntrada): Promise<ExecucaoRegraApi> {
  return requisitar<ExecucaoRegraApi>('/api/automacoes/simulacoes', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function simularRecallAutomacao(regraId: string): Promise<ExecucaoRegraApi> {
  return requisitar<ExecucaoRegraApi>('/api/automacoes/recall/simulacoes', {
    method: 'POST',
    body: JSON.stringify({ regraId })
  });
}

export async function alterarAtivacaoRegra(id: string, ativa: boolean): Promise<RegraAutomacaoApi> {
  return requisitar<RegraAutomacaoApi>(`/api/automacoes/regras/${id}/ativacao`, {
    method: 'PATCH',
    body: JSON.stringify({ ativa })
  });
}

export async function listarExecucoesAutomacao(): Promise<ExecucaoRegraApi[]> {
  return requisitar<ExecucaoRegraApi[]>('/api/automacoes/avaliacoes');
}

export async function carregarBootstrapAutomacoes(): Promise<BootstrapAutomacoes> {
  const [regras, execucoes, profissionais, pacientes] = await Promise.all([
    listarRegrasAutomacao(),
    listarExecucoesAutomacao(),
    listarProfissionais(),
    listarPacientes()
  ]);
  return { regras, execucoes, profissionais, pacientes };
}

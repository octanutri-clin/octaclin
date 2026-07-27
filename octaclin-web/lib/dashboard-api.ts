export type PeriodoDashboardClinico = 'hoje' | 'sete_dias' | 'trinta_dias';
export type StatusConsultaClinica = 'agendada' | 'reagendada' | 'concluida' | 'falta' | 'cancelada';

export interface ProfissionalContextoClinico {
  id: string;
  nome: string;
}

export interface ResumoDashboardClinicoApi {
  contexto: {
    periodo: PeriodoDashboardClinico;
    inicioEm: string;
    fimEm: string;
    profissionalId?: string;
    profissionalNome?: string;
  };
  indicadores: {
    consultasHoje: number;
    proximas: number;
    concluidas: number;
    reagendadas: number;
    canceladas: number;
    faltas: number;
    semRetorno30: number;
    semRetorno60: number;
    semRetorno90Mais: number;
    formulariosPendentes: number;
    tarefasVencidas: number;
    solicitacoesPendentes: number;
    comunicacoesEmAlerta: number;
    pacientesRiscoAlto: number;
  };
  atendimentos: {
    id: string;
    pacienteId: string;
    profissionalId: string;
    pacienteNome: string;
    inicioEm: string;
    fimEm: string;
    status: StatusConsultaClinica;
  }[];
  semRetorno: {
    pacienteId: string;
    profissionalId: string;
    pacienteNome: string;
    nivelRisco: 'baixo' | 'medio' | 'alto';
    scoreRisco: number;
    diasSemRetorno: number;
    faixa: '30' | '60' | '90+';
    ultimaConsultaConcluidaEm?: string;
  }[];
  tarefasVencidas: {
    id: string;
    pacienteId: string;
    profissionalId: string;
    pacienteNome: string;
    titulo: string;
    prioridade: 'baixa' | 'media' | 'alta';
    vencimentoEm: string;
  }[];
  formulariosPendentes: {
    id: string;
    pacienteId: string;
    profissionalId: string;
    pacienteNome: string;
    questionarioId: string;
    respondidoEm?: string;
  }[];
  solicitacoesPendentes: {
    id: string;
    profissionalId: string;
    solicitanteNome: string;
    inicioEm: string;
    fimEm: string;
    expiraEm: string;
  }[];
  comunicacoes: {
    id: string;
    pacienteId: string;
    profissionalId: string;
    pacienteNome: string;
    status: 'pendente' | 'falhou' | 'recebido';
    criadoEm: string;
  }[];
  alertas: {
    id: string;
    tipo: string;
    prioridade: number;
    recursoId: string;
    pacienteId?: string;
    ocorridoEm: string;
    ocultavel: boolean;
  }[];
  selecaoObrigatoria: boolean;
}

class ErroApiDashboard extends Error {
  constructor(public readonly status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApiDashboard';
  }
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, init);
  if (!resposta.ok) {
    const detalhe = await resposta.text();
    let mensagem = detalhe || `Falha HTTP ${resposta.status}`;
    try {
      const corpo = JSON.parse(detalhe) as { mensagem?: string; message?: string };
      mensagem = corpo.mensagem ?? corpo.message ?? mensagem;
    } catch {
      // A resposta pode ser um texto de validacao vindo do BFF.
    }
    throw new ErroApiDashboard(resposta.status, mensagem);
  }
  return resposta.json() as Promise<T>;
}

export async function carregarResumoDashboardClinico(entrada: {
  periodo: PeriodoDashboardClinico;
  profissionalId?: string;
}): Promise<ResumoDashboardClinicoApi> {
  const parametros = new URLSearchParams({ periodo: entrada.periodo });
  if (entrada.profissionalId) parametros.set('profissionalId', entrada.profissionalId);
  return requisitar<ResumoDashboardClinicoApi>(`/api/dashboard/clinico?${parametros.toString()}`);
}

export async function ocultarAlertaDashboardClinico(alertaId: string): Promise<{ alertaId: string; ocultoAteEm: string }> {
  return requisitar<{ alertaId: string; ocultoAteEm: string }>(
    `/api/dashboard/clinico/alertas/${encodeURIComponent(alertaId)}/ocultar`,
    { method: 'POST' }
  );
}

export async function concluirTarefaDashboardClinico(pacienteId: string, tarefaId: string): Promise<void> {
  await requisitar(`/api/pacientes/${encodeURIComponent(pacienteId)}/tarefas-acompanhamento/${encodeURIComponent(tarefaId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'concluida' })
  });
}

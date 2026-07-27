import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { StatusAgendaConsulta } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { PrioridadeTarefaAcompanhamento } from '../../pacientes/infraestrutura/acompanhamento-tarefa.orm';

export const PERIODOS_DASHBOARD_CLINICO = ['hoje', 'sete_dias', 'trinta_dias'] as const;
export type PeriodoDashboardClinico = (typeof PERIODOS_DASHBOARD_CLINICO)[number];
export type FaixaSemRetorno = '30' | '60' | '90+';
export type NivelRiscoDashboard = 'baixo' | 'medio' | 'alto';
export type TipoAlertaDashboardClinico =
  | 'sem_retorno_risco_alto'
  | 'tarefa_vencida'
  | 'atendimento_proximo'
  | 'formulario_pendente'
  | 'solicitacao_pendente'
  | 'comunicacao_alerta';

export class FiltrosDashboardClinicoDto {
  @IsOptional()
  @IsIn(PERIODOS_DASHBOARD_CLINICO)
  periodo: PeriodoDashboardClinico = 'hoje';

  @IsOptional()
  @IsUUID()
  profissionalId?: string;
}

export interface ContextoDashboardClinicoDto {
  periodo: PeriodoDashboardClinico;
  inicioEm: Date;
  fimEm: Date;
  profissionalId?: string;
  profissionalNome?: string;
}

export interface IndicadoresDashboardClinicoDto {
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
}

export interface AtendimentoDashboardClinicoDto {
  id: string;
  pacienteId: string;
  profissionalId: string;
  pacienteNome: string;
  inicioEm: Date;
  fimEm: Date;
  status: StatusAgendaConsulta;
}

export interface SemRetornoDashboardClinicoDto {
  pacienteId: string;
  profissionalId: string;
  pacienteNome: string;
  nivelRisco: NivelRiscoDashboard;
  scoreRisco: number;
  diasSemRetorno: number;
  faixa: FaixaSemRetorno;
  ultimaConsultaConcluidaEm?: Date;
}

export interface TarefaVencidaDashboardClinicoDto {
  id: string;
  pacienteId: string;
  profissionalId: string;
  pacienteNome: string;
  titulo: string;
  prioridade: PrioridadeTarefaAcompanhamento;
  vencimentoEm: Date;
}

export interface FormularioPendenteDashboardClinicoDto {
  id: string;
  pacienteId: string;
  profissionalId: string;
  pacienteNome: string;
  questionarioId: string;
  respondidoEm?: Date;
}

export interface SolicitacaoPendenteDashboardClinicoDto {
  id: string;
  profissionalId: string;
  solicitanteNome: string;
  inicioEm: Date;
  fimEm: Date;
  expiraEm: Date;
}

export interface ComunicacaoDashboardClinicoDto {
  id: string;
  pacienteId: string;
  profissionalId: string;
  pacienteNome: string;
  status: 'pendente' | 'falhou' | 'recebido';
  criadoEm: Date;
}

export interface AlertaDashboardClinicoDto {
  id: string;
  tipo: TipoAlertaDashboardClinico;
  prioridade: number;
  recursoId: string;
  pacienteId?: string;
  ocorridoEm: Date;
  ocultavel: boolean;
}

export interface ResumoDashboardClinicoDto {
  contexto: ContextoDashboardClinicoDto;
  indicadores: IndicadoresDashboardClinicoDto;
  atendimentos: AtendimentoDashboardClinicoDto[];
  semRetorno: SemRetornoDashboardClinicoDto[];
  tarefasVencidas: TarefaVencidaDashboardClinicoDto[];
  formulariosPendentes: FormularioPendenteDashboardClinicoDto[];
  solicitacoesPendentes: SolicitacaoPendenteDashboardClinicoDto[];
  comunicacoes: ComunicacaoDashboardClinicoDto[];
  alertas: AlertaDashboardClinicoDto[];
  selecaoObrigatoria: boolean;
}

export interface OcultacaoAlertaDashboardClinicoDto {
  alertaId: string;
  ocultoAteEm: Date;
}

import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';
import type {
  CategoriaTarefaAcompanhamento,
  PrioridadeTarefaAcompanhamento,
  StatusTarefaAcompanhamento
} from '../infraestrutura/acompanhamento-tarefa.orm';
import type { TipoEvolucaoClinica, VisibilidadeEvolucaoClinica } from '../infraestrutura/evolucao-clinica.orm';

export class CriarPacienteDto {
  @IsUUID()
  profissionalResponsavelId: string;

  @IsString()
  @MaxLength(180)
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contato?: string;

  @IsOptional()
  @IsDateString()
  dataNascimento?: string;
}

export class ListarPacientesDto {
  @IsOptional()
  @IsString()
  busca?: string;
}

export class AtualizarPacienteDto {
  @IsOptional()
  @IsUUID()
  profissionalResponsavelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contato?: string;

  @IsOptional()
  @IsDateString()
  dataNascimento?: string;

  @IsOptional()
  @IsString()
  statusAdesao?: 'novo' | 'aderente' | 'em_acompanhamento' | 'risco' | 'inativo';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  scoreRisco?: number;
}

export interface PacienteRespostaDto {
  id: string;
  tenantId: string;
  usuarioId?: string;
  profissionalResponsavelId: string;
  nome: string;
  contato?: string;
  dataNascimento?: string;
  statusAdesao: string;
  scoreRisco: string;
  ultimoCheckinEm?: Date;
  ultimaConsultaConcluidaEm?: Date;
  proximaConsultaEm?: Date;
  criadoEm: Date;
  atualizadoEm: Date;
}

export type TipoEventoProntuarioPaciente =
  | 'consulta'
  | 'formulario'
  | 'resposta_formulario'
  | 'checkin_rapido'
  | 'mensagem'
  | 'evolucao_clinica'
  | 'tarefa_acompanhamento';

export interface EventoProntuarioPacienteDto {
  id: string;
  tipo: TipoEventoProntuarioPaciente;
  titulo: string;
  descricao?: string;
  data: Date;
  status?: string;
  origemId?: string;
  metadados?: Record<string, unknown>;
}

export interface ProntuarioPacienteRespostaDto {
  paciente: PacienteRespostaDto;
  resumo: {
    consultas: number;
    formulariosPendentes: number;
    respostas: number;
    checkinsRapidos: number;
    mensagens: number;
    evolucoes: number;
    tarefasPendentes: number;
    ultimoEventoEm?: Date;
  };
  linhaDoTempo: EventoProntuarioPacienteDto[];
}

export class CriarEvolucaoClinicaDto {
  @IsString()
  @MaxLength(180)
  titulo: string;

  @IsString()
  @MinLength(3)
  @MaxLength(6000)
  conteudo: string;

  @IsOptional()
  @IsIn(['consulta', 'retorno', 'observacao', 'ajuste_plano'])
  tipo?: TipoEvolucaoClinica;

  @IsOptional()
  @IsIn(['privada'])
  visibilidade?: VisibilidadeEvolucaoClinica;
}

export interface EvolucaoClinicaRespostaDto {
  id: string;
  tenantId: string;
  pacienteId: string;
  autorUsuarioId: string;
  titulo: string;
  conteudo: string;
  tipo: TipoEvolucaoClinica;
  visibilidade: VisibilidadeEvolucaoClinica;
  criadoEm: Date;
  atualizadoEm: Date;
}

export class CriarTarefaAcompanhamentoDto {
  @IsString()
  @MaxLength(180)
  titulo: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descricao?: string;

  @IsOptional()
  @IsIn(['meta', 'tarefa', 'checkin', 'orientacao'])
  categoria?: CategoriaTarefaAcompanhamento;

  @IsOptional()
  @IsIn(['baixa', 'media', 'alta'])
  prioridade?: PrioridadeTarefaAcompanhamento;

  @IsOptional()
  @IsDateString()
  vencimentoEm?: string;
}

export class AtualizarTarefaAcompanhamentoDto {
  @IsOptional()
  @IsIn(['pendente', 'em_andamento', 'concluida', 'cancelada'])
  status?: StatusTarefaAcompanhamento;
}

export interface TarefaAcompanhamentoRespostaDto {
  id: string;
  tenantId: string;
  pacienteId: string;
  profissionalId: string;
  titulo: string;
  descricao?: string;
  categoria: CategoriaTarefaAcompanhamento;
  prioridade: PrioridadeTarefaAcompanhamento;
  status: StatusTarefaAcompanhamento;
  vencimentoEm?: Date;
  concluidoEm?: Date;
  criadoEm: Date;
  atualizadoEm: Date;
}

export class CriarConvitePacienteDto {
  @IsEmail()
  @MaxLength(180)
  email: string;
}

export class AtivarConvitePacienteDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(120)
  senha: string;

  @IsBoolean()
  aceiteLgpd: boolean;

  @IsBoolean()
  aceiteTermosUso: boolean;

  @IsBoolean()
  aceitePoliticaPrivacidade: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  versaoLgpd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  versaoTermosUso?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  versaoPoliticaPrivacidade?: string;
}

export class AtualizarPerfilPacientePortalDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  nome?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsapp?: string;

  @IsOptional()
  @IsDateString()
  dataNascimento?: string;

  @IsOptional()
  @IsBoolean()
  prefereEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  prefereWhatsapp?: boolean;

  @IsOptional()
  @IsIn(['email', 'whatsapp', 'qualquer'])
  canalPreferido?: 'email' | 'whatsapp' | 'qualquer';

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horarioInicio?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horarioFim?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezoneComunicacao?: string;
}

export class RegistrarCheckinRapidoPortalDto {
  @IsIn(['muito_bem', 'bem', 'neutro', 'mal', 'muito_mal'])
  humor: 'muito_bem' | 'bem' | 'neutro' | 'mal' | 'muito_mal';

  @IsNumber()
  @Min(0)
  @Max(100)
  adesaoPlano: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sintomas?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacoes?: string;
}

export class RegistrarConsentimentoLgpdPortalDto {
  @IsBoolean()
  aceiteLgpd: boolean;

  @IsBoolean()
  aceiteTermosUso: boolean;

  @IsBoolean()
  aceitePoliticaPrivacidade: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  versaoLgpd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  versaoTermosUso?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  versaoPoliticaPrivacidade?: string;

  @IsOptional()
  @IsBoolean()
  prefereEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  prefereWhatsapp?: boolean;
}

export class RegistrarSolicitacaoLgpdPortalDto {
  @IsIn(['retificacao', 'exclusao'])
  tipo: 'retificacao' | 'exclusao';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  detalhes?: string;
}

import { IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { StatusAgendaConsulta } from '../infraestrutura/agenda-consulta.orm';
import type { TipoBloqueioManualAgenda } from '../infraestrutura/agenda-bloqueio-manual.orm';
import type { ResultadoGoogleCalendar } from './servico-google-calendar';

export type ResultadoNotificacaoAgenda =
  | { status: 'pendente'; mensagemId: string }
  | { status: 'enviado'; mensagemId: string }
  | { status: 'ignorado'; motivo: string }
  | { status: 'falhou'; erro: string };

export interface NotificacoesConsultaAgenda {
  email?: ResultadoNotificacaoAgenda;
  whatsapp?: ResultadoNotificacaoAgenda;
  googleCalendar?: ResultadoGoogleCalendar;
}

export class CriarConsultaAgendaDto {
  @IsUUID()
  pacienteId: string;

  @IsOptional()
  @IsUUID()
  profissionalId?: string;

  @IsDateString()
  inicioEm: string;

  @IsOptional()
  @IsDateString()
  fimEm?: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  duracaoMinutos?: number;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  local?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacoes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  emailContato?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsappContato?: string;

  @IsOptional()
  @IsBoolean()
  enviarNotificacoes?: boolean;
}

export class RemarcarConsultaAgendaDto {
  @IsDateString()
  inicioEm: string;

  @IsOptional()
  @IsDateString()
  fimEm?: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  duracaoMinutos?: number;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  local?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacoes?: string;
}

export class CancelarConsultaAgendaDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class ConsultarFeedAgendaDto {
  @IsDateString()
  inicioEm: string;

  @IsDateString()
  fimEm: string;

  @IsOptional()
  @IsUUID()
  profissionalId?: string;
}

export class CriarBloqueioManualAgendaDto {
  @IsOptional()
  @IsUUID()
  profissionalId?: string;

  @IsIn(['intervalo', 'reuniao', 'ferias'])
  tipo: TipoBloqueioManualAgenda;

  @IsDateString()
  inicioEm: string;

  @IsDateString()
  fimEm: string;
}

export class RegistrarDesfechoConsultaAgendaDto {
  @IsIn(['concluida', 'falta', 'cancelada'])
  status: 'concluida' | 'falta' | 'cancelada';
}

export class CriarSolicitacaoAgendamentoPublicoDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(180)
  nome: string;

  @IsEmail()
  @MaxLength(180)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string;

  @IsDateString()
  inicioEm: string;
}

export class AprovarSolicitacaoAgendamentoDto {
  @IsUUID()
  pacienteId: string;
}

export class RecusarSolicitacaoAgendamentoDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export interface ConsultaAgendaRespostaDto {
  id: string;
  tenantId: string;
  pacienteId: string;
  pacienteNome?: string;
  profissionalId?: string;
  profissionalNome?: string;
  titulo: string;
  inicioEm: Date;
  fimEm: Date;
  timezone: string;
  status: StatusAgendaConsulta;
  local?: string;
  observacoes?: string;
  googleCalendarId?: string;
  googleEventId?: string;
  googleEventHtmlLink?: string;
  notificacoes: NotificacoesConsultaAgenda;
  payload: Record<string, unknown>;
  criadoEm: Date;
  atualizadoEm: Date;
}

export type ItemFeedAgendaRespostaDto =
  | (ConsultaAgendaRespostaDto & { tipo: 'consulta' })
  | {
      id: string;
      tipo: 'google_indisponivel';
      profissionalId: string;
      inicioEm: Date;
      fimEm: Date;
      rotulo: 'Indisponivel';
    }
  | {
      id: string;
      tipo: 'bloqueio_manual';
      profissionalId: string;
      inicioEm: Date;
      fimEm: Date;
      rotulo: 'Intervalo' | 'Reuniao' | 'Ferias';
    };

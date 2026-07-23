import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

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
  status: string;
  local?: string;
  observacoes?: string;
  googleCalendarId?: string;
  googleEventId?: string;
  googleEventHtmlLink?: string;
  notificacoes: Record<string, any>;
  payload: Record<string, unknown>;
  criadoEm: Date;
  atualizadoEm: Date;
}

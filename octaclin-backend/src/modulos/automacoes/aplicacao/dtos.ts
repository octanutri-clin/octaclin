import { IsArray, IsBoolean, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CriarRegraAutomacaoDto {
  @IsUUID()
  profissionalId: string;

  @IsString()
  @MaxLength(160)
  nome: string;

  @IsObject()
  gatilho: Record<string, unknown>;

  @IsArray()
  condicoes: Array<Record<string, unknown>>;

  @IsArray()
  acoes: Array<Record<string, unknown>>;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}

export class AvaliarRegraDto {
  @IsUUID()
  regraId: string;

  @IsOptional()
  @IsUUID()
  pacienteId?: string;

  @IsOptional()
  @IsObject()
  contexto?: Record<string, unknown>;
}

export class AlterarAtivacaoRegraDto {
  @IsBoolean()
  ativa: boolean;
}

import { IsArray, IsBoolean, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AcaoAutomacao } from '../dominio/acoes-automacao';
import { GatilhoAutomacao } from '../dominio/gatilhos-automacao';

export class CriarRegraAutomacaoDto {
  @IsUUID()
  profissionalId: string;

  @IsString()
  @MaxLength(160)
  nome: string;

  @IsObject()
  gatilho: GatilhoAutomacao;

  @IsArray()
  condicoes: Array<Record<string, unknown>>;

  @IsArray()
  acoes: AcaoAutomacao[];

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

export class SimularRecallDto {
  @IsUUID()
  regraId: string;
}

export class SimularCheckinAtrasadoDto {
  @IsUUID()
  regraId: string;
}

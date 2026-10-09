import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import type { ModoEntregaNotificacao } from '../dominio/politica-notificacoes';

export class ListarNotificacoesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limite?: number;
}

export class MarcarNotificacoesLidasDto {
  /** Ausente marca tudo como lido — e o que o botao "marcar todas" faz. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  ids?: string[];
}

export class ModosNotificacaoDto {
  @IsIn(['imediato', 'diario', 'semanal', 'silenciado'])
  formulario_respondido: ModoEntregaNotificacao;

  @IsIn(['imediato', 'diario', 'semanal', 'silenciado'])
  tarefa_concluida: ModoEntregaNotificacao;

  @IsIn(['imediato', 'diario', 'semanal', 'silenciado'])
  automacao_executada: ModoEntregaNotificacao;
}

export class PreferenciasNotificacaoDto {
  @Type(() => ModosNotificacaoDto)
  @IsObject()
  @ValidateNested()
  modos: ModosNotificacaoDto;

  @IsString()
  timezone: string;

  @IsBoolean()
  emailResumo: boolean;
}

export class MarcarNotificacoesComResumosLidasDto extends MarcarNotificacoesLidasDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  idsResumos?: string[];
}

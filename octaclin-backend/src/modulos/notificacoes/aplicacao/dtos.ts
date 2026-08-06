import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

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

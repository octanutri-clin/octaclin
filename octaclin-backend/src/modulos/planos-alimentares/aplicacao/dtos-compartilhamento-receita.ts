import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, Matches, Min, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { CanalEntregaReceita } from '../infraestrutura/entrega-compartilhamento-receita.orm';

export class CompartilharReceitasNutricionaisDto {
  @IsUUID()
  pacienteId: string;

  @IsUUID('4')
  chaveIdempotencia: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  receitaIds: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => VersaoReceitaEsperadaDto)
  versoesEsperadas: VersaoReceitaEsperadaDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsIn(['portal', 'email', 'whatsapp', 'push'], { each: true })
  canais: CanalEntregaReceita[];

  @IsOptional()
  @IsDateString()
  agendadoPara?: string;

  @IsOptional()
  @IsBoolean()
  confirmacaoRevisaoManual?: boolean;
}

export class VersaoReceitaEsperadaDto {
  @IsUUID('4')
  receitaId: string;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  versao: number;
}

export class AtualizarConsentimentoReceitasDto {
  @IsBoolean()
  email: boolean;

  @IsBoolean()
  whatsapp: boolean;

  @IsBoolean()
  push: boolean;
}

export class CriarSubscriptionPushDto {
  @IsUUID()
  pacienteId: string;

  @IsObject()
  @ValidateNested()
  @Type(() => WebPushSubscriptionDto)
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
}

export class WebPushSubscriptionDto {
  @IsString()
  @MaxLength(2048)
  @Matches(/^https:\/\//)
  endpoint: string;

  @IsObject()
  @ValidateNested()
  @Type(() => WebPushKeysDto)
  keys: WebPushKeysDto;
}

export class WebPushKeysDto {
  @IsString()
  @MaxLength(256)
  p256dh: string;

  @IsString()
  @MaxLength(256)
  auth: string;
}

export class RevogarSubscriptionPushDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  endpoint?: string;
}

import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, Matches, Min, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { CanalEntregaReceita } from '../infraestrutura/entrega-compartilhamento-receita.orm';

export class PorcionamentoCompartilhamentoReceitaDto {
  @IsUUID('4')
  receitaId: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(1000)
  porcoesDesejadas: number;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  fingerprintPrevia: string;

  @ValidateIf(o => o.instrucoesPersonalizadas !== undefined)
  @IsString()
  @MaxLength(4000)
  instrucoesPersonalizadas?: string;

  @Equals(true)
  confirmacaoConferenciaInstrucoes: true;
}

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

  @ValidateIf(o => o.porcionamentos !== undefined)
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PorcionamentoCompartilhamentoReceitaDto)
  porcionamentos?: PorcionamentoCompartilhamentoReceitaDto[];

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

export class WebPushKeysDto {
  @IsString()
  @MaxLength(256)
  p256dh: string;

  @IsString()
  @MaxLength(256)
  auth: string;
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

export class RevogarSubscriptionPushDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  endpoint?: string;
}

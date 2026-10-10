import { Type } from 'class-transformer';
import { Equals, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsUUID, Matches, Max, Min, ValidateNested } from 'class-validator';
import { ORIGENS_PESO_GESTACIONAL, TERMO_GESTACAO } from '../dominio/contexto-gestacional';
export class ReferenciaGestacaoDto {
  @IsOptional() @IsNumber() @Min(1) @Max(500) pesoKg?: number;
  @IsOptional() @IsNumber() @Min(30) @Max(250) alturaCm?: number;
  @IsOptional() @IsIn(ORIGENS_PESO_GESTACIONAL) origem?: typeof ORIGENS_PESO_GESTACIONAL[number];
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dataPeso?: string;
  @IsOptional() @IsInt() @Min(0) @Max(45) semanasMedida?: number;
  @IsOptional() @IsInt() @Min(0) @Max(6) diasMedida?: number;
  @IsOptional() @IsBoolean() pesoHabitualAnteriorConfirmado?: boolean;
}
export class ContextoGestacionalDto {
  @IsOptional() @IsUUID() gestacaoId?: string;
  @IsOptional() @IsInt() @Min(1) referenciaNumero?: number;
  @IsOptional() @IsInt() @Min(0) @Max(45) semanas?: number;
  @IsOptional() @IsInt() @Min(0) @Max(6) dias?: number;
  @IsOptional() @IsIn(['unica','multipla','nao_informada']) tipo?: 'unica'|'multipla'|'nao_informada';
  @IsOptional() @IsIn(['habitual','alto','nao_informado']) risco?: 'habitual'|'alto'|'nao_informado';
  @IsOptional() @IsIn(['pre_natal','ultrassonografia','dum','nao_informada']) origemIdadeGestacional?: 'pre_natal'|'ultrassonografia'|'dum'|'nao_informada';
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dataFonteIdadeGestacional?: string;
  @IsOptional() @IsBoolean() idadeGestacionalInconsistente?: boolean;
}
export class ConfirmarGestacaoDto {
  @Equals(true) confirmar: boolean;
  @IsInt() @Min(1) versao: number;
}
export class CriarGestacaoDto {
  @Equals(true) confirmar: boolean;
  @IsUUID() chaveCriacao: string;
  @ValidateNested() @Type(() => ReferenciaGestacaoDto) referencia: ReferenciaGestacaoDto;
}
export class NovaReferenciaGestacaoDto extends ConfirmarGestacaoDto {
  @ValidateNested() @Type(() => ReferenciaGestacaoDto) referencia: ReferenciaGestacaoDto;
}
export class CompartilharGestacaoDto extends ConfirmarGestacaoDto {
  @IsBoolean() compartilhada: boolean;
}
export class ConsentimentoGestacaoDto {
  @Equals(true) confirmar: boolean;
  @IsBoolean() aceitar: boolean;
  @IsInt() @Min(1) geracao: number;
  @IsInt() @Min(0) versao: number;
  @Equals(TERMO_GESTACAO) termoVersao: string;
}
export class PaginaGestacoesDto {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limite?: number;
}
export class PaginaAvaliacoesGestacaoDto {
  @IsOptional() @IsUUID() cursor?: string;
}

import { Equals, IsISO8601, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { TERMO_COMUNIDADE, TERMO_CONQUISTAS } from '../dominio/piloto-gamificacao';
export class ComandoPilotoDto {
  @IsUUID() chave:string;
  @IsInt() @Min(0) @Max(2147483646) versaoEsperada:number;
}
export class PaginaPilotoDto { @IsOptional() @IsString() @MaxLength(1024) cursor?:string; }
export class ConquistaPilotoDto extends ComandoPilotoDto {
  @IsString() @MinLength(1) @MaxLength(120) titulo:string;
  @IsOptional() @IsString() @MaxLength(1000) descricao?:string;
  @IsIn(['award','heart','book','calendar','check']) icone:string;
}
export class CompartilharConquistaDto extends ComandoPilotoDto { @IsBoolean() compartilhado:boolean; }
export class ConsentirConquistaDto extends ComandoPilotoDto {
  @IsBoolean() aceitar:boolean;
  @IsInt() @Min(1) @Max(2147483646) geracao:number;
  @IsIn([TERMO_CONQUISTAS]) termoVersao:string;
}
export class CirculoPilotoDto extends ComandoPilotoDto {
  @IsString() @MinLength(1) @MaxLength(160) nome:string;
  @IsString() @MinLength(1) @MaxLength(160) objetivo:string;
}
export class AceitarCirculoDto extends ComandoPilotoDto {
  @IsInt() @Min(1) @Max(2147483646) geracao:number;
  @IsIn([TERMO_COMUNIDADE]) termoVersao:string;
  @IsString() @MinLength(1) @MaxLength(80) nomeExibicao:string;
}
export class PublicacaoPilotoDto extends ComandoPilotoDto { @IsString() @MinLength(1) @MaxLength(2000) texto:string; }
export class ComentarioPilotoDto extends ComandoPilotoDto { @IsString() @MinLength(1) @MaxLength(500) texto:string; }
export class CurtirPilotoDto extends ComandoPilotoDto { @IsBoolean() curti:boolean; }
export class DenunciarPilotoDto extends ComandoPilotoDto { @IsString() @MinLength(1) @MaxLength(1000) motivo:string; }
export class DecidirDenunciaDto extends ComandoPilotoDto {
  @IsBoolean() retirar:boolean;
  @IsString() @MinLength(1) @MaxLength(1000) justificativa:string;
}

export class ExcecaoRetencaoDto extends ComandoPilotoDto {
  @IsISO8601({strict:true}) holdAte:string;
  @IsString() @MinLength(1) @MaxLength(1000) justificativa:string;
  @Equals(true) confirmacaoLegal:boolean;
}

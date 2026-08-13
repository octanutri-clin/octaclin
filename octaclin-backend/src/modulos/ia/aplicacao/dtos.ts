import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { DecisaoRevisaoIa } from '../dominio/revisao-humana';

export class AnalisarSentimentoDto {
  @IsUUID()
  pacienteId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  texto: string;

  @IsOptional()
  @IsUUID()
  respostaCheckinId?: string;

  @IsOptional()
  @IsUUID()
  transcricaoMidiaId?: string;

  @IsOptional()
  @IsObject()
  contexto?: Record<string, unknown>;
}

export class ReconhecerAlimentoDto {
  @IsUUID()
  pacienteId: string;

  @IsUUID()
  arquivoMidiaId: string;

  @IsOptional()
  @IsObject()
  contexto?: Record<string, unknown>;
}

export class RevisarSugestaoIaDto {
  @IsIn(['aceita', 'editada', 'rejeitada'])
  decisao: DecisaoRevisaoIa;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string;

  @IsOptional()
  @IsObject()
  conteudoEditado?: Record<string, unknown>;
}

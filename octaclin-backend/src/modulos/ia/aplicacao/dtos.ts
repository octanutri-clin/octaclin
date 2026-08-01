import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DecisaoRevisaoIa } from '../dominio/revisao-humana';

export class AnalisarSentimentoDto {
  @IsUUID()
  pacienteId: string;

  @IsString()
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
  @IsString()
  imagemUrl?: string;

  @IsOptional()
  @IsString()
  imagemBase64?: string;

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

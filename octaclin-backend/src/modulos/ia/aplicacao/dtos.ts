import { Type } from 'class-transformer';
import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { DecisaoRevisaoIa } from '../dominio/revisao-humana';

export class ContextoSentimentoIaDto {
  @IsOptional()
  @IsIn(['checkin_manual', 'transcricao_audio', 'mensagem_paciente'])
  origem?: string;
}

export class ContextoReconhecimentoAlimentarIaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  observacao?: string;
}

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
  @ValidateNested()
  @Type(() => ContextoSentimentoIaDto)
  contexto?: ContextoSentimentoIaDto;
}

export class ReconhecerAlimentoDto {
  @IsUUID()
  pacienteId: string;

  @IsUUID()
  arquivoMidiaId: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ContextoReconhecimentoAlimentarIaDto)
  contexto?: ContextoReconhecimentoAlimentarIaDto;
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

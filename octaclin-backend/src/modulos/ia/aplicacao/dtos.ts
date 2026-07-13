import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

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

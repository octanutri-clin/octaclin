import { IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TipoCanalNotificacao } from '../dominio/canal-notificacao';

export class CriarCanalNotificacaoDto {
  @IsIn(['whatsapp', 'email', 'push'])
  tipo: TipoCanalNotificacao;

  @IsString()
  @MaxLength(120)
  nome: string;

  @IsObject()
  configuracao: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class CriarTemplateMensagemDto {
  @IsIn(['whatsapp', 'email', 'push'])
  canal: TipoCanalNotificacao;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  codigoExterno?: string;

  @IsString()
  @MaxLength(160)
  nome: string;

  @IsObject()
  conteudo: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  aprovado?: boolean;
}

export class DispararMensagemDto {
  @IsUUID()
  pacienteId: string;

  @IsUUID()
  canalId: string;

  @IsUUID()
  templateId: string;

  @IsObject()
  payload: Record<string, unknown>;
}

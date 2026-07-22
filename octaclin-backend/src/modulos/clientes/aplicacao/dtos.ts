import { IsBoolean, IsEmail, IsHexColor, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { PapelUsuario } from '../../auth/dominio/usuario-autenticado';

export type PapelUsuarioClienteAdministrativo = Extract<PapelUsuario, 'Client' | 'Professional' | 'Collaborator'>;
export type PapelUsuarioClienteCriavel = Extract<PapelUsuario, 'Professional' | 'Collaborator'>;

export class CriarUsuarioClienteDto {
  @IsEmail()
  email: string;

  @IsIn(['Professional', 'Collaborator'])
  role: PapelUsuarioClienteCriavel;
}

export interface UsuarioClienteRespostaDto {
  id: string;
  tenantId: string;
  email: string;
  role: PapelUsuarioClienteAdministrativo;
  ativo: boolean;
  ultimoLoginEm?: Date;
  criadoEm: Date;
  atualizadoEm: Date;
  convite?: {
    expiraEm: Date;
    linkPrimeiroAcesso?: string;
  };
}

export interface ConviteUsuarioClienteRespostaDto {
  id: string;
  usuarioId: string;
  tenantId: string;
  email: string;
  role: PapelUsuarioClienteAdministrativo;
  status: string;
  expiraEm: Date;
  criadoEm: Date;
  criadoPorUsuarioId?: string;
  emailErro?: string;
}

export class CanaisPadraoClienteDto {
  @IsBoolean()
  email: boolean;

  @IsBoolean()
  whatsapp: boolean;

  @IsBoolean()
  googleCalendar: boolean;
}

export class MarcaClienteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nomeExibido: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  emailRemetente?: string;

  @IsOptional()
  @IsHexColor()
  corPrimaria?: string;
}

export class AtualizarConfiguracoesClienteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nome: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  timezone: string;

  @IsIn(['pt-BR', 'en-US', 'es'])
  idioma: 'pt-BR' | 'en-US' | 'es';

  @IsObject()
  @ValidateNested()
  @Type(() => CanaisPadraoClienteDto)
  canaisPadrao: CanaisPadraoClienteDto;

  @IsObject()
  @ValidateNested()
  @Type(() => MarcaClienteDto)
  marca: MarcaClienteDto;
}

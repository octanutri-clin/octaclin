import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import type { PapelUsuario } from '../../auth/dominio/usuario-autenticado';

export type PapelUsuarioClienteAdministrativo = Extract<PapelUsuario, 'Client' | 'Professional' | 'Collaborator'>;
export type PapelUsuarioClienteCriavel = Extract<PapelUsuario, 'Professional' | 'Collaborator'>;

export class CriarUsuarioClienteDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  senhaInicial: string;

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
}

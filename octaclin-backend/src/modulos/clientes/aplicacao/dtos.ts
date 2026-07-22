import { IsEmail, IsIn } from 'class-validator';
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

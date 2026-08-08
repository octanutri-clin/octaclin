import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CriarProfissionalDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  senhaInicial: string;

  @IsString()
  @MaxLength(180)
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  registroProfissional?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  especialidade?: string;
}

export class AtualizarProfissionalDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  registroProfissional?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  especialidade?: string;
}

export interface ProfissionalRespostaDto {
  id: string;
  tenantId: string;
  usuarioId: string;
  nome: string;
  registroProfissional?: string;
  especialidade?: string;
  arquivadoEm?: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

import { IsEmail, IsJWT, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  tenantSlug: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  senha: string;
}

export class RenovarTokenDto {
  @IsJWT()
  refreshToken: string;
}

export class SolicitarRecuperacaoSenhaDto {
  @IsString()
  tenantSlug: string;

  @IsEmail()
  email: string;
}

export class RedefinirSenhaDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(120)
  senha: string;
}

export class ValidarTokenRedefinicaoSenhaDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  contexto?: string;
}

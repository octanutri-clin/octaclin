import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsJWT,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

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

export class ConcluirLoginMfaDto {
  @IsJWT()
  desafioMfa: string;

  @IsString()
  @Matches(/^(?:\d{6}|[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})$/i)
  codigo: string;
}

export class DesafioMfaDto {
  @IsJWT()
  desafioMfa: string;
}

export class ReautenticarDto {
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  senha: string;
}

export class ConfirmarConfiguracaoMfaDto {
  @IsString()
  @Matches(/^\d{6}$/)
  codigo: string;
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

  /**
   * Obrigatorios somente quando o token e de primeiro acesso de staff
   * (convite administrativo); irrelevantes para recuperacao de senha comum.
   * A checagem e feita no servico, que conhece a origem do token.
   */
  @IsOptional()
  @IsBoolean()
  aceiteTermosUso?: boolean;

  @IsOptional()
  @IsBoolean()
  aceitePoliticaPrivacidade?: boolean;
}

export class ValidarTokenRedefinicaoSenhaDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  contexto?: string;
}

export class EncerrarSessaoDto {
  /** Referencia opaca devolvida pela listagem; nunca o id da sessao. */
  @IsString()
  @Matches(/^[0-9a-f]{32}$/)
  referencia: string;
}

export class ListarSessoesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  pagina = 1;
}

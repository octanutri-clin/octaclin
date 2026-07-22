import { IsBoolean, IsDateString, IsEmail, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CriarPacienteDto {
  @IsUUID()
  profissionalResponsavelId: string;

  @IsString()
  @MaxLength(180)
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contato?: string;

  @IsOptional()
  @IsDateString()
  dataNascimento?: string;
}

export class ListarPacientesDto {
  @IsOptional()
  @IsString()
  busca?: string;
}

export class AtualizarPacienteDto {
  @IsOptional()
  @IsUUID()
  profissionalResponsavelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contato?: string;

  @IsOptional()
  @IsDateString()
  dataNascimento?: string;

  @IsOptional()
  @IsString()
  statusAdesao?: 'novo' | 'aderente' | 'em_acompanhamento' | 'risco' | 'inativo';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  scoreRisco?: number;
}

export interface PacienteRespostaDto {
  id: string;
  tenantId: string;
  usuarioId?: string;
  profissionalResponsavelId: string;
  nome: string;
  contato?: string;
  dataNascimento?: string;
  statusAdesao: string;
  scoreRisco: string;
  ultimoCheckinEm?: Date;
  criadoEm: Date;
  atualizadoEm: Date;
}

export class CriarConvitePacienteDto {
  @IsEmail()
  @MaxLength(180)
  email: string;
}

export class AtivarConvitePacienteDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(120)
  senha: string;

  @IsBoolean()
  aceiteLgpd: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  versaoLgpd?: string;
}

export class AtualizarPerfilPacientePortalDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  nome?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsapp?: string;

  @IsOptional()
  @IsDateString()
  dataNascimento?: string;

  @IsOptional()
  @IsBoolean()
  prefereEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  prefereWhatsapp?: boolean;
}

export class RegistrarConsentimentoLgpdPortalDto {
  @IsBoolean()
  aceiteLgpd: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  versaoLgpd?: string;

  @IsOptional()
  @IsBoolean()
  prefereEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  prefereWhatsapp?: boolean;
}

export class RegistrarSolicitacaoLgpdPortalDto {
  @IsIn(['retificacao', 'exclusao'])
  tipo: 'retificacao' | 'exclusao';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  detalhes?: string;
}

import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

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

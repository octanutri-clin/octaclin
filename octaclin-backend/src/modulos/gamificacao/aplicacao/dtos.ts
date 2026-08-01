import { IsBoolean, IsISO8601, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class AtualizarConfiguracaoGamificacaoDto {
  @IsOptional()
  @IsBoolean()
  metasBadgesHabilitados?: boolean;

  @IsOptional()
  @IsBoolean()
  comunidadeHabilitada?: boolean;

  @IsOptional()
  @IsBoolean()
  rankingHabilitado?: boolean;
}

export class CriarCirculoDto {
  @IsUUID()
  profissionalId: string;

  @IsString()
  @MaxLength(160)
  nome: string;

  @IsString()
  @MaxLength(160)
  objetivo: string;

  @IsOptional()
  @IsBoolean()
  privado?: boolean;
}

export class EntrarCirculoDto {
  @IsUUID()
  pacienteId: string;
}

export class CriarPostDto {
  @IsUUID()
  circuloId: string;

  @IsUUID()
  pacienteId: string;

  @IsString()
  conteudo: string;
}

export class CriarDesafioDto {
  @IsUUID()
  profissionalId: string;

  @IsString()
  @MaxLength(160)
  titulo: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsObject()
  regraPontuacao: Record<string, unknown>;

  @IsISO8601()
  iniciaEm: string;

  @IsISO8601()
  terminaEm: string;
}

export class AtualizarProgressoDesafioDto {
  @IsUUID()
  desafioId: string;

  @IsUUID()
  pacienteId: string;

  @IsNumber()
  @Min(0)
  pontos: number;

  @IsObject()
  progresso: Record<string, unknown>;
}

export class CriarBadgeDto {
  @IsString()
  @MaxLength(120)
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsString()
  iconeSvg: string;

  @IsObject()
  regraConquista: Record<string, unknown>;
}

export class ConcederBadgeDto {
  @IsUUID()
  pacienteId: string;

  @IsUUID()
  badgeId: string;
}

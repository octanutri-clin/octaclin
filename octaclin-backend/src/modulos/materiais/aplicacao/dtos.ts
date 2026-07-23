import { IsIn, IsOptional, IsString, IsUUID, IsUrl, MaxLength } from 'class-validator';
import type { StatusEnvioMaterialPaciente } from '../infraestrutura/envio-material-paciente.orm';
import type { TipoMaterialEducativo } from '../infraestrutura/material-educativo.orm';

export class CriarMaterialEducativoDto {
  @IsString()
  @MaxLength(180)
  titulo: string;

  @IsIn(['link', 'pdf_url', 'orientacao'])
  tipo: TipoMaterialEducativo;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  categoria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  resumo?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(1000)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  conteudo?: string;
}

export class EnviarMaterialPacienteDto {
  @IsUUID()
  materialId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string;
}

export interface MaterialEducativoRespostaDto {
  id: string;
  tenantId: string;
  criadoPorUsuarioId: string;
  titulo: string;
  tipo: TipoMaterialEducativo;
  categoria?: string;
  resumo?: string;
  url?: string;
  conteudo?: string;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface EnvioMaterialPacienteRespostaDto {
  id: string;
  tenantId: string;
  pacienteId: string;
  materialId: string;
  enviadoPorUsuarioId: string;
  titulo: string;
  tipo: TipoMaterialEducativo;
  categoria?: string;
  resumo?: string;
  url?: string;
  conteudo?: string;
  observacao?: string;
  status: StatusEnvioMaterialPaciente;
  enviadoEm?: Date;
  visualizadoEm?: Date;
  criadoEm: Date;
  atualizadoEm: Date;
}

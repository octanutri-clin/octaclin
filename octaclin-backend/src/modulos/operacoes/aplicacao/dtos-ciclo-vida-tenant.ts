import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { PlanoSaasId } from '../../clientes/dominio/planos-saas';

export class ProvisionarTenantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(/^[a-z0-9][a-z0-9._-]*$/)
  referencia: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nome: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
  slug: string;

  @IsEmail()
  @MaxLength(180)
  emailProprietario: string;

  @IsIn(['gratuito', 'profissional', 'clinica', 'enterprise'])
  planoId: PlanoSaasId;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;
}

export const ACOES_CICLO_VIDA_TENANT = [
  'marcar_primeiro_uso',
  'iniciar_acompanhamento',
  'concluir_acompanhamento',
  'suspender',
  'reativar',
  'iniciar_encerramento',
  'encerrar'
] as const;

export type AcaoCicloVidaTenant = (typeof ACOES_CICLO_VIDA_TENANT)[number];

export class AtualizarCicloVidaTenantDto {
  @IsIn(ACOES_CICLO_VIDA_TENANT)
  acao: AcaoCicloVidaTenant;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;

  @IsOptional()
  @IsBoolean()
  exportacaoConfirmada?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/)
  protocoloExportacao?: string;
}

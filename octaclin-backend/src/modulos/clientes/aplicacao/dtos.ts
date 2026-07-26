import { IsBoolean, IsEmail, IsHexColor, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { PapelUsuario } from '../../auth/dominio/usuario-autenticado';
import type { PlanoSaasId } from '../dominio/planos-saas';

export type PapelUsuarioClienteAdministrativo = Extract<PapelUsuario, 'Client' | 'Professional' | 'Collaborator'>;
export type PapelUsuarioClienteCriavel = Extract<PapelUsuario, 'Professional' | 'Collaborator'>;

export class CriarUsuarioClienteDto {
  @IsEmail()
  email: string;

  @IsIn(['Professional', 'Collaborator'])
  role: PapelUsuarioClienteCriavel;

  @ValidateIf((dados: CriarUsuarioClienteDto) => dados.role === 'Professional')
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  nomeProfissional?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  registroProfissional?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  especialidade?: string;
}

export class SolicitarAjusteAssinaturaClienteDto {
  @IsIn(['upgrade', 'downgrade', 'revisao_limite'])
  acao: 'upgrade' | 'downgrade' | 'revisao_limite';

  @IsOptional()
  @IsIn(['gratuito', 'profissional', 'clinica', 'enterprise'])
  planoDesejado?: PlanoSaasId;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
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

export interface ConviteUsuarioClienteRespostaDto {
  id: string;
  usuarioId: string;
  tenantId: string;
  email: string;
  role: PapelUsuarioClienteAdministrativo;
  status: string;
  expiraEm: Date;
  criadoEm: Date;
  criadoPorUsuarioId?: string;
  emailErro?: string;
}

export interface HistoricoConviteUsuarioClienteRespostaDto extends ConviteUsuarioClienteRespostaDto {
  usadoEm?: Date;
  revogadoEm?: Date;
  convidadoEm?: string;
  reenviadoPorUsuarioId?: string;
  revogadoPorUsuarioId?: string;
  motivoRevogacao?: string;
}

export class CanaisPadraoClienteDto {
  @IsBoolean()
  email: boolean;

  @IsBoolean()
  whatsapp: boolean;

  @IsBoolean()
  googleCalendar: boolean;
}

export class MarcaClienteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nomeExibido: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  emailRemetente?: string;

  @IsOptional()
  @IsHexColor()
  corPrimaria?: string;
}

export class AtualizarConfiguracoesClienteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nome: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  timezone: string;

  @IsIn(['pt-BR', 'en-US', 'es'])
  idioma: 'pt-BR' | 'en-US' | 'es';

  @IsObject()
  @ValidateNested()
  @Type(() => CanaisPadraoClienteDto)
  canaisPadrao: CanaisPadraoClienteDto;

  @IsObject()
  @ValidateNested()
  @Type(() => MarcaClienteDto)
  marca: MarcaClienteDto;
}

export class ResponsavelEmpresaClienteDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nome?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  cargo?: string;
}

export class EnderecoEmpresaClienteDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cep?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  logradouro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  complemento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bairro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  uf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  pais?: string;
}

export class ContatosEmpresaClienteDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  emailFinanceiro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefoneFinanceiro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsappAtendimento?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  emailAtendimento?: string;
}

export class FiscalEmpresaClienteDto {
  @IsBoolean()
  prepararRecibos: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoes?: string;
}

export class AtualizarPerfilEmpresaClienteDto {
  @IsIn(['pf', 'pj'])
  tipoPessoa: 'pf' | 'pj';

  @IsOptional()
  @IsString()
  @MaxLength(32)
  documento?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  nomeLegal: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  inscricaoEstadual?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  inscricaoMunicipal?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ResponsavelEmpresaClienteDto)
  responsavel: ResponsavelEmpresaClienteDto;

  @IsObject()
  @ValidateNested()
  @Type(() => EnderecoEmpresaClienteDto)
  endereco: EnderecoEmpresaClienteDto;

  @IsObject()
  @ValidateNested()
  @Type(() => ContatosEmpresaClienteDto)
  contatos: ContatosEmpresaClienteDto;

  @IsObject()
  @ValidateNested()
  @Type(() => FiscalEmpresaClienteDto)
  fiscal: FiscalEmpresaClienteDto;
}

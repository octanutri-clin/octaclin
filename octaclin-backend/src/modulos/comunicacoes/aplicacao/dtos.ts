import { IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TipoCanalNotificacao } from '../dominio/canal-notificacao';
import { CategoriaMensagemNotificacao } from '../infraestrutura/mensagem-notificacao.orm';

export class CriarCanalNotificacaoDto {
  @IsIn(['whatsapp', 'email', 'push'])
  tipo: TipoCanalNotificacao;

  @IsString()
  @MaxLength(120)
  nome: string;

  @IsObject()
  configuracao: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class CriarTemplateMensagemDto {
  @IsIn(['whatsapp', 'email', 'push'])
  canal: TipoCanalNotificacao;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  codigoExterno?: string;

  @IsString()
  @MaxLength(160)
  nome: string;

  @IsObject()
  conteudo: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  aprovado?: boolean;
}

export class DispararMensagemDto {
  @IsUUID()
  pacienteId: string;

  @IsUUID()
  canalId: string;

  @IsUUID()
  templateId: string;

  @IsObject()
  payload: Record<string, unknown>;

  /**
   * Opcional. Quando informada, um retry/duplo clique com a mesma chave
   * retorna a mensagem ja criada em vez de disparar um segundo envio.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  chaveIdempotencia?: string;

  /**
   * Opcional, default false. Disparo manual para paciente que optou por nao
   * receber naquele canal e recusado (409) a menos que o chamador confirme
   * explicitamente com esta flag apos ver o aviso.
   */
  @IsOptional()
  @IsBoolean()
  ignorarOptOut?: boolean;

  /**
   * Opcional, default `administrativo` (Fase 261). So marque `clinico`
   * quando o conteudo da mensagem for narrativa clinica ou relevante para a
   * assistencia -- essa categoria herda a retencao de 20 anos do
   * prontuario em vez dos 12 meses padrao.
   */
  @IsOptional()
  @IsIn(['clinico', 'administrativo'])
  categoria?: CategoriaMensagemNotificacao;
}

export class AssociarContatoWhatsappDto {
  @IsString()
  @MaxLength(40)
  contato: string;

  @IsUUID()
  pacienteId: string;

  @IsOptional()
  @IsBoolean()
  atualizarContatoPaciente?: boolean;
}

export class RegistrarNotaWhatsappDto {
  @IsString()
  @MaxLength(40)
  contato: string;

  @IsOptional()
  @IsUUID()
  pacienteId?: string;

  @IsString()
  @MaxLength(1000)
  texto: string;

  @IsIn(['acompanhamento', 'resolvido'])
  statusAtendimento: 'acompanhamento' | 'resolvido';
}

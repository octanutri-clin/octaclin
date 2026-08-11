import {
  IsBoolean,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMaxSize,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type {
  CategoriaTarefaAcompanhamento,
  PrioridadeTarefaAcompanhamento,
  StatusTarefaAcompanhamento
} from '../infraestrutura/acompanhamento-tarefa.orm';
import type { TipoEvolucaoClinica, VisibilidadeEvolucaoClinica } from '../infraestrutura/evolucao-clinica.orm';
import { PROTOCOLOS_COMPOSICAO } from '../dominio/antropometria';
import { TIPOS_DOCUMENTO_CLINICO } from '../dominio/documentos-clinicos';
import type { TipoDocumentoClinico } from '../dominio/documentos-clinicos';
import type {
  DeltaAntropometrico,
  MedidasAntropometricas,
  ProtocoloComposicao,
  ResultadoAntropometrico,
  SexoBiologico
} from '../dominio/antropometria';

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

  @IsOptional()
  @IsString()
  @MaxLength(180)
  referenciaExterna?: string;
}

export class ListarPacientesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite = 25;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  busca?: string;

  @IsOptional()
  @IsIn(['alto', 'medio', 'baixo'])
  risco?: 'alto' | 'medio' | 'baixo';

  @IsOptional()
  @IsUUID()
  profissionalId?: string;

  @IsOptional()
  @IsIn(['novo', 'aderente', 'em_acompanhamento', 'risco', 'inativo'])
  status?: 'novo' | 'aderente' | 'em_acompanhamento' | 'risco' | 'inativo';

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  semProximaConsulta?: boolean;
}

export class ImportarPacientesDto {
  /**
   * Conteudo do CSV como texto. O teto de 1 MB e freio de abuso no corpo da
   * requisicao — o teto de linhas util fica em `LIMITE_LINHAS_IMPORTACAO`.
   */
  @IsString()
  @MaxLength(1_000_000)
  conteudo: string;

  /** Ignorado quando quem importa e Professional: ali vale sempre o proprio vinculo. */
  @IsOptional()
  @IsUUID()
  profissionalResponsavelId?: string;

  /** Cria convite de portal para cada paciente importado com e-mail no contato. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  enviarConvite?: boolean;
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

export class AtualizarIdentificacaoCadastroPacienteDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  nomeUso?: string;
}

export class EnderecoCadastroPacienteDto {
  @IsOptional() @IsString() @MaxLength(12) cep?: string;
  @IsOptional() @IsString() @MaxLength(160) logradouro?: string;
  @IsOptional() @IsString() @MaxLength(30) numero?: string;
  @IsOptional() @IsString() @MaxLength(80) complemento?: string;
  @IsOptional() @IsString() @MaxLength(80) bairro?: string;
  @IsOptional() @IsString() @MaxLength(100) cidade?: string;
  @IsOptional() @IsString() @MaxLength(2) estado?: string;
}

export class AtualizarContatoCadastroPacienteDto {
  @IsOptional() @IsEmail() @MaxLength(180) email?: string;
  @IsOptional() @Matches(/^\+[1-9]\d{7,14}$/) telefone?: string;
  @IsOptional() @IsIn(['email', 'whatsapp', 'telefone']) canalPreferido?: 'email' | 'whatsapp' | 'telefone';
  @IsOptional() @ValidateNested() @Type(() => EnderecoCadastroPacienteDto) endereco?: EnderecoCadastroPacienteDto;
}

export class ResponsavelCadastroPacienteDto {
  @IsOptional() @IsString() @MaxLength(180) nome?: string;
  @IsOptional() @IsString() @MaxLength(80) parentesco?: string;
  @IsOptional() @IsString() @MaxLength(180) contato?: string;
}

export class AtualizarOperacaoCadastroPacienteDto {
  @IsOptional() @IsString() @MaxLength(100) origem?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(40, { each: true }) tags?: string[];
  @IsOptional() @IsDateString() proximaRevisaoEm?: string;
  @IsOptional() @ValidateNested() @Type(() => ResponsavelCadastroPacienteDto) responsavel?: ResponsavelCadastroPacienteDto;
}

export class AtualizarFiscalCadastroPacienteDto {
  @IsOptional() @IsString() @MaxLength(180) nomePagador?: string;
  @IsOptional() @Matches(/^[0-9.\/-]{11,18}$/) documentoPagador?: string;
  @IsOptional() @IsEmail() @MaxLength(180) emailRecibo?: string;
  @IsOptional() @ValidateNested() @Type(() => EnderecoCadastroPacienteDto) enderecoCobranca?: EnderecoCadastroPacienteDto;
}

export interface PerfilCadastroPacienteRespostaDto {
  identificacao?: AtualizarIdentificacaoCadastroPacienteDto;
  contato?: AtualizarContatoCadastroPacienteDto;
  operacao?: AtualizarOperacaoCadastroPacienteDto;
  atualizadoEm?: Date;
}

export interface FiscalCadastroPacienteRespostaDto extends AtualizarFiscalCadastroPacienteDto {
  atualizadoEm?: Date;
}

export interface PacienteRespostaDto {
  id: string;
  tenantId: string;
  usuarioId?: string;
  profissionalResponsavelId: string;
  nome: string;
  contato?: string;
  dataNascimento?: string;
  referenciaExterna?: string;
  statusAdesao: string;
  scoreRisco: string;
  ultimoCheckinEm?: Date;
  ultimaConsultaConcluidaEm?: Date;
  proximaConsultaEm?: Date;
  arquivadoEm?: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

export type TipoEventoProntuarioPaciente =
  | 'consulta'
  | 'formulario'
  | 'resposta_formulario'
  | 'checkin_rapido'
  | 'mensagem'
  | 'evolucao_clinica'
  | 'tarefa_acompanhamento';

export interface EventoProntuarioPacienteDto {
  id: string;
  tipo: TipoEventoProntuarioPaciente;
  titulo: string;
  descricao?: string;
  data: Date;
  status?: string;
  origemId?: string;
  metadados?: Record<string, unknown>;
}

export interface ProntuarioPacienteRespostaDto {
  paciente: PacienteRespostaDto;
  resumo: {
    consultas: number;
    formulariosPendentes: number;
    respostas: number;
    checkinsRapidos: number;
    mensagens: number;
    evolucoes: number;
    tarefasPendentes: number;
    ultimoEventoEm?: Date;
  };
  linhaDoTempo: EventoProntuarioPacienteDto[];
}

export interface PaginaLinhaTempoProntuarioDto {
  itens: EventoProntuarioPacienteDto[];
  proximoCursor?: string;
}

export class ListarLinhaTempoProntuarioDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  cursor?: string;

  @IsOptional()
  @IsIn(['consulta', 'formulario', 'resposta_formulario', 'checkin_rapido', 'mensagem', 'evolucao_clinica', 'tarefa_acompanhamento'])
  tipo?: TipoEventoProntuarioPaciente;

  @IsOptional()
  @IsDateString()
  inicio?: string;

  @IsOptional()
  @IsDateString()
  fim?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limite?: number = 20;
}

export class CriarEvolucaoClinicaDto {
  @IsString()
  @MaxLength(180)
  titulo: string;

  @IsString()
  @MinLength(3)
  @MaxLength(6000)
  conteudo: string;

  @IsOptional()
  @IsIn(['consulta', 'retorno', 'observacao', 'ajuste_plano'])
  tipo?: TipoEvolucaoClinica;

  @IsOptional()
  @IsIn(['privada'])
  visibilidade?: VisibilidadeEvolucaoClinica;
}

export interface EvolucaoClinicaRespostaDto {
  id: string;
  tenantId: string;
  pacienteId: string;
  autorUsuarioId: string;
  titulo: string;
  conteudo: string;
  tipo: TipoEvolucaoClinica;
  visibilidade: VisibilidadeEvolucaoClinica;
  criadoEm: Date;
  atualizadoEm: Date;
}

export class CriarTarefaAcompanhamentoDto {
  @IsString()
  @MaxLength(180)
  titulo: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descricao?: string;

  @IsOptional()
  @IsIn(['meta', 'tarefa', 'checkin', 'orientacao'])
  categoria?: CategoriaTarefaAcompanhamento;

  @IsOptional()
  @IsIn(['baixa', 'media', 'alta'])
  prioridade?: PrioridadeTarefaAcompanhamento;

  @IsOptional()
  @IsDateString()
  vencimentoEm?: string;
}

export class AtualizarTarefaAcompanhamentoDto {
  @IsOptional()
  @IsIn(['pendente', 'em_andamento', 'concluida', 'cancelada'])
  status?: StatusTarefaAcompanhamento;
}

export interface TarefaAcompanhamentoRespostaDto {
  id: string;
  tenantId: string;
  pacienteId: string;
  profissionalId: string;
  titulo: string;
  descricao?: string;
  categoria: CategoriaTarefaAcompanhamento;
  prioridade: PrioridadeTarefaAcompanhamento;
  status: StatusTarefaAcompanhamento;
  vencimentoEm?: Date;
  concluidoEm?: Date;
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

  @IsBoolean()
  aceiteTermosUso: boolean;

  @IsBoolean()
  aceitePoliticaPrivacidade: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  versaoLgpd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  versaoTermosUso?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  versaoPoliticaPrivacidade?: string;
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

  @IsOptional()
  @IsIn(['email', 'whatsapp', 'qualquer'])
  canalPreferido?: 'email' | 'whatsapp' | 'qualquer';

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horarioInicio?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horarioFim?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezoneComunicacao?: string;
}

export class RegistrarCheckinRapidoPortalDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  idLocal?: string;

  @IsOptional()
  @IsUUID()
  pacienteIdEsperado?: string;

  @IsIn(['muito_bem', 'bem', 'neutro', 'mal', 'muito_mal'])
  humor: 'muito_bem' | 'bem' | 'neutro' | 'mal' | 'muito_mal';

  @IsNumber()
  @Min(0)
  @Max(100)
  adesaoPlano: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sintomas?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacoes?: string;
}

export class RegistrarConsentimentoLgpdPortalDto {
  @IsBoolean()
  aceiteLgpd: boolean;

  @IsBoolean()
  aceiteTermosUso: boolean;

  @IsBoolean()
  aceitePoliticaPrivacidade: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  versaoLgpd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  versaoTermosUso?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  versaoPoliticaPrivacidade?: string;

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

export class CircunferenciasDto {
  @IsOptional() @IsNumber() @Min(10) @Max(300) cintura?: number;
  @IsOptional() @IsNumber() @Min(10) @Max(300) quadril?: number;
  @IsOptional() @IsNumber() @Min(10) @Max(300) abdomen?: number;
  @IsOptional() @IsNumber() @Min(10) @Max(300) braco?: number;
  @IsOptional() @IsNumber() @Min(10) @Max(300) coxa?: number;
  @IsOptional() @IsNumber() @Min(10) @Max(300) panturrilha?: number;
}

export class DobrasCutaneasDto {
  @IsOptional() @IsNumber() @Min(2) @Max(80) peitoral?: number;
  @IsOptional() @IsNumber() @Min(2) @Max(80) axilarMedia?: number;
  @IsOptional() @IsNumber() @Min(2) @Max(80) triceps?: number;
  @IsOptional() @IsNumber() @Min(2) @Max(80) subescapular?: number;
  @IsOptional() @IsNumber() @Min(2) @Max(80) abdominal?: number;
  @IsOptional() @IsNumber() @Min(2) @Max(80) suprailiaca?: number;
  @IsOptional() @IsNumber() @Min(2) @Max(80) coxa?: number;
  @IsOptional() @IsNumber() @Min(2) @Max(80) panturrilha?: number;
}

export class CriarAvaliacaoAntropometricaDto {
  /** Data civil da avaliacao. Ausente, o servico usa a data de hoje na clinica. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'avaliadaEm deve estar no formato AAAA-MM-DD.' })
  avaliadaEm?: string;

  @IsOptional()
  @IsIn(PROTOCOLOS_COMPOSICAO)
  protocolo?: ProtocoloComposicao;

  @IsOptional()
  @IsIn(['masculino', 'feminino'])
  sexo?: SexoBiologico;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  pesoKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(250)
  alturaCm?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CircunferenciasDto)
  circunferencias?: CircunferenciasDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DobrasCutaneasDto)
  dobras?: DobrasCutaneasDto;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}

export interface AvaliacaoAntropometricaRespostaDto {
  id: string;
  pacienteId: string;
  avaliadaEm: string;
  protocolo: ProtocoloComposicao;
  sexo?: SexoBiologico;
  idadeAnos?: number;
  medidas: MedidasAntropometricas;
  resultado: ResultadoAntropometrico;
  formulaAplicada?: string;
  observacoes?: string;
  criadoEm: Date;
}

export interface SerieAntropometricaRespostaDto {
  avaliacoes: AvaliacaoAntropometricaRespostaDto[];
  /** Comparacao entre as duas mais recentes, ja calculada para o painel. */
  deltaUltimas: DeltaAntropometrico[];
}

export class EmitirDocumentoClinicoDto {
  @IsIn(TIPOS_DOCUMENTO_CLINICO as unknown as string[])
  tipo: TipoDocumentoClinico;

  /** Obrigatoria para declaracao de comparecimento; validada no servico. */
  @IsOptional()
  @IsUUID()
  consultaId?: string;

  /** Texto livre do profissional no relatorio de alta. */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  conteudo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cidadeEmissao?: string;
}

export class CancelarDocumentoClinicoDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}

export interface DocumentoClinicoRespostaDto {
  id: string;
  tipo: TipoDocumentoClinico;
  titulo: string;
  corpo: string;
  paragrafos: string[];
  cabecalho?: {
    clinicaNome: string;
    clinicaDocumento: string;
    clinicaEndereco: string;
    profissionalNome: string;
    profissionalRegistro: string;
    profissionalEspecialidade: string;
  };
  consultaId?: string;
  emitidoEm: string;
  canceladoEm?: string;
  motivoCancelamento?: string;
  enviadoEm?: string;
  podeEnviarPorEmail: boolean;
  /** Variaveis do modelo que nao encontraram valor; a interface avisa quem emitiu. */
  variaveisVazias: string[];
}

export interface ResultadoEnvioDocumentoDto {
  status: 'pendente' | 'ignorado';
  motivo?: 'contato_ausente' | 'canal_ausente' | 'template_ausente';
  mensagemId?: string;
}

import {
  ArrayMaxSize,
  Allow,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { TIPOS_PERGUNTA_SUPORTADOS, TipoPergunta } from '../dominio/tipos-pergunta';

export class CriarCategoriaPerguntaDto {
  @IsString()
  @MaxLength(120)
  nome: string;

  @IsString()
  iconeSvg: string;

  @IsHexColor()
  corHex: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;
}

export class CriarQuestionarioDto {
  @IsUUID()
  profissionalId: string;

  @IsString()
  @MaxLength(180)
  titulo: string;

  @IsOptional()
  @IsString()
  descricao?: string;
}

export class AtualizarQuestionarioDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsIn(['rascunho', 'publicado', 'arquivado'])
  status?: 'rascunho' | 'publicado' | 'arquivado';
}

export class DuplicarQuestionarioDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  titulo?: string;
}

export class CriarQuestionarioAPartirModeloDto {
  @IsUUID()
  profissionalId: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;
}

export class OpcaoPerguntaDto {
  @IsString()
  @MaxLength(180)
  rotulo: string;

  @IsString()
  @MaxLength(120)
  valor: string;

  @IsOptional()
  @IsString()
  imagemUrl?: string;
}

export class CriarPerguntaDto {
  @IsUUID()
  categoriaId: string;

  @IsIn(TIPOS_PERGUNTA_SUPORTADOS)
  tipo: TipoPergunta;

  @IsString()
  enunciado: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  peso: number;

  @IsOptional()
  @IsBoolean()
  obrigatoria?: boolean;

  @IsOptional()
  @IsObject()
  configuracao?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OpcaoPerguntaDto)
  opcoes?: OpcaoPerguntaDto[];
}

export class AtualizarPerguntaDto {
  @IsOptional()
  @IsUUID()
  categoriaId?: string;

  @IsOptional()
  @IsIn(TIPOS_PERGUNTA_SUPORTADOS)
  tipo?: TipoPergunta;

  @IsOptional()
  @IsString()
  enunciado?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  peso?: number;

  @IsOptional()
  @IsBoolean()
  obrigatoria?: boolean;

  @IsOptional()
  @IsObject()
  configuracao?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OpcaoPerguntaDto)
  opcoes?: OpcaoPerguntaDto[];
}

export class OrdemPerguntaDto {
  @IsUUID()
  id: string;

  @IsInt()
  @Min(0)
  ordem: number;
}

export class ReordenarPerguntasDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrdemPerguntaDto)
  perguntas: OrdemPerguntaDto[];
}

export class CriarAgendamentoQuestionarioDto {
  @IsUUID()
  questionarioId: string;

  @ValidateIf((dados: CriarAgendamentoQuestionarioDto) => !dados.dataFixa)
  @IsString()
  regraCron?: string;

  @ValidateIf((dados: CriarAgendamentoQuestionarioDto) => !dados.regraCron)
  @IsISO8601()
  dataFixa?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class CriarEnvioQuestionarioManualDto {
  @IsUUID()
  pacienteId: string;

  @IsOptional()
  @IsISO8601()
  expiraEm?: string;
}

export class RespostaFormularioPacienteDto {
  @IsUUID()
  perguntaId: string;

  @Allow()
  valor: unknown;
}

export class FinalizarFormularioPacienteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespostaFormularioPacienteDto)
  respostas: RespostaFormularioPacienteDto[];
}

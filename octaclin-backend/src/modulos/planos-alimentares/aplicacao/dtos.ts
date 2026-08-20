import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested
} from 'class-validator';
import { FORMULAS_ENERGETICAS, FormulaEnergetica } from '../dominio/calculo-nutricional';
import {
  ORIGENS_MODELO_PLANO_ALIMENTAR,
  OrigemModeloPlanoAlimentar
} from '../dominio/modelos-plano-alimentar';

export class CriarPlanoAlimentarDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  titulo: string;
}

// Teto de pagina: com `limite` maximo de 100, segura o OFFSET em 100.000 linhas
// e impede que uma pagina absurda vire varredura cara no banco.
export const PAGINA_MAXIMA = 1_000;

export class ListarPlanosAlimentaresDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINA_MAXIMA)
  pagina = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite = 25;
}

/**
 * Paginação da trilha append-only de escolhas de substituição. Mantém um DTO
 * próprio para não acoplar a API clínica ao nome da listagem de planos.
 */
export class ListarEscolhasPlanoAlimentarDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINA_MAXIMA)
  pagina = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite = 25;
}

export class BuscarAlimentosDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  busca: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINA_MAXIMA)
  pagina = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite = 25;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  fonteCodigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  versao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  baseCodigo?: string;
}

export class ListarModelosPlanoAlimentarDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINA_MAXIMA)
  pagina = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite = 25;

  @IsOptional()
  @IsIn(ORIGENS_MODELO_PLANO_ALIMENTAR)
  origem?: OrigemModeloPlanoAlimentar;
}

export class NutrientesPor100gDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  energiaKcal: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  proteinasG: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  carboidratosG: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  gordurasG: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  fibrasG?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  sodioMg?: number;
}

export class SubstituicaoPlanoAlimentarDto {
  @IsOptional()
  @IsUUID()
  alimentoComposicaoId?: string;

  @ValidateIf((item: SubstituicaoPlanoAlimentarDto) => !item.alimentoComposicaoId)
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  descricao?: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(10_000)
  quantidade: number;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  unidade: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(10_000)
  porcaoGramas: number;

  @ValidateIf((item: SubstituicaoPlanoAlimentarDto) => !item.alimentoComposicaoId)
  @ValidateNested()
  @Type(() => NutrientesPor100gDto)
  nutrientesPor100g?: NutrientesPor100gDto;
}

// As duas decisoes do profissional sobre uma alternativa. Ficam aqui, e nao em
// `SubstituicaoPlanoAlimentarDto`, porque o item principal estende aquela classe
// e nao e alternativa de nada.
export class AlternativaPlanoAlimentarDto extends SubstituicaoPlanoAlimentarDto {
  // Exposicao ao paciente e decisao explicita: omitir o campo nunca libera.
  @IsOptional()
  @IsBoolean()
  liberadaParaPaciente = false;

  @IsOptional()
  @IsBoolean()
  preferida = false;
}

export class ItemPlanoAlimentarDto extends SubstituicaoPlanoAlimentarDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AlternativaPlanoAlimentarDto)
  substituicoes: AlternativaPlanoAlimentarDto[] = [];

  // Ausente significa mostrar todas as liberadas. Zero seria um grupo de troca
  // que nunca aparece, que e a mesma coisa que nao liberar nenhuma.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  substituicoesVisiveisInicialmente?: number;
}

export class RefeicaoPlanoAlimentarDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  nome: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/)
  horarioLocal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  orientacoes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ItemPlanoAlimentarDto)
  itens: ItemPlanoAlimentarDto[];
}

export class CriarModeloPlanoAlimentarDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  nome: string;

  @IsIn(ORIGENS_MODELO_PLANO_ALIMENTAR)
  origem: OrigemModeloPlanoAlimentar;

  // Mesmos limites do rascunho: um modelo so vale se puder ser aplicado, entao
  // nao pode aceitar uma estrutura que o rascunho recusaria.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RefeicaoPlanoAlimentarDto)
  refeicoes: RefeicaoPlanoAlimentarDto[];
}

export class DistribuicaoMacrosDto {
  @IsInt()
  @Min(0)
  @Max(10_000)
  carboidratosBasisPoints: number;

  @IsInt()
  @Min(0)
  @Max(10_000)
  proteinasBasisPoints: number;

  @IsInt()
  @Min(0)
  @Max(10_000)
  gordurasBasisPoints: number;
}

export class AtualizarRascunhoPlanoAlimentarDto {
  @IsUUID()
  avaliacaoAntropometricaId: string;

  @IsIn(FORMULAS_ENERGETICAS)
  formula: FormulaEnergetica;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(1.4)
  @Max(2.4)
  fatorAtividade: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(-10_000)
  @Max(10_000)
  ajusteEnergeticoKcal?: number;

  @ValidateNested()
  @Type(() => DistribuicaoMacrosDto)
  distribuicaoMacros: DistribuicaoMacrosDto;

  @IsBoolean()
  possuiCondicaoEspecial: boolean;

  @IsBoolean()
  aplicabilidadeFormulaConfirmada: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  justificativaCondicaoEspecial?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2_000)
  justificativaDivergenciaClinica?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4_000)
  objetivos: string;

  @IsOptional()
  @IsString()
  @MaxLength(8_000)
  observacoes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RefeicaoPlanoAlimentarDto)
  refeicoes: RefeicaoPlanoAlimentarDto[];
}

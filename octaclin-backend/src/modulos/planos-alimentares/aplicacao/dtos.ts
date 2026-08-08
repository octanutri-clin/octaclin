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

export class CriarPlanoAlimentarDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  titulo: string;
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

export class ItemPlanoAlimentarDto extends SubstituicaoPlanoAlimentarDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SubstituicaoPlanoAlimentarDto)
  substituicoes: SubstituicaoPlanoAlimentarDto[] = [];
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

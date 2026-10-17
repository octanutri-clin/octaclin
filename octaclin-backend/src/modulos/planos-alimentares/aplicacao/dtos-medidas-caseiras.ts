import { Transform, Type } from 'class-transformer';
import { Equals, IsIn, IsInt, IsNumber, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
const presente = (_objeto: unknown, valor: unknown) => valor !== undefined;
export class CriarMedidaCaseiraDto {
    @IsUUID()
    chaveIdempotencia: string;
    @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
    @IsString()
    @MinLength(1)
    @MaxLength(40)
    nome: string;
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    @Max(10000)
    quantidadeReferencia: number;
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    @Max(10000)
    pesoReferenciaGramas: number;
    @ValidateIf(presente)
    @IsIn(['pessoal', 'clinica'])
    escopo?: 'pessoal' | 'clinica';
}
export class AtualizarMedidaCaseiraDto {
    @IsInt()
    @Min(1)
    @Max(2147483646)
    revisaoEsperada: number;
    @ValidateIf(presente)
    @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
    @IsString()
    @MinLength(1)
    @MaxLength(40)
    nome?: string;
    @ValidateIf(presente)
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    @Max(10000)
    quantidadeReferencia?: number;
    @ValidateIf(presente)
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    @Max(10000)
    pesoReferenciaGramas?: number;
    @ValidateIf(presente)
    @Equals(false)
    ativa?: false;
}
export class ListarMedidasCaseirasDto {
    @ValidateIf(presente)
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(10000)
    pagina?: number;
    @ValidateIf(presente)
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limite?: number;
}

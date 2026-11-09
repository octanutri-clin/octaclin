import { IsIn, IsInt, IsNumber, IsString, Max, MaxLength, Min, MinLength, ValidateIf, validateSync } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { CODIGOS_MICRONUTRIENTES, type CodigoMicronutriente } from '../dominio/micronutrientes';

/**
 * Janela máxima de resultados (página × limite). Busca por `LIKE '%…%'` com
 * deslocamento grande vira varredura do catálogo; quem precisa ir além refina a
 * busca. Revisão R4 da #455.
 */
export const JANELA_MAXIMA_CONSULTA_TEOR = 1000;

export class ConsultaTeorCatalogoDto {
  @IsIn(CODIGOS_MICRONUTRIENTES) codigo: CodigoMicronutriente;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(10000) porcaoGramas: number;
  @IsString() @MinLength(2) @MaxLength(120) busca: string;
  @IsInt() @Min(1) @Max(10000) pagina: number;
  @IsInt() @Min(1) @Max(100) limite: number;
  @ValidateIf((_o, v) => v !== undefined) @IsString() @MinLength(1) @MaxLength(80) fonteCodigo?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsString() @MinLength(1) @MaxLength(80) versao?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsString() @MinLength(1) @MaxLength(80) baseCodigo?: string;
}

export function validarConsultaTeorCatalogo(valor: unknown): ConsultaTeorCatalogoDto {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)
    || ![Object.prototype, ConsultaTeorCatalogoDto.prototype, null].includes(Object.getPrototypeOf(valor))
    || Object.keys(valor).some(k => !['codigo', 'porcaoGramas', 'busca', 'pagina', 'limite', 'fonteCodigo', 'versao', 'baseCodigo'].includes(k))
    || Object.getOwnPropertySymbols(valor).length
    || Object.values(Object.getOwnPropertyDescriptors(valor)).some(d => !d.enumerable || !Object.hasOwn(d, 'value')))
    throw new BadRequestException('Consulta factual inválida.');
  const dto = Object.assign(new ConsultaTeorCatalogoDto(), valor);
  if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true }).length
    || dto.busca.trim().length < 2
    || dto.pagina * dto.limite > JANELA_MAXIMA_CONSULTA_TEOR
    || (['fonteCodigo', 'versao', 'baseCodigo'] as const).some(k => dto[k] !== undefined && !dto[k]!.trim().length))
    throw new BadRequestException('Consulta factual inválida.');
  return dto;
}

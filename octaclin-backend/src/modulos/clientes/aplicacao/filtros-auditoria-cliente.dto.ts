import { Transform, plainToInstance } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, validateSync } from 'class-validator';
import { BadRequestException } from '@nestjs/common';

const inteiro = ({ value }: { value: unknown }) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

export class FiltrosAuditoriaClienteDto {
  @IsOptional() @Transform(inteiro) @IsInt() @Min(1) @Max(10000)
  pagina?: number;

  @IsOptional() @Transform(inteiro) @IsInt() @Min(1) @Max(100)
  limite?: number;

  @IsOptional() @IsUUID()
  usuarioId?: string;

  @IsOptional() @IsString() @MaxLength(120) @Matches(/^[a-zA-Z0-9_.-]+$/)
  acao?: string;

  @IsOptional() @IsString() @MaxLength(120) @Matches(/^[a-zA-Z0-9_.-]+$/)
  recursoTipo?: string;

  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true })
  inicio?: string;

  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true })
  fim?: string;
}

export function validarFiltrosAuditoriaCliente(entrada: object): FiltrosAuditoriaClienteDto {
  const filtros = plainToInstance(FiltrosAuditoriaClienteDto, entrada);
  if (validateSync(filtros, { whitelist: true, forbidNonWhitelisted: true }).length
    || (filtros.inicio && filtros.fim && filtros.inicio > filtros.fim)) {
    throw new BadRequestException('Filtros de auditoria inválidos. Confira o período e a paginação.');
  }
  return filtros;
}

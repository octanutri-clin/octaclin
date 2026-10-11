import { IsBoolean, IsIn, IsInt, IsOptional, Matches, Max, Min, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import type { ContextoPediatrico } from '../dominio/antropometria-pediatrica';

export class ContextoPediatricoDto implements ContextoPediatrico {
  @IsBoolean() @IsIn([true]) confirmado: true;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) nascimento?: string;
  @IsIn(['masculino','feminino','nao_informado']) sexoCurva: ContextoPediatrico['sexoCurva'];
  @IsIn(['deitado','em_pe','nao_informada']) tecnica: ContextoPediatrico['tecnica'];
  @IsIn(['sim','nao','desconhecido']) edema: ContextoPediatrico['edema'];
  @IsIn(['a_termo','prematuro','nao_informado']) nascimentoTipo: ContextoPediatrico['nascimentoTipo'];
  @IsOptional() @IsInt() @Min(20) @Max(45) semanasNascimento?: number;
  @IsOptional() @IsInt() @Min(0) @Max(6) diasNascimento?: number;
  @IsOptional() @IsIn(['documentada','informada','nao_informada']) origemGestacional?: ContextoPediatrico['origemGestacional'];
  @IsIn(['nascimento','pos_natal','nao_informado']) tipoMedida: ContextoPediatrico['tipoMedida'];
}
@ValidatorConstraint({ name: 'MedidaContextual', async: false })
export class MedidaContextual implements ValidatorConstraintInterface {
  validate(valor: unknown, args: ValidationArguments): boolean {
    const objeto = args.object as { pediatrico?: ContextoPediatricoDto };
    const minimo = objeto.pediatrico ? 0 : args.property === 'pesoKg' ? 1 : 30;
    return typeof valor === 'number' && Number.isFinite(valor) && (objeto.pediatrico ? valor > minimo : valor >= minimo) && valor <= (args.property === 'pesoKg' ? 500 : 250);
  }
  defaultMessage() { return 'Medida fora dos limites técnicos do contexto.'; }
}

import { Type } from 'class-transformer';
import { IsUUID } from 'class-validator';
export class PaginaPediatricaDto {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite?: number;
}

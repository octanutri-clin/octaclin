import { Transform, Type } from 'class-transformer';
import { Allow, Equals, IsIn, IsInt, IsString, IsUUID, Max, MaxLength, Min, MinLength, Validate, ValidateIf, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { BaseComposicaoPersonalizada, CAMPOS_COMPOSICAO_CUSTOM, normalizarComposicaoPersonalizada, NutrientesPersonalizados, selecionarConteudoPersonalizado } from '../dominio/alimentos-personalizados';
import { MicronutrientesPor100gEntrada } from '../dominio/micronutrientes';
const presente = (_: unknown, v: unknown) => v !== undefined;
@ValidatorConstraint({ name: 'composicaoAlimentoPersonalizado', async: false })
class ValidadorComposicao implements ValidatorConstraintInterface {
  validate(_v: unknown, args: ValidationArguments): boolean {
    const o = args.object as Record<string, unknown>;
    if (o.ativo === false) return CAMPOS_COMPOSICAO_CUSTOM.every(k => o[k] === undefined);
    try { normalizarComposicaoPersonalizada(selecionarConteudoPersonalizado(o)); return true; } catch { return false; }
  }
  defaultMessage() { return 'Composição informada inválida.'; }
}
class ConteudoDto {
  @Allow() nome: string;
  @Allow() preparacao?: string;
  @Allow() referenciaComposicao?: string;
  @Validate(ValidadorComposicao) base: BaseComposicaoPersonalizada;
  @Allow() nutrientes: NutrientesPersonalizados;
  @Allow() micronutrientes?: MicronutrientesPor100gEntrada;
}
export class CriarAlimentoPersonalizadoDto extends ConteudoDto {
  @IsUUID() chaveIdempotencia: string;
  @ValidateIf(presente) @IsIn(['pessoal', 'clinica']) escopo?: 'pessoal' | 'clinica';
}
export class AtualizarAlimentoPersonalizadoDto extends ConteudoDto {
  @IsInt() @Min(1) @Max(2147483646) revisaoEsperada: number;
  @ValidateIf(presente) @Equals(false) ativo?: false;
}
export class ListarAlimentosPersonalizadosDto {
  @ValidateIf(presente) @Type(() => Number) @IsInt() @Min(1) @Max(10000) pagina?: number;
  @ValidateIf(presente) @Type(() => Number) @IsInt() @Min(1) @Max(100) limite?: number;
  @ValidateIf(presente) @IsIn(['pessoal', 'clinica']) escopo?: 'pessoal' | 'clinica';
}
export class BuscarAlimentosPersonalizadosDto extends ListarAlimentosPersonalizadosDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(3) @MaxLength(240) busca: string;
}

import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsString, IsUUID, Max, MaxLength, Min, MinLength, Validate, ValidateIf, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { ConteudoGrupo, validarConteudoGrupo } from '../dominio/grupos-substituicoes';
type ConteudoEntrada = Omit<ConteudoGrupo, 'etiquetas'> & { etiquetas?: string[] };
const presente = (_o: unknown, v: unknown) => v !== undefined;
@ValidatorConstraint({ name: 'conteudoGrupo', async: false })
class ConteudoValido implements ValidatorConstraintInterface {
  validate(v: unknown) { try { validarConteudoGrupo(v); return true; } catch { return false; } }
  defaultMessage() { return 'Conteúdo do grupo inválido.'; }
}
@ValidatorConstraint({ name: 'operacaoGrupo', async: false })
class OperacaoValida implements ValidatorConstraintInterface {
  validate(_v: unknown, a: ValidationArguments) {
    const o = a.object as Record<string, unknown>;
    return ['conteudo','estado','escopo'].filter(k => o[k] !== undefined).length === 1;
  }
  defaultMessage() { return 'Informe uma única alteração no grupo.'; }
}
export class CriarGrupoDto {
  @IsUUID() chaveIdempotencia: string;
  @ValidateIf(presente) @IsIn(['pessoal','clinica']) escopo?: 'pessoal' | 'clinica';
  @Validate(ConteudoValido) conteudo: ConteudoEntrada;
}
export class AtualizarGrupoDto {
  @IsInt() @Min(1) @Max(2147483646) @Validate(OperacaoValida) revisaoEsperada: number;
  @ValidateIf(presente) @Validate(ConteudoValido) conteudo?: ConteudoEntrada;
  @ValidateIf(presente) @IsIn(['ativo','arquivado']) estado?: 'ativo' | 'arquivado';
  @ValidateIf(presente) @IsIn(['clinica']) escopo?: 'clinica';
}
export class DuplicarGrupoDto extends CriarGrupoDto {
  @IsInt() @Min(1) @Max(2147483646) revisaoEsperada: number;
}
export class ConsultarGruposDto {
  @ValidateIf(presente) @Type(() => Number) @IsInt() @Min(1) @Max(10000) pagina?: number;
  @ValidateIf(presente) @Type(() => Number) @IsInt() @Min(1) @Max(100) limite?: number;
  @ValidateIf(presente) @IsIn(['pessoal','clinica']) escopo?: 'pessoal' | 'clinica';
  @ValidateIf(presente) @IsIn(['ativo','arquivado','todos']) estado?: 'ativo' | 'arquivado' | 'todos';
  @ValidateIf(presente) @IsBoolean() favoritos?: boolean;
  @ValidateIf(presente) @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @MinLength(3) @MaxLength(180) busca?: string;
  @ValidateIf(presente) @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @MinLength(1) @MaxLength(80) categoria?: string;
  @ValidateIf(presente) @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @MinLength(1) @MaxLength(40) etiqueta?: string;
}

export class BuscarFontesGrupoDto {
  @IsIn(['catalogo','custom']) origem: 'catalogo'|'custom';
  @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @MinLength(3) @MaxLength(120) busca: string;
  @ValidateIf(presente) @Type(()=>Number) @IsInt() @Min(1) @Max(10000) pagina?: number;
  @ValidateIf(presente) @Type(()=>Number) @IsInt() @Min(1) @Max(100) limite?: number;
}

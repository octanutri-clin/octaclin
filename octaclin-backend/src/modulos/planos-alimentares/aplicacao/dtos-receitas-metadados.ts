import { IsInt, IsNumber, Max, Min, Validate, ValidateIf, ValidatorConstraint, type ValidatorConstraintInterface } from 'class-validator';
import { mesclarMetadadosReceita, normalizarMetadadosReceita, type AlteracaoMetadadosReceita } from '../dominio/metadados-receita';

@ValidatorConstraint({ name: 'metadadosReceita', async: false })
export class ValidadorMetadadosReceita implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    try { normalizarMetadadosReceita(valor); return true; } catch { return false; }
  }
  defaultMessage(): string { return 'Metadados da receita inválidos.'; }
}
@ValidatorConstraint({ name: 'alteracaoMetadadosReceita', async: false })
export class ValidadorAlteracaoMetadadosReceita implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    try { mesclarMetadadosReceita(undefined, valor); return true; } catch { return false; }
  }
  defaultMessage(): string { return 'Metadados da receita inválidos.'; }
}
/** Conectar aos DTOs HTTP apenas junto do writer atômico de T02: não aceitar e descartar. */
export class CriarMetadadosReceitaDto {
  @ValidateIf(o => o.metadados !== undefined)
  @Validate(ValidadorMetadadosReceita)
  metadados?: unknown;
}
export class AtualizarMetadadosReceitaDto {
  @ValidateIf(o => o.metadados !== undefined)
  @Validate(ValidadorAlteracaoMetadadosReceita)
  metadados?: AlteracaoMetadadosReceita;
}
export class PreverPorcionamentoReceitaDto {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  versaoEsperada: number;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(1000)
  porcoesDesejadas: number;
}

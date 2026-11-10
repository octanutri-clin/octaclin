import { IsBoolean, Validate, ValidateIf, ValidatorConstraint, type ValidationArguments, type ValidatorConstraintInterface } from 'class-validator';
import { CalculoCombinadoDto, validarSelecoesCalculo, type SelecaoPlanoCalculo } from './dtos-calculo-combinado';
import { validarConfirmacoesContexto, type ConfirmacoesContextoRegistro } from './contexto-confirmado-registro';

/**
 * Analise ao vivo com referencias DRI por opt-in (FOOD06, T3a).
 *
 * Sem `incluirReferencias`, o contrato e exatamente o de antes (`selecoes`), e a
 * resposta tambem. Com `incluirReferencias: true`, o profissional envia so as 7
 * confirmacoes explicitas (as mesmas da captura do registro factual). Nascimento,
 * data da analise, idade e elegibilidade NUNCA vem do navegador: o servidor os
 * resolve na mesma transacao autorizada.
 */
export interface EntradaAnaliseMicronutrientes {
  selecoes: SelecaoPlanoCalculo[];
  confirmacoes?: ConfirmacoesContextoRegistro;
}

const CHAVES = ['selecoes', 'incluirReferencias', 'confirmacoes'];

export function validarAnaliseMicronutrientes(valor: unknown): EntradaAnaliseMicronutrientes {
  const falhar = (): never => { throw new Error('Análise de micronutrientes inválida.'); };
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return falhar();
  const v = valor as Record<string, unknown>;
  if (Object.keys(v).some((k) => !CHAVES.includes(k))) return falhar();
  const { selecoes } = validarSelecoesCalculo({ selecoes: v.selecoes });
  if (v.incluirReferencias !== undefined && typeof v.incluirReferencias !== 'boolean') return falhar();
  const temConfirmacoes = Object.hasOwn(v, 'confirmacoes');
  if (v.incluirReferencias !== true) {
    // Confirmacao sem pedido explicito nao e silenciosamente ignorada.
    if (temConfirmacoes) return falhar();
    return { selecoes };
  }
  if (!temConfirmacoes) return falhar();
  let confirmacoes: ConfirmacoesContextoRegistro;
  try { confirmacoes = validarConfirmacoesContexto(v.confirmacoes); } catch { return falhar(); }
  return { selecoes, confirmacoes };
}

@ValidatorConstraint({ name: 'analiseMicronutrientes', async: false })
class ValidadorAnaliseMicronutrientes implements ValidatorConstraintInterface {
  validate(_valor: unknown, args: ValidationArguments): boolean {
    const d = args.object as Record<string, unknown>;
    try {
      validarAnaliseMicronutrientes(Object.fromEntries(CHAVES.filter((c) => Object.hasOwn(d, c) && d[c] !== undefined).map((c) => [c, d[c]])));
      return true;
    } catch { return false; }
  }
  defaultMessage(): string { return 'Análise de micronutrientes inválida.'; }
}

export class AnaliseMicronutrientesDto extends CalculoCombinadoDto {
  /** Opt-in aditivo, como `incluirOrigem`: clientes anteriores nao o enviam e recebem a resposta de sempre. */
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() @Validate(ValidadorAnaliseMicronutrientes) incluirReferencias?: boolean;
  @ValidateIf((_o, v) => v !== undefined) @Validate(ValidadorAnaliseMicronutrientes) confirmacoes?: ConfirmacoesContextoRegistro;
}

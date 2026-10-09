export type SituacaoFaixa = 'dentro_da_faixa' | 'fora_da_faixa';

export type ResultadoMarcador = {
  nome: string;
  valor: string;
  unidade?: string;
  referencia?: string;
  metodo?: string;
  limiteInferior?: string;
  limiteSuperior?: string;
};

export function numeroDecimal(valor: string | undefined): number | undefined {
  if (!valor || !/^-?\d+(?:[.,]\d+)?$/.test(valor.trim())) return undefined;
  const numero = Number(valor.trim().replace(',', '.'));
  return Number.isFinite(numero) ? numero : undefined;
}

export function situacaoFaixa(resultado: ResultadoMarcador): SituacaoFaixa | undefined {
  if (!resultado.unidade?.trim()) return undefined;
  const valor = numeroDecimal(resultado.valor);
  const inferior = numeroDecimal(resultado.limiteInferior);
  const superior = numeroDecimal(resultado.limiteSuperior);
  if (
    valor === undefined
    || (resultado.limiteInferior !== undefined && inferior === undefined)
    || (resultado.limiteSuperior !== undefined && superior === undefined)
    || (inferior === undefined && superior === undefined)
    || (inferior !== undefined && superior !== undefined && inferior > superior)
  ) return undefined;

  return (inferior !== undefined && valor < inferior) || (superior !== undefined && valor > superior)
    ? 'fora_da_faixa'
    : 'dentro_da_faixa';
}

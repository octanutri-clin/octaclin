export const TIPOS_PERGUNTA_SUPORTADOS = [
  'likert',
  'multipla_escolha',
  'linear',
  'metrica',
  'upload_midia',
  'texto_longo',
  'sim_nao'
] as const;

export type TipoPergunta = (typeof TIPOS_PERGUNTA_SUPORTADOS)[number];

export function validarTipoPergunta(tipo: string): tipo is TipoPergunta {
  return TIPOS_PERGUNTA_SUPORTADOS.includes(tipo as TipoPergunta);
}

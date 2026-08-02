export type PapelProcesso = 'web' | 'worker' | 'all';

const PAPEIS_VALIDOS: readonly PapelProcesso[] = ['web', 'worker', 'all'];

export function obterPapelProcesso(valor = process.env.OCTACLIN_PROCESSO): PapelProcesso {
  const normalizado = valor?.trim().toLowerCase();
  if (!normalizado) return 'all';
  if (PAPEIS_VALIDOS.includes(normalizado as PapelProcesso)) return normalizado as PapelProcesso;
  throw new Error('OCTACLIN_PROCESSO deve ser web, worker ou all.');
}

export function deveExecutarProcessadores(valor = process.env.OCTACLIN_PROCESSO): boolean {
  return obterPapelProcesso(valor) !== 'web';
}

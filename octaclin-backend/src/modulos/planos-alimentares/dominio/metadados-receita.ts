export type BaseQuantidadesReceita = 'receita_inteira' | 'por_porcao';
export interface MetadadosReceitaV1 {
  schemaVersao: 1;
  etiquetas: string[];
  baseQuantidades?: BaseQuantidadesReceita;
  rendimentoPorcoes?: number;
  tempoPreparoMinutos?: number;
}
export interface AlteracaoMetadadosReceita {
  schemaVersao?: 1;
  etiquetas?: string[];
  baseQuantidades?: BaseQuantidadesReceita | null;
  rendimentoPorcoes?: number | null;
  tempoPreparoMinutos?: number | null;
}
const CAMPOS = ['schemaVersao', 'etiquetas', 'baseQuantidades', 'rendimentoPorcoes', 'tempoPreparoMinutos'];
const REMOVIVEIS = ['baseQuantidades', 'rendimentoPorcoes', 'tempoPreparoMinutos'] as const;
function invalido(): never { throw new Error('Metadados da receita inválidos.'); }

/** Dados JSON próprios, sem getters, símbolos ou protótipos definidos pelo cliente. */
function objeto(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(valor))) return invalido();
  const descritores = Object.getOwnPropertyDescriptors(valor);
  if (Object.getOwnPropertySymbols(valor).length || Object.entries(descritores).some(([chave, d]) =>
    !CAMPOS.includes(chave) || !Object.hasOwn(d, 'value') || !d.enumerable)) return invalido();
  return valor as Record<string, unknown>;
}

/** Mesma identidade textual do índice HMAC existente, sem gerar índice no domínio. */
export function identidadeEtiquetaReceita(valor: string): string {
  return valor.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim().replace(/\s+/gu, ' ');
}

export function normalizarMetadadosReceita(entrada: unknown): MetadadosReceitaV1 {
  const dados = objeto(entrada);
  if (Object.hasOwn(dados, 'schemaVersao') && dados.schemaVersao !== 1) return invalido();
  const resultado: MetadadosReceitaV1 = { schemaVersao: 1, etiquetas: [] };
  if (Object.hasOwn(dados, 'etiquetas')) {
    if (!Array.isArray(dados.etiquetas) || dados.etiquetas.length > 10) return invalido();
    const identidades = new Set<string>();
    for (const valor of dados.etiquetas) {
      if (typeof valor !== 'string' || /[\u0000-\u001f\u007f]/u.test(valor)) return invalido();
      const etiqueta = valor.normalize('NFC').trim().replace(/\s+/gu, ' ');
      if (!etiqueta || etiqueta.length > 40 || /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(etiqueta) ||
          /\b\d{8,}\b/u.test(etiqueta) || /\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/i.test(etiqueta)) return invalido();
      const identidade = identidadeEtiquetaReceita(etiqueta);
      if (!identidade) return invalido();
      if (!identidades.has(identidade)) resultado.etiquetas.push(etiqueta);
      identidades.add(identidade);
    }
  }
  if (Object.hasOwn(dados, 'baseQuantidades')) {
    if (dados.baseQuantidades !== 'receita_inteira' && dados.baseQuantidades !== 'por_porcao') return invalido();
    resultado.baseQuantidades = dados.baseQuantidades;
  }
  for (const [campo, maximo] of [['rendimentoPorcoes', 1000], ['tempoPreparoMinutos', 10080]] as const) {
    if (Object.hasOwn(dados, campo)) {
      const valor = dados[campo];
      if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 1 || valor > maximo) return invalido();
      resultado[campo] = valor;
    }
  }
  return resultado;
}

/** Omissão mantém o legado; null só remove os campos explicitamente removíveis. */
export function mesclarMetadadosReceita(anterior: unknown, alteracao: unknown): MetadadosReceitaV1 | undefined {
  const base = anterior === undefined ? undefined : normalizarMetadadosReceita(anterior);
  if (alteracao === undefined) return base;
  const delta = objeto(alteracao);
  const mesclado: Record<string, unknown> = { ...base, ...delta };
  for (const campo of REMOVIVEIS) if (Object.hasOwn(delta, campo) && delta[campo] === null) delete mesclado[campo];
  return normalizarMetadadosReceita(mesclado);
}

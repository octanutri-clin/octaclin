import { validarMicronutrientesManuais, CODIGOS_MICRONUTRIENTES } from './micronutrientes';
import { normalizarMetadadosReceita } from './metadados-receita';
import type { ConteudoReceitaNutricional } from './receitas-nutricionais';

const CAMPOS_ALIMENTO = ['alimentoComposicaoId', 'descricao', 'quantidade', 'unidade', 'porcaoGramas', 'nutrientesPor100g', 'micronutrientesPor100g'];
const MACROS = ['energiaKcal', 'proteinasG', 'carboidratosG', 'gordurasG'];
function invalido(): never { throw new Error('Conteúdo da receita inválido.'); }
function objeto(v: unknown, campos: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) return invalido();
  if (Object.getOwnPropertySymbols(v).length || Object.entries(Object.getOwnPropertyDescriptors(v)).some(([k, d]) =>
    !campos.includes(k) || !Object.hasOwn(d, 'value') || !d.enumerable)) return invalido();
  return v as Record<string, unknown>;
}
function texto(v: unknown, maximo: number): boolean {
  return typeof v === 'string' && v.trim().length > 0 && Array.from(v).length <= maximo;
}
/** Não arredonda para validar: a precisão extra é erro, não autorização de corte. */
export function milesimosReceita(v: unknown, maximo = 10000): bigint {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0.001 || v > maximo) return invalido();
  const partes = /^(\d+)(?:\.(\d{1,3}))?$/.exec(String(v));
  if (!partes) return invalido();
  return BigInt(partes[1]) * 1000n + BigInt((partes[2] ?? '').padEnd(3, '0'));
}
function alimento(v: unknown, alternativa: boolean): Record<string, unknown> {
  const a = { ...objeto(v, [...CAMPOS_ALIMENTO, ...(alternativa ? ['liberadaParaPaciente', 'preferida'] : ['substituicoes', 'substituicoesVisiveisInicialmente'])]) };
  // Os DTOs anteriores aceitam null em campos opcionais e o writer os
  // preservava. Normalizar só a projeção em memória, nunca o ciphertext lido.
  for (const campo of ['alimentoComposicaoId', 'descricao', 'substituicoesVisiveisInicialmente', 'liberadaParaPaciente', 'preferida']) {
    if (a[campo] === null) delete a[campo];
  }
  if (a.alimentoComposicaoId && a.nutrientesPor100g === null) delete a.nutrientesPor100g;
  milesimosReceita(a.quantidade); milesimosReceita(a.porcaoGramas);
  if (!texto(a.unidade, 40)) return invalido();
  if (a.alimentoComposicaoId !== undefined && (typeof a.alimentoComposicaoId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a.alimentoComposicaoId))) return invalido();
  if (!a.alimentoComposicaoId && !texto(a.descricao, 240)) return invalido();
  if (a.descricao !== undefined && !texto(a.descricao, 240)) return invalido();
  if (a.nutrientesPor100g !== undefined) {
    const n = { ...objeto(a.nutrientesPor100g, [...MACROS, 'fibrasG', 'sodioMg']) };
    for (const campo of Object.keys(n)) {
      if (n[campo] === null && (a.alimentoComposicaoId || campo === 'fibrasG' || campo === 'sodioMg')) delete n[campo];
    }
    a.nutrientesPor100g = n;
    for (const valor of Object.values(n)) {
      if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) return invalido();
      // Precisão da fonte de catálogo permanece intacta. A restrição de quatro
      // casas é do cadastro manual existente, não da composição importada.
      if (!a.alimentoComposicaoId && !Number.isInteger(valor) && !/^\d+(?:\.\d{1,4})?$/.test(String(valor))) return invalido();
    }
    if (!a.alimentoComposicaoId && MACROS.some(k => !Object.hasOwn(n, k))) return invalido();
  } else if (!a.alimentoComposicaoId) return invalido();
  if (a.micronutrientesPor100g !== undefined) {
    const n = objeto(a.micronutrientesPor100g, CODIGOS_MICRONUTRIENTES);
    try { validarMicronutrientesManuais(n); } catch { return invalido(); }
  }
  for (const campo of ['liberadaParaPaciente', 'preferida']) {
    if (a[campo] !== undefined && typeof a[campo] !== 'boolean') return invalido();
  }
  if (a.substituicoesVisiveisInicialmente !== undefined &&
    (typeof a.substituicoesVisiveisInicialmente !== 'number' || !Number.isInteger(a.substituicoesVisiveisInicialmente) ||
    a.substituicoesVisiveisInicialmente < 1 || a.substituicoesVisiveisInicialmente > 20)) return invalido();
  if (a.substituicoes !== undefined) {
    if (!Array.isArray(a.substituicoes) || a.substituicoes.length > 20) return invalido();
    a.substituicoes = a.substituicoes.map(sub => alimento(sub, true));
  }
  // Clone JSON após validar, preservando o contrato JSON também entre realms.
  return JSON.parse(JSON.stringify(a));
}

/** Valida dados decifrados; não escreve, não completa pelo catálogo e não reinterpreta legado. */
export function lerConteudoReceita(v: unknown): ConteudoReceitaNutricional {
  const dados = objeto(v, ['instrucoes', 'itens', 'metadados']);
  if (dados.instrucoes !== undefined && (typeof dados.instrucoes !== 'string' || Array.from(dados.instrucoes).length > 4000)) return invalido();
  if (!Array.isArray(dados.itens) || !dados.itens.length || dados.itens.length > 100) return invalido();
  const itens = dados.itens.map(i => alimento(i, false));
  const metadados = dados.metadados === undefined ? undefined : normalizarMetadadosReceita(dados.metadados);
  return {
    ...(dados.instrucoes === undefined ? {} : { instrucoes: dados.instrucoes }),
    itens: itens as unknown as ConteudoReceitaNutricional['itens'],
    ...(metadados === undefined ? {} : { metadados })
  };
}

/** Allowlist pública; tags/base e outros fatos internos não atravessam esta fronteira. */
export function projetarConteudoReceitaPaciente(v: unknown) {
  const { instrucoes, itens, metadados } = lerConteudoReceita(v);
  return {
    ...(instrucoes === undefined ? {} : { instrucoes }), itens,
    ...(metadados === undefined ? {} : { metadados: {
      schemaVersao: 1 as const,
      ...(metadados.rendimentoPorcoes === undefined ? {} : { rendimentoPorcoes: metadados.rendimentoPorcoes }),
      ...(metadados.tempoPreparoMinutos === undefined ? {} : { tempoPreparoMinutos: metadados.tempoPreparoMinutos })
    } })
  };
}

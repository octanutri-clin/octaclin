import type { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { validarConteudoRestricao, type ConteudoRestricaoV1 } from '../dominio/conteudo-restricao';

/**
 * FOOD06 D2 (#531): ÚNICO caminho de cifra e decifra do conteúdo clínico de restrição.
 *
 * - Cifra só depois de `validarConteudoRestricao` (cifragem autenticada AES-GCM de `CriptografiaDadosSensiveis`).
 * - O envelope cifrado tem formato e versão próprios e carrega o VÍNCULO (finalidade, tenant, paciente, restrição e
 *   revisão). Ao decifrar, o vínculo esperado é comparado: cifra copiada de outra linha, outro tenant, outro paciente
 *   ou outra revisão falha fechada.
 * - Qualquer falha (bytes adulterados, JSON inválido, formato ou versão desconhecidos, conteúdo inválido) lança
 *   `ConteudoRestricaoIlegivelError`, genérico, sem causa nem eco. Ilegível NUNCA é ausência de restrição: o chamador
 *   deve tratar como erro (e o motor como `indeterminado`), jamais como lista vazia.
 * - Não registra em log nem devolve conteúdo decifrado a ninguém além do chamador.
 */
export const FORMATO_CONTEUDO_RESTRICAO = 'food06-restricao-conteudo' as const;
export const VERSAO_ENVELOPE_RESTRICAO = 1 as const;

export interface VinculoConteudoRestricao {
  finalidade: 'restricao' | 'revisao_restricao';
  tenantId: string; pacienteId: string; restricaoId: string; revisao: number;
}

export class ConteudoRestricaoIlegivelError extends Error {
  constructor() { super('Conteúdo de restrição ilegível.'); this.name = 'ConteudoRestricaoIlegivelError'; }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function ilegivel(): never { throw new ConteudoRestricaoIlegivelError(); }

function normalizarVinculo(v: unknown): VinculoConteudoRestricao {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ilegivel();
  const o = v as Record<string, unknown>;
  if (Reflect.ownKeys(o).some(k => !['finalidade', 'tenantId', 'pacienteId', 'restricaoId', 'revisao'].includes(k as string))) return ilegivel();
  if (o.finalidade !== 'restricao' && o.finalidade !== 'revisao_restricao') return ilegivel();
  for (const k of ['tenantId', 'pacienteId', 'restricaoId']) if (typeof o[k] !== 'string' || !UUID.test(o[k] as string)) return ilegivel();
  if (typeof o.revisao !== 'number' || !Number.isSafeInteger(o.revisao) || o.revisao < 1) return ilegivel();
  return { finalidade: o.finalidade, tenantId: o.tenantId as string, pacienteId: o.pacienteId as string, restricaoId: o.restricaoId as string, revisao: o.revisao };
}
const mesmoVinculo = (a: VinculoConteudoRestricao, b: VinculoConteudoRestricao) =>
  a.finalidade === b.finalidade && a.tenantId === b.tenantId && a.pacienteId === b.pacienteId && a.restricaoId === b.restricaoId && a.revisao === b.revisao;

/** Valida o conteúdo (lança `ConteudoRestricaoInvalidoError`) e o vínculo, e devolve o `bytea` a persistir. */
export function cifrarConteudoRestricao(cripto: CriptografiaDadosSensiveis, conteudo: unknown, vinculo: VinculoConteudoRestricao): Buffer {
  const valido = validarConteudoRestricao(conteudo);
  const v = normalizarVinculo(vinculo);
  return cripto.criptografar(JSON.stringify({ formato: FORMATO_CONTEUDO_RESTRICAO, versao: VERSAO_ENVELOPE_RESTRICAO, vinculo: v, conteudo: valido }));
}

export function decifrarConteudoRestricao(cripto: CriptografiaDadosSensiveis, cifrado: Buffer, esperado: VinculoConteudoRestricao): ConteudoRestricaoV1 {
  const v = normalizarVinculo(esperado);
  let envelope: unknown;
  try { envelope = JSON.parse(cripto.descriptografar(cifrado)); } catch { return ilegivel(); }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return ilegivel();
  const e = envelope as Record<string, unknown>;
  if (Object.keys(e).sort().join(',') !== 'conteudo,formato,versao,vinculo') return ilegivel();
  if (e.formato !== FORMATO_CONTEUDO_RESTRICAO || e.versao !== VERSAO_ENVELOPE_RESTRICAO) return ilegivel();
  let gravado: VinculoConteudoRestricao;
  try { gravado = normalizarVinculo(e.vinculo); } catch { return ilegivel(); }
  if (!mesmoVinculo(gravado, v)) return ilegivel();
  try { return validarConteudoRestricao(e.conteudo); } catch { return ilegivel(); }
}

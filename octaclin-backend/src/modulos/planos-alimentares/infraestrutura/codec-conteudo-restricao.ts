import type { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { validarConteudoRestricao, validarTextoProtegido, ConteudoRestricaoInvalidoError, type ConteudoRestricaoV1 } from '../dominio/conteudo-restricao';
import { validarDesfechoSolicitacao, validarPedidoSolicitacao } from '../dominio/solicitacao-restricao-paciente';
import { validarResultadoReconfirmacao } from '../dominio/reconfirmacao-restricao';

/**
 * FOOD06 D2 + R3 (#531): ÚNICO caminho de cifra e decifra de TODOS os campos `bytea` da migration 1083.
 *
 * - `CAMPOS_CIFRADOS` registra cada coluna (`tabela.coluna`) com o seu validador e o tipo de vínculo. Um teste confere
 *   que o registro é exatamente o conjunto de colunas `*_criptografad[oa]` da 1083.
 * - Cifra só depois de validar (AES-GCM autenticado de `CriptografiaDadosSensiveis`). O envelope tem formato e versão
 *   próprios e carrega o CAMPO e o VÍNCULO: tenant, registro, revisão e, quando aplicável, paciente. Ao decifrar, campo
 *   e vínculo esperados são comparados: cifra copiada de outro campo, registro, revisão, paciente ou tenant falha fechada.
 * - Qualquer falha ao decifrar lança `ConteudoRestricaoIlegivelError`, genérico, sem causa nem eco. Ilegível NUNCA é
 *   ausência de restrição: o chamador trata como erro (e o motor como `indeterminado`), jamais como vazio.
 * - `revisao` é a revisão do registro em que o campo foi gravado: a da linha para o conteúdo da restrição; o `numero`
 *   para as revisões; a revisão da decisão para explicação, justificativa interna e desfecho; 1 nos campos imutáveis
 *   (`revisaoFixa`). `registroId` é o id da linha; nas revisões da restrição, o id da restrição (com `numero`).
 * - Não registra em log nem devolve conteúdo decifrado a ninguém além do chamador.
 */
export const FORMATO_CAMPO_RESTRICOES = 'food06-restricoes-campo' as const;
export const VERSAO_ENVELOPE_RESTRICOES = 1 as const;

/** O desfecho persiste só os dados (sem o marcador derivado `alteraRestricao`), e é revalidado na leitura. */
function desfechoPersistido(v: unknown) {
  const { estadoFinal, alterados, inalterados } = validarDesfechoSolicitacao(v);
  return { estadoFinal, alterados, inalterados };
}
export interface DefinicaoCampo { readonly comPaciente: boolean; readonly revisaoFixa?: 1; readonly validar: (v: unknown) => unknown }
const DEFINICOES = {
  'restricoes_pacientes.conteudo_criptografado': { comPaciente: true, validar: validarConteudoRestricao },
  'restricoes_pacientes_revisoes.conteudo_criptografado': { comPaciente: true, validar: validarConteudoRestricao },
  'restricoes_pacientes_revisoes.justificativa_criptografada': { comPaciente: true, validar: validarTextoProtegido },
  'reconfirmacoes_restricoes.resultado_criptografado': { comPaciente: true, revisaoFixa: 1, validar: validarResultadoReconfirmacao },
  'solicitacoes_restricoes_pacientes.conteudo_criptografado': { comPaciente: true, revisaoFixa: 1, validar: validarPedidoSolicitacao },
  'solicitacoes_restricoes_pacientes.explicacao_paciente_criptografada': { comPaciente: true, validar: validarTextoProtegido },
  'solicitacoes_restricoes_pacientes.justificativa_interna_criptografada': { comPaciente: true, validar: validarTextoProtegido },
  'solicitacoes_restricoes_pacientes.desfecho_criptografado': { comPaciente: true, validar: desfechoPersistido },
  'mapeamentos_alimento_alvo_locais.evidencia_criptografada': { comPaciente: false, revisaoFixa: 1, validar: validarTextoProtegido },
  'mapeamentos_alimento_alvo_locais.justificativa_criptografada': { comPaciente: false, revisaoFixa: 1, validar: validarTextoProtegido }
} as const satisfies Record<string, DefinicaoCampo>;
export type CampoCifrado = keyof typeof DEFINICOES;
export const CAMPOS_CIFRADOS: Readonly<Record<CampoCifrado, DefinicaoCampo>> = Object.freeze(DEFINICOES);

export interface VinculoCampo { tenantId: string; registroId: string; revisao: number; pacienteId?: string }

export class ConteudoRestricaoIlegivelError extends Error {
  constructor() { super('Conteúdo de restrição ilegível.'); this.name = 'ConteudoRestricaoIlegivelError'; }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function ilegivel(): never { throw new ConteudoRestricaoIlegivelError(); }

function definicao(campo: unknown): DefinicaoCampo {
  if (typeof campo !== 'string' || !Object.prototype.hasOwnProperty.call(CAMPOS_CIFRADOS, campo)) return ilegivel();
  return CAMPOS_CIFRADOS[campo as CampoCifrado];
}
function normalizarVinculo(d: DefinicaoCampo, v: unknown): VinculoCampo {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ilegivel();
  const o = v as Record<string, unknown>;
  const chaves = d.comPaciente ? ['tenantId', 'registroId', 'revisao', 'pacienteId'] : ['tenantId', 'registroId', 'revisao'];
  if (Reflect.ownKeys(o).some(k => !chaves.includes(k as string))) return ilegivel();
  for (const k of chaves.filter(k => k !== 'revisao')) if (typeof o[k] !== 'string' || !UUID.test(o[k] as string)) return ilegivel();
  if (typeof o.revisao !== 'number' || !Number.isSafeInteger(o.revisao) || o.revisao < 1) return ilegivel();
  if (d.revisaoFixa !== undefined && o.revisao !== d.revisaoFixa) return ilegivel();
  return { tenantId: o.tenantId as string, registroId: o.registroId as string, revisao: o.revisao, ...(d.comPaciente ? { pacienteId: o.pacienteId as string } : {}) };
}
const mesmoVinculo = (a: VinculoCampo, b: VinculoCampo) =>
  a.tenantId === b.tenantId && a.registroId === b.registroId && a.revisao === b.revisao && a.pacienteId === b.pacienteId;

/** Valida o valor (lança `ConteudoRestricaoInvalidoError`) e o vínculo (`ConteudoRestricaoIlegivelError`); devolve o `bytea`. */
export function cifrarCampo(cripto: CriptografiaDadosSensiveis, campo: CampoCifrado, valor: unknown, vinculo: VinculoCampo): Buffer {
  const d = definicao(campo);
  const v = normalizarVinculo(d, vinculo);
  let valido: unknown;
  try { valido = d.validar(valor); } catch { throw new ConteudoRestricaoInvalidoError(); }
  return cripto.criptografar(JSON.stringify({ formato: FORMATO_CAMPO_RESTRICOES, versao: VERSAO_ENVELOPE_RESTRICOES, campo, vinculo: v, valor: valido }));
}

export function decifrarCampo(cripto: CriptografiaDadosSensiveis, campo: CampoCifrado, cifrado: Buffer, esperado: VinculoCampo): unknown {
  const d = definicao(campo);
  const v = normalizarVinculo(d, esperado);
  let envelope: unknown;
  try { envelope = JSON.parse(cripto.descriptografar(cifrado)); } catch { return ilegivel(); }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return ilegivel();
  const e = envelope as Record<string, unknown>;
  if (Object.keys(e).sort().join(',') !== 'campo,formato,valor,versao,vinculo') return ilegivel();
  if (e.formato !== FORMATO_CAMPO_RESTRICOES || e.versao !== VERSAO_ENVELOPE_RESTRICOES || e.campo !== campo) return ilegivel();
  let gravado: VinculoCampo;
  try { gravado = normalizarVinculo(d, e.vinculo); } catch { return ilegivel(); }
  if (!mesmoVinculo(gravado, v)) return ilegivel();
  try { return d.validar(e.valor); } catch { return ilegivel(); }
}

/* ── Atalhos do conteúdo clínico da restrição (D2), mantidos para os chamadores existentes ── */
export interface VinculoConteudoRestricao {
  finalidade: 'restricao' | 'revisao_restricao';
  tenantId: string; pacienteId: string; restricaoId: string; revisao: number;
}
function campoEVinculo(v: VinculoConteudoRestricao): [CampoCifrado, VinculoCampo] {
  if (!v || typeof v !== 'object' || (v.finalidade !== 'restricao' && v.finalidade !== 'revisao_restricao')) return ilegivel();
  const extras = Reflect.ownKeys(v).filter(k => !['finalidade', 'tenantId', 'pacienteId', 'restricaoId', 'revisao'].includes(k as string));
  if (extras.length) return ilegivel();
  return [v.finalidade === 'restricao' ? 'restricoes_pacientes.conteudo_criptografado' : 'restricoes_pacientes_revisoes.conteudo_criptografado',
    { tenantId: v.tenantId, registroId: v.restricaoId, revisao: v.revisao, pacienteId: v.pacienteId }];
}
export function cifrarConteudoRestricao(cripto: CriptografiaDadosSensiveis, conteudo: unknown, vinculo: VinculoConteudoRestricao): Buffer {
  const [campo, v] = campoEVinculo(vinculo);
  return cifrarCampo(cripto, campo, conteudo, v);
}
export function decifrarConteudoRestricao(cripto: CriptografiaDadosSensiveis, cifrado: Buffer, esperado: VinculoConteudoRestricao): ConteudoRestricaoV1 {
  const [campo, v] = campoEVinculo(esperado);
  return decifrarCampo(cripto, campo, cifrado, v) as ConteudoRestricaoV1;
}

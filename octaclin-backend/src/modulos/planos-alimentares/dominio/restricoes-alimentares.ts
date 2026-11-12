import { createHash } from 'crypto';

/**
 * Motor de avaliação de restrições alimentares (FOOD06 P1a, contrato v2 da T8). Domínio puro e
 * em memória: recebe restrições, avaliação global, regras e o mapeamento do item JÁ resolvidos e
 * devolve fatos. Não lê banco, não autoriza, não grava, não é DTO HTTP e não aplica nada.
 *
 * Princípios (não negociáveis):
 * - Ausência nunca é compatibilidade: sem confirmação, avaliação válida, evidência e cobertura, o
 *   resultado é `indeterminado`, nunca `sem_conflito_registrado`.
 * - O motor é INERTE sem conteúdo clínico: `conflita`, `pode_conflitar` e `impedido` só existem
 *   quando há regra clínica validada por uma pessoa. Nenhuma regra, alérgeno ou mapeamento é semeado.
 * - Gravidade, texto livre e preferência nunca alteram um alerta de alergia.
 * - Não diagnostica, não calcula risco numérico e não diz "seguro", "liberado" ou "adequado".
 * A prévia e o aplicar devem chamar a MESMA função com as mesmas entradas e comparar o resultado
 * com `compararPreviaComAplicacao` (a impressão cobre revisões e versões, contra TOCTOU).
 */
export const MOTOR_RESTRICOES_VERSAO = 'food06-restricoes-v2' as const;
export const LIMITE_RESTRICOES_AVALIACAO = 200;
export const LIMITE_INGREDIENTES_RECEITA = 100;

export type NaturezaRestricao = 'clinica' | 'escolha' | 'preferencia';
export type SubtipoClinico = 'alergia_alimentar' | 'intolerancia_alimentar' | 'doenca_ou_condicao_com_restricao' | 'outra_restricao_clinica';
export type EstadoRestricao = 'ativa' | 'em_reavaliacao' | 'inativa';
export type ConfirmacaoRestricao = 'pendente' | 'confirmada' | 'rejeitada';
export type AlvoTipo = 'alergeno' | 'constituinte' | 'grupo' | 'alimento' | 'categoria_escolha' | 'nao_catalogado';
export type GravidadeRestricao = 'leve' | 'moderada' | 'grave' | 'nao_informada';
export type SituacaoAvaliacao = 'nao_informado' | 'sem_restricoes_confirmadas' | 'restricoes_registradas';
/** Origem do mapeamento: `global` (catálogo curado) ou `local_profissional` (composição declarada no atendimento). */
export type OrigemMapeamento = 'global' | 'local_profissional';
export type RelacaoMapeamento = 'contem' | 'pode_conter' | 'nao_contem_confirmado';
/** Ação de uma regra clínica validada. Não existe "nenhuma": uma regra nunca silencia um alerta. */
export type AcaoRegra = 'impedir' | 'exigir_esclarecimento' | 'exigir_revisao' | 'exigir_confirmacao';
export type AcaoAplicar = 'impedido' | 'exige_esclarecimento' | 'exige_revisao' | 'exige_confirmacao' | 'permitido';
export type ResultadoRestricao =
  'conflita' | 'pode_conflitar' | 'incompatibilidade_escolha' | 'indeterminado' | 'sem_conflito_registrado' | 'sem_efeito_clinico';
export type MotivoIndeterminado =
  'avaliacao_nao_informada' | 'avaliacao_vencida' | 'avaliacao_inconsistente' | 'declaracao_pendente' | 'alvo_nao_catalogado' |
  'alimento_sem_classificacao' | 'ingrediente_nao_identificado' | 'regra_nao_validada' | 'mapeamento_sem_evidencia';

export interface RestricaoEntrada {
  id: string; revisao: number; natureza: NaturezaRestricao; subtipoClinico?: SubtipoClinico;
  alvo: { tipo: AlvoTipo; id?: string }; gravidade?: GravidadeRestricao; estado: EstadoRestricao; confirmacao: ConfirmacaoRestricao;
}
export interface AvaliacaoEntrada { situacao: SituacaoAvaliacao; revisao: number; venceEm?: string }
export interface MapeamentoEntrada {
  alvoId: string; relacao: RelacaoMapeamento; versaoMapeamento: string; origem: OrigemMapeamento; evidenciaReferencia?: string; cobertura: 'suficiente' | 'insuficiente';
}
export interface RegraEntrada {
  subtipo: SubtipoClinico; alvoId?: string; acaoContem: AcaoRegra; acaoPodeConter: AcaoRegra; versaoRegra: string; validadaPor: string; validadaEm: string;
}
export interface ItemEntrada { id: string; composicaoHash: string; ingredienteIdentificado?: boolean; mapeamentos: MapeamentoEntrada[] }
export interface EntradaAvaliacao { agora: string; restricoes: RestricaoEntrada[]; avaliacao: AvaliacaoEntrada; regras: RegraEntrada[]; item: ItemEntrada }
export interface EntradaReceita { agora: string; restricoes: RestricaoEntrada[]; avaliacao: AvaliacaoEntrada; regras: RegraEntrada[]; ingredientes: ItemEntrada[] }

export interface ResultadoIndividual {
  restricaoId: string; resultado: ResultadoRestricao; motivo?: MotivoIndeterminado; acaoAplicar: AcaoAplicar; mapeamentoVersao?: string; regraVersao?: string;
}
export interface AgregadoAvaliacao { resultado: ResultadoRestricao; motivos: MotivoIndeterminado[]; acaoAplicar: AcaoAplicar }
export interface AvaliacaoItem {
  schemaVersao: 1; motorVersao: typeof MOTOR_RESTRICOES_VERSAO; natureza: 'avaliacao_nao_gravada';
  itemId: string; avaliacaoValida: boolean; motivoAvaliacao?: MotivoIndeterminado;
  agregado: AgregadoAvaliacao; individuais: ResultadoIndividual[]; impressao: string;
}
export interface FocoReceita { ingredienteId: string; restricaoId: string; resultado: ResultadoRestricao; acaoAplicar: AcaoAplicar }
export interface AvaliacaoReceita {
  schemaVersao: 1; motorVersao: typeof MOTOR_RESTRICOES_VERSAO; natureza: 'avaliacao_nao_gravada';
  agregado: AgregadoAvaliacao; porIngrediente: AvaliacaoItem[]; focos: FocoReceita[]; impressao: string;
}

export class RestricoesInvalidasError extends Error {
  constructor() { super('Entrada de restrições inválida para avaliação.'); this.name = 'RestricoesInvalidasError'; }
}

// ───────────────────────────── validação fechada ─────────────────────────────
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/;
const SEM_CONTROLE = /^[^\p{C}]{0,100}$/u;
function invalida(): never { throw new RestricoesInvalidasError(); }
function simples(v: unknown, permitidas: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) ||
    Reflect.ownKeys(v).some(k => typeof k !== 'string' || !permitidas.includes(k))) return invalida();
  return v as Record<string, unknown>;
}
const id = (v: unknown): string => (typeof v === 'string' && ID.test(v) ? v : invalida());
const texto = (v: unknown): string => (typeof v === 'string' && SEM_CONTROLE.test(v) ? v : invalida());
function opcao<T extends string>(v: unknown, validas: readonly T[]): T { return (validas as readonly unknown[]).includes(v) ? v as T : invalida(); }
function instante(v: unknown): string {
  if (typeof v !== 'string' || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v) return invalida();
  return v;
}
function lista(v: unknown, limite: number): unknown[] { return Array.isArray(v) && v.length <= limite ? v : invalida(); }
const inteiroPositivo = (v: unknown): number => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 1 ? v : invalida());

const NATUREZAS = ['clinica', 'escolha', 'preferencia'] as const;
const SUBTIPOS = ['alergia_alimentar', 'intolerancia_alimentar', 'doenca_ou_condicao_com_restricao', 'outra_restricao_clinica'] as const;
const ESTADOS = ['ativa', 'em_reavaliacao', 'inativa'] as const;
const CONFIRMACOES = ['pendente', 'confirmada', 'rejeitada'] as const;
const ALVO_TIPOS = ['alergeno', 'constituinte', 'grupo', 'alimento', 'categoria_escolha', 'nao_catalogado'] as const;
const GRAVIDADES = ['leve', 'moderada', 'grave', 'nao_informada'] as const;
const SITUACOES = ['nao_informado', 'sem_restricoes_confirmadas', 'restricoes_registradas'] as const;
const RELACOES = ['contem', 'pode_conter', 'nao_contem_confirmado'] as const;
const ACOES_REGRA = ['impedir', 'exigir_esclarecimento', 'exigir_revisao', 'exigir_confirmacao'] as const;
/** Alergia e doença com restrição nunca ficam abaixo de "impedir" quando o alérgeno está presente (D4). */
const GRAVES: readonly SubtipoClinico[] = ['alergia_alimentar', 'doenca_ou_condicao_com_restricao'];

function lerRestricao(v: unknown): RestricaoEntrada {
  const o = simples(v, ['id', 'revisao', 'natureza', 'subtipoClinico', 'alvo', 'gravidade', 'estado', 'confirmacao']);
  const natureza = opcao(o.natureza, NATUREZAS);
  const subtipoClinico = o.subtipoClinico === undefined ? undefined : opcao(o.subtipoClinico, SUBTIPOS);
  const gravidade = o.gravidade === undefined ? undefined : opcao(o.gravidade, GRAVIDADES);
  if ((natureza === 'clinica') !== (subtipoClinico !== undefined) || (natureza !== 'clinica' && gravidade !== undefined)) return invalida();
  const a = simples(o.alvo, ['tipo', 'id']);
  const tipo = opcao(a.tipo, ALVO_TIPOS);
  if ((tipo === 'nao_catalogado') !== (a.id === undefined)) return invalida();
  return {
    id: id(o.id), revisao: inteiroPositivo(o.revisao), natureza, ...(subtipoClinico ? { subtipoClinico } : {}),
    alvo: tipo === 'nao_catalogado' ? { tipo } : { tipo, id: id(a.id) }, ...(gravidade ? { gravidade } : {}),
    estado: opcao(o.estado, ESTADOS), confirmacao: opcao(o.confirmacao, CONFIRMACOES)
  };
}
function lerAvaliacao(v: unknown): AvaliacaoEntrada {
  const o = simples(v, ['situacao', 'revisao', 'venceEm']);
  return { situacao: opcao(o.situacao, SITUACOES), revisao: inteiroPositivo(o.revisao), ...(o.venceEm === undefined ? {} : { venceEm: instante(o.venceEm) }) };
}
function lerMapeamento(v: unknown): MapeamentoEntrada {
  const o = simples(v, ['alvoId', 'relacao', 'versaoMapeamento', 'origem', 'evidenciaReferencia', 'cobertura']);
  return {
    alvoId: id(o.alvoId), relacao: opcao(o.relacao, RELACOES), versaoMapeamento: id(o.versaoMapeamento), origem: opcao(o.origem, ['global', 'local_profissional'] as const),
    ...(o.evidenciaReferencia === undefined ? {} : { evidenciaReferencia: texto(o.evidenciaReferencia) }), cobertura: opcao(o.cobertura, ['suficiente', 'insuficiente'] as const)
  };
}
function lerRegra(v: unknown): RegraEntrada {
  const o = simples(v, ['subtipo', 'alvoId', 'acaoContem', 'acaoPodeConter', 'versaoRegra', 'validadaPor', 'validadaEm']);
  const subtipo = opcao(o.subtipo, SUBTIPOS), acaoContem = opcao(o.acaoContem, ACOES_REGRA), acaoPodeConter = opcao(o.acaoPodeConter, ACOES_REGRA);
  // Uma regra mal configurada não pode silenciar alergia: falha fechado.
  if (GRAVES.includes(subtipo) && (acaoContem !== 'impedir' || !['impedir', 'exigir_esclarecimento'].includes(acaoPodeConter))) return invalida();
  return {
    subtipo, ...(o.alvoId === undefined ? {} : { alvoId: id(o.alvoId) }), acaoContem, acaoPodeConter, versaoRegra: id(o.versaoRegra),
    validadaPor: texto(o.validadaPor), validadaEm: texto(o.validadaEm)
  };
}
function lerItem(v: unknown): ItemEntrada {
  const o = simples(v, ['id', 'composicaoHash', 'ingredienteIdentificado', 'mapeamentos']);
  if (o.ingredienteIdentificado !== undefined && typeof o.ingredienteIdentificado !== 'boolean') return invalida();
  return {
    id: id(o.id), composicaoHash: id(o.composicaoHash), ...(o.ingredienteIdentificado === undefined ? {} : { ingredienteIdentificado: o.ingredienteIdentificado }),
    mapeamentos: lista(o.mapeamentos, LIMITE_RESTRICOES_AVALIACAO).map(lerMapeamento)
  };
}
function lerContexto(o: Record<string, unknown>) {
  const restricoes = lista(o.restricoes, LIMITE_RESTRICOES_AVALIACAO).map(lerRestricao);
  if (new Set(restricoes.map(r => r.id)).size !== restricoes.length) return invalida();
  return {
    agora: instante(o.agora), restricoes, avaliacao: lerAvaliacao(o.avaliacao), regras: lista(o.regras, LIMITE_RESTRICOES_AVALIACAO).map(lerRegra)
  };
}

// ───────────────────────────── avaliação ─────────────────────────────
const RANK_RESULTADO: Record<ResultadoRestricao, number> = {
  conflita: 5, pode_conflitar: 4, incompatibilidade_escolha: 3, indeterminado: 2, sem_conflito_registrado: 1, sem_efeito_clinico: 0
};
const RANK_ACAO: Record<AcaoAplicar, number> = { impedido: 4, exige_esclarecimento: 3, exige_revisao: 2, exige_confirmacao: 1, permitido: 0 };
const ACAO_DA_REGRA: Record<AcaoRegra, AcaoAplicar> = {
  impedir: 'impedido', exigir_esclarecimento: 'exige_esclarecimento', exigir_revisao: 'exige_revisao', exigir_confirmacao: 'exige_confirmacao'
};
type Contexto = ReturnType<typeof lerContexto>;
interface Relacao { relacao?: RelacaoMapeamento; versao?: string; evidenciaOk: boolean; local?: boolean }

function relacaoDoAlvo(item: ItemEntrada, alvoId: string): Relacao {
  const entradas = item.mapeamentos.filter(m => m.alvoId === alvoId).sort((a, b) => a.versaoMapeamento.localeCompare(b.versaoMapeamento));
  if (!entradas.length) return { evidenciaOk: false };
  const pior = entradas.find(m => m.relacao === 'contem') ?? entradas.find(m => m.relacao === 'pode_conter');
  if (pior) return { relacao: pior.relacao, versao: pior.versaoMapeamento, evidenciaOk: true };
  // `nao_contem_confirmado` só vale com evidência positiva e cobertura suficiente em TODAS as linhas do alvo.
  return {
    relacao: 'nao_contem_confirmado', versao: entradas[0].versaoMapeamento,
    evidenciaOk: entradas.every(m => !!m.evidenciaReferencia?.trim() && m.cobertura === 'suficiente'),
    // Liberação com qualquer linha local nunca é silenciosa (contrato v3, Q1/Q4).
    local: entradas.some(m => m.origem === 'local_profissional')
  };
}
function regraPara(regras: RegraEntrada[], subtipo: SubtipoClinico, alvoId: string): RegraEntrada | undefined {
  const validadas = regras.filter(r => r.validadaPor.trim() !== '' && r.validadaEm.trim() !== '' && r.subtipo === subtipo && (r.alvoId === undefined || r.alvoId === alvoId));
  const especificas = validadas.filter(r => r.alvoId === alvoId);
  const candidatas = especificas.length ? especificas : validadas;
  return [...candidatas].sort((a, b) => RANK_ACAO[ACAO_DA_REGRA[b.acaoContem]] - RANK_ACAO[ACAO_DA_REGRA[a.acaoContem]] || a.versaoRegra.localeCompare(b.versaoRegra))[0];
}
function situacaoDaAvaliacao(c: Contexto): { valida: boolean; motivo?: MotivoIndeterminado } {
  const confirmadas = c.restricoes.filter(r => r.estado !== 'inativa' && r.confirmacao === 'confirmada' && r.natureza !== 'preferencia').length;
  const a = c.avaliacao;
  if (a.situacao === 'nao_informado') return { valida: false, motivo: 'avaliacao_nao_informada' };
  if (a.venceEm === undefined) return { valida: false, motivo: 'avaliacao_inconsistente' };
  if (Date.parse(a.venceEm) <= Date.parse(c.agora)) return { valida: false, motivo: 'avaliacao_vencida' };
  if ((a.situacao === 'sem_restricoes_confirmadas' && confirmadas > 0) || (a.situacao === 'restricoes_registradas' && confirmadas === 0)) {
    return { valida: false, motivo: 'avaliacao_inconsistente' };
  }
  return { valida: true };
}
const indeterminado = (r: RestricaoEntrada, motivo: MotivoIndeterminado, acaoAplicar: AcaoAplicar, extra: Partial<ResultadoIndividual> = {}): ResultadoIndividual =>
  ({ restricaoId: r.id, resultado: 'indeterminado', motivo, acaoAplicar, ...extra });

function avaliarRestricao(r: RestricaoEntrada, c: Contexto, item: ItemEntrada, aval: { valida: boolean; motivo?: MotivoIndeterminado }): ResultadoIndividual {
  if (r.natureza === 'preferencia') return { restricaoId: r.id, resultado: 'sem_efeito_clinico', acaoAplicar: 'permitido' };
  const clinica = r.natureza === 'clinica';
  const nao = r.alvo.tipo === 'nao_catalogado';
  const rel = nao ? undefined : relacaoDoAlvo(item, r.alvo.id as string);
  const comVersao: Partial<ResultadoIndividual> = rel?.versao ? { mapeamentoVersao: rel.versao } : {};
  const indicio = rel?.relacao === 'contem' || rel?.relacao === 'pode_conter';
  const revisarSeClinica: AcaoAplicar = clinica ? 'exige_revisao' : 'permitido';

  if (r.confirmacao === 'pendente') {
    return indeterminado(r, 'declaracao_pendente', clinica && indicio ? 'exige_revisao' : 'permitido', comVersao);
  }
  if (nao) return indeterminado(r, 'alvo_nao_catalogado', revisarSeClinica);

  if (indicio) {
    if (!clinica) return { restricaoId: r.id, resultado: 'incompatibilidade_escolha', acaoAplicar: 'exige_confirmacao', ...comVersao };
    const regra = regraPara(c.regras, r.subtipoClinico as SubtipoClinico, r.alvo.id as string);
    if (!regra) return indeterminado(r, 'regra_nao_validada', 'exige_revisao', comVersao);
    return rel?.relacao === 'contem'
      ? { restricaoId: r.id, resultado: 'conflita', acaoAplicar: ACAO_DA_REGRA[regra.acaoContem], ...comVersao, regraVersao: regra.versaoRegra }
      : { restricaoId: r.id, resultado: 'pode_conflitar', acaoAplicar: ACAO_DA_REGRA[regra.acaoPodeConter], ...comVersao, regraVersao: regra.versaoRegra };
  }
  if (item.ingredienteIdentificado === false) return indeterminado(r, 'ingrediente_nao_identificado', revisarSeClinica, comVersao);
  if (!rel?.relacao) return indeterminado(r, 'alimento_sem_classificacao', revisarSeClinica);
  // nao_contem_confirmado
  if (!rel.evidenciaOk) return indeterminado(r, 'mapeamento_sem_evidencia', revisarSeClinica, comVersao);
  if (!aval.valida) return indeterminado(r, aval.motivo as MotivoIndeterminado, revisarSeClinica, comVersao);
  return { restricaoId: r.id, resultado: 'sem_conflito_registrado', acaoAplicar: rel.local ? 'exige_confirmacao' : 'permitido', ...comVersao };
}

function agregar(individuais: ResultadoIndividual[], aval: { valida: boolean; motivo?: MotivoIndeterminado }): AgregadoAvaliacao {
  if (!individuais.length) {
    return aval.valida ? { resultado: 'sem_conflito_registrado', motivos: [], acaoAplicar: 'permitido' }
      : { resultado: 'indeterminado', motivos: [aval.motivo as MotivoIndeterminado], acaoAplicar: 'permitido' };
  }
  const clinicos = individuais.filter(i => i.resultado !== 'sem_efeito_clinico');
  if (!clinicos.length) return { resultado: 'sem_efeito_clinico', motivos: [], acaoAplicar: 'permitido' };
  const resultado = clinicos.reduce<ResultadoRestricao>((p, i) => (RANK_RESULTADO[i.resultado] > RANK_RESULTADO[p] ? i.resultado : p), 'sem_conflito_registrado');
  const acaoAplicar = clinicos.reduce<AcaoAplicar>((p, i) => (RANK_ACAO[i.acaoAplicar] > RANK_ACAO[p] ? i.acaoAplicar : p), 'permitido');
  const motivos = [...new Set(clinicos.flatMap(i => (i.motivo ? [i.motivo] : [])))];
  return { resultado, motivos, acaoAplicar };
}

function canonico(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonico);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonico(x)]));
  return v;
}
const hash = (v: unknown): string => createHash('sha256').update(JSON.stringify(canonico(v))).digest('hex');
const porId = <T extends { id: string }>(l: T[]): T[] => [...l].sort((a, b) => a.id.localeCompare(b.id));

/** Impressão das ENTRADAS que decidem o resultado (revisões, versões, composição); nunca o conteúdo livre nem o tempo. */
function impressaoDe(c: Contexto, item: ItemEntrada, avaliacaoValida: boolean): string {
  return hash({
    motor: MOTOR_RESTRICOES_VERSAO, avaliacaoValida, avaliacao: c.avaliacao,
    restricoes: porId(c.restricoes).map(r => ({ id: r.id, revisao: r.revisao, natureza: r.natureza, subtipo: r.subtipoClinico, alvo: r.alvo, estado: r.estado, confirmacao: r.confirmacao })),
    regras: c.regras.map(r => ({ s: r.subtipo, a: r.alvoId, c: r.acaoContem, p: r.acaoPodeConter, v: r.versaoRegra, ok: r.validadaPor.trim() !== '' && r.validadaEm.trim() !== '' }))
      .sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))),
    item: {
      id: item.id, composicaoHash: item.composicaoHash, identificado: item.ingredienteIdentificado,
      mapeamentos: item.mapeamentos.map(m => ({ a: m.alvoId, r: m.relacao, v: m.versaoMapeamento, o: m.origem, e: !!m.evidenciaReferencia?.trim(), c: m.cobertura }))
        .sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)))
    }
  });
}

function avaliarContexto(c: Contexto, item: ItemEntrada): AvaliacaoItem {
  const aval = situacaoDaAvaliacao(c);
  const individuais = c.restricoes
    .filter(r => r.estado !== 'inativa' && r.confirmacao !== 'rejeitada')
    .map(r => avaliarRestricao(r, c, item, aval)).sort((a, b) => a.restricaoId.localeCompare(b.restricaoId));
  return {
    schemaVersao: 1, motorVersao: MOTOR_RESTRICOES_VERSAO, natureza: 'avaliacao_nao_gravada', itemId: item.id,
    avaliacaoValida: aval.valida, ...(aval.motivo ? { motivoAvaliacao: aval.motivo } : {}),
    agregado: agregar(individuais, aval), individuais, impressao: impressaoDe(c, item, aval.valida)
  };
}

/** Avalia UM item (alimento ou ingrediente) contra as restrições do paciente. Entrada fechada; falha sem ecoar conteúdo. */
export function avaliarItem(entrada: unknown): AvaliacaoItem {
  const o = simples(entrada, ['agora', 'restricoes', 'avaliacao', 'regras', 'item']);
  return avaliarContexto(lerContexto(o), lerItem(o.item));
}

/** Avalia uma receita ingrediente a ingrediente e aponta o ingrediente exato e a restrição que causam cada conflito. */
export function avaliarReceita(entrada: unknown): AvaliacaoReceita {
  const o = simples(entrada, ['agora', 'restricoes', 'avaliacao', 'regras', 'ingredientes']);
  const contexto = lerContexto(o);
  const ingredientes = lista(o.ingredientes, LIMITE_INGREDIENTES_RECEITA).map(lerItem);
  if (!ingredientes.length || new Set(ingredientes.map(i => i.id)).size !== ingredientes.length) return invalida();
  const porIngrediente = ingredientes.map(i => avaliarContexto(contexto, i));
  const resultado = porIngrediente.reduce<ResultadoRestricao>((p, i) => (RANK_RESULTADO[i.agregado.resultado] > RANK_RESULTADO[p] ? i.agregado.resultado : p), 'sem_efeito_clinico');
  const acaoAplicar = porIngrediente.reduce<AcaoAplicar>((p, i) => (RANK_ACAO[i.agregado.acaoAplicar] > RANK_ACAO[p] ? i.agregado.acaoAplicar : p), 'permitido');
  const focos = porIngrediente.flatMap(i => i.individuais
    .filter(x => ['conflita', 'pode_conflitar', 'incompatibilidade_escolha'].includes(x.resultado))
    .map(x => ({ ingredienteId: i.itemId, restricaoId: x.restricaoId, resultado: x.resultado, acaoAplicar: x.acaoAplicar })));
  return {
    schemaVersao: 1, motorVersao: MOTOR_RESTRICOES_VERSAO, natureza: 'avaliacao_nao_gravada',
    agregado: { resultado, motivos: [...new Set(porIngrediente.flatMap(i => i.agregado.motivos))], acaoAplicar },
    porIngrediente, focos, impressao: hash(porIngrediente.map(i => i.impressao).sort())
  };
}

/**
 * Compara a avaliação da prévia com a refeita no aplicar. Qualquer diferença (entrada, versão, validade ou
 * resultado) exige nova revisão: o aplicar nunca herda uma prévia desatualizada.
 */
export function compararPreviaComAplicacao(previa: AvaliacaoItem | AvaliacaoReceita, aplicacao: AvaliacaoItem | AvaliacaoReceita):
  { estado: 'igual' } | { estado: 'mudou'; exigeNovaRevisao: true; diferencas: ('impressao' | 'agregado')[] } {
  const diferencas: ('impressao' | 'agregado')[] = [];
  if (previa.impressao !== aplicacao.impressao) diferencas.push('impressao');
  if (JSON.stringify(canonico(previa.agregado)) !== JSON.stringify(canonico(aplicacao.agregado))) diferencas.push('agregado');
  return diferencas.length ? { estado: 'mudou', exigeNovaRevisao: true, diferencas } : { estado: 'igual' };
}

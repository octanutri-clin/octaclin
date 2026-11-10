import type { LinhaMicronutrienteFactual } from './micronutrientes-factuais';
import type { ConfirmacoesContextoFactual } from './registro-analise-factual';

/**
 * Comparação do total planejado com a DRI (FOOD06 T4a), só quando o profissional pede.
 * Este módulo apenas valida e projeta a resposta do servidor; não calcula elegibilidade,
 * idade, percentual nem posição do UL no navegador.
 */
export const MOTIVOS_COMPARACAO_FACTUAL = [
  'contexto_nao_elegivel', 'dia_nao_confirmado', 'dados_incompletos', 'valor_invalido', 'referencia_indisponivel',
  'definicao_incompativel', 'unidade_incompativel', 'abrangencia_ul_incompativel', 'tabagismo_nao_informado',
  'nao_estabelecido', 'limite_precisao'
] as const;
export type MotivoComparacaoFactual = typeof MOTIVOS_COMPARACAO_FACTUAL[number];

export const MOTIVOS_CONTEXTO_FACTUAL = [
  'data_invalida', 'nascimento_nao_informado', 'nascimento_futuro', 'idade_fora_do_escopo', 'populacao_nao_confirmada',
  'gestacao_fora_do_escopo', 'lactacao_fora_do_escopo', 'fisiologia_nao_confirmada', 'aplicabilidade_nao_confirmada', 'confirmacao_invalida'
] as const;
export type MotivoContextoFactual = typeof MOTIVOS_CONTEXTO_FACTUAL[number];

export type UnidadeReferencia = 'mg' | 'mcg';
export type ComparacaoNutrienteFactual =
  | { estado: 'indisponivel'; motivo: MotivoComparacaoFactual }
  | {
    estado: 'comparavel'; tipo: 'RDA' | 'AI' | 'UL'; quantidadePlanejada: number; unidadePlanejada: UnidadeReferencia;
    valorReferencia: number; unidadeReferencia: UnidadeReferencia; percentual: number;
    /** Presente só na RDA da vitamina C com tabagismo confirmado. */
    ajusteTabagismoMg?: 35;
    /** Só no UL: posição factual do total planejado, sem classificação de risco. */
    posicao?: 'abaixo' | 'igual' | 'acima';
  };
export interface ReferenciaNutrienteFactual { codigo: string; referencia: ComparacaoNutrienteFactual; ul: ComparacaoNutrienteFactual }
export interface ReferenciasFactuais {
  versao: string;
  fonte: { autoridade: string; modificadaEm: string; licenca: string };
  contextoElegivel: boolean;
  motivosContexto: MotivoContextoFactual[];
  nutrientes: Record<string, ReferenciaNutrienteFactual>;
}

const VERSAO = /^[a-z0-9][a-z0-9_.:-]{0,99}$/;
const TOLERANCIA = 1e-9;
function falhar(): never { throw new Error('Não foi possível interpretar a análise factual. Atualize a seleção e tente novamente.'); }
function objeto(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return falhar(); return v as Record<string, unknown>; }
function numero(v: unknown): v is number { return typeof v === 'number' && Number.isFinite(v); }
function texto(v: unknown): v is string { return typeof v === 'string' && v.length > 0 && v.length <= 120; }
function unidade(v: unknown): v is UnidadeReferencia { return v === 'mg' || v === 'mcg'; }
const iguais = (a: number, b: number) => Math.abs(a - b) <= TOLERANCIA * Math.max(1, Math.abs(a), Math.abs(b));

function lerComparacao(valor: unknown, linha: LinhaMicronutrienteFactual, versao: string, contextoElegivel: boolean, ehUl: boolean): ComparacaoNutrienteFactual {
  const c = objeto(valor);
  if (c.estado === 'indisponivel') {
    if (!(MOTIVOS_COMPARACAO_FACTUAL as readonly unknown[]).includes(c.motivo)) return falhar();
    return { estado: 'indisponivel', motivo: c.motivo as MotivoComparacaoFactual };
  }
  if (c.estado !== 'comparavel' || !contextoElegivel) return falhar();
  // Só um total completo e coerente com a cobertura da mesma resposta pode ser comparado.
  if (linha.estado !== 'COMPLETO' || linha.valor === undefined) return falhar();
  const tipo = c.tipo;
  if (ehUl ? tipo !== 'UL' : tipo !== 'RDA' && tipo !== 'AI') return falhar();
  if (!numero(c.quantidadePlanejada) || c.quantidadePlanejada < 0 || !iguais(c.quantidadePlanejada, linha.valor) ||
    c.unidadePlanejada !== linha.unidade || !unidade(c.unidadeReferencia) || !numero(c.valorReferencia) || c.valorReferencia <= 0 ||
    !numero(c.percentual) || c.percentual < 0 || c.referenciaVersao !== versao) return falhar();
  if (c.ajusteTabagismoMg !== undefined && (c.ajusteTabagismoMg !== 35 || ehUl || linha.codigo !== 'vitaminaCMg')) return falhar();
  let posicao: 'abaixo' | 'igual' | 'acima' | undefined;
  if (ehUl) {
    if (c.posicao !== 'abaixo' && c.posicao !== 'igual' && c.posicao !== 'acima') return falhar();
    posicao = c.posicao;
    // Mesma unidade: a posição não pode contradizer os números recebidos.
    if (c.unidadeReferencia === c.unidadePlanejada) {
      const q = c.quantidadePlanejada, r = c.valorReferencia;
      if ((posicao === 'abaixo' && q > r && !iguais(q, r)) || (posicao === 'acima' && q < r && !iguais(q, r)) || (posicao === 'igual' && !iguais(q, r))) return falhar();
    }
  } else if (c.posicao !== undefined) return falhar();
  return {
    estado: 'comparavel', tipo: tipo as 'RDA' | 'AI' | 'UL', quantidadePlanejada: c.quantidadePlanejada, unidadePlanejada: c.unidadePlanejada as UnidadeReferencia,
    valorReferencia: c.valorReferencia, unidadeReferencia: c.unidadeReferencia, percentual: c.percentual,
    ...(c.ajusteTabagismoMg !== undefined ? { ajusteTabagismoMg: 35 as const } : {}),
    ...(posicao ? { posicao } : {})
  };
}

/** Valida contra a cobertura da mesma resposta e falha fechado; devolve só o que a interface usa. */
export function lerReferenciasFactuais(comparacoes: unknown, linhas: LinhaMicronutrienteFactual[]): ReferenciasFactuais {
  const r = objeto(comparacoes), fonte = objeto(r.fonteReferencias);
  if (r.estado !== 'calculado' || typeof r.versaoReferencias !== 'string' || !VERSAO.test(r.versaoReferencias) ||
    !texto(fonte.autoridade) || !texto(fonte.modificadaEm) || !texto(fonte.licenca) ||
    typeof r.contextoElegivel !== 'boolean' || !Array.isArray(r.motivosContexto) || r.motivosContexto.length > MOTIVOS_CONTEXTO_FACTUAL.length ||
    !Array.isArray(r.nutrientes) || r.nutrientes.length !== linhas.length) return falhar();
  const motivos = r.motivosContexto as unknown[];
  if (motivos.some(m => !(MOTIVOS_CONTEXTO_FACTUAL as readonly unknown[]).includes(m)) || new Set(motivos).size !== motivos.length ||
    r.contextoElegivel !== (motivos.length === 0)) return falhar();
  const versao = r.versaoReferencias, elegivel = r.contextoElegivel;
  const porCodigo = new Map(linhas.map(l => [l.codigo as string, l]));
  const nutrientes: Record<string, ReferenciaNutrienteFactual> = {};
  for (const item of r.nutrientes) {
    const n = objeto(item), codigo = n.codigo;
    if (typeof codigo !== 'string' || !porCodigo.has(codigo) || Object.hasOwn(nutrientes, codigo)) return falhar();
    const linha = porCodigo.get(codigo)!;
    nutrientes[codigo] = { codigo, referencia: lerComparacao(n.referencia, linha, versao, elegivel, false), ul: lerComparacao(n.ul, linha, versao, elegivel, true) };
  }
  return {
    versao, fonte: { autoridade: fonte.autoridade, modificadaEm: fonte.modificadaEm, licenca: fonte.licenca },
    contextoElegivel: elegivel, motivosContexto: motivos as MotivoContextoFactual[], nutrientes
  };
}

/**
 * Respostas do profissional sobre o paciente. Ficam só na memória da tela, nunca persistidas;
 * nenhuma vem preenchida e nada aqui deduz idade, nascimento ou elegibilidade.
 */
export type RespostasPacienteReferencias = Omit<ConfirmacoesContextoFactual, 'mesmoDiaPlanejado'>;
export function respostasPacienteIniciais(): RespostasPacienteReferencias {
  return { populacaoReferencia: 'nao_informada', populacaoConfirmada: false, gestacao: 'nao_informada', lactacao: 'nao_informada', aplicabilidade: 'nao_informada', tabagismo: 'nao_informado' };
}
export type PendenciaReferencias = 'gestacao' | 'lactacao' | 'populacao' | 'populacao_conferida' | 'aplicabilidade' | 'dia_completo';
export interface SituacaoRespostas {
  /** Resposta que deixa o paciente fora do escopo: a comparação não se aplica e nada é pedido ao servidor. */
  foraDoEscopo?: 'gestacao' | 'lactacao' | 'aplicabilidade';
  pendencias: PendenciaReferencias[];
  completo: boolean;
}
export function situacaoRespostas(r: RespostasPacienteReferencias, diaCompleto: boolean): SituacaoRespostas {
  const pendencias: PendenciaReferencias[] = [];
  if (r.gestacao === 'nao_informada') pendencias.push('gestacao');
  if (r.lactacao === 'nao_informada') pendencias.push('lactacao');
  if (r.populacaoReferencia === 'nao_informada') pendencias.push('populacao');
  else if (!r.populacaoConfirmada) pendencias.push('populacao_conferida');
  if (r.aplicabilidade === 'nao_informada') pendencias.push('aplicabilidade');
  if (!diaCompleto) pendencias.push('dia_completo');
  const foraDoEscopo = r.gestacao === 'sim' ? 'gestacao' : r.lactacao === 'sim' ? 'lactacao' : r.aplicabilidade === 'nao_aplicavel' ? 'aplicabilidade' : undefined;
  return { ...(foraDoEscopo ? { foraDoEscopo } : {}), pendencias, completo: !foraDoEscopo && pendencias.length === 0 };
}
export function montarConfirmacoesReferencias(r: RespostasPacienteReferencias, diaCompleto: boolean): ConfirmacoesContextoFactual {
  return { ...r, mesmoDiaPlanejado: diaCompleto };
}

export interface ResumoComparacao { comparados: number; dadosIncompletos: number; semReferencia: number; total: number }
/** Contagem pela comparação com a RDA/AI de cada nutriente; a soma fecha com o total de linhas. */
export function resumirComparacao(r: ReferenciasFactuais): ResumoComparacao {
  const lista = Object.values(r.nutrientes);
  let comparados = 0, dadosIncompletos = 0;
  for (const n of lista) {
    if (n.referencia.estado === 'comparavel') comparados++;
    else if (n.referencia.motivo === 'dados_incompletos') dadosIncompletos++;
  }
  return { comparados, dadosIncompletos, semReferencia: lista.length - comparados - dadosIncompletos, total: lista.length };
}

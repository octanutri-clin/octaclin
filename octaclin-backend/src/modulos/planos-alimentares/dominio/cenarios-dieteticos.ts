import { calcularNutrientesCombinados, type EntradaPlanoCombinado, type ResultadoCalculoCombinado } from './calculo-combinado';
import { analisarCoberturaDietetica, type CoberturaDietetica } from './cobertura-dietetica';
import { compararAnaliseComReferencias, type ResultadoComparacaoReferencias } from './comparacao-referencias';
import type { ContextoDieteticoResolvido } from './contexto-dietetico';
import { compararCenariosFactuais, type PreviaDieteticaFactual } from './previa-dietetica';

/**
 * Núcleo de cenários (FOOD06 M12, T5). Domínio puro, em memória: compara um cenário original com
 * alternativas já resolvidas, lado a lado, e nada mais. Não grava, não publica, não aplica, não
 * resolve alimentos, paciente, revisão, direitos ou autorização, e não é DTO HTTP.
 *
 * - Cada cenário é calculado SOZINHO pela PA06 (mesmo somador, mesma cobertura): alternativas
 *   excludentes nunca são somadas entre si nem com o original.
 * - As diferenças são as da prévia M04 (`compararCenariosFactuais`), original × cada alternativa;
 *   ausência nunca vira zero.
 * - Referências usam o comparador em lote da T2 e o contexto já resolvido no servidor; sem contexto,
 *   ficam indisponíveis com motivo.
 * A API futura monta os estados no servidor, depois de autorizar, a partir de fontes e versões exatas;
 * esta estrutura nunca vem do navegador. Aplicar um cenário continua sendo o fluxo M04 existente.
 */
export const LIMITE_ALTERNATIVAS_CENARIO = 6;
export const ESCOPOS_CENARIO = ['item', 'receita_porcao', 'refeicao', 'dia'] as const;
export type EscopoCenario = typeof ESCOPOS_CENARIO[number];

export interface CenarioDietetico {
  id: string;
  rotulo: string;
  escopo: EscopoCenario;
  estado: EntradaPlanoCombinado[];
}
export interface EntradaCenarios {
  original: CenarioDietetico;
  alternativas: CenarioDietetico[];
  contexto?: ContextoDieteticoResolvido;
}
/** `cobertura_incompleta`: algum micronutriente tem cobertura diferente entre o original e a alternativa. */
export type IncompatibilidadeCenario = 'escopo_diferente' | 'cenario_sem_itens' | 'cobertura_incompleta';
export type ReferenciasCenario =
  | ({ estado: 'calculado' } & ResultadoComparacaoReferencias)
  | { estado: 'indisponivel'; motivo: 'contexto_nao_informado' };
export interface CenarioAnalisado {
  id: string;
  rotulo: string;
  escopo: EscopoCenario;
  calculo: ResultadoCalculoCombinado;
  cobertura: CoberturaDietetica;
  referencias: ReferenciasCenario;
}
export interface ComparacaoCenario {
  alternativaId: string;
  diferencas: PreviaDieteticaFactual['diferencas'];
  incompatibilidades: IncompatibilidadeCenario[];
}
export interface ResultadoCenarios {
  schemaVersao: 1;
  motorVersao: 'food06-cenarios-v1';
  /** Simulação em memória: nada foi gravado, publicado ou aplicado. */
  natureza: 'simulacao_nao_gravada';
  original: CenarioAnalisado;
  alternativas: CenarioAnalisado[];
  comparacoes: ComparacaoCenario[];
}

export class CenariosInvalidosError extends Error {
  constructor() { super('Cenários inválidos para comparação.'); this.name = 'CenariosInvalidosError'; }
}

const ID = /^[a-z0-9][a-z0-9_.:-]{0,99}$/;
const SEM_CONTROLE = /^[^\p{C}]+$/u;
function simples(v: unknown, permitidas: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) ||
    Reflect.ownKeys(v).some(k => typeof k !== 'string' || !permitidas.includes(k))) throw new CenariosInvalidosError();
  return v as Record<string, unknown>;
}
function validarCenario(v: unknown): CenarioDietetico {
  const c = simples(v, ['id', 'rotulo', 'escopo', 'estado']);
  if (typeof c.id !== 'string' || !ID.test(c.id) || typeof c.rotulo !== 'string' || !c.rotulo.trim() || c.rotulo.length > 80 || !SEM_CONTROLE.test(c.rotulo) ||
    !(ESCOPOS_CENARIO as readonly unknown[]).includes(c.escopo) || !Array.isArray(c.estado)) throw new CenariosInvalidosError();
  return { id: c.id, rotulo: c.rotulo, escopo: c.escopo as EscopoCenario, estado: c.estado as EntradaPlanoCombinado[] };
}

function analisar(c: CenarioDietetico, contexto: ContextoDieteticoResolvido | undefined): CenarioAnalisado {
  const calculo = calcularNutrientesCombinados(c.estado);
  return {
    id: c.id, rotulo: c.rotulo, escopo: c.escopo, calculo, cobertura: analisarCoberturaDietetica(c.estado),
    referencias: contexto
      ? { estado: 'calculado', ...compararAnaliseComReferencias(calculo.nutrientes, contexto) }
      : { estado: 'indisponivel', motivo: 'contexto_nao_informado' }
  };
}

export function compararCenarios(entrada: EntradaCenarios): ResultadoCenarios {
  const e = simples(entrada, ['original', 'alternativas', 'contexto']);
  if (!Array.isArray(e.alternativas) || e.alternativas.length < 1 || e.alternativas.length > LIMITE_ALTERNATIVAS_CENARIO) throw new CenariosInvalidosError();
  const original = validarCenario(e.original), alternativas = e.alternativas.map(validarCenario);
  const ids = [original.id, ...alternativas.map(a => a.id)];
  if (new Set(ids).size !== ids.length) throw new CenariosInvalidosError();
  const contexto = e.contexto as ContextoDieteticoResolvido | undefined;

  const base = analisar(original, contexto);
  const analisadas = alternativas.map(a => analisar(a, contexto));
  const comparacoes = alternativas.map((a, i): ComparacaoCenario => {
    // Cada par é recalculado pela prévia M04; os totais de cada lado são os mesmos calculados acima.
    const previa = compararCenariosFactuais(original.estado, a.estado);
    const incompatibilidades: IncompatibilidadeCenario[] = [];
    if (a.escopo !== original.escopo) incompatibilidades.push('escopo_diferente');
    if (base.calculo.estado !== 'calculado' || analisadas[i].calculo.estado !== 'calculado') incompatibilidades.push('cenario_sem_itens');
    // Só quando a cobertura DIFERE entre os lados: nutriente que um cenário conhece por inteiro e o outro não.
    // Desconhecido nos dois lados é o normal (e já aparece como diferença indisponível), não incompatibilidade.
    else if ((Object.keys(base.cobertura.nutrientes) as (keyof CoberturaDietetica['nutrientes'])[])
      .some(c => base.cobertura.nutrientes[c].estado !== analisadas[i].cobertura.nutrientes[c].estado)) incompatibilidades.push('cobertura_incompleta');
    return { alternativaId: a.id, diferencas: previa.diferencas, incompatibilidades };
  });
  return { schemaVersao: 1, motorVersao: 'food06-cenarios-v1', natureza: 'simulacao_nao_gravada', original: base, alternativas: analisadas, comparacoes };
}

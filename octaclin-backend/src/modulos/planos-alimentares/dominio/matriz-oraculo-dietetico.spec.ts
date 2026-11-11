import { isDeepStrictEqual } from 'node:util';
import { calcularNutrientesCombinados, type EntradaPlanoCombinado } from './calculo-combinado';
import { analisarCoberturaDietetica } from './cobertura-dietetica';
import { compararCenariosFactuais } from './previa-dietetica';
import { criarSnapshotMicronutrientes } from './micronutrientes';
import { porcionarReceita } from './porcionamento-receita';

/**
 * FOOD06 T7 (M02/M04): matriz global contra um oráculo decimal independente do motor.
 *
 * O oráculo abaixo é aritmética racional com BigInt escrita aqui, a partir das regras documentadas
 * (porção = valor × porção ÷ base com half-up em 1e-8; soma de valores já quantizados; delta e
 * percentual sobre os totais quantizados; receita em milésimos). Ele NÃO importa
 * `decimal-nutricional.ts` nem os helpers de escala de `micronutrientes.ts`. Os valores entram como
 * strings decimais; o motor recebe `Number(texto)`. Dados sintéticos apenas.
 */

// ───────────────────────────── oráculo ─────────────────────────────
interface Q { n: bigint; d: bigint }
const E8 = 100_000_000n;
const MAX_SEGURO = BigInt(Number.MAX_SAFE_INTEGER);
function dec(texto: string): Q {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(texto);
  if (!m) throw new Error(`decimal inválido no oráculo: ${texto}`);
  const fracao = m[2] ?? '';
  return { n: BigInt(m[1] + fracao), d: 10n ** BigInt(fracao.length) };
}
const mul = (a: Q, b: Q): Q => ({ n: a.n * b.n, d: a.d * b.d });
const div = (a: Q, b: Q): Q => ({ n: a.n * b.d, d: a.d * b.n });
/** Half-up de n/d (n ≥ 0, d > 0). */
const meio = (n: bigint, d: bigint): bigint => (2n * n + d) / (2n * d);
const arred8 = (q: Q): bigint => meio(q.n * E8, q.d);
const texto8 = (i: bigint): string => `${i / E8}.${(i % E8).toString().padStart(8, '0')}`;
/** O motor devolve Number(inteiro)/1e8, o mesmo double do decimal exato (divisão com arredondamento correto). */
const numero8 = (i: bigint): number => Number(texto8(i));

// ───────────────────────────── cenários ─────────────────────────────
type Est = { e: 'conhecido'; v: string } | { e: string };
type ItemCen =
  | { tipo: 'normal'; base: string; porcao: string; calcio: Est; ferro: Est; energia?: string }
  | { tipo: 'legado'; energia?: string }
  | { tipo: 'schema_futuro'; energia?: string }
  | { tipo: 'nulo' };
interface RefeicaoCen { ativa: boolean; selecionada: boolean; itens: ItemCen[] }
interface PlanoCen { ativo: boolean; selecionado: boolean; refeicoes: RefeicaoCen[] }
type Nut = 'calcioMg' | 'ferroMg';

const conhecido = (v: string): Est => ({ e: 'conhecido', v });
const normal = (calcio: Est, ferro: Est = conhecido('0.3'), base = '30', porcao = '37.5', energia?: string): ItemCen =>
  ({ tipo: 'normal', base, porcao, calcio, ferro, ...(energia === undefined ? {} : { energia }) });

function construir(item: ItemCen): unknown {
  if (item.tipo === 'nulo') return null;
  const macros = { nutrientesPorcao: 'energia' in item && item.energia !== undefined ? { energiaKcal: Number(item.energia) } : {} };
  if (item.tipo === 'legado') return macros;
  if (item.tipo === 'schema_futuro') return { ...macros, micronutrientes: { schemaVersao: 2 } };
  const valores: Record<string, unknown> = {};
  const futuros: Nut[] = [];
  for (const nut of ['calcioMg', 'ferroMg'] as const) {
    const est = item[nut === 'calcioMg' ? 'calcio' : 'ferro'];
    if (est.e === 'conhecido') valores[nut] = { estado: 'conhecido', valor: Number((est as { v: string }).v) };
    else if (est.e === 'estado-futuro') futuros.push(nut);
    else valores[nut] = { estado: est.e };
  }
  const micronutrientes = criarSnapshotMicronutrientes(valores as never, Number(item.base), Number(item.porcao));
  for (const nut of futuros) (micronutrientes.nutrientes as Record<string, unknown>)[nut] = { estado: 'estado-futuro' };
  return { ...macros, micronutrientes };
}
function paraEntrada(planos: PlanoCen[]): EntradaPlanoCombinado[] {
  return planos.map((p, i) => ({
    planoId: `plano-${i}`, ativo: p.ativo, selecionado: p.selecionado,
    refeicoes: p.refeicoes.map((r, j) => ({ identidadeId: `refeicao-${i}-${j}`, ativa: r.ativa, selecionada: r.selecionada, itens: r.itens.map(construir) }))
  }));
}
function incluidos(planos: PlanoCen[]): ItemCen[] {
  return planos.flatMap(p => !p.selecionado || !p.ativo ? [] : p.refeicoes.flatMap(r => r.selecionada && r.ativa ? r.itens : []));
}

// ─────────────────────── oráculo: classificação e totais ───────────────────────
type Contagem = 'conhecidos' | 'semComposicao' | 'incompativeis' | 'naoResolvidos';
interface Classe { c: Contagem; causa?: string; tecnico?: boolean; valor?: bigint }
function classificar(item: ItemCen, nut: Nut): Classe {
  if (item.tipo === 'nulo') return { c: 'naoResolvidos', causa: 'snapshot_indisponivel', tecnico: true };
  if (item.tipo === 'legado') return { c: 'semComposicao', causa: 'legado_sem_composicao' };
  if (item.tipo === 'schema_futuro') return { c: 'naoResolvidos', causa: 'schema_nao_suportado', tecnico: true };
  const est = item[nut === 'calcioMg' ? 'calcio' : 'ferro'];
  if (est.e === 'conhecido') return { c: 'conhecidos', valor: arred8(div(mul(dec((est as { v: string }).v), dec(item.porcao)), dec(item.base))) };
  if (['ausente', 'traco', 'nao_analisado', 'abaixo_loq'].includes(est.e)) return { c: 'semComposicao', causa: est.e };
  if (['unidade_incompativel', 'definicao_incompativel'].includes(est.e)) return { c: 'incompativeis', causa: est.e };
  if (['em_reavaliacao', 'duplicado', 'invalido'].includes(est.e)) return { c: 'naoResolvidos', causa: est.e };
  return { c: 'naoResolvidos', causa: 'estado_nao_suportado' };
}
interface Esperado {
  soma: bigint;
  pa06: { estado: 'completo' | 'parcial' | 'indisponivel'; total?: number; quantidadeConhecida?: number; itensComValor: number; itensIncluidos: number };
  cobertura: { estado: string; contagens: Record<string, number>; causas: { codigo: string; quantidade: number }[]; total?: number; quantidadeConhecida?: number };
}
function esperadoMicro(itens: ItemCen[], nut: Nut): Esperado {
  const contagens = { incluidos: itens.length, conhecidos: 0, semComposicao: 0, incompativeis: 0, naoResolvidos: 0 };
  const causas = new Map<string, number>();
  let tecnico = itens.length === 0;
  if (!itens.length) causas.set('sem_componentes', 0);
  let soma = 0n;
  for (const item of itens) {
    const k = classificar(item, nut);
    contagens[k.c]++;
    if (k.causa) causas.set(k.causa, (causas.get(k.causa) ?? 0) + 1);
    tecnico ||= k.tecnico === true;
    if (k.valor !== undefined) soma += k.valor;
  }
  const completo = itens.length > 0 && contagens.conhecidos === itens.length;
  const estado = tecnico ? 'INDISPONIVEL' : contagens.incompativeis ? 'INCOMPATIVEL' : completo ? 'COMPLETO' : contagens.conhecidos ? 'PARCIAL' : 'DESCONHECIDO';
  const pa06: Esperado['pa06'] = { estado: completo ? 'completo' : contagens.conhecidos ? 'parcial' : 'indisponivel', itensComValor: contagens.conhecidos, itensIncluidos: itens.length };
  if (completo) pa06.total = numero8(soma); else if (contagens.conhecidos) pa06.quantidadeConhecida = numero8(soma);
  const cobertura: Esperado['cobertura'] = { estado, contagens, causas: [...causas].map(([codigo, quantidade]) => ({ codigo, quantidade })) };
  if (estado === 'COMPLETO') cobertura.total = numero8(soma); else if (contagens.conhecidos) cobertura.quantidadeConhecida = numero8(soma);
  return { soma, pa06, cobertura };
}
function esperadoEnergia(itens: ItemCen[]): { soma: bigint } & Esperado['pa06'] {
  const valores = itens.flatMap(i => i.tipo !== 'nulo' && i.energia !== undefined ? [arred8(dec(i.energia))] : []);
  const completo = itens.length > 0 && valores.length === itens.length;
  const soma = valores.reduce((a, b) => a + b, 0n);
  const r: { soma: bigint } & Esperado['pa06'] = { soma, estado: completo ? 'completo' : valores.length ? 'parcial' : 'indisponivel', itensComValor: valores.length, itensIncluidos: itens.length };
  if (completo) r.total = numero8(soma); else if (valores.length) r.quantidadeConhecida = numero8(soma);
  return r;
}
/** Delta M04 sobre dois totais quantizados (inteiros escala 8). */
function esperadoDelta(antes: bigint, depois: bigint) {
  const d = depois - antes;
  const abs = d < 0n ? -d : d;
  const diferenca = d < 0n ? -numero8(abs) : numero8(abs);
  if (antes === 0n) return { estado: 'calculavel', diferenca, percentual: { estado: 'indisponivel', motivo: 'base_zero' } };
  const pct = meio(abs * 100n * E8, antes);
  if (pct > MAX_SEGURO) return { estado: 'calculavel', diferenca, percentual: { estado: 'indisponivel', motivo: 'limite_precisao' } };
  return { estado: 'calculavel', diferenca, percentual: { estado: 'calculavel', valor: d < 0n ? -numero8(pct) : numero8(pct), arredondado: (abs * 100n * E8) % antes !== 0n } };
}

// ───────────────────────────── utilitários ─────────────────────────────
const falhas: string[] = [];
function conferir(celula: string, obtido: unknown, esperado: unknown): void {
  if (!isDeepStrictEqual(obtido, esperado)) falhas.push(`${celula}: obtido=${JSON.stringify(obtido)} esperado=${JSON.stringify(esperado)}`);
}
function resultado(): string[] { const lista = falhas.splice(0); return lista.slice(0, 8).concat(lista.length > 8 ? [`… e mais ${lista.length - 8} divergência(s)`] : []); }
const picos = (o: unknown, ...chaves: string[]) => Object.fromEntries(chaves.filter(c => (o as Record<string, unknown>)[c] !== undefined).map(c => [c, (o as Record<string, unknown>)[c]]));

const VALORES = ['0', '0.00000001', '0.1', '0.2', '0.3', '33.333', '9999.99'];
const BASES = ['100', '30', '250.5'];
const PORCOES = ['0.001', '1', '37.5', '1000', '0.3'];
const ESTADOS: Est[] = [
  conhecido('0.1'), conhecido('0'), conhecido('0.2'),
  { e: 'ausente' }, { e: 'traco' }, { e: 'nao_analisado' }, { e: 'abaixo_loq' }, { e: 'em_reavaliacao' }, { e: 'duplicado' },
  { e: 'invalido' }, { e: 'unidade_incompativel' }, { e: 'definicao_incompativel' }, { e: 'estado-futuro' }
];
const ITENS_ESPECIAIS: ItemCen[] = [{ tipo: 'legado', energia: '0.2' }, { tipo: 'schema_futuro' }, { tipo: 'nulo' }];

describe('FOOD06 T7: matriz global contra oráculo decimal independente', () => {
  beforeEach(() => { falhas.length = 0; });

  it('porção do snapshot: valor × porção ÷ base com half-up em 1e-8, zero conhecido preservado', () => {
    for (const v of VALORES) for (const base of BASES) for (const porcao of PORCOES) {
      const snap = criarSnapshotMicronutrientes({ calcioMg: { estado: 'conhecido', valor: Number(v) } }, Number(base), Number(porcao)).nutrientes.calcioMg;
      const celula = `valor=${v} base=${base} porcao=${porcao}`;
      conferir(`${celula} porcao`, snap.porcao, numero8(arred8(div(mul(dec(v), dec(porcao)), dec(base)))));
      conferir(`${celula} por100g`, snap.por100g, numero8(arred8(div(mul(dec(v), dec('100')), dec(base)))));
      conferir(`${celula} estado`, snap.estado, 'conhecido');
    }
    expect(resultado()).toEqual([]);
  });

  it('soma PA06 e cobertura M02: todos os pares e trincas de estados, por nutriente', () => {
    const catalogo: ItemCen[] = [
      // Bases 30/100 × porções 37.5/100/0.3: inclui divisões não exatas (0.2 × 100 ÷ 30 = 0.6666…) e energias com mais de 8 casas.
      ...ESTADOS.map((e, i) => normal(e, ESTADOS[(i + 3) % ESTADOS.length], i % 2 ? '100' : '30', ['37.5', '100', '0.3'][i % 3],
        ['0.1', '0.2', undefined, '0.000000004', '0.000000005', '0.123456785'][i % 6])),
      ...ITENS_ESPECIAIS
    ];
    const rodar = (itens: ItemCen[], rotulo: string) => {
      const plano: PlanoCen[] = [{ ativo: true, selecionado: true, refeicoes: [{ ativa: true, selecionada: true, itens }] }];
      const entrada = paraEntrada(plano);
      const calculo = calcularNutrientesCombinados(entrada), cobertura = analisarCoberturaDietetica(entrada);
      for (const nut of ['calcioMg', 'ferroMg'] as const) {
        const e = esperadoMicro(itens, nut);
        const obtido = calculo.nutrientes[nut];
        conferir(`${rotulo} ${nut} pa06`, picos(obtido, 'estado', 'total', 'quantidadeConhecida', 'itensComValor', 'itensIncluidos'), e.pa06);
        const c = cobertura.nutrientes[nut];
        conferir(`${rotulo} ${nut} cobertura`, picos(c, 'estado', 'contagens', 'causas', 'total', 'quantidadeConhecida'), e.cobertura);
      }
      const { soma: _soma, ...energia } = esperadoEnergia(itens);
      conferir(`${rotulo} energia`, picos(calculo.nutrientes.energiaKcal, 'estado', 'total', 'quantidadeConhecida', 'itensComValor', 'itensIncluidos'), energia);
    };
    rodar([], 'vazio');
    for (const a of catalogo) rodar([a], `1[${catalogo.indexOf(a)}]`);
    catalogo.forEach((a, i) => catalogo.forEach((b, j) => rodar([a, b], `2[${i},${j}]`)));
    catalogo.forEach((a, i) => catalogo.forEach((b, j) => catalogo.forEach((c, k) => rodar([a, b, c], `3[${i},${j},${k}]`))));
    expect(resultado()).toEqual([]);
  });

  it('seleção compartilhada: plano/refeição desativados ou não selecionados não entram, com a exclusão registrada', () => {
    const [A, B, C] = [normal(conhecido('0.1'), conhecido('0.3'), '30', '37.5', '0.1'), normal(conhecido('0.2'), { e: 'ausente' }, '100', '1', '0.2'), normal({ e: 'traco' }, conhecido('0'), '250.5', '0.3')];
    const bool = [true, false];
    for (const ativo of bool) for (const sel of bool) for (const ativa2 of bool) for (const sel2 of bool) for (const dois of bool) {
      const planos: PlanoCen[] = [{ ativo, selecionado: sel, refeicoes: [{ ativa: true, selecionada: true, itens: [A, B] }, { ativa: ativa2, selecionada: sel2, itens: [C] }] }];
      if (dois) planos.push({ ativo: true, selecionado: true, refeicoes: [{ ativa: true, selecionada: true, itens: [B] }] });
      const rotulo = `ativo=${ativo} sel=${sel} ativa2=${ativa2} sel2=${sel2} dois=${dois}`;
      const inc = incluidos(planos);
      const calculo = calcularNutrientesCombinados(paraEntrada(planos));
      const cobertura = analisarCoberturaDietetica(paraEntrada(planos));
      conferir(`${rotulo} estado`, calculo.estado, !planos.some(p => p.selecionado) ? 'sem_selecao' : inc.length ? 'calculado' : 'sem_itens_incluidos');
      conferir(`${rotulo} itens`, calculo.itensIncluidos, inc.length);
      const exclusoes = planos.flatMap((p, i) => !p.selecionado ? [] : !p.ativo ? [{ planoId: `plano-${i}`, motivo: 'plano_desativado' }]
        : p.refeicoes.flatMap((r, j) => r.selecionada && !r.ativa ? [{ planoId: `plano-${i}`, identidadeRefeicao: `refeicao-${i}-${j}`, motivo: 'refeicao_desativada' }] : []));
      conferir(`${rotulo} exclusoes`, calculo.exclusoes, exclusoes);
      for (const nut of ['calcioMg', 'ferroMg'] as const) {
        const e = esperadoMicro(inc, nut);
        conferir(`${rotulo} ${nut} pa06`, picos(calculo.nutrientes[nut], 'estado', 'total', 'quantidadeConhecida'), picos(e.pa06, 'estado', 'total', 'quantidadeConhecida'));
        conferir(`${rotulo} ${nut} cobertura`, picos(cobertura.nutrientes[nut], 'estado', 'contagens', 'total', 'quantidadeConhecida'), picos(e.cobertura, 'estado', 'contagens', 'total', 'quantidadeConhecida'));
      }
    }
    expect(resultado()).toEqual([]);
  });

  it('troca A → B (prévia M04): diferença, percentual, base zero, limite de precisão e composição incompleta', () => {
    const fixoNaoZero = normal(conhecido('0.2'), conhecido('0.3'), '100', '37.5', '0.3');
    const fixoZero = normal(conhecido('0'), conhecido('0'), '100', '37.5', '0');
    const opcoes: ItemCen[] = [
      ...VALORES.flatMap(v => [normal(conhecido(v), conhecido(v), '30', '37.5', v)]),
      normal(conhecido('33.333'), conhecido('0.1'), '250.5', '0.3', '0.1'),
      normal({ e: 'ausente' }, { e: 'ausente' }), normal({ e: 'unidade_incompativel' }, { e: 'em_reavaliacao' }, '100', '1', '0.2'),
      { tipo: 'legado', energia: '0.1' }, { tipo: 'schema_futuro' }
    ];
    const cenario = (a: ItemCen, fixo: ItemCen): PlanoCen[] => [{ ativo: true, selecionado: true, refeicoes: [{ ativa: true, selecionada: true, itens: [a, fixo] }] }];
    for (const [nomeFixo, fixo] of [['fixo!=0', fixoNaoZero], ['fixo=0', fixoZero]] as const) opcoes.forEach((a, i) => opcoes.forEach((b, j) => {
      const antes = cenario(a, fixo), depois = cenario(b, fixo), rotulo = `troca[${nomeFixo} ${i}->${j}]`;
      const previa = compararCenariosFactuais(paraEntrada(antes), paraEntrada(depois));
      for (const nut of ['calcioMg', 'ferroMg'] as const) {
        const ea = esperadoMicro(incluidos(antes), nut), eb = esperadoMicro(incluidos(depois), nut);
        conferir(`${rotulo} ${nut} cobertura antes/depois`, [previa.antes.cobertura.nutrientes[nut].estado, previa.depois.cobertura.nutrientes[nut].estado], [ea.cobertura.estado, eb.cobertura.estado]);
        const completos = ea.cobertura.estado === 'COMPLETO' && eb.cobertura.estado === 'COMPLETO';
        const esperado = completos ? esperadoDelta(ea.soma, eb.soma) : { estado: 'indisponivel', motivo: 'composicao_incompleta' };
        conferir(`${rotulo} ${nut} delta`, previa.diferencas[nut].delta, esperado);
      }
      const ea = esperadoEnergia(incluidos(antes)), eb = esperadoEnergia(incluidos(depois));
      const completos = ea.estado === 'completo' && eb.estado === 'completo';
      conferir(`${rotulo} energia delta`, previa.diferencas.energiaKcal.delta,
        completos ? esperadoDelta(ea.soma, eb.soma) : { estado: 'indisponivel', motivo: 'composicao_incompleta' });
    }));
    // Limite de precisão do percentual: base de 1e-8 contra um total grande.
    const pequeno = normal(conhecido('0.00000001'), conhecido('0.3'), '100', '100'), grande = normal(conhecido('1000'), conhecido('0.3'), '100', '100');
    const previa = compararCenariosFactuais(paraEntrada([{ ativo: true, selecionado: true, refeicoes: [{ ativa: true, selecionada: true, itens: [pequeno] }] }]), paraEntrada([{ ativo: true, selecionado: true, refeicoes: [{ ativa: true, selecionada: true, itens: [grande] }] }]));
    conferir('limite de precisao', previa.diferencas.calcioMg.delta, esperadoDelta(1n, 1000n * E8));
    expect((previa.diferencas.calcioMg.delta as { percentual: { motivo?: string } }).percentual.motivo).toBe('limite_precisao');
    expect(resultado()).toEqual([]);
  });

  it('receita: porções desejadas × rendimento × base, limites e avisos, encadeado com porção do snapshot e soma', () => {
    const ID = '10000000-0000-4000-8000-000000000001';
    // Porções desejadas válidas: [0,001; 1000]. 1000 é a fronteira; 1001 e 0.0001 são recusadas.
    const PORCOES_DESEJADAS = [0.5, 1, 1.5, 3, 10, 0.001, 2.5, 11, 1000, 1001];
    const BASES_RECEITA: { base: 'receita_inteira' | 'por_porcao'; rendimento?: number }[] = [
      { base: 'receita_inteira', rendimento: 1 }, { base: 'receita_inteira', rendimento: 3 }, { base: 'receita_inteira', rendimento: 4 },
      { base: 'receita_inteira', rendimento: 7 }, { base: 'por_porcao' }
    ];
    const LINHAS: [string, string, string?][] = [['100', '100'], ['37.5', '37.5'], ['0.001', '0.001'], ['10000', '10000'], ['250.123', '120.5', '33.3'], ['909.091', '909.091']];
    const milesimos = (t: string): bigint => { const q = dec(t); return q.n * 1000n / q.d; };
    for (const { base, rendimento } of BASES_RECEITA) for (const porcoes of PORCOES_DESEJADAS) for (const [qtd, gramas, alt] of LINHAS) {
      const rotulo = `base=${base} rend=${rendimento ?? '-'} porcoes=${porcoes} qtd=${qtd} g=${gramas} alt=${alt ?? '-'}`;
      const alimento = (q: string, g: string, extra: object = {}) => ({ alimentoComposicaoId: ID, quantidade: Number(q), unidade: 'g', porcaoGramas: Number(g), ...extra });
      const entrada = {
        instrucoes: 'Misture; sintético.',
        metadados: { schemaVersao: 1, etiquetas: ['Interna'], baseQuantidades: base, ...(rendimento === undefined ? {} : { rendimentoPorcoes: rendimento }), tempoPreparoMinutos: 20 },
        itens: [alimento(qtd, gramas, alt === undefined ? {} : { substituicoes: [alimento(alt, alt)] }), alimento('50', '50')]
      };
      const obtido = porcionarReceita(entrada, porcoes);
      if (porcoes > 1000) {
        conferir(`${rotulo} porcoes invalidas`, obtido.estado === 'indisponivel' ? obtido.motivos : obtido.estado, [{ codigo: 'PORCOES_INVALIDAS' }]);
        continue;
      }
      const P = milesimos(String(porcoes)), D = 1000n * BigInt(base === 'receita_inteira' ? rendimento! : 1);
      const campos: { local: { item: number; substituicao?: number }; q: bigint; g: bigint }[] = [
        { local: { item: 0 }, q: milesimos(qtd), g: milesimos(gramas) },
        ...(alt === undefined ? [] : [{ local: { item: 0, substituicao: 0 }, q: milesimos(alt), g: milesimos(alt) }]),
        { local: { item: 1 }, q: milesimos('50'), g: milesimos('50') }
      ];
      const motivos: unknown[] = [], avisos: unknown[] = [], escalados = new Map<string, number>();
      for (const c of campos) for (const [campo, m] of [['quantidade', c.q], ['porcaoGramas', c.g]] as const) {
        const produto = m * P;
        if (produto < D || produto > 10_000_000n * D) { motivos.push({ codigo: 'QUANTIDADE_FORA_DO_LIMITE', ...c.local }); continue; }
        escalados.set(`${c.local.item}.${c.local.substituicao ?? '-'}.${campo}`, Number(meio(produto, D)) / 1000);
        if (produto % D !== 0n) avisos.push({ codigo: 'ARREDONDAMENTO', ...c.local, campo });
      }
      if (motivos.length) {
        conferir(`${rotulo} indisponivel`, obtido.estado === 'indisponivel' ? obtido.motivos.map(m => ({ ...m })) : obtido.estado, motivos);
        continue;
      }
      if (obtido.estado !== 'calculavel') { falhas.push(`${rotulo}: esperado calculavel`); continue; }
      conferir(`${rotulo} avisos`, obtido.avisos, avisos);
      conferir(`${rotulo} item0`, [obtido.itens[0].quantidade, obtido.itens[0].porcaoGramas], [escalados.get('0.-.quantidade'), escalados.get('0.-.porcaoGramas')]);
      if (alt !== undefined) conferir(`${rotulo} alternativa`, [obtido.itens[0].substituicoes![0].quantidade, obtido.itens[0].substituicoes![0].porcaoGramas], [escalados.get('0.0.quantidade'), escalados.get('0.0.porcaoGramas')]);
      conferir(`${rotulo} item1`, [obtido.itens[1].quantidade, obtido.itens[1].porcaoGramas], [escalados.get('1.-.quantidade'), escalados.get('1.-.porcaoGramas')]);
      // Encadeamento: os gramas escalados pelo motor alimentam o snapshot; o oráculo usa os gramas que ele mesmo calculou.
      const itens = obtido.itens.map(i => ({ micronutrientes: criarSnapshotMicronutrientes({ calcioMg: { estado: 'conhecido', valor: 12.5 } }, 100, i.porcaoGramas) }));
      const calculo = calcularNutrientesCombinados([{ planoId: 'p', ativo: true, selecionado: true, refeicoes: [{ identidadeId: 'r', ativa: true, selecionada: true, itens }] }]);
      const esperadoSoma = [escalados.get('0.-.porcaoGramas')!, escalados.get('1.-.porcaoGramas')!].map(g => arred8(div(mul(dec('12.5'), dec(String(g))), dec('100')))).reduce((a, b) => a + b, 0n);
      conferir(`${rotulo} total encadeado`, calculo.nutrientes.calcioMg.total, numero8(esperadoSoma));
    }
    expect(resultado()).toEqual([]);
  });
});

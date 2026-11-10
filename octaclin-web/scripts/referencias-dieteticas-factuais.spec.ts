import assert from 'node:assert/strict';
import test from 'node:test';
import { analisarMicronutrientesPlanejados } from '../lib/calculo-combinado-planos-api';
import { lerAnaliseMicronutrientesFactual } from '../lib/micronutrientes-factuais';
import { CAMPOS_MICRONUTRIENTES_PLANO } from '../lib/micronutrientes-plano';
import { MOTIVOS_COMPARACAO_FACTUAL, MOTIVOS_CONTEXTO_FACTUAL, montarConfirmacoesReferencias, resumirComparacao, respostasPacienteIniciais, situacaoRespostas, type ComparacaoNutrienteFactual } from '../lib/referencias-dieteticas-factuais';
import { AVISO_FORA_DO_ESCOPO, COMO_LER, MOTIVO_COMPARACAO_CURTO, MOTIVO_COMPARACAO_LONGO, MOTIVO_CONTEXTO_TEXTO, formatarPercentualReferencia, textoFonteReferencias, textoReferencia, textoUl } from '../lib/textos-referencias-dieteticas';

const VERSAO = 'dri-hc-2025-11-19-adulto-v1';
const entrada = { selecoes: [{ planoId: 'p1', versaoIdEsperada: 'v1', ativacaoRevisaoEsperada: 2, identidadesRefeicoes: ['r1'] }] };
type Solto = Record<string, unknown>;
type Comparavel = Extract<ComparacaoNutrienteFactual, { estado: 'comparavel' }>;

// Dados sintéticos: cálcio completo (500 mg), ferro parcial, o resto desconhecido.
function resposta(): Solto {
  const nutrientes = Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c => [c.codigo, { codigo: c.codigo, unidade: c.unidade, estado: 'DESCONHECIDO', contagens: { incluidos: 2, conhecidos: 0, semComposicao: 2, incompativeis: 0, naoResolvidos: 0 }, causas: [{ codigo: 'ausente', quantidade: 2 }] } as Solto]));
  Object.assign(nutrientes.calcioMg, { estado: 'COMPLETO', contagens: { incluidos: 2, conhecidos: 2, semComposicao: 0, incompativeis: 0, naoResolvidos: 0 }, causas: [], total: 500 });
  Object.assign(nutrientes.ferroMg, { estado: 'PARCIAL', contagens: { incluidos: 2, conhecidos: 1, semComposicao: 1, incompativeis: 0, naoResolvidos: 0 }, causas: [{ codigo: 'ausente', quantidade: 1 }], quantidadeConhecida: 2 });
  return {
    schemaVersao: 1, motorVersao: 'food06-factual-v1', calculadoEm: '2026-10-31T12:00:00.000Z', publicacoes: [{ planoId: 'p1', versaoId: 'v1', ativacaoRevisao: 2 }],
    cobertura: { schemaVersao: 1, nutrientes }, comparacoes: comparacoes()
  };
}
function comparacoes(elegivel = true): Solto {
  const ind = (motivo: string) => ({ estado: 'indisponivel', motivo });
  return {
    estado: 'calculado', fonteReferencias: { autoridade: 'Health Canada', modificadaEm: '2025-11-19', licenca: 'OGL-Canada', licencaId: 'ca-ogl-lgo', urls: [] },
    versaoReferencias: VERSAO, contextoElegivel: elegivel, motivosContexto: elegivel ? [] : ['gestacao_fora_do_escopo'],
    nutrientes: CAMPOS_MICRONUTRIENTES_PLANO.map(c => {
      if (!elegivel) return { codigo: c.codigo, referencia: ind('contexto_nao_elegivel'), ul: ind('contexto_nao_elegivel') };
      if (c.codigo === 'calcioMg') return {
        codigo: c.codigo,
        referencia: { estado: 'comparavel', tipo: 'RDA', referenciaId: 'x', referenciaVersao: VERSAO, quantidadePlanejada: 500, unidadePlanejada: 'mg', valorReferencia: 1000, unidadeReferencia: 'mg', percentual: 50, diferencaNaUnidadePlanejada: -500, diferencaArredondada: false },
        ul: { estado: 'comparavel', tipo: 'UL', referenciaId: 'x', referenciaVersao: VERSAO, quantidadePlanejada: 500, unidadePlanejada: 'mg', valorReferencia: 2500, unidadeReferencia: 'mg', percentual: 20, diferencaNaUnidadePlanejada: -2000, diferencaArredondada: false, posicao: 'abaixo' }
      };
      if (c.codigo === 'ferroMg') return { codigo: c.codigo, referencia: ind('dados_incompletos'), ul: ind('dados_incompletos') };
      return { codigo: c.codigo, referencia: ind('dados_incompletos'), ul: ind('nao_estabelecido') };
    })
  };
}
// Acessadores tipados para alterar a fixture sem `any`.
const comp = (r: Solto) => r.comparacoes as Solto & { nutrientes: (Solto & { referencia: Solto; ul: Solto })[]; fonteReferencias: Solto };
const nut = (r: Solto, codigo: string) => comp(r).nutrientes.find(n => n.codigo === codigo)!;
const cob = (r: Solto, codigo: string) => ((r.cobertura as Solto).nutrientes as Record<string, Solto>)[codigo];
const ler = (r: unknown) => lerAnaliseMicronutrientesFactual(r, entrada, { referencias: true });
const lerSemPedido = (r: unknown, opts?: { referencias?: boolean }) => lerAnaliseMicronutrientesFactual(r, entrada, opts);
const alterar = (f: (r: Solto) => void) => { const r = resposta(); f(r); return r; };

test('FOOD06 T4a: sem o pedido, a leitura e identica a de sempre e exige o placeholder', () => {
  const sem = alterar(r => { r.comparacoes = { estado: 'indisponivel', motivo: 'referencias_nao_habilitadas' }; });
  assert.equal(lerSemPedido(sem).referencias, undefined);
  assert.equal(lerSemPedido(sem, { referencias: false }).referencias, undefined);
  // Resposta com comparacao calculada, mas nao pedida: o placeholder e obrigatorio (fail closed).
  assert.throws(() => lerSemPedido(resposta()), Error);
  // Pedida, mas a resposta voltou como placeholder: nao ha comparacao a exibir.
  assert.throws(() => ler(sem), Error);
});

test('FOOD06 T4a: le a comparacao do servidor e projeta so o necessario', () => {
  const a = ler(resposta()), calcio = a.referencias!.nutrientes.calcioMg;
  assert.equal(a.referencias!.versao, VERSAO);
  assert.equal(a.referencias!.contextoElegivel, true);
  assert.equal(Object.keys(a.referencias!.nutrientes).length, 22);
  assert.deepEqual(calcio.referencia, { estado: 'comparavel', tipo: 'RDA', quantidadePlanejada: 500, unidadePlanejada: 'mg', valorReferencia: 1000, unidadeReferencia: 'mg', percentual: 50 });
  assert.deepEqual(calcio.ul, { estado: 'comparavel', tipo: 'UL', quantidadePlanejada: 500, unidadePlanejada: 'mg', valorReferencia: 2500, unidadeReferencia: 'mg', percentual: 20, posicao: 'abaixo' });
  assert.deepEqual(a.referencias!.nutrientes.ferroMg.referencia, { estado: 'indisponivel', motivo: 'dados_incompletos' });
  // Nada de identidade interna, diferenca ou fonte bruta na projecao.
  assert.doesNotMatch(JSON.stringify(a.referencias), /referenciaId|diferenca|urls|licencaId/);
});

test('FOOD06 T4a: contexto inelegivel mostra o motivo e nenhuma comparacao', () => {
  const a = ler(alterar(r => { r.comparacoes = comparacoes(false); }));
  assert.equal(a.referencias!.contextoElegivel, false);
  assert.deepEqual(a.referencias!.motivosContexto, ['gestacao_fora_do_escopo']);
  assert.ok(Object.values(a.referencias!.nutrientes).every(n => n.referencia.estado === 'indisponivel' && n.ul.estado === 'indisponivel'));
});

test('FOOD06 T4a: falha fechada para comparacao incoerente com a cobertura ou com o contrato', () => {
  const casos: [string, (r: Solto) => void][] = [
    ['comparavel sobre nutriente parcial', r => { nut(r, 'ferroMg').referencia = { ...nut(r, 'calcioMg').referencia }; }],
    ['comparavel sobre parcial mesmo com a mesma quantidade', r => { cob(r, 'ferroMg').quantidadeConhecida = 500; nut(r, 'ferroMg').referencia = { ...nut(r, 'calcioMg').referencia }; }],
    ['quantidade diferente da cobertura', r => { nut(r, 'calcioMg').referencia.quantidadePlanejada = 499; }],
    ['unidade diferente da cobertura', r => { nut(r, 'calcioMg').referencia.unidadePlanejada = 'mcg'; }],
    ['versao da referencia diferente', r => { nut(r, 'calcioMg').referencia.referenciaVersao = 'outra-v1'; }],
    ['comparavel com contexto inelegivel', r => { comp(r).contextoElegivel = false; comp(r).motivosContexto = ['gestacao_fora_do_escopo']; }],
    ['elegivel com motivos', r => { comp(r).motivosContexto = ['gestacao_fora_do_escopo']; }],
    ['motivo de contexto desconhecido', r => { comp(r).contextoElegivel = false; comp(r).motivosContexto = ['inventado']; }],
    ['motivo de comparacao desconhecido', r => { nut(r, 'magnesioMg').referencia = { estado: 'indisponivel', motivo: 'inventado' }; }],
    ['UL sem posicao', r => { delete nut(r, 'calcioMg').ul.posicao; }],
    ['RDA com posicao', r => { nut(r, 'calcioMg').referencia.posicao = 'abaixo'; }],
    ['posicao contradiz os numeros', r => { nut(r, 'calcioMg').ul.posicao = 'acima'; }],
    ['tipo trocado entre RDA e UL', r => { nut(r, 'calcioMg').referencia.tipo = 'UL'; }],
    ['percentual negativo', r => { nut(r, 'calcioMg').referencia.percentual = -1; }],
    ['valor de referencia zero', r => { nut(r, 'calcioMg').referencia.valorReferencia = 0; }],
    ['percentual nao finito', r => { nut(r, 'calcioMg').referencia.percentual = Number.POSITIVE_INFINITY; }],
    ['ajuste de tabagismo fora da vitamina C', r => { nut(r, 'calcioMg').referencia.ajusteTabagismoMg = 35; }],
    ['nutriente repetido', r => { comp(r).nutrientes[1].codigo = comp(r).nutrientes[0].codigo; }],
    ['nutriente desconhecido', r => { comp(r).nutrientes[1].codigo = 'inventadoMg'; }],
    ['faltando nutriente', r => { comp(r).nutrientes.pop(); }],
    ['estado diferente de calculado', r => { r.comparacoes = { estado: 'indisponivel', motivo: 'referencias_nao_habilitadas' }; }],
    ['versao malformada', r => { comp(r).versaoReferencias = 'DRI atual'; }],
    ['fonte sem autoridade', r => { delete comp(r).fonteReferencias.autoridade; }]
  ];
  for (const [nome, f] of casos) assert.throws(() => ler(alterar(f)), Error, nome);
});

test('FOOD06 T4a: UL igual ao limite e UL em unidade diferente nao sao rejeitados', () => {
  const igual = ler(alterar(r => { Object.assign(nut(r, 'calcioMg').ul, { quantidadePlanejada: 500, valorReferencia: 500, posicao: 'igual' }); }));
  assert.equal((igual.referencias!.nutrientes.calcioMg.ul as { posicao?: string }).posicao, 'igual');
  const mcg = ler(alterar(r => { Object.assign(nut(r, 'calcioMg').ul, { unidadeReferencia: 'mcg', valorReferencia: 3_000_000, posicao: 'abaixo' }); }));
  assert.equal(mcg.referencias!.nutrientes.calcioMg.ul.estado, 'comparavel');
});

test('FOOD06 T4a: resumo fecha com o total e o contexto nao entra nas contagens por celula', () => {
  const r = ler(resposta()).referencias!, s = resumirComparacao(r);
  assert.deepEqual(s, { comparados: 1, dadosIncompletos: 21, semReferencia: 0, total: 22 });
  assert.equal(s.comparados + s.dadosIncompletos + s.semReferencia, s.total);
});

test('FOOD06 T4a: textos factuais aprovados, sem palavras proibidas nem verbo de acao', () => {
  const calcio = ler(resposta()).referencias!.nutrientes.calcioMg, ref = calcio.referencia as Comparavel, ul = calcio.ul as Comparavel;
  assert.equal(textoReferencia('calcioMg', ref), 'Planejado: 500 mg = 50% da RDA (1.000 mg)');
  assert.equal(textoUl('calcioMg', ul), 'Limite superior (UL): total planejado abaixo de 2.500 mg');
  assert.equal(textoUl('calcioMg', { ...ul, posicao: 'acima' }), 'Limite superior (UL): total planejado acima de 2.500 mg');
  assert.equal(textoUl('calcioMg', { ...ul, posicao: 'igual' }), 'Limite superior (UL): total planejado igual a 2.500 mg');
  assert.equal(textoReferencia('vitaminaCMg', { estado: 'comparavel', tipo: 'RDA', quantidadePlanejada: 60, unidadePlanejada: 'mg', valorReferencia: 125, unidadeReferencia: 'mg', percentual: 48, ajusteTabagismoMg: 35 }), 'Planejado: 60 mg = 48% da RDA (125 mg), com +35 mg por tabagismo confirmado');
  const todos = [...Object.values(MOTIVO_COMPARACAO_CURTO), ...Object.values(MOTIVO_COMPARACAO_LONGO), ...Object.values(MOTIVO_CONTEXTO_TEXTO), ...Object.values(AVISO_FORA_DO_ESCOPO), ...COMO_LER,
    textoReferencia('calcioMg', ref), textoUl('calcioMg', ul)].join('\n');
  assert.doesNotMatch(todos, /\b(seguro|segura|excesso|risco|toxic|defici|alerta|perigo|reduza|evite|cuidado|recomenda[çc][ãa]o)\b/i);
  // Todo motivo do contrato tem texto curto e longo.
  for (const m of MOTIVOS_COMPARACAO_FACTUAL) { assert.ok(MOTIVO_COMPARACAO_CURTO[m]); assert.ok(MOTIVO_COMPARACAO_LONGO[m]); }
  for (const m of MOTIVOS_CONTEXTO_FACTUAL) assert.ok(MOTIVO_CONTEXTO_TEXTO[m]);
  assert.equal(textoFonteReferencias({ fonte: { autoridade: 'Health Canada', modificadaEm: '2025-11-19', licenca: 'OGL-Canada' }, versao: VERSAO }), `Fonte: Health Canada, tabela de 19/11/2025, licença OGL-Canada. Versão ${VERSAO}.`);
});

test('FOOD06 T4a: percentual nunca vira zero falso e zero conhecido continua zero', () => {
  assert.equal(formatarPercentualReferencia(0), '0');
  assert.equal(formatarPercentualReferencia(0.2), '<1');
  assert.equal(formatarPercentualReferencia(3.45), '3,5');
  assert.equal(formatarPercentualReferencia(50), '50');
  assert.equal(formatarPercentualReferencia(180.4), '180');
  assert.equal(formatarPercentualReferencia(Number.NaN), '—');
});

test('FOOD06 T4a: respostas do profissional exigem tudo explicito e fora do escopo nao pede ao servidor', () => {
  const r = respostasPacienteIniciais();
  assert.deepEqual(situacaoRespostas(r, false).pendencias, ['gestacao', 'lactacao', 'populacao', 'aplicabilidade', 'dia_completo']);
  assert.equal(situacaoRespostas(r, false).completo, false);
  const ok = { ...r, populacaoReferencia: 'feminina' as const, populacaoConfirmada: true, gestacao: 'nao' as const, lactacao: 'nao' as const, aplicabilidade: 'confirmada' as const };
  assert.equal(situacaoRespostas(ok, true).completo, true);
  // Tabagismo "nao informado" continua valido: so a vitamina C fica sem comparacao.
  assert.equal(situacaoRespostas({ ...ok, tabagismo: 'nao_informado' }, true).completo, true);
  assert.deepEqual(situacaoRespostas({ ...ok, populacaoConfirmada: false }, true).pendencias, ['populacao_conferida']);
  assert.equal(situacaoRespostas({ ...ok, gestacao: 'sim' }, true).foraDoEscopo, 'gestacao');
  assert.equal(situacaoRespostas({ ...ok, gestacao: 'sim' }, true).completo, false);
  assert.equal(situacaoRespostas({ ...ok, lactacao: 'sim' }, true).foraDoEscopo, 'lactacao');
  assert.equal(situacaoRespostas({ ...ok, aplicabilidade: 'nao_aplicavel' }, true).foraDoEscopo, 'aplicabilidade');
  assert.deepEqual(montarConfirmacoesReferencias(ok, true), { ...ok, mesmoDiaPlanejado: true });
  assert.equal(montarConfirmacoesReferencias(ok, false).mesmoDiaPlanejado, false);
});

test('FOOD06 T4a: o pedido leva so as 7 confirmacoes, sem nascimento, idade ou elegibilidade', async () => {
  const original = globalThis.fetch; const corpos: Solto[] = [];
  globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
    corpos.push(JSON.parse(String(init?.body)) as Solto);
    const corpo = corpos.length === 1 ? resposta() : alterar(r => { r.comparacoes = { estado: 'indisponivel', motivo: 'referencias_nao_habilitadas' }; });
    return new Response(JSON.stringify(corpo), { status: 200 });
  }) as typeof fetch;
  try {
    const ok = { populacaoReferencia: 'feminina' as const, populacaoConfirmada: true, gestacao: 'nao' as const, lactacao: 'nao' as const, aplicabilidade: 'confirmada' as const, mesmoDiaPlanejado: true, tabagismo: 'nao' as const };
    const a = await analisarMicronutrientesPlanejados('paciente', entrada, undefined, ok);
    assert.equal(a.referencias?.versao, VERSAO);
    assert.deepEqual(Object.keys(corpos[0]).sort(), ['confirmacoes', 'incluirReferencias', 'selecoes']);
    assert.equal(corpos[0].incluirReferencias, true);
    assert.deepEqual(corpos[0].confirmacoes, ok);
    assert.doesNotMatch(JSON.stringify(corpos[0]), /"(nascimento|dataAnalise|idadeAnos|elegivel)"/);
    // Sem confirmacoes o corpo e o de sempre, sem a flag.
    await analisarMicronutrientesPlanejados('paciente', entrada);
    assert.deepEqual(corpos[1], entrada);
    // Confirmacoes adulteradas nao saem do navegador.
    await assert.rejects(() => analisarMicronutrientesPlanejados('paciente', entrada, undefined, { ...ok, nascimento: '1990-01-01' } as never));
    assert.equal(corpos.length, 2);
  } finally { globalThis.fetch = original; }
});

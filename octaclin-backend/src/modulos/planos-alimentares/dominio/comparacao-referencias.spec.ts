import type { CodigoNutrienteCombinado, ResultadoNutrienteCombinado } from './calculo-combinado';
import { compararNutrientePlanejado } from './comparacao-dietetica';
import { compararAnaliseComReferencias, type ResultadoComparacaoReferencias } from './comparacao-referencias';
import { resolverContextoDietetico, type EntradaContextoDietetico } from './contexto-dietetico';
import { CODIGOS_MICRONUTRIENTES, MICRONUTRIENTES, type CodigoMicronutriente } from './micronutrientes';
import { VERSAO_REFERENCIAS_DRI_ADULTO, referenciaDriAdulto } from './referencias-dri';

type Totais = Partial<Record<CodigoNutrienteCombinado, ResultadoNutrienteCombinado>>;

const completo = (codigo: CodigoMicronutriente, total: number): ResultadoNutrienteCombinado =>
  ({ codigo, unidade: MICRONUTRIENTES[codigo].unidade, estado: 'completo', total, itensComValor: 3, itensIncluidos: 3 });
/** Todos os 22 codigos completos e zerados, com sobrescritas. Os totais sao fixtures de aritmetica. */
const totais = (sobrescritas: Partial<Record<CodigoMicronutriente, number>> = {}): Totais =>
  Object.fromEntries(CODIGOS_MICRONUTRIENTES.map((c) => [c, completo(c, sobrescritas[c] ?? 0)]));

const entrada = (extra: Partial<EntradaContextoDietetico> = {}): EntradaContextoDietetico => ({
  nascimento: '1985-06-15', dataAnalise: '2026-11-10', populacaoReferencia: 'masculina', populacaoConfirmada: true,
  gestacao: 'nao', lactacao: 'nao', aplicabilidade: 'confirmada', mesmoDiaPlanejado: true, tabagismo: 'nao', ...extra
});
const contexto = (extra: Partial<EntradaContextoDietetico> = {}) => resolverContextoDietetico(entrada(extra));
const por = (r: ResultadoComparacaoReferencias, codigo: CodigoMicronutriente) => r.nutrientes.find((n) => n.codigo === codigo)!;

/*
 * Oraculo independente: razoes exatas em BigInt, escritas aqui com os numeros do
 * quadro ratificado (nao lidos do modulo de referencias). Percentual em escala 8,
 * arredondado half-up so na saida, como o contrato do comparador.
 */
function percentualExato(totalNum: bigint, totalDen: bigint, refNum: bigint, refDen: bigint): number {
  const escala = 100_000_000n;
  const num = totalNum * refDen * 100n * escala;
  const den = totalDen * refNum;
  return Number((num * 2n + den) / (den * 2n)) / 1e8;
}

describe('comparador em lote com referencias DRI (T2)', () => {
  describe('contexto elegivel: percentual e posicao em relacao ao UL', () => {
    it('adulto masculino de 40 anos: calcio 1250 mg = 125% da RDA de 1000 e 50% do UL de 2500, abaixo do UL', () => {
      const r = compararAnaliseComReferencias(totais({ calcioMg: 1250 }), contexto());
      expect(r.contextoElegivel).toBe(true);
      expect(r.motivosContexto).toEqual([]);
      expect(r.versaoReferencias).toBe(VERSAO_REFERENCIAS_DRI_ADULTO);
      const calcio = por(r, 'calcioMg');
      expect(calcio.referencia).toMatchObject({ estado: 'comparavel', tipo: 'RDA', percentual: percentualExato(1250n, 1n, 1000n, 1n), diferencaNaUnidadePlanejada: 250 });
      expect(calcio.referencia).toMatchObject({ referenciaVersao: VERSAO_REFERENCIAS_DRI_ADULTO });
      expect(calcio.ul).toMatchObject({ estado: 'comparavel', tipo: 'UL', percentual: 50, posicao: 'abaixo', diferencaNaUnidadePlanejada: -1250 });
    });

    it.each([
      [2499.99999999, 'abaixo'], [2500, 'igual'], [2500.00000001, 'acima'], [3000, 'acima'], [0, 'abaixo']
    ] as const)('borda do UL: calcio %s mg esta %s do UL de 2500 (decisao pela razao exata)', (valor, posicao) => {
      const ul = por(compararAnaliseComReferencias(totais({ calcioMg: valor }), contexto()), 'calcioMg').ul;
      expect(ul).toMatchObject({ estado: 'comparavel', posicao });
      if (posicao === 'igual') expect(ul).toMatchObject({ percentual: 100, diferencaNaUnidadePlanejada: 0, diferencaArredondada: false });
    });

    it('a borda do UL com conversao de unidade e exata: cobre 10 mg e igual ao UL de 10000 mcg', () => {
      const cobre = por(compararAnaliseComReferencias(totais({ cobreMg: 10 }), contexto()), 'cobreMg');
      expect(cobre.ul).toMatchObject({ estado: 'comparavel', posicao: 'igual', percentual: 100, valorReferencia: 10000, unidadeReferencia: 'mcg' });
      expect(cobre.referencia).toMatchObject({ estado: 'comparavel', valorReferencia: 900, unidadeReferencia: 'mcg', percentual: percentualExato(10000n, 1n, 900n, 1n) });
    });

    it('a posicao existe so para o UL; RDA e AI trazem percentual e diferenca, sem rotulo', () => {
      const r = compararAnaliseComReferencias(totais({ calcioMg: 500, potassioMg: 1000 }), contexto());
      expect(por(r, 'calcioMg').referencia).not.toHaveProperty('posicao');
      expect(por(r, 'potassioMg').referencia).toMatchObject({ estado: 'comparavel', tipo: 'AI', valorReferencia: 3400 });
      expect(por(r, 'potassioMg').referencia).not.toHaveProperty('posicao');
    });

    it('zero conhecido e valor valido: 0 mg de calcio = 0% da RDA', () => {
      expect(por(compararAnaliseComReferencias(totais({ calcioMg: 0 }), contexto()), 'calcioMg').referencia)
        .toMatchObject({ estado: 'comparavel', percentual: 0, diferencaNaUnidadePlanejada: -1000 });
    });

    it('nao classifica deficiencia ou toxicidade, nem usa cor/semaforo (CL06)', () => {
      const texto = JSON.stringify(compararAnaliseComReferencias(totais({ calcioMg: 9999, ferroMg: 1 }), contexto()));
      expect(texto).not.toMatch(/deficien|toxic|adequad|segur|excess|insuficien|semaforo|cor\b|alerta|risco|perigo/i);
    });
  });

  describe('transicoes de idade e populacao da referencia', () => {
    it.each([
      // [nascimento, dataAnalise, valorFerroMg, percentualEsperado]  ferro feminino: 18 mg ate 50, 8 mg a partir de 51
      ['1976-11-11', '2026-11-10', 8, percentualExato(8n, 1n, 18n, 1n)], // 49 anos completos (aniversario amanha)
      ['1976-11-10', '2026-11-10', 8, percentualExato(8n, 1n, 18n, 1n)], // 50 anos completos hoje
      ['1975-11-11', '2026-11-10', 8, percentualExato(8n, 1n, 18n, 1n)], // 50 anos completos (51 amanha)
      ['1975-11-10', '2026-11-10', 8, 100]                                // 51 anos completos hoje
    ])('ferro feminino nasc. %s em %s: %s mg -> %s%%', (nascimento, dataAnalise, valor, percentual) => {
      const ctx = contexto({ nascimento, dataAnalise, populacaoReferencia: 'feminina' });
      expect(por(compararAnaliseComReferencias(totais({ ferroMg: valor }), ctx), 'ferroMg').referencia)
        .toMatchObject({ estado: 'comparavel', percentual });
    });

    it('a populacao da referencia vem do contexto confirmado, sem inferencia: feminina usa 75 mg de vitamina C, masculina 90', () => {
      const f = compararAnaliseComReferencias(totais({ vitaminaCMg: 75 }), contexto({ populacaoReferencia: 'feminina' }));
      const m = compararAnaliseComReferencias(totais({ vitaminaCMg: 75 }), contexto({ populacaoReferencia: 'masculina' }));
      expect(por(f, 'vitaminaCMg').referencia).toMatchObject({ percentual: 100, valorReferencia: 75 });
      expect(por(m, 'vitaminaCMg').referencia).toMatchObject({ percentual: percentualExato(75n, 1n, 90n, 1n), valorReferencia: 90 });
    });
  });

  describe('vitamina C e tabagismo (CL07)', () => {
    it.each([
      ['sim', 125, 100, 35], ['nao', 90, 100, undefined]
    ] as const)('tabagismo %s: RDA de vitamina C masculina com %s mg = %s%%', (tabagismo, valor, percentual, ajuste) => {
      const c = por(compararAnaliseComReferencias(totais({ vitaminaCMg: valor }), contexto({ tabagismo })), 'vitaminaCMg');
      expect(c.referencia).toMatchObject({ estado: 'comparavel', percentual, ...(ajuste ? { ajusteTabagismoMg: ajuste, valorReferencia: 125 } : {}) });
      if (!ajuste) expect(c.referencia).not.toHaveProperty('ajusteTabagismoMg');
      expect(c.ul).toMatchObject({ estado: 'comparavel', valorReferencia: 2000 }); // UL nao muda com tabagismo
    });
    it('tabagismo desconhecido indisponibiliza so a RDA da vitamina C; o UL e os demais nutrientes seguem', () => {
      const r = compararAnaliseComReferencias(totais({ vitaminaCMg: 90, calcioMg: 1000 }), contexto({ tabagismo: 'nao_informado' }));
      expect(por(r, 'vitaminaCMg').referencia).toEqual({ estado: 'indisponivel', motivo: 'tabagismo_nao_informado' });
      expect(por(r, 'vitaminaCMg').ul.estado).toBe('comparavel');
      expect(por(r, 'calcioMg').referencia.estado).toBe('comparavel');
    });
  });

  describe('contexto nao elegivel: todos indisponiveis, com o motivo do contexto', () => {
    it.each([
      [{ gestacao: 'sim' } as const, 'gestacao_fora_do_escopo'],
      [{ lactacao: 'sim' } as const, 'lactacao_fora_do_escopo'],
      [{ populacaoConfirmada: false } as const, 'populacao_nao_confirmada'],
      [{ populacaoReferencia: 'nao_informada' } as const, 'populacao_nao_confirmada'],
      [{ aplicabilidade: 'nao_aplicavel' } as const, 'aplicabilidade_nao_confirmada'],
      [{ gestacao: 'nao_informada' } as const, 'fisiologia_nao_confirmada'],
      [{ nascimento: '2010-01-01' } as const, 'idade_fora_do_escopo'],
      [{ nascimento: '2030-01-01' } as const, 'nascimento_futuro'],
      [{ nascimento: undefined } as const, 'nascimento_nao_informado'],
      [{ dataAnalise: '2026-02-30' } as const, 'data_invalida']
    ])('%j -> %s', (extra, motivo) => {
      const r = compararAnaliseComReferencias(totais({ calcioMg: 1000 }), contexto(extra as Partial<EntradaContextoDietetico>));
      expect(r.contextoElegivel).toBe(false);
      expect(r.motivosContexto).toContain(motivo);
      expect(r.nutrientes).toHaveLength(22);
      for (const n of r.nutrientes) {
        expect(n.referencia).toEqual({ estado: 'indisponivel', motivo: 'contexto_nao_elegivel' });
        expect(n.ul).toEqual({ estado: 'indisponivel', motivo: 'contexto_nao_elegivel' });
      }
    });
    it('mesmo dia planejado nao confirmado indisponibiliza tudo (CL03) e o motivo aparece no resultado', () => {
      const r = compararAnaliseComReferencias(totais({ calcioMg: 1000 }), contexto({ mesmoDiaPlanejado: false }));
      expect(r.contextoElegivel).toBe(true);
      for (const n of r.nutrientes) expect(n.referencia).toEqual({ estado: 'indisponivel', motivo: 'dia_nao_confirmado' });
    });
    it('contexto inconsistente (elegivel mas com motivos, ou sem idade/populacao) nao e aceito como elegivel', () => {
      const bom = contexto();
      const casos = [
        { ...bom, motivos: ['gestacao_fora_do_escopo' as const] },
        { ...bom, idadeAnos: undefined },
        { ...bom, populacaoReferencia: undefined },
        { ...bom, idadeAnos: 18 },
        null, undefined, 'elegivel', [], {}
      ];
      for (const ctx of casos) {
        const r = compararAnaliseComReferencias(totais({ calcioMg: 1000 }), ctx as never);
        expect(r.contextoElegivel).toBe(false);
        expect(r.motivosContexto.length).toBeGreaterThan(0);
        expect(r.nutrientes.every((n) => n.referencia.estado === 'indisponivel' && n.ul.estado === 'indisponivel')).toBe(true);
      }
    });
    it('os motivos do contexto sao copiados: alterar o resultado nao altera o contexto de origem', () => {
      const ctx = contexto({ gestacao: 'sim' });
      const r = compararAnaliseComReferencias(totais(), ctx);
      r.motivosContexto.push('data_invalida');
      expect(ctx.motivos).toEqual(['gestacao_fora_do_escopo']);
    });
  });

  describe('cobertura, unidade e codigos (CL04, CL05, CL08)', () => {
    it.each(['parcial', 'indisponivel'] as const)('cobertura %s nao gera percentual e nao afeta os demais nutrientes', (estado) => {
      const t = totais({ ferroMg: 8 });
      t.calcioMg = { ...completo('calcioMg', 600), estado, itensComValor: 1 };
      const r = compararAnaliseComReferencias(t, contexto());
      expect(por(r, 'calcioMg').referencia).toEqual({ estado: 'indisponivel', motivo: 'dados_incompletos' });
      expect(por(r, 'calcioMg').ul).toEqual({ estado: 'indisponivel', motivo: 'dados_incompletos' });
      expect(por(r, 'ferroMg').referencia.estado).toBe('comparavel');
    });
    it('itens com valor diferente dos incluidos, mesmo marcado completo, nao gera percentual', () => {
      const t = totais();
      t.calcioMg = { ...completo('calcioMg', 600), itensComValor: 2, itensIncluidos: 3 };
      expect(por(compararAnaliseComReferencias(t, contexto()), 'calcioMg').referencia).toEqual({ estado: 'indisponivel', motivo: 'dados_incompletos' });
    });
    it('nutriente ausente do calculo e indisponivel por dados incompletos, nunca zero', () => {
      const t = totais(); delete t.zincoMg;
      expect(por(compararAnaliseComReferencias(t, contexto()), 'zincoMg').referencia).toEqual({ estado: 'indisponivel', motivo: 'dados_incompletos' });
    });
    it('unidade incompativel (g no lugar de mg; mcg no lugar de mg) nao compara', () => {
      const t = totais();
      t.calcioMg = { ...completo('calcioMg', 1), unidade: 'g' };
      t.ferroMg = { ...completo('ferroMg', 8000), unidade: 'mcg' };
      const r = compararAnaliseComReferencias(t, contexto());
      expect(por(r, 'calcioMg').referencia).toEqual({ estado: 'indisponivel', motivo: 'unidade_incompativel' });
      expect(por(r, 'ferroMg').referencia).toEqual({ estado: 'indisponivel', motivo: 'unidade_incompativel' });
    });
    it('chave diferente do codigo do total nao e aceita', () => {
      const t = totais(); t.calcioMg = completo('ferroMg', 8);
      expect(por(compararAnaliseComReferencias(t, contexto()), 'calcioMg').referencia).toEqual({ estado: 'indisponivel', motivo: 'definicao_incompativel' });
    });
    it.each(['retinolMcg', 'vitaminaAReMcg', 'niacinaMg'] as const)('%s nao tem referencia propria', (codigo) => {
      const n = por(compararAnaliseComReferencias(totais({ [codigo]: 100 }), contexto()), codigo);
      expect(n.referencia).toEqual({ estado: 'indisponivel', motivo: 'referencia_indisponivel' });
      expect(n.ul).toEqual({ estado: 'indisponivel', motivo: 'referencia_indisponivel' });
    });
    it('UL restrito a formas fica indisponivel para o total alimentar, e a RDA segue (magnesio, niacina NE, folato DFE, vitamina A RAE)', () => {
      const r = compararAnaliseComReferencias(totais({ magnesioMg: 420, niacinaNeMg: 16, folatoDfeMcg: 400, vitaminaARaeMcg: 900 }), contexto());
      for (const codigo of ['magnesioMg', 'niacinaNeMg', 'folatoDfeMcg', 'vitaminaARaeMcg'] as const) {
        expect(por(r, codigo).referencia).toMatchObject({ estado: 'comparavel', percentual: 100 });
        expect(por(r, codigo).ul).toEqual({ estado: 'indisponivel', motivo: 'abrangencia_ul_incompativel' });
      }
    });
    it('vitamina E fica sem comparacao (formas 2R) e UL nao estabelecido e dito como tal (potassio, tiamina, riboflavina, B12)', () => {
      const r = compararAnaliseComReferencias(totais({ vitaminaEAlfaTocoferolMg: 15 }), contexto());
      expect(por(r, 'vitaminaEAlfaTocoferolMg').referencia).toEqual({ estado: 'indisponivel', motivo: 'definicao_incompativel' });
      for (const codigo of ['potassioMg', 'tiaminaMg', 'riboflavinaMg', 'vitaminaB12Mcg'] as const) {
        expect(por(r, codigo).ul).toEqual({ estado: 'indisponivel', motivo: 'nao_estabelecido' });
      }
    });
  });

  describe('forma do resultado', () => {
    it('devolve os 22 codigos PA06 na ordem canonica e ignora nutrientes legados (energia, sodio...)', () => {
      const t: Totais = { ...totais(), sodioMg: { codigo: 'sodioMg', unidade: 'mg', estado: 'completo', total: 2000, itensComValor: 1, itensIncluidos: 1 },
        energiaKcal: { codigo: 'energiaKcal', unidade: 'kcal', estado: 'completo', total: 2000, itensComValor: 1, itensIncluidos: 1 } };
      const r = compararAnaliseComReferencias(t, contexto());
      expect(r.nutrientes.map((n) => n.codigo)).toEqual([...CODIGOS_MICRONUTRIENTES]);
    });
    it('cada nutriente do lote equivale ao comparador por nutriente com a mesma referencia (sem regra duplicada)', () => {
      const t = totais({ calcioMg: 1250, ferroMg: 9.5, vitaminaCMg: 100, cobreMg: 1.1 });
      const ctx = contexto({ tabagismo: 'sim' });
      const lote = compararAnaliseComReferencias(t, ctx);
      for (const codigo of ['calcioMg', 'ferroMg', 'vitaminaCMg', 'cobreMg'] as const) {
        const individual = compararNutrientePlanejado(t[codigo]!, referenciaDriAdulto(codigo, ctx), ctx.contexto);
        expect(por(lote, codigo).referencia).toEqual(individual.referencia);
        expect(por(lote, codigo).ul).toEqual(individual.ul);
      }
    });
    it('nao altera as entradas e o resultado serializa sem funcoes nem undefined', () => {
      const t = totais({ calcioMg: 1250 }); const ctx = contexto();
      const antes = JSON.stringify([t, ctx]);
      const r = compararAnaliseComReferencias(t, ctx);
      expect(JSON.stringify([t, ctx])).toBe(antes);
      expect(JSON.parse(JSON.stringify(r))).toEqual(r);
    });
    it('totais nao-objeto tornam tudo indisponivel por dados incompletos', () => {
      for (const t of [null, undefined, 'x', 42, []]) {
        const r = compararAnaliseComReferencias(t as never, contexto());
        expect(r.nutrientes).toHaveLength(22);
        expect(r.nutrientes.every((n) => n.referencia.estado === 'indisponivel')).toBe(true);
      }
    });
  });
});

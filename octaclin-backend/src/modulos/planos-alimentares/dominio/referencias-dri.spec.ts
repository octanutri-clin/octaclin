import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ResultadoNutrienteCombinado } from './calculo-combinado';
import { compararNutrientePlanejado, type ContextoComparacaoDietetica, type ReferenciaDieteticaCalculo } from './comparacao-dietetica';
import { CODIGOS_MICRONUTRIENTES, MICRONUTRIENTES, type CodigoMicronutriente } from './micronutrientes';
import {
  FONTE_REFERENCIAS_DRI_ADULTO, TABELA_REFERENCIAS_DRI_ADULTO, VERSAO_REFERENCIAS_DRI_ADULTO,
  faixaEtariaDriAdulto, referenciaDriAdulto
} from './referencias-dri';

/*
 * Oraculo: o quadro adulto ratificado (CL01-CL08, 2026-10-31) em
 * docs/product/VALORES_CANDIDATOS_DRI_FOOD06.md. O teste le o Markdown e compara
 * cada celula com o modulo; o modulo nao le o Markdown em runtime. Se o quadro
 * mudar, este teste reprova ate o modulo receber nova versao.
 */
const RAIZ = join(__dirname, '../../../../..');
const QUADRO = readFileSync(join(RAIZ, 'docs/product/VALORES_CANDIDATOS_DRI_FOOD06.md'), 'utf8');

type Celula = number | 'ND';
interface LinhaQuadro {
  nutriente: string; unidade: string; tipo: string;
  m: Celula[]; f: Celula[]; unidadeUl: string; ulM: Celula[]; ulF: Celula[];
}
function lerSequencia(texto: string): Celula[] {
  return texto.split('/').map((parte) => {
    const valor = parte.trim();
    if (valor === 'ND') return 'ND';
    // Virgula decimal pt-BR, sem separador de milhar (declarado no proprio quadro).
    if (!/^\d+(,\d+)?$/.test(valor)) throw new Error(`celula fora do formato: "${valor}"`);
    return Number(valor.replace(',', '.'));
  });
}
function lerQuadro(): LinhaQuadro[] {
  const linhas = QUADRO.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Nutriente') && !l.startsWith('| ---'));
  return linhas.map((linha) => {
    const c = linha.split('|').slice(1, -1).map((x) => x.trim());
    if (c.length !== 8) throw new Error(`linha do quadro com ${c.length} colunas: ${linha}`);
    return { nutriente: c[0], unidade: c[1], tipo: c[2], m: lerSequencia(c[3]), f: lerSequencia(c[4]), unidadeUl: c[5], ulM: lerSequencia(c[6]), ulF: lerSequencia(c[7]) };
  });
}

/*
 * Semantica de unidade/qualificador/abrangencia. O quadro descreve unidades em
 * prosa ("mcg RAE", "mg formas abrangidas"); o mapeamento para o contrato do
 * comparador e parte do que este teste fixa, com base nas "Limitacoes
 * obrigatorias" do mesmo documento e na matriz PA06 da ficha clinica.
 */
type Unidade = 'mg' | 'mcg';
type Qualificador = ReferenciaDieteticaCalculo['qualificador'];
type Abrangencia = 'total' | 'farmacologica' | 'sintetica' | 'preformada' | 'suplementar';
const SEMANTICA: Record<string, { codigo: CodigoMicronutriente; unidade: Unidade; qualificador?: Qualificador; ul: { unidade: Unidade; abrangencia: Abrangencia } }> = {
  'Cálcio': { codigo: 'calcioMg', unidade: 'mg', ul: { unidade: 'mg', abrangencia: 'total' } },
  // "Magnesio: UL farmacologico/suplementar, nao o magnesio alimentar natural."
  'Magnésio': { codigo: 'magnesioMg', unidade: 'mg', ul: { unidade: 'mg', abrangencia: 'farmacologica' } },
  'Manganês': { codigo: 'manganesMg', unidade: 'mg', ul: { unidade: 'mg', abrangencia: 'total' } },
  'Fósforo': { codigo: 'fosforoMg', unidade: 'mg', ul: { unidade: 'mg', abrangencia: 'total' } },
  'Ferro': { codigo: 'ferroMg', unidade: 'mg', ul: { unidade: 'mg', abrangencia: 'total' } },
  'Potássio': { codigo: 'potassioMg', unidade: 'mg', ul: { unidade: 'mg', abrangencia: 'total' } },
  // "Cobre: tabela esta em mcg; PA06 usa mg." A referencia fica na unidade publicada.
  'Cobre': { codigo: 'cobreMg', unidade: 'mcg', ul: { unidade: 'mcg', abrangencia: 'total' } },
  'Zinco': { codigo: 'zincoMg', unidade: 'mg', ul: { unidade: 'mg', abrangencia: 'total' } },
  'Selênio': { codigo: 'selenioMcg', unidade: 'mcg', ul: { unidade: 'mcg', abrangencia: 'total' } },
  // RDA em RAE; UL somente da fracao pre-formada.
  'Vitamina A': { codigo: 'vitaminaARaeMcg', unidade: 'mcg', qualificador: 'RAE', ul: { unidade: 'mcg', abrangencia: 'preformada' } },
  'Tiamina': { codigo: 'tiaminaMg', unidade: 'mg', ul: { unidade: 'mg', abrangencia: 'total' } },
  'Riboflavina': { codigo: 'riboflavinaMg', unidade: 'mg', ul: { unidade: 'mg', abrangencia: 'total' } },
  'Vitamina B6': { codigo: 'vitaminaB6Mg', unidade: 'mg', ul: { unidade: 'mg', abrangencia: 'total' } },
  // RDA em NE; UL em mg das formas sinteticas abrangidas, nao mg NE.
  'Niacina': { codigo: 'niacinaNeMg', unidade: 'mg', qualificador: 'NE', ul: { unidade: 'mg', abrangencia: 'sintetica' } },
  'Vitamina B12': { codigo: 'vitaminaB12Mcg', unidade: 'mcg', ul: { unidade: 'mcg', abrangencia: 'total' } },
  // RDA em DFE; UL em mcg de acido folico/formas abrangidas, nao DFE.
  'Folato': { codigo: 'folatoDfeMcg', unidade: 'mcg', qualificador: 'DFE', ul: { unidade: 'mcg', abrangencia: 'sintetica' } },
  'Vitamina D': { codigo: 'vitaminaDMcg', unidade: 'mcg', ul: { unidade: 'mcg', abrangencia: 'total' } },
  // "Vitamina E: referencia exige formas 2R"; UL de formas suplementares abrangidas.
  'Vitamina E': { codigo: 'vitaminaEAlfaTocoferolMg', unidade: 'mg', qualificador: '2R', ul: { unidade: 'mg', abrangencia: 'suplementar' } },
  'Vitamina C': { codigo: 'vitaminaCMg', unidade: 'mg', ul: { unidade: 'mg', abrangencia: 'total' } }
};
const UNIDADE_PROSA: Record<string, { unidade: Unidade; qualificador?: Qualificador }> = {
  'mg': { unidade: 'mg' }, 'mcg': { unidade: 'mcg' }, 'mcg RAE': { unidade: 'mcg', qualificador: 'RAE' },
  'mg NE': { unidade: 'mg', qualificador: 'NE' }, 'mcg DFE': { unidade: 'mcg', qualificador: 'DFE' }
};
const UNIDADE_UL_PROSA: Record<string, { unidade: Unidade; abrangencia: Abrangencia }> = {
  'mg': { unidade: 'mg', abrangencia: 'total' }, 'mcg': { unidade: 'mcg', abrangencia: 'total' },
  'mcg pré-formada': { unidade: 'mcg', abrangencia: 'preformada' },
  'mg formas abrangidas': { unidade: 'mg', abrangencia: 'sintetica' },
  'mcg ácido fólico': { unidade: 'mcg', abrangencia: 'sintetica' },
  'mg formas suplementares abrangidas': { unidade: 'mg', abrangencia: 'suplementar' }
};
// Uma idade em cada ponta das quatro faixas declaradas no quadro (19-30/31-50/51-70/71+).
const IDADES_POR_FAIXA = [[19, 30], [31, 50], [51, 70], [71, 120]] as const;
const SEM_REFERENCIA: CodigoMicronutriente[] = ['retinolMcg', 'vitaminaAReMcg', 'niacinaMg'];

describe('referencias DRI adultas versionadas (T1)', () => {
  const quadro = lerQuadro();

  it('o quadro ratificado tem os 19 nutrientes esperados, e o modulo exatamente os mesmos codigos', () => {
    expect(quadro.map((l) => l.nutriente).sort()).toEqual(Object.keys(SEMANTICA).sort());
    const codigosModulo = [...new Set(TABELA_REFERENCIAS_DRI_ADULTO.map((l) => l.codigo))].sort();
    expect(codigosModulo).toEqual(Object.values(SEMANTICA).map((s) => s.codigo).sort());
    expect(codigosModulo).toHaveLength(19);
    // As limitacoes que sustentam o mapeamento ainda estao no documento ratificado.
    expect(QUADRO).toContain('Magnésio: UL farmacológico/suplementar');
    expect(QUADRO).toContain('Vitamina E: referência exige formas 2R');
  });

  it.each(quadro.map((l) => [l.nutriente, l] as const))('%s: cada celula (sexo x faixa) bate com o quadro ratificado', (_nome, linha) => {
    const s = SEMANTICA[linha.nutriente];
    expect(UNIDADE_PROSA[linha.unidade]).toEqual({ unidade: s.unidade, ...(s.qualificador && s.qualificador !== '2R' ? { qualificador: s.qualificador } : {}) });
    if (linha.nutriente !== 'Magnésio') expect(UNIDADE_UL_PROSA[linha.unidadeUl]).toEqual(s.ul);
    for (const [populacao, valores, uls] of [['masculina', linha.m, linha.ulM], ['feminina', linha.f, linha.ulF]] as const) {
      expect(valores).toHaveLength(4);
      expect(uls).toHaveLength(4);
      IDADES_POR_FAIXA.forEach((idades, faixa) => {
        for (const idadeAnos of idades) {
          const ref = referenciaDriAdulto(s.codigo, { populacaoReferencia: populacao, idadeAnos });
          expect(ref).toBeDefined();
          expect(ref!.codigo).toBe(s.codigo);
          expect(ref!.tipo).toBe(linha.tipo);
          expect(ref!.valor).toBe(valores[faixa]);
          expect(ref!.unidade).toBe(s.unidade);
          expect(ref!.qualificador).toBe(s.qualificador);
          if (uls[faixa] === 'ND') {
            // ND nunca vira zero: UL nao estabelecido, sem valor numerico.
            expect(ref!.ul).toEqual({ estado: 'nao_estabelecido' });
          } else {
            expect(ref!.ul).toEqual({ estado: 'definido', valor: uls[faixa], unidade: s.ul.unidade, abrangencia: s.ul.abrangencia });
          }
        }
      });
    }
  });

  it('codigos PA06 sem referencia propria ficam sem entrada (retinol, RE, niacina sem NE)', () => {
    for (const codigo of SEM_REFERENCIA) {
      expect(referenciaDriAdulto(codigo, { populacaoReferencia: 'feminina', idadeAnos: 40 })).toBeUndefined();
    }
    expect(CODIGOS_MICRONUTRIENTES.filter((c) => !TABELA_REFERENCIAS_DRI_ADULTO.some((l) => l.codigo === c)).sort())
      .toEqual([...SEM_REFERENCIA].sort());
  });

  it('nenhum valor de referencia ou UL e zero ou negativo (ND nao e zero)', () => {
    for (const linha of TABELA_REFERENCIAS_DRI_ADULTO) {
      for (const v of [...linha.valores.masculina, ...linha.valores.feminina]) expect(v).toBeGreaterThan(0);
      if (linha.ul.estado === 'definido') for (const v of [...linha.ul.valores.masculina, ...linha.ul.valores.feminina]) expect(v).toBeGreaterThan(0);
    }
  });

  describe('faixas etarias nos limites exatos', () => {
    it.each([
      [18, undefined], [19, 0], [30, 0], [31, 1], [50, 1], [51, 2], [70, 2], [71, 3], [120, 3]
    ])('%i anos completos -> faixa %s', (idade, faixa) => {
      expect(faixaEtariaDriAdulto(idade)).toBe(faixa);
    });
    it.each([[Number.NaN], [-1], [18.5], [30.5], [Number.POSITIVE_INFINITY], ['40' as unknown as number], [undefined as unknown as number]])(
      'idade invalida (%s) nao tem faixa nem referencia', (idade) => {
        expect(faixaEtariaDriAdulto(idade)).toBeUndefined();
        expect(referenciaDriAdulto('calcioMg', { populacaoReferencia: 'feminina', idadeAnos: idade })).toBeUndefined();
      });
    it.each([
      ['magnesioMg', 'masculina', 30, 400], ['magnesioMg', 'masculina', 31, 420],
      ['calcioMg', 'feminina', 50, 1000], ['calcioMg', 'feminina', 51, 1200],
      ['calcioMg', 'masculina', 70, 1000], ['calcioMg', 'masculina', 71, 1200],
      ['ferroMg', 'feminina', 50, 18], ['ferroMg', 'feminina', 51, 8],
      ['vitaminaB6Mg', 'masculina', 50, 1.3], ['vitaminaB6Mg', 'masculina', 51, 1.7],
      ['vitaminaDMcg', 'feminina', 70, 15], ['vitaminaDMcg', 'feminina', 71, 20]
    ] as const)('%s %s aos %i anos = %s', (codigo, populacaoReferencia, idadeAnos, valor) => {
      expect(referenciaDriAdulto(codigo, { populacaoReferencia, idadeAnos })?.valor).toBe(valor);
    });
    it('o UL tambem muda por faixa (fosforo 4000 aos 70, 3000 aos 71) e cada nutriente usa as proprias faixas', () => {
      expect(referenciaDriAdulto('fosforoMg', { populacaoReferencia: 'masculina', idadeAnos: 70 })?.ul).toMatchObject({ valor: 4000 });
      expect(referenciaDriAdulto('fosforoMg', { populacaoReferencia: 'masculina', idadeAnos: 71 })?.ul).toMatchObject({ valor: 3000 });
      expect(referenciaDriAdulto('calcioMg', { populacaoReferencia: 'feminina', idadeAnos: 50 })?.ul).toMatchObject({ valor: 2500 });
      expect(referenciaDriAdulto('calcioMg', { populacaoReferencia: 'feminina', idadeAnos: 51 })?.ul).toMatchObject({ valor: 2000 });
    });
  });

  it.each([
    [{ idadeAnos: 40 }], [{ populacaoReferencia: 'nao_informada', idadeAnos: 40 }],
    [{ populacaoReferencia: 'outra', idadeAnos: 40 }], [{ populacaoReferencia: 'feminina' }], [undefined], [null]
  ])('populacao nao confirmada ou contexto incompleto (%j) -> sem referencia', (contexto) => {
    expect(referenciaDriAdulto('calcioMg', contexto as never)).toBeUndefined();
  });

  it('codigo desconhecido ou de prototipo nao tem referencia', () => {
    for (const codigo of ['sodioMg', '__proto__', 'constructor', 'toString']) {
      expect(referenciaDriAdulto(codigo as CodigoMicronutriente, { populacaoReferencia: 'masculina', idadeAnos: 40 })).toBeUndefined();
    }
  });

  describe('versao, fonte e imutabilidade', () => {
    it('declara versao, autoridade, licenca e as paginas oficiais', () => {
      expect(VERSAO_REFERENCIAS_DRI_ADULTO).toBe('dri-hc-2025-11-19-adulto-v1');
      expect(FONTE_REFERENCIAS_DRI_ADULTO).toEqual({
        autoridade: 'Health Canada',
        modificadaEm: '2025-11-19',
        licenca: 'OGL-Canada',
        licencaId: 'ca-ogl-lgo',
        urls: [
          'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-elements.html',
          'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-vitamins.html'
        ],
        populacao: 'adultos_19_mais_sem_gestacao_lactacao'
      });
    });
    it('toda referencia carrega a versao e um id unico valido para o comparador', () => {
      const ids = new Set<string>();
      for (const linha of TABELA_REFERENCIAS_DRI_ADULTO) for (const populacaoReferencia of ['masculina', 'feminina'] as const) {
        for (const [idadeAnos] of IDADES_POR_FAIXA) {
          const ref = referenciaDriAdulto(linha.codigo, { populacaoReferencia, idadeAnos })!;
          expect(ref.versao).toBe(VERSAO_REFERENCIAS_DRI_ADULTO);
          // Mesmo padrao exigido por compararNutrientePlanejado (minusculas, sem "+").
          expect(ref.id).toMatch(/^[a-z0-9][a-z0-9_.:-]{0,99}$/);
          ids.add(ref.id);
        }
      }
      expect(ids.size).toBe(19 * 2 * 4);
    });
    it('a tabela e as referencias sao imutaveis em runtime', () => {
      expect(Object.isFrozen(TABELA_REFERENCIAS_DRI_ADULTO)).toBe(true);
      for (const linha of TABELA_REFERENCIAS_DRI_ADULTO) {
        expect(Object.isFrozen(linha)).toBe(true);
        expect(Object.isFrozen(linha.valores.masculina)).toBe(true);
        expect(Object.isFrozen(linha.ul)).toBe(true);
      }
      const ref = referenciaDriAdulto('calcioMg', { populacaoReferencia: 'feminina', idadeAnos: 40 })!;
      expect(Object.isFrozen(ref)).toBe(true);
      expect(Object.isFrozen(ref.ul)).toBe(true);
      expect(() => { (ref as { valor: number }).valor = 1; }).toThrow(TypeError);
      expect(referenciaDriAdulto('calcioMg', { populacaoReferencia: 'feminina', idadeAnos: 40 })!.valor).toBe(1000);
    });
    it('conteudo congelado por hash: mudar valor exige nova versao', () => {
      // Se este teste reprovar, NAO atualize so o hash: um valor mudou dentro da
      // mesma versao. Crie VERSAO nova (ex.: ...-adulto-v2), preserve a v1 para a
      // reproducao de registros antigos e so entao fixe o hash da nova versao.
      const hash = createHash('sha256').update(JSON.stringify(TABELA_REFERENCIAS_DRI_ADULTO)).digest('hex');
      expect({ versao: VERSAO_REFERENCIAS_DRI_ADULTO, hash }).toEqual({
        versao: 'dri-hc-2025-11-19-adulto-v1',
        hash: HASH_CONTEUDO_V1
      });
    });
  });

  describe('integracao com o comparador existente (regras ratificadas)', () => {
    const contexto = (tabagismo: ContextoComparacaoDietetica['tabagismo'] = 'nao'): ContextoComparacaoDietetica =>
      ({ elegivel: true, mesmoDiaPlanejado: true, tabagismo });
    const total = (codigo: CodigoMicronutriente, valor: number): ResultadoNutrienteCombinado => ({
      codigo, unidade: MICRONUTRIENTES[codigo].unidade, estado: 'completo', total: valor, itensIncluidos: 1, itensComValor: 1
    } as unknown as ResultadoNutrienteCombinado);
    const ref = (codigo: CodigoMicronutriente, populacaoReferencia: 'masculina' | 'feminina' = 'masculina', idadeAnos = 40) =>
      referenciaDriAdulto(codigo, { populacaoReferencia, idadeAnos });

    it('CL05: UL de magnesio, niacina, folato e vitamina A fica indisponivel para o total alimentar', () => {
      for (const codigo of ['magnesioMg', 'niacinaNeMg', 'folatoDfeMcg', 'vitaminaARaeMcg'] as const) {
        const resultado = compararNutrientePlanejado(total(codigo, 100), ref(codigo), contexto());
        expect(resultado.ul).toEqual({ estado: 'indisponivel', motivo: 'abrangencia_ul_incompativel' });
        expect(resultado.referencia.estado).toBe('comparavel');
      }
    });
    it('CL08: vitamina E sem comparacao (RDA exige formas 2R; UL de formas suplementares)', () => {
      const resultado = compararNutrientePlanejado(total('vitaminaEAlfaTocoferolMg', 10), ref('vitaminaEAlfaTocoferolMg'), contexto());
      expect(resultado.referencia).toEqual({ estado: 'indisponivel', motivo: 'definicao_incompativel' });
      expect(resultado.ul.estado).toBe('indisponivel');
    });
    it('UL nao estabelecido (potassio, tiamina, riboflavina, B12) e informado como tal, nunca como zero', () => {
      for (const codigo of ['potassioMg', 'tiaminaMg', 'riboflavinaMg', 'vitaminaB12Mcg'] as const) {
        expect(compararNutrientePlanejado(total(codigo, 1), ref(codigo), contexto()).ul)
          .toEqual({ estado: 'indisponivel', motivo: 'nao_estabelecido' });
      }
    });
    it('CL07: vitamina C soma 35 mg so na RDA e so com tabagismo confirmado; UL nao muda', () => {
      const fumante = compararNutrientePlanejado(total('vitaminaCMg', 125), ref('vitaminaCMg'), contexto('sim'));
      expect(fumante.referencia).toMatchObject({ estado: 'comparavel', valorReferencia: 125, percentual: 100, ajusteTabagismoMg: 35 });
      expect(fumante.ul).toMatchObject({ estado: 'comparavel', valorReferencia: 2000 });
      const naoFumante = compararNutrientePlanejado(total('vitaminaCMg', 90), ref('vitaminaCMg'), contexto('nao'));
      expect(naoFumante.referencia).toMatchObject({ estado: 'comparavel', valorReferencia: 90, percentual: 100 });
      expect(naoFumante.referencia).not.toHaveProperty('ajusteTabagismoMg');
      expect(compararNutrientePlanejado(total('vitaminaCMg', 90), ref('vitaminaCMg'), contexto('nao_informado')).referencia)
        .toEqual({ estado: 'indisponivel', motivo: 'tabagismo_nao_informado' });
      expect(ref('vitaminaCMg', 'feminina')!.valor).toBe(75);
    });
    it('cobre: referencia publicada em mcg compara com total PA06 em mg por conversao exata', () => {
      const resultado = compararNutrientePlanejado(total('cobreMg', 0.9), ref('cobreMg'), contexto());
      expect(resultado.referencia).toMatchObject({ estado: 'comparavel', valorReferencia: 900, unidadeReferencia: 'mcg', percentual: 100 });
      expect(resultado.ul).toMatchObject({ estado: 'comparavel', valorReferencia: 10000, unidadeReferencia: 'mcg' });
    });
    it('referencia de populacao/faixa errada nao e escolhida: feminina 51+ usa ferro 8, nao 18', () => {
      const resultado = compararNutrientePlanejado(total('ferroMg', 8), ref('ferroMg', 'feminina', 51), contexto());
      expect(resultado.referencia).toMatchObject({ estado: 'comparavel', valorReferencia: 8, percentual: 100 });
    });
  });
});

// Hash do conteudo da v1, fixado quando todas as celulas bateram com o quadro
// ratificado (e depois de um teste de mutacao provar que o oraculo reprova
// divergencia). Ver o teste "conteudo congelado por hash".
const HASH_CONTEUDO_V1 = '1c3e3b2bf61ba75025f2df637ab02ad242f8569f81e3656dba5aa721f6a65f53';

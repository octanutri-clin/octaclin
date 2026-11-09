import { identificarFonteCatalogo, MAPA_FONTES_CATALOGO, VERSAO_MAPA_FONTES_CATALOGO } from './fonte-catalogo';

/**
 * CONGELADO. A origem é derivada na leitura; mudar qualquer linha abaixo altera retroativamente análises já salvas.
 * Só é permitido ACRESCENTAR entradas (com decisão do proprietário, nova versão do mapa e novas linhas aqui).
 */
describe('mapa de fontes do catálogo é append-only', () => {
  const CONGELADO = {
    taco_nepa_unicamp: { baseCodigo: 'cmvcol_taco3', tipo: 'TACO' },
    usda_fdc_foundation: { baseCodigo: 'foundation-foods', tipo: 'USDA' },
    usda_fdc_sr_legacy: { baseCodigo: 'sr-legacy', tipo: 'USDA' },
    ibge_pof_2008_2009: { baseCodigo: 'pof-2008-2009-composicao', tipo: 'IBGE' }
  } as const;

  it('toda entrada congelada continua idêntica; entradas novas só podem ser acrescentadas', () => {
    for (const [codigo, valor] of Object.entries(CONGELADO)) expect(MAPA_FONTES_CATALOGO[codigo]).toEqual(valor);
  });
  it('o mapa só cresce com decisão explícita: o conjunto atual é exatamente o congelado', () => {
    // Ao acrescentar uma entrada, inclua-a em CONGELADO, suba a versão do mapa e atualize o corpus abaixo.
    expect(Object.keys(MAPA_FONTES_CATALOGO).sort()).toEqual(Object.keys(CONGELADO).sort());
    expect(VERSAO_MAPA_FONTES_CATALOGO).toBe('food06-fontes-v1');
  });
  it('o mapa não pode ser alterado em execução', () => {
    expect(Object.isFrozen(MAPA_FONTES_CATALOGO)).toBe(true);
    expect(() => { (MAPA_FONTES_CATALOGO as Record<string, unknown>).intruso = { baseCodigo: 'x', tipo: 'TACO' }; }).toThrow();
  });

  /** Corpus de snapshots de `fonte` como já existiram em registros históricos. Resultado esperado congelado. */
  const CORPUS: [string, unknown, unknown][] = [
    ['TACO governado atual', { codigo: 'taco_nepa_unicamp', baseCodigo: 'cmvcol_taco3', versao: 'taco-4a-cmvcol-taco3-v1' }, { tipo: 'TACO', codigo: 'taco_nepa_unicamp', versao: 'taco-4a-cmvcol-taco3-v1' }],
    ['TACO anterior à governança (sem baseCodigo)', { codigo: 'taco_nepa_unicamp', versao: 'taco-4a-cmvcol-taco3-v1' }, { tipo: 'TACO', codigo: 'taco_nepa_unicamp', versao: 'taco-4a-cmvcol-taco3-v1' }],
    ['USDA Foundation', { codigo: 'usda_fdc_foundation', baseCodigo: 'foundation-foods', versao: 'FoodData Central 2025-04-24' }, { tipo: 'USDA', codigo: 'usda_fdc_foundation', versao: 'FoodData Central 2025-04-24' }],
    ['USDA SR Legacy', { codigo: 'usda_fdc_sr_legacy', baseCodigo: 'sr-legacy', versao: '2018-04' }, { tipo: 'USDA', codigo: 'usda_fdc_sr_legacy', versao: '2018-04' }],
    ['IBGE POF', { codigo: 'ibge_pof_2008_2009', baseCodigo: 'pof-2008-2009-composicao', versao: 'pof-2008-2009-v1' }, { tipo: 'IBGE', codigo: 'ibge_pof_2008_2009', versao: 'pof-2008-2009-v1' }],
    ['sem versão', { codigo: 'taco_nepa_unicamp', baseCodigo: 'cmvcol_taco3' }, { tipo: 'TACO', codigo: 'taco_nepa_unicamp' }],
    ['versão inválida fica desconhecida', { codigo: 'taco_nepa_unicamp', baseCodigo: 'cmvcol_taco3', versao: '<b>x</b>' }, { tipo: 'TACO', codigo: 'taco_nepa_unicamp' }],
    ['base divergente do código', { codigo: 'taco_nepa_unicamp', baseCodigo: 'foundation-foods', versao: '1' }, undefined],
    ['código desconhecido', { codigo: 'outra_fonte', baseCodigo: 'cmvcol_taco3', versao: '1' }, undefined],
    ['só baseCodigo, sem código', { baseCodigo: 'cmvcol_taco3', versao: '1' }, undefined],
    ['identificação sintética antiga', { codigo: 'TACO', baseCodigo: 'principal', versao: '4' }, undefined],
    ['vazio', {}, undefined],
    ['nulo', null, undefined],
    ['lista', [], undefined]
  ];
  it.each(CORPUS)('corpus histórico congelado: %s', (_nome, entrada, esperado) => {
    expect(identificarFonteCatalogo(entrada)).toEqual(esperado);
  });
});

import {
  montarCatalogoIbgePof,
  normalizarNutrienteIbge
} from './importador-ibge-pof';
import { montarCatalogoUsda } from './importador-usda-fdc';
import { calcularHashConteudoCatalogo, validarCatalogoFonte, type RegistroCatalogoFonte } from './catalogo-composicao-fonte';

describe('importadores de fontes de composição', () => {
  it('preserva códigos de alimento e preparação, referência e nutrientes IBGE', () => {
    const catalogo = montarCatalogoIbgePof({
      versao: 'pof-2008-2009-v1',
      checksumArquivo: 'a'.repeat(64),
      capturadaEm: '2026-10-01',
      linhas: [
        {
          codigoAlimento: '6300701',
          nomeAlimento: 'MILHO (EM GRAO)',
          codigoPreparacao: '2',
          nomePreparacao: 'COZIDO(A)',
          referenciaCodigo: '1',
          referenciaDescricao: 'Fonte original de referência',
          nutrientes: {
            'ENERGIA (kcal)': 160.141,
            'PROTEÍNA (g)': 3.32,
            'LIPÍDEOS TOTAIS (g)': 7.178,
            'CARBOIDRATO (g)': 25.11,
            'FIBRA ALIMENTAR TOTAL (g)': 4.25,
            'SÓDIO (mg)': '-'
          }
        }
      ]
    });

    expect(catalogo.registros).toHaveLength(1);
    expect(catalogo.registros[0]).toMatchObject({
      externalId: '6300701:2',
      nome: 'MILHO (EM GRAO)',
      preparacao: 'COZIDO(A)',
      nutrientes: {
        energiaKcal: 160.141,
        proteinasG: 3.32,
        lipidiosG: 7.178,
        carboidratosG: 25.11,
        fibrasG: 4.25,
        sodioMg: null
      },
      metadadosOrigem: expect.objectContaining({
        codigoAlimento: '6300701',
        codigoPreparacao: '2',
        referenciaCodigo: '1',
        referenciaDescricao: 'Fonte original de referência',
        nutrientesOriginais: expect.objectContaining({ 'SÓDIO (mg)': '-' }),
        nutrientesNormalizados: expect.objectContaining({ 'SÓDIO (mg)': null })
      })
    });
  });

  it('mantém traço e ausências como null, zero como zero e rejeita negativos IBGE', () => {
    expect(normalizarNutrienteIbge('-')).toBeNull();
    expect(normalizarNutrienteIbge('')).toBeNull();
    expect(normalizarNutrienteIbge(0)).toBe(0);
    expect(() => normalizarNutrienteIbge(-1)).toThrow('negativo');
    expect(() => normalizarNutrienteIbge('valor')).toThrow('inválido');
  });

  it('mapeia USDA Foundation e mantém FDC ID, versão e nutrientes originais', () => {
    const catalogo = montarCatalogoUsda(
      {
        FoundationFoods: [
          {
            fdcId: 123456,
            dataType: 'Foundation',
            description: 'Corn, cooked',
            foodCategory: { description: 'Vegetables and Vegetable Products' },
            foodNutrients: [
              { nutrient: { id: 2047, name: 'Energy', unitName: 'kcal' }, amount: 99 },
              { nutrient: { id: 2048, name: 'Energy', unitName: 'kcal' }, amount: 100 },
              { nutrient: { id: 1003, name: 'Protein', unitName: 'g' }, amount: 3 },
              { nutrient: { id: 1004, name: 'Total lipid (fat)', unitName: 'g' }, amount: 2 },
              { nutrient: { id: 1005, name: 'Carbohydrate, by difference', unitName: 'g' }, amount: 20 },
              { nutrient: { id: 1079, name: 'Fiber, total dietary', unitName: 'g' }, amount: 4 },
              { nutrient: { id: 1093, name: 'Sodium, Na', unitName: 'mg' }, amount: 5 }
            ]
          }
        ]
      },
      { base: 'foundation-foods', versao: '2026-04', capturadaEm: '2026-10-01', checksumArquivo: 'b'.repeat(64) }
    );

    expect(catalogo.fonte.codigo).toBe('usda_fdc_foundation');
    expect(catalogo.fonte.versao).toBe('2026-04');
    expect(catalogo.registros[0]).toMatchObject({
      externalId: '123456',
      nome: 'Corn, cooked',
      nutrientes: {
        energiaKcal: 100,
        proteinasG: 3,
        lipidiosG: 2,
        carboidratosG: 20,
        fibrasG: 4,
        sodioMg: 5
      },
      metadadosOrigem: expect.objectContaining({
        dataType: 'Foundation',
        categoria: 'Vegetables and Vegetable Products',
        nutrientsOriginal: expect.arrayContaining([
          expect.objectContaining({ nutrient: expect.objectContaining({ id: 2047 }), amount: 99 }),
          expect.objectContaining({ nutrient: expect.objectContaining({ id: 2048 }), amount: 100 })
        ])
      })
    });
  });

  it('rejeita identidade e tipo USDA divergentes e conserva SR Legacy separada', () => {
    expect(() =>
      montarCatalogoUsda({ FoundationFoods: [{ fdcId: 1, dataType: 'SR Legacy', description: 'x', foodNutrients: [] }] }, {
        base: 'foundation-foods', versao: '2026-04', capturadaEm: '2026-10-01', checksumArquivo: 'b'.repeat(64)
      })
    ).toThrow('Tipo de dado');

    const sr = montarCatalogoUsda(
      {
        SRLegacyFoods: [
          {
            fdcId: 2,
            dataType: 'SR Legacy',
            description: 'Rice, cooked',
            foodNutrients: [
              { nutrient: { id: 1008, name: 'Energy', unitName: 'kcal' }, amount: 130 },
              { nutrient: { id: 1003, name: 'Protein', unitName: 'g' }, amount: 2.7 },
              { nutrient: { id: 1004, name: 'Total lipid (fat)', unitName: 'g' }, amount: 0.3 },
              { nutrient: { id: 1005, name: 'Carbohydrate, by difference', unitName: 'g' }, amount: 28 }
            ]
          }
        ]
      },
      { base: 'sr-legacy', versao: '2018-04', capturadaEm: '2026-10-01', checksumArquivo: 'c'.repeat(64) }
    );
    expect(sr.fonte.baseCodigo).toBe('sr-legacy');
    expect(sr.registros[0].nutrientes.energiaKcal).toBe(130);
  });

  it('rejeita alteração de conteúdo depois de calcular a identidade versionada', () => {
    const catalogo = montarCatalogoIbgePof({
      versao: 'pof-2008-2009-v1',
      checksumArquivo: 'a'.repeat(64),
      capturadaEm: '2026-10-01',
      linhas: [{
        codigoAlimento: '6300701',
        nomeAlimento: 'MILHO',
        codigoPreparacao: '2',
        nomePreparacao: 'COZIDO',
        referenciaCodigo: '1',
        referenciaDescricao: 'Referência',
        nutrientes: { 'ENERGIA (kcal)': 1 }
      }]
    });
    expect(() => validarCatalogoFonte(catalogo)).not.toThrow();
    catalogo.registros[0].nutrientes.energiaKcal = 2;
    expect(() => validarCatalogoFonte(catalogo)).toThrow('Hash do conteúdo normalizado não confere.');
  });

  it('preserva nutrientes USDA negativos na origem e impede que entrem no valor calculável', () => {
    const catalogo = montarCatalogoUsda({
      FoundationFoods: [{
        fdcId: 8,
        dataType: 'Foundation',
        description: 'Food with analytical negative carbohydrate',
        foodNutrients: [
          { nutrient: { id: 2048, name: 'Energy', unitName: 'kcal' }, amount: 20 },
          { nutrient: { id: 1003, name: 'Protein', unitName: 'g' }, amount: 1 },
          { nutrient: { id: 1004, name: 'Total lipid (fat)', unitName: 'g' }, amount: 1 },
          { nutrient: { id: 1005, name: 'Carbohydrate, by difference', unitName: 'g' }, amount: -0.2 }
        ]
      }]
    }, { base: 'foundation-foods', versao: '2026-04', capturadaEm: '2026-10-01', checksumArquivo: 'd'.repeat(64) });

    expect(catalogo.registros[0].nutrientes.carboidratosG).toBeNull();
    expect(catalogo.registros[0].metadadosOrigem.nutrientsOriginal).toEqual(expect.arrayContaining([
      expect.objectContaining({ amount: -0.2, nutrient: expect.objectContaining({ id: 1005 }) })
    ]));
    expect(catalogo.registros[0].metadadosOrigem.nutrientesNegativos).toEqual([
      expect.objectContaining({ nutrientId: 1005, amount: -0.2 })
    ]);
  });

  it('usa hash canônico independente da ordem das chaves JSONB e aceita fonte futura custom', () => {
    const registro: RegistroCatalogoFonte = {
      externalId: 'custom-1',
      nome: 'Alimento de teste',
      baseGramas: 100,
      nutrientes: {
        energiaKcal: 1, proteinasG: 1, carboidratosG: 1, lipidiosG: 1, fibrasG: null, sodioMg: null
      },
      metadadosOrigem: { referencia: { versao: 1, codigo: 'A' }, nota: 'teste' }
    };
    const reordenado = structuredClone(registro);
    reordenado.metadadosOrigem = { nota: 'teste', referencia: { codigo: 'A', versao: 1 } };
    expect(calcularHashConteudoCatalogo([registro])).toBe(calcularHashConteudoCatalogo([reordenado]));

    const catalogo = {
      fonte: {
        codigo: 'custom', nome: 'Fonte custom', instituicao: 'Clínica', versao: '1', baseCodigo: 'custom',
        urlFonte: 'https://example.invalid/source', urlArtefato: 'https://example.invalid/file', licenca: 'referência registrada',
        checksumArquivo: 'e'.repeat(64), hashConteudo: calcularHashConteudoCatalogo([registro]),
        capturadaEm: '2026-10-01T00:00:00.000Z', esquemaVersao: 'octaclin-composicao-v1', contagem: { registros: 1 }
      },
      registros: [registro]
    };
    expect(() => validarCatalogoFonte(catalogo)).not.toThrow();
  });

  it('rejeita dois códigos externos IBGE iguais na mesma fonte/preparação', () => {
    const linha: Parameters<typeof montarCatalogoIbgePof>[0]['linhas'][number] = {
      codigoAlimento: '6300701', nomeAlimento: 'MILHO', codigoPreparacao: '2', nomePreparacao: 'COZIDO',
      referenciaCodigo: '1', referenciaDescricao: 'Referência', nutrientes: {}
    };
    expect(() => montarCatalogoIbgePof({
      versao: 'pof-2008-2009-v1', checksumArquivo: 'f'.repeat(64), capturadaEm: '2026-10-01', linhas: [linha, linha]
    })).toThrow('Identificador IBGE duplicado: 6300701:2.');
  });
});

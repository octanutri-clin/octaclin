import { analisarFontesPorNutriente } from './fontes-por-nutriente';
import { analisarCoberturaDietetica } from './cobertura-dietetica';
import type { EntradaPlanoCombinado } from './calculo-combinado';
import { criarSnapshotMicronutrientes, CODIGOS_MICRONUTRIENTES } from './micronutrientes';

type Fonte = { codigo?: string; versao?: string; baseCodigo?: string; hashConteudo?: string; nome?: string };
const TACO: Fonte = { codigo: 'taco_nepa_unicamp', versao: '4.1', baseCodigo: 'cmvcol_taco3' };
const USDA_F: Fonte = { codigo: 'usda_fdc_foundation', versao: '2025.4', baseCodigo: 'foundation-foods' };
const USDA_S: Fonte = { codigo: 'usda_fdc_sr_legacy', versao: '2025.4', baseCodigo: 'sr-legacy' };
const IBGE: Fonte = { codigo: 'ibge_pof_2008_2009', versao: '2008.2009', baseCodigo: 'pof-2008-2009-composicao' };
/** Item sintético: calcio conhecido (ou ausente) com a origem informada. */
const item = (calcio: number | undefined, fonte?: Fonte, origem: string = 'catalogo') => ({
  origem, ...(fonte ? { fonte } : {}),
  micronutrientes: criarSnapshotMicronutrientes(calcio === undefined ? {} : { calcioMg: { estado: 'conhecido', valor: calcio } }, 100, 100)
});
const plano = (itens: unknown[], extra: Partial<EntradaPlanoCombinado['refeicoes'][number]> = {}): EntradaPlanoCombinado =>
  ({ planoId: 'plano-sintetico', ativo: true, selecionado: true, refeicoes: [{ identidadeId: 'ref-1', ativa: true, selecionada: true, itens, ...extra }] });
const calcio = (planos: EntradaPlanoCombinado[]) => analisarFontesPorNutriente(planos).nutrientes.calcioMg;

describe('FOOD06 M01 fontes factuais por nutriente', () => {
  it('FT01 uma fonte: origem registrada coerente com a cobertura', () => {
    const p = plano([item(10, TACO), item(5, TACO)]);
    expect(calcio([p])).toEqual({ contribuintes: 2, semOrigemDocumentada: 0, fontesNaoDetalhadas: 0,
      fontes: [{ tipo: 'TACO', codigo: 'taco_nepa_unicamp', versao: '4.1', quantidade: 2 }] });
    expect(analisarCoberturaDietetica([p]).nutrientes.calcioMg.contagens.conhecidos).toBe(2);
  });

  it('FT02 múltiplas fontes ficam separadas e em ordem determinística, inclusive subfontes USDA', () => {
    const p = plano([item(1, USDA_S), item(1, IBGE), item(1, TACO), item(1, USDA_F), item(1, USDA_F)]);
    const r = calcio([p]);
    expect(r.fontes).toEqual([
      { tipo: 'IBGE', codigo: 'ibge_pof_2008_2009', versao: '2008.2009', quantidade: 1 },
      { tipo: 'TACO', codigo: 'taco_nepa_unicamp', versao: '4.1', quantidade: 1 },
      { tipo: 'USDA', codigo: 'usda_fdc_foundation', versao: '2025.4', quantidade: 2 },
      { tipo: 'USDA', codigo: 'usda_fdc_sr_legacy', versao: '2025.4', quantidade: 1 }
    ]);
    expect(r.contribuintes).toBe(5);
    expect(JSON.stringify(calcio([plano([item(1, TACO), item(1, USDA_F)])])))
      .toBe(JSON.stringify(calcio([plano([item(1, USDA_F), item(1, TACO)])])));
  });

  it('FT03 parcial: só contribuintes conhecidos aparecem; o item sem valor não vira fonte', () => {
    const r = calcio([plano([item(10, TACO), item(undefined, USDA_F)])]);
    expect(r.contribuintes).toBe(1);
    expect(r.fontes).toEqual([{ tipo: 'TACO', codigo: 'taco_nepa_unicamp', versao: '4.1', quantidade: 1 }]);
  });

  it('FT04 zero conhecido continua sendo contribuinte', () => {
    const r = calcio([plano([item(0, TACO)])]);
    expect(r).toMatchObject({ contribuintes: 1, fontes: [{ tipo: 'TACO', quantidade: 1 }] });
  });

  it('FT05 ausência não vira fonte presumida nem zero', () => {
    const r = analisarFontesPorNutriente([plano([item(undefined, TACO), item(undefined, USDA_F)])]).nutrientes;
    for (const codigo of CODIGOS_MICRONUTRIENTES) expect(r[codigo]).toEqual({ contribuintes: 0, fontes: [], semOrigemDocumentada: 0, fontesNaoDetalhadas: 0 });
  });

  it('FT06 origem de outro nutriente não é atribuída: ferro desconhecido não lista a fonte do cálcio', () => {
    const r = analisarFontesPorNutriente([plano([item(10, TACO)])]);
    expect(r.vinculo).toBe('origem_do_registro_de_composicao');
    expect(r.nutrientes.calcioMg.fontes).toHaveLength(1);
    expect(r.nutrientes.ferroMg.fontes).toEqual([]);
  });

  it.each(['traco', 'nao_analisado', 'abaixo_loq', 'em_reavaliacao', 'duplicado', 'invalido', 'unidade_incompativel', 'definicao_incompativel'])(
    'FT11 estado %s não contribui como fonte', estado => {
      const ruim = item(undefined, USDA_F);
      ruim.micronutrientes.nutrientes.calcioMg = { estado: estado as never };
      const r = calcio([plano([item(5, TACO), ruim])]);
      expect(r.contribuintes).toBe(1);
      expect(r.fontes.map(f => f.tipo)).toEqual(['TACO']);
    });

  it('FT09/FT10 só refeições incluídas contam; repetição legítima em duas refeições conta duas vezes', () => {
    const repetido = item(3, TACO);
    const p: EntradaPlanoCombinado = { planoId: 'p', ativo: true, selecionado: true, refeicoes: [
      { identidadeId: 'a', ativa: true, selecionada: true, itens: [repetido] },
      { identidadeId: 'b', ativa: true, selecionada: true, itens: [repetido] },
      { identidadeId: 'c', ativa: false, selecionada: true, itens: [item(9, USDA_F)] },
      { identidadeId: 'd', ativa: true, selecionada: false, itens: [item(9, IBGE)] }
    ] };
    const r = calcio([p]);
    expect(r.fontes).toEqual([{ tipo: 'TACO', codigo: 'taco_nepa_unicamp', versao: '4.1', quantidade: 2 }]);
    expect(r.contribuintes).toBe(analisarCoberturaDietetica([p]).nutrientes.calcioMg.contagens.conhecidos);
  });

  it('plano desativado ou não selecionado não contribui', () => {
    expect(calcio([{ ...plano([item(1, TACO)]), ativo: false }]).contribuintes).toBe(0);
    expect(calcio([{ ...plano([item(1, TACO)]), selecionado: false }]).contribuintes).toBe(0);
  });

  it('FT12 legado e itens sem origem utilizável: conhecido sem fonte vai para semOrigemDocumentada, sem falhar', () => {
    const r = calcio([plano([{}, item(4), item(4, { baseCodigo: 'DESCONHECIDA', codigo: 'x', versao: '1' }), item(4, TACO), null])]);
    expect(r).toEqual({ contribuintes: 3, semOrigemDocumentada: 2, fontesNaoDetalhadas: 0,
      fontes: [{ tipo: 'TACO', codigo: 'taco_nepa_unicamp', versao: '4.1', quantidade: 1 }] });
  });

  it('código ausente ou malformado não identifica fonte; versão fora do formato fica desconhecida, sem preencher', () => {
    const r = calcio([plano([
      item(1, { baseCodigo: 'cmvcol_taco3', codigo: 'taco_nepa_unicamp', versao: 'versão com espaço' }),
      item(1, { baseCodigo: 'cmvcol_taco3' }),
      item(1, { baseCodigo: 'cmvcol_taco3', codigo: 'com espaço <script>', versao: '1' })
    ])]);
    expect(r.fontes).toEqual([{ tipo: 'TACO', codigo: 'taco_nepa_unicamp', quantidade: 1 }]);
    expect(r.semOrigemDocumentada).toBe(2);
  });

  it('FT18 manual e custom expõem somente o tipo, sem versão ou código fictícios', () => {
    const r = calcio([plano([item(2, { codigo: 'x', versao: '9.9', baseCodigo: 'TACO' }, 'manual'), item(2, { versao: '1.0' }, 'custom'), item(2, undefined, 'custom')])]);
    expect(r.fontes).toEqual([{ tipo: 'custom', quantidade: 2 }, { tipo: 'manual', quantidade: 1 }]);
    expect(r.semOrigemDocumentada).toBe(0);
  });

  it('FT19 limita grupos, mantém contagens reconciliadas e ordem determinística', () => {
    const itens = Array.from({ length: 60 }, (_, i) => item(1, { baseCodigo: 'foundation-foods', codigo: 'usda_fdc_foundation', versao: `2025.${i + 1}` }));
    const r = calcio([plano(itens)]);
    expect(r.fontes).toHaveLength(50);
    expect(r.fontesNaoDetalhadas).toBe(10);
    expect(r.fontes.reduce((n, f) => n + f.quantidade, 0) + r.semOrigemDocumentada + r.fontesNaoDetalhadas).toBe(r.contribuintes);
    const ordem = r.fontes.map(f => f.versao);
    expect(ordem).toEqual([...ordem].sort((a, b) => a!.localeCompare(b!, 'pt-BR', { numeric: true })));
  });

  it('canário: campos extras do snapshot não vazam (hash, nome livre, descrição, extras na raiz)', () => {
    const sujo = { ...item(1, { ...TACO, hashConteudo: 'a'.repeat(64), nome: 'Nome livre sensível' }), descricao: 'Texto livre do paciente', extra: { x: 1 } };
    const r = analisarFontesPorNutriente([plano([sujo])]);
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/hash|aaaaaaaa|Nome livre|Texto livre|extra|descricao|nome/i);
    expect(Object.keys(r).sort()).toEqual(['nutrientes', 'schemaVersao', 'vinculo']);
    expect(Object.keys(r.nutrientes.calcioMg).sort()).toEqual(['contribuintes', 'fontes', 'fontesNaoDetalhadas', 'semOrigemDocumentada']);
    expect(Object.keys(r.nutrientes.calcioMg.fontes[0]!).sort()).toEqual(['codigo', 'quantidade', 'tipo', 'versao']);
  });

  it('reconcilia com a cobertura em todos os nutrientes e não altera a entrada', () => {
    const rico = item(1, TACO);
    rico.micronutrientes.nutrientes.ferroMg = { estado: 'conhecido', valorOrigem: 2, por100g: 2, porcao: 2 } as never;
    const p = plano([rico, item(0, USDA_F), item(undefined, IBGE), item(3, undefined, 'manual'), {}]);
    const antes = JSON.stringify(p);
    const fontes = analisarFontesPorNutriente([p]);
    const cobertura = analisarCoberturaDietetica([p]);
    for (const codigo of CODIGOS_MICRONUTRIENTES) {
      const f = fontes.nutrientes[codigo];
      expect(f.contribuintes).toBe(cobertura.nutrientes[codigo].contagens.conhecidos);
      expect(f.fontes.reduce((n, x) => n + x.quantidade, 0) + f.semOrigemDocumentada + f.fontesNaoDetalhadas).toBe(f.contribuintes);
    }
    expect(JSON.stringify(p)).toBe(antes);
  });

  it('FT07 derivado só do snapshot recebido: alterar o objeto de entrada altera o resultado, sem catálogo externo', () => {
    const p = plano([item(1, TACO)]);
    expect(calcio([p]).fontes[0]!.versao).toBe('4.1');
    const alterado = plano([item(1, { ...TACO, versao: '5.0' })]);
    expect(calcio([alterado]).fontes[0]!.versao).toBe('5.0');
    expect(calcio([p]).fontes[0]!.versao).toBe('4.1');
  });

  it('FT08 receita já porcionada: quantidade, rendimento e fator no snapshot não alteram a contagem nem a origem', () => {
    const receita = { ...item(7, TACO), quantidade: '1.5', unidade: 'porcao', fatorRendimento: 0.4, rendimento: { fator: 3 }, porcaoRegistroGramas: ['150', '1'] };
    const simples = item(7, TACO);
    expect(calcio([plano([receita])])).toEqual(calcio([plano([simples])]));
    expect(calcio([plano([receita])]).fontes).toEqual([{ tipo: 'TACO', codigo: 'taco_nepa_unicamp', versao: '4.1', quantidade: 1 }]);
    expect(JSON.stringify(calcio([plano([receita])]))).not.toMatch(/fator|rendimento|quantidade":1\.5/);
  });

  it('FT09 só o que o seletor entrega contribui: a alternativa não escolhida, fora da seleção, não aparece; a escolhida substitui a principal', () => {
    const principal = item(5, TACO), alternativa = item(5, USDA_F);
    const comPrincipal = calcio([plano([principal])]);
    const comAlternativa = calcio([plano([alternativa])]);
    expect(comPrincipal.fontes.map(f => f.tipo)).toEqual(['TACO']);
    expect(comAlternativa.fontes.map(f => f.tipo)).toEqual(['USDA']);
    expect(comAlternativa.contribuintes).toBe(1);
    // Principal e alternativa excludentes em refeições não selecionadas distintas não somam.
    const p: EntradaPlanoCombinado = { planoId: 'p', ativo: true, selecionado: true, refeicoes: [
      { identidadeId: 'a', ativa: true, selecionada: true, itens: [principal] },
      { identidadeId: 'b', ativa: true, selecionada: false, itens: [alternativa] }
    ] };
    expect(calcio([p])).toEqual(comPrincipal);
  });

  describe('R4C2-01 fontes reais de produção (par codigo/baseCodigo e versões livres do catálogo)', () => {
    const REAIS = {
      taco: { codigo: 'taco_nepa_unicamp', baseCodigo: 'cmvcol_taco3', versao: 'taco-4a-cmvcol-taco3-v1' },
      foundation: { codigo: 'usda_fdc_foundation', baseCodigo: 'foundation-foods', versao: '2025-10-30' },
      legacy: { codigo: 'usda_fdc_sr_legacy', baseCodigo: 'sr-legacy', versao: 'sr-legacy-2018' },
      pof: { codigo: 'ibge_pof_2008_2009', baseCodigo: 'pof-2008-2009-composicao', versao: 'pof-2008-2009-v1' }
    };
    it('reconhece as quatro fontes reais e preserva a versão registrada', () => {
      const r = calcio([plano([item(1, REAIS.taco), item(1, REAIS.foundation), item(1, REAIS.legacy), item(1, REAIS.pof)])]);
      expect(r.semOrigemDocumentada).toBe(0);
      expect(r.fontes).toEqual([
        { tipo: 'IBGE', codigo: 'ibge_pof_2008_2009', versao: 'pof-2008-2009-v1', quantidade: 1 },
        { tipo: 'TACO', codigo: 'taco_nepa_unicamp', versao: 'taco-4a-cmvcol-taco3-v1', quantidade: 1 },
        { tipo: 'USDA', codigo: 'usda_fdc_foundation', versao: '2025-10-30', quantidade: 1 },
        { tipo: 'USDA', codigo: 'usda_fdc_sr_legacy', versao: 'sr-legacy-2018', quantidade: 1 }
      ]);
    });
    it('par incoerente, código desconhecido e identificação sintética antiga não viram origem oficial', () => {
      const r = calcio([plano([
        item(1, { ...REAIS.taco, baseCodigo: 'foundation-foods' }),
        item(1, { codigo: 'fonte_desconhecida', baseCodigo: 'cmvcol_taco3', versao: '1' }),
        item(1, { baseCodigo: 'cmvcol_taco3', versao: '1' }),
        item(1, { codigo: 'taco_nepa_unicamp', baseCodigo: 'TACO', versao: '4.1' })
      ])]);
      expect(r).toEqual({ contribuintes: 4, fontes: [], semOrigemDocumentada: 4, fontesNaoDetalhadas: 0 });
    });
    it('versão com espaço, símbolo ou acima de 64 caracteres fica desconhecida, sem expor texto livre', () => {
      const r = calcio([plano([item(1, { ...REAIS.taco, versao: 'CANARIO com espaço' }), item(1, { ...REAIS.taco, versao: 'a'.repeat(65) }), item(1, { ...REAIS.taco, versao: '<b>x</b>' })])]);
      expect(r.fontes).toEqual([{ tipo: 'TACO', codigo: 'taco_nepa_unicamp', quantidade: 3 }]);
      expect(JSON.stringify(r)).not.toMatch(/CANARIO|<b>/);
    });
  });
});

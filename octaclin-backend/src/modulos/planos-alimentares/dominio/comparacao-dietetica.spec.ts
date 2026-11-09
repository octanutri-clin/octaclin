import { compararNutrientePlanejado, ReferenciaDieteticaCalculo, ContextoComparacaoDietetica } from './comparacao-dietetica';
import type { ResultadoNutrienteCombinado } from './calculo-combinado';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Todos os números são fixtures de aritmética, não tabelas DRI ou dados de pacientes.
const contexto = (): ContextoComparacaoDietetica => ({ elegivel: true, mesmoDiaPlanejado: true, tabagismo: 'nao' });
const total = (valor = 7): ResultadoNutrienteCombinado => ({ codigo: 'calcioMg', unidade: 'mg', estado: 'completo', total: valor, itensComValor: 2, itensIncluidos: 2 });
const ref = (): ReferenciaDieteticaCalculo => ({ id: 'fixture-sintetica', versao: 'teste-1', codigo: 'calcioMg', tipo: 'RDA', valor: 4, unidade: 'mg', ul: { estado: 'definido', valor: 10, unidade: 'mg', abrangencia: 'total' } });
const oraculo: { casos: { total: string; referencia: string; percentual: string }[] } = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../../research/food06/oraculo-fracoes-sinteticas.json'), 'utf8'));

describe('FOOD06 núcleo isolado com referências sintéticas', () => {
  it.each(oraculo.casos)('confronta oráculo Python Decimal: $total / $referencia', caso => {
    expect(compararNutrientePlanejado(total(Number(caso.total)), { ...ref(), valor: Number(caso.referencia) }, contexto()).referencia)
      .toMatchObject({ estado: 'comparavel', percentual: Number(caso.percentual) });
  });
  it('compara RDA e UL separadamente sem rótulos diagnósticos', () => {
    const r = compararNutrientePlanejado(total(), ref(), contexto());
    expect(r.referencia).toEqual({ estado: 'comparavel', tipo: 'RDA', referenciaId: 'fixture-sintetica', referenciaVersao: 'teste-1', quantidadePlanejada: 7, unidadePlanejada: 'mg', valorReferencia: 4, unidadeReferencia: 'mg', percentual: 175, diferencaNaUnidadePlanejada: 3, diferencaArredondada: false });
    expect(r.ul).toMatchObject({ estado: 'comparavel', tipo: 'UL', percentual: 70, diferencaNaUnidadePlanejada: -3 });
    expect(JSON.stringify(r)).not.toMatch(/deficiente|toxico|adequado|seguro/i);
  });
  it('mantém AI distinto e aceita zero conhecido', () => {
    const r = compararNutrientePlanejado(total(0), { ...ref(), tipo: 'AI' }, contexto());
    expect(r.referencia).toMatchObject({ estado: 'comparavel', tipo: 'AI', percentual: 0, diferencaNaUnidadePlanejada: -4 });
  });
  it('oráculo racional sintético 1/3 preserva escala8 sem usar número exibido', () => {
    expect(compararNutrientePlanejado(total(1), { ...ref(), valor: 3 }, contexto()).referencia).toMatchObject({ percentual: 33.33333333 });
    expect(compararNutrientePlanejado(total(0.1), { ...ref(), valor: 0.3 }, contexto()).referencia).toMatchObject({ percentual: 33.33333333 });
  });
  it.each([0.1, 0.125, 0.5, 1, 2.5, 5, 10])('escala ambos os lados sem mudar percentual (%s)', fator => {
    expect(compararNutrientePlanejado(total(7 * fator), { ...ref(), valor: 4 * fator }, contexto()).referencia).toMatchObject({ percentual: 175 });
  });
  it('converte mg/mcg dimensionalmente sem alterar fontes nem porções', () => {
    const t = { ...total(0.9), codigo: 'cobreMg' as const };
    const fonte = { ...ref(), codigo: 'cobreMg' as const, valor: 900, unidade: 'mcg' as const };
    const original = JSON.stringify({ t, fonte });
    expect(compararNutrientePlanejado(t, fonte, contexto()).referencia).toMatchObject({ percentual: 100, diferencaNaUnidadePlanejada: 0 });
    expect(JSON.stringify({ t, fonte })).toBe(original);
    expect(compararNutrientePlanejado({ ...total(1000), codigo: 'selenioMcg', unidade: 'mcg' }, { ...ref(), codigo: 'selenioMcg', valor: 1, unidade: 'mg' }, contexto()).referencia).toMatchObject({ percentual: 100 });
  });
  it.each(['RE', undefined] as const)('não trata qualificador %s como RAE', qualificador => {
    expect(compararNutrientePlanejado({ ...total(), codigo: 'vitaminaARaeMcg', unidade: 'mcg' }, { ...ref(), codigo: 'vitaminaARaeMcg', unidade: 'mcg', qualificador }, contexto()).referencia).toEqual({ estado: 'indisponivel', motivo: 'definicao_incompativel' });
  });
  it.each(['retinolMcg', 'vitaminaAReMcg', 'niacinaMg', 'vitaminaEAlfaTocoferolMg'] as const)('não inventa compatibilidade para %s', codigo => {
    expect(compararNutrientePlanejado({ ...total(), codigo }, { ...ref(), codigo }, contexto()).referencia.estado).toBe('indisponivel');
  });
  it.each(['magnesioMg', 'vitaminaARaeMcg', 'niacinaNeMg', 'folatoDfeMcg'] as const)('UL restrito de %s não se torna total por metadado adulterado', codigo => {
    const q: ReferenciaDieteticaCalculo['qualificador'] = codigo === 'vitaminaARaeMcg' ? 'RAE' : codigo === 'niacinaNeMg' ? 'NE' : codigo === 'folatoDfeMcg' ? 'DFE' : undefined;
    const unidade = codigo.endsWith('Mcg') ? 'mcg' as const : 'mg' as const;
    const f = { ...ref(), codigo, qualificador: q, unidade };
    const r = compararNutrientePlanejado({ ...total(), codigo, unidade }, f, contexto());
    expect(r.referencia.estado).toBe('comparavel');
    expect(r.ul).toEqual({ estado: 'indisponivel', motivo: 'abrangencia_ul_incompativel' });
  });
  it('mantém UL restrito indisponível mesmo quando referência reconhece sua origem', () => {
    expect(compararNutrientePlanejado(total(), { ...ref(), ul: { estado: 'definido', valor: 10, unidade: 'mg', abrangencia: 'suplementar' } }, contexto()).ul).toEqual({ estado: 'indisponivel', motivo: 'abrangencia_ul_incompativel' });
  });
  it('não confunde UL não estabelecido com metadado ausente', () => {
    expect(compararNutrientePlanejado(total(), { ...ref(), ul: { estado: 'nao_estabelecido' } }, contexto()).ul).toEqual({ estado: 'indisponivel', motivo: 'nao_estabelecido' });
    expect(compararNutrientePlanejado(total(), { ...ref(), ul: undefined }, contexto()).ul).toEqual({ estado: 'indisponivel', motivo: 'referencia_indisponivel' });
  });
  it.each(['parcial', 'indisponivel'] as const)('cobertura %s não gera percentual nem usa subtotal como total', estado => {
    const r = compararNutrientePlanejado({ ...total(), estado, quantidadeConhecida: 7 }, ref(), contexto());
    expect(r.referencia).toEqual({ estado: 'indisponivel', motivo: 'dados_incompletos' });
    expect(r.ul.estado).toBe('indisponivel');
  });
  it('cobertura completa inconsistente não gera percentual', () => {
    expect(compararNutrientePlanejado({ ...total(), itensComValor: 1 }, ref(), contexto()).referencia.estado).toBe('indisponivel');
    expect(compararNutrientePlanejado({ ...total(), itensIncluidos: 0, itensComValor: 0 }, ref(), contexto()).referencia.estado).toBe('indisponivel');
  });
  it.each([-1, NaN, Infinity, undefined])('rejeita total %s sem serializar resultado inválido', valor => {
    const r = compararNutrientePlanejado({ ...total(), total: valor }, ref(), contexto());
    expect(r.referencia.estado).toBe('indisponivel');
    expect(JSON.stringify(r)).not.toMatch(/NaN|Infinity/);
  });
  it.each([0, -1, NaN, Infinity])('referência %s inválida não invalida UL independente', valor => {
    const r = compararNutrientePlanejado(total(), { ...ref(), valor }, contexto());
    expect(r.referencia.estado).toBe('indisponivel');
    expect(r.ul).toMatchObject({ estado: 'comparavel', percentual: 70 });
  });
  it('não compara sem referência, com código errado ou unidade inválida', () => {
    expect(compararNutrientePlanejado(total(), undefined, contexto()).referencia.estado).toBe('indisponivel');
    expect(compararNutrientePlanejado(total(), { ...ref(), codigo: 'ferroMg' }, contexto()).referencia.estado).toBe('indisponivel');
    expect(compararNutrientePlanejado({ ...total(), unidade: 'g' }, ref(), contexto()).referencia.estado).toBe('indisponivel');
  });
  it('não compara antes de confirmar o dia e elegibilidade', () => {
    expect(compararNutrientePlanejado(total(), ref(), { ...contexto(), mesmoDiaPlanejado: false }).referencia).toEqual({ estado: 'indisponivel', motivo: 'dia_nao_confirmado' });
    expect(compararNutrientePlanejado(total(), ref(), { ...contexto(), elegivel: false }).referencia).toEqual({ estado: 'indisponivel', motivo: 'contexto_nao_elegivel' });
  });
  it('tabagismo confirmado soma 35 mg só à RDA C; UL e fonte permanecem intactos', () => {
    const t = { ...total(80), codigo: 'vitaminaCMg' as const };
    const f = { ...ref(), codigo: 'vitaminaCMg' as const, valor: 5, ul: { estado: 'definido' as const, valor: 100, unidade: 'mg' as const, abrangencia: 'total' as const } };
    const r = compararNutrientePlanejado(t, f, { ...contexto(), tabagismo: 'sim' });
    expect(r.referencia).toMatchObject({ valorReferencia: 40, percentual: 200, ajusteTabagismoMg: 35 });
    expect(r.ul).toMatchObject({ valorReferencia: 100, percentual: 80 });
    expect(f.valor).toBe(5);
    expect(compararNutrientePlanejado(t, f, contexto()).referencia).toMatchObject({ valorReferencia: 5 });
  });
  it('tabagismo não informado impede apenas a comparação RDA de vitamina C', () => {
    const r = compararNutrientePlanejado({ ...total(), codigo: 'vitaminaCMg' }, { ...ref(), codigo: 'vitaminaCMg' }, { ...contexto(), tabagismo: 'nao_informado' });
    expect(r.referencia).toEqual({ estado: 'indisponivel', motivo: 'tabagismo_nao_informado' });
    expect(r.ul.estado).toBe('comparavel');
    expect(compararNutrientePlanejado(total(), ref(), { ...contexto(), tabagismo: 'sim' }).referencia).toMatchObject({ valorReferencia: 4 });
  });
  it('a regra de 35 mg não é aplicada a uma AI sintética', () => {
    const r = compararNutrientePlanejado({ ...total(10), codigo: 'vitaminaCMg' },
      { ...ref(), codigo: 'vitaminaCMg', tipo: 'AI', valor: 5 }, { ...contexto(), tabagismo: 'sim' });
    expect(r.referencia).toMatchObject({ tipo: 'AI', valorReferencia: 5, percentual: 200 });
    expect(r.referencia).not.toHaveProperty('ajusteTabagismoMg');
  });
  it('converte o ajuste de 35 mg quando a referência sintética está em mcg', () => {
    expect(compararNutrientePlanejado({ ...total(80), codigo: 'vitaminaCMg' },
      { ...ref(), codigo: 'vitaminaCMg', valor: 5000, unidade: 'mcg' },
      { ...contexto(), tabagismo: 'sim' }).referencia).toMatchObject({ valorReferencia: 40000, percentual: 200 });
  });
  it('rejeita metadados/códigos manipulados sem projetar conteúdo livre', () => {
    expect(compararNutrientePlanejado(total(), { ...ref(), id: 'conteúdo clínico livre' }, contexto()).referencia.estado).toBe('indisponivel');
    expect(compararNutrientePlanejado({ ...total(), codigo: '__proto__' } as never, ref(), contexto()).referencia.estado).toBe('indisponivel');
    expect(compararNutrientePlanejado(total(), { ...ref(), ul: { estado: 'definido', valor: 10, unidade: 'mg', qualificador: 'NE', abrangencia: 'total' } }, contexto()).ul).toEqual({ estado: 'indisponivel', motivo: 'definicao_incompativel' });
  });
  it('overflow é indisponibilidade explícita', () => {
    expect(compararNutrientePlanejado(total(90_071_992), { ...ref(), valor: 0.00000001 }, contexto()).referencia).toEqual({ estado: 'indisponivel', motivo: 'limite_precisao' });
  });
  it.each([[1, 3.0000000049, 33.33333328], [0.00000001, 0.0000000149, 67.11409396]])(
    'não arredonda referência antes da divisão: %s / %s', (valor, referencia, esperado) => {
      const r = compararNutrientePlanejado(total(valor), { ...ref(), valor: referencia }, contexto()).referencia;
      expect(r).toMatchObject({ estado: 'comparavel', percentual: esperado, valorReferencia: referencia });
    });
  it('preserva também a precisão da referência UL', () => {
    expect(compararNutrientePlanejado(total(1), { ...ref(), ul: { estado: 'definido', valor: 3.0000000049, unidade: 'mg', abrangencia: 'total' } }, contexto()).ul)
      .toMatchObject({ percentual: 33.33333328, valorReferencia: 3.0000000049 });
  });
  it('informa quando a diferença de saída foi arredondada, inclusive para zero', () => {
    expect(compararNutrientePlanejado(total(0.00000001), { ...ref(), valor: 0.0000000149 }, contexto()).referencia)
      .toMatchObject({ diferencaNaUnidadePlanejada: 0, diferencaArredondada: true });
  });
  it('arredonda empate half-up somente na saída', () => {
    expect(compararNutrientePlanejado(total(1), { ...ref(), valor: 51200 }, contexto()).referencia)
      .toMatchObject({ percentual: 0.00195313 });
  });
  it.each([[2, 133.33333333, 0.5], [1, 66.66666667, -0.5]])('confere percentual e sinal em conversão: %s mg / 1500 mcg', (valor, percentual, diferenca) => {
    expect(compararNutrientePlanejado({ ...total(valor), codigo: 'cobreMg' }, { ...ref(), codigo: 'cobreMg', valor: 1500, unidade: 'mcg' }, contexto()).referencia)
      .toMatchObject({ percentual, diferencaNaUnidadePlanejada: diferenca });
  });
  it('unidade inválida de uma referência não bloqueia o resultado independente', () => {
    const r = compararNutrientePlanejado(total(), { ...ref(), unidade: 'g' as never }, contexto());
    expect(r.referencia).toEqual({ estado: 'indisponivel', motivo: 'unidade_incompativel' });
    expect(r.ul.estado).toBe('comparavel');
    const s = compararNutrientePlanejado(total(), { ...ref(), ul: { estado: 'definido', valor: 10, unidade: 'g' as never, abrangencia: 'total' } }, contexto());
    expect(s.referencia.estado).toBe('comparavel');
    expect(s.ul).toEqual({ estado: 'indisponivel', motivo: 'unidade_incompativel' });
  });
  it('projeta apenas resultados, sem carregar campos livres ou metadados arbitrários', () => {
    const f = { ...ref(), observacaoPrivada: 'canario-sintetico' };
    expect(JSON.stringify(compararNutrientePlanejado(total(), f, contexto()))).not.toContain('canario-sintetico');
  });
});

import { dataIsoNoTimezoneClinico } from '../../../infraestrutura/tempo/timezone-clinico';
import { resolverContextoDietetico, type EntradaContextoDietetico } from './contexto-dietetico';
import { compararNutrientePlanejado, type ReferenciaDieteticaCalculo } from './comparacao-dietetica';
const entrada = (delta: Partial<EntradaContextoDietetico> = {}): EntradaContextoDietetico => ({
  nascimento: '1990-06-15', dataAnalise: '2026-10-31', populacaoReferencia: 'feminina', populacaoConfirmada: true,
  gestacao: 'nao', lactacao: 'nao', aplicabilidade: 'confirmada', mesmoDiaPlanejado: true, tabagismo: 'nao', ...delta
});
// Referência exclusivamente sintética, não é valor clínico ou validação científica.
const referencia: ReferenciaDieteticaCalculo = { id: 'sintetica-c', versao: 'teste-1', codigo: 'vitaminaCMg', tipo: 'RDA', valor: 100, unidade: 'mg', ul: { estado: 'definido', valor: 1000, unidade: 'mg', abrangencia: 'total' } };
const resultado = { codigo: 'vitaminaCMg', unidade: 'mg', estado: 'completo', total: 135, itensComValor: 1, itensIncluidos: 1 } as const;
describe('FOOD06 contexto confirmado sem inferência clínica', () => {
  it('resolve contexto elegível, sem retornar nascimento ou campos arbitrários', () => {
    const dados = { ...entrada(), prontuario: 'canario-contexto-sintetico' };
    const antes = JSON.stringify(dados);
    expect(resolverContextoDietetico(dados)).toEqual({ contexto: { elegivel: true, mesmoDiaPlanejado: true, tabagismo: 'nao' }, motivos: [], idadeAnos: 36, populacaoReferencia: 'feminina' });
    expect(JSON.stringify(dados)).toBe(antes);
    expect(JSON.stringify(resolverContextoDietetico(dados))).not.toContain('1990-06-15');
    expect(JSON.stringify(resolverContextoDietetico(dados))).not.toContain('canario-contexto-sintetico');
  });
  it.each([
    ['2007-11-01', '2026-10-31', 18, false], ['2007-10-31', '2026-10-31', 19, true],
    ['1996-11-01', '2026-10-31', 29, true], ['1995-11-01', '2026-10-31', 30, true], ['1995-10-31', '2026-10-31', 31, true],
    ['1976-11-01', '2026-10-31', 49, true], ['1975-11-01', '2026-10-31', 50, true], ['1975-10-31', '2026-10-31', 51, true],
    ['1956-11-01', '2026-10-31', 69, true], ['1955-11-01', '2026-10-31', 70, true], ['1955-10-31', '2026-10-31', 71, true],
    ['2008-02-29', '2027-02-28', 18, false], ['2008-02-29', '2027-03-01', 19, true]
  ])('anos completos para %s em %s, sem atribuir faixa universal', (nascimento, dataAnalise, idadeAnos, elegivel) => {
    const r = resolverContextoDietetico(entrada({ nascimento: String(nascimento), dataAnalise: String(dataAnalise) }));
    expect(r.idadeAnos).toBe(idadeAnos);
    expect(r.contexto.elegivel).toBe(elegivel);
    expect(r.motivos).toEqual(elegivel ? [] : ['idade_fora_do_escopo']);
  });
  it.each(['2026-02-30', '0000-01-01', '2000-13-01', '1990-01-01T00:00:00Z', '', 'texto'])('rejeita nascimento inválido %s', nascimento => {
    expect(resolverContextoDietetico(entrada({ nascimento }))).toMatchObject({ contexto: { elegivel: false }, motivos: ['data_invalida'] });
  });
  it.each([
    ['America/Sao_Paulo', '2026-10-31T02:59:59Z', false], ['America/Sao_Paulo', '2026-10-31T03:00:00Z', true],
    ['America/Rio_Branco', '2026-10-31T04:59:59Z', false], ['America/Rio_Branco', '2026-10-31T05:00:00Z', true],
    ['Asia/Tokyo', '2026-10-30T14:59:59Z', false], ['Asia/Tokyo', '2026-10-30T15:00:00Z', true],
    ['Pacific/Kiritimati', '2026-10-30T09:59:59Z', false], ['Pacific/Kiritimati', '2026-10-30T10:00:00Z', true]
  ] as const)('fronteira de 19 anos no fuso clínico %s em %s', (timezone, instante, elegivel) => {
    jest.useFakeTimers().setSystemTime(new Date(instante));
    try {
      const dataAnalise = dataIsoNoTimezoneClinico(timezone);
      const r = resolverContextoDietetico(entrada({ nascimento: '2007-10-31', dataAnalise }));
      expect(r.contexto.elegivel).toBe(elegivel);
      expect(r.idadeAnos).toBe(elegivel ? 19 : 18);
    } finally { jest.useRealTimers(); }
  });
  it('diferencia ausência, futuro e data de análise inválida', () => {
    expect(resolverContextoDietetico(entrada({ nascimento: undefined })).motivos).toEqual(['nascimento_nao_informado']);
    expect(resolverContextoDietetico(entrada({ nascimento: '2026-11-01' })).motivos).toEqual(['nascimento_futuro']);
    expect(resolverContextoDietetico(entrada({ dataAnalise: '2026-02-30' })).motivos).toEqual(['data_invalida']);
  });
  it.each([
    [{ populacaoReferencia: 'nao_informada' }, 'populacao_nao_confirmada'],
    [{ populacaoConfirmada: false }, 'populacao_nao_confirmada'],
    [{ gestacao: 'sim' }, 'gestacao_fora_do_escopo'], [{ lactacao: 'sim' }, 'lactacao_fora_do_escopo'],
    [{ gestacao: 'nao_informada' }, 'fisiologia_nao_confirmada'], [{ lactacao: 'nao_informada' }, 'fisiologia_nao_confirmada'],
    [{ aplicabilidade: 'nao_informada' }, 'aplicabilidade_nao_confirmada'], [{ aplicabilidade: 'nao_aplicavel' }, 'aplicabilidade_nao_confirmada']
  ] as const)('não infere contexto incompleto %o', (delta, motivo) => {
    const r = resolverContextoDietetico(entrada(delta));
    expect(r.contexto.elegivel).toBe(false);
    expect(r.motivos).toEqual([motivo]);
  });
  it('acumula causas sem duplicar a fisiologia desconhecida', () => {
    expect(resolverContextoDietetico(entrada({ populacaoConfirmada: false, gestacao: 'nao_informada', lactacao: 'nao_informada' })).motivos).toEqual(['populacao_nao_confirmada', 'fisiologia_nao_confirmada']);
  });
  it('sem confirmação diária bloqueia comparação mas conserva elegibilidade populacional', () => {
    const r = resolverContextoDietetico(entrada({ mesmoDiaPlanejado: false }));
    expect(r.contexto.elegivel).toBe(true);
    expect(compararNutrientePlanejado(resultado, referencia, r.contexto)).toEqual({ referencia: { estado: 'indisponivel', motivo: 'dia_nao_confirmado' }, ul: { estado: 'indisponivel', motivo: 'dia_nao_confirmado' } });
  });
  it('tabagismo desconhecido bloqueia apenas a RDA C, não UL ou população', () => {
    const r = resolverContextoDietetico(entrada({ tabagismo: 'nao_informado' }));
    expect(r.contexto.elegivel).toBe(true);
    const comparacao = compararNutrientePlanejado(resultado, referencia, r.contexto);
    expect(comparacao.referencia).toEqual({ estado: 'indisponivel', motivo: 'tabagismo_nao_informado' });
    expect(comparacao.ul).toMatchObject({ estado: 'comparavel', percentual: 13.5 });
  });
  it('tabagismo confirmado é conservado para ajuste somente da RDA C', () => {
    const r = resolverContextoDietetico(entrada({ tabagismo: 'sim' }));
    const comparacao = compararNutrientePlanejado(resultado, referencia, r.contexto);
    expect(comparacao.referencia).toMatchObject({ estado: 'comparavel', valorReferencia: 135, percentual: 100 });
    expect(comparacao.ul).toMatchObject({ estado: 'comparavel', valorReferencia: 1000 });
  });
  it.each([{ populacaoConfirmada: 'true' }, { mesmoDiaPlanejado: 'false' }, { tabagismo: 'desconhecido' }, { gestacao: false }, { nascimento: 1990 }, { dataAnalise: null }])('falha fechado para entrada interna malformada %o', delta => {
    const r = resolverContextoDietetico({ ...entrada(), ...delta } as unknown as EntradaContextoDietetico);
    expect(r.contexto.elegivel).toBe(false);
    expect(r.motivos.length).toBeGreaterThan(0);
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as receitas from './receitas-nutricionais';
import type { ConteudoReceitaNutricional } from './receitas-nutricionais';

type Calculo = {
  estado: 'calculavel'; itens: ConteudoReceitaNutricional['itens'];
  fatorExato: { numerador: string; denominador: string };
  avisos: { codigo: string; item: number; substituicao?: number; campo: string }[];
};
const api = receitas as unknown as { porcionarReceita: (c: unknown, p: unknown) => Calculo | { estado: 'indisponivel'; motivos: unknown[] } };
const ID = '10000000-0000-4000-8000-000000000001';
function origem(base = 'receita_inteira', rendimento: number | null = 4, gramas = 500) {
  return { instrucoes: 'Misture 500 g; 20 minutos.', metadados: { schemaVersao: 1, etiquetas: ['Interna'], baseQuantidades: base,
    ...(rendimento === null ? {} : { rendimentoPorcoes: rendimento }), tempoPreparoMinutos: 20 },
  itens: [{ alimentoComposicaoId: ID, quantidade: gramas, unidade: 'g', porcaoGramas: gramas }] };
}
function calculo(conteudo: unknown, porcoes: unknown): Calculo {
  const resultado = api.porcionarReceita(conteudo, porcoes);
  expect(resultado.estado).toBe('calculavel');
  if (resultado.estado !== 'calculavel') throw new Error('Esperado cálculo disponível');
  return resultado;
}
const oraculo = JSON.parse(readFileSync(join(__dirname, 'fixtures/porcionamento-receita-oraculo.json'), 'utf8')) as {
  casos: { base: string; rendimento: number; gramas: number; quantidade: number; porcoes: number;
    esperado: { quantidade: number; porcaoGramas: number }; fator: Calculo['fatorExato'] }[];
};

describe('FOOD07 — porcionamento determinístico', () => {
  beforeEach(() => expect(api.porcionarReceita).toEqual(expect.any(Function)));
  it.each(oraculo.casos)('concorda com Fraction/Decimal: %#', caso => {
    const entrada = origem(caso.base, caso.rendimento, caso.gramas);
    entrada.itens[0].quantidade = caso.quantidade;
    const resultado = calculo(entrada, caso.porcoes);
    expect(resultado.itens[0]).toMatchObject(caso.esperado);
    expect(resultado.fatorExato).toEqual(caso.fator);
    expect(() => JSON.stringify(resultado)).not.toThrow();
  });
  it.each([1, 1.5, 2.5, 0.5, 0.001, 10])('obtém o mesmo resultado nas duas bases para %s porções', porcoes => {
    const inteira = calculo(origem(), porcoes);
    const porP = calculo(origem('por_porcao', 4, 125), porcoes);
    expect(inteira.itens).toEqual(porP.itens);
    expect(Number(porP.fatorExato.numerador) / Number(porP.fatorExato.denominador)).toBe(porcoes);
  });
  it.each([1, 2, 4, 5, 10].flatMap(rendimento => [1, 2.5, 10, 125].flatMap(porP =>
    [0.001, 0.5, 1, 1.5, 2.5, 10].map(porcoes => ({ rendimento, porP, porcoes }))))
  )('propriedade de equivalência entre bases para a grade sintética: %#', ({ rendimento, porP, porcoes }) => {
    expect(calculo(origem('receita_inteira', rendimento, porP * rendimento), porcoes).itens)
      .toEqual(calculo(origem('por_porcao', rendimento, porP), porcoes).itens);
  });
  it('fator um preserva medidas exatamente e não produz aviso de arredondamento', () => {
    const entrada = origem();
    Object.freeze(entrada.itens[0]); Object.freeze(entrada.itens); Object.freeze(entrada.metadados); Object.freeze(entrada);
    const r = calculo(entrada, 4);
    expect(r.itens).toEqual(entrada.itens);
    expect(r.fatorExato).toEqual({ numerador: '1', denominador: '1' });
    expect(r.avisos).toEqual([]);
  });
  it('usa uma porção como base mesmo sem rendimento total na base por_porcao', () => {
    expect(calculo(origem('por_porcao', null, 125), 1.5).itens[0].porcaoGramas).toBe(187.5);
  });
  it('arredonda half-up uma única vez e relata cada campo afetado', () => {
    const r = calculo(origem('receita_inteira', 4, 2), 0.003);
    expect(r.itens[0]).toMatchObject({ quantidade: 0.002, porcaoGramas: 0.002 });
    expect(r.avisos).toEqual([
      { codigo: 'ARREDONDAMENTO', item: 0, campo: 'quantidade' },
      { codigo: 'ARREDONDAMENTO', item: 0, campo: 'porcaoGramas' }
    ]);
  });
  it('parte sempre do original, não acumula arredondamento de outra prévia e não muda a fonte', () => {
    const entrada = origem('receita_inteira', 3, 1);
    const antes = JSON.stringify(entrada);
    const primeira = calculo(entrada, 1);
    expect(primeira.itens[0].porcaoGramas).toBe(0.333);
    expect(calculo(entrada, 2.5).itens[0].porcaoGramas).toBe(0.833);
    primeira.itens[0].porcaoGramas = 999;
    expect(calculo(entrada, 1).itens[0].porcaoGramas).toBe(0.333);
    expect(JSON.stringify(entrada)).toBe(antes);
  });
  it('escala alternativas pela mesma razão, mantendo unidade, composição, flags e instruções', () => {
    const entrada = origem();
    const item = { ...entrada.itens[0], quantidade: 4, unidade: 'medida', nutrientesPor100g: { energiaKcal: 100 },
      micronutrientesPor100g: { calcioMg: 12 }, substituicoes: [{ alimentoComposicaoId: ID, quantidade: 2, unidade: 'unidade', porcaoGramas: 200, liberadaParaPaciente: false, preferida: false }] };
    const r = calculo({ ...entrada, itens: [item] }, 1.5);
    expect(r.itens[0]).toMatchObject({ quantidade: 1.5, unidade: 'medida', porcaoGramas: 187.5,
      nutrientesPor100g: { energiaKcal: 100 }, micronutrientesPor100g: { calcioMg: 12 },
      substituicoes: [{ quantidade: 0.75, porcaoGramas: 75, liberadaParaPaciente: false, preferida: false }] });
    expect(r.itens[0].nutrientesPor100g?.proteinasG).toBeUndefined();
    expect(entrada.instrucoes).toBe('Misture 500 g; 20 minutos.');
    expect(entrada.metadados.tempoPreparoMinutos).toBe(20);
  });
  it.each([undefined, null, 0, -1, 1000.001, NaN, Infinity, '1.5', {}, 0.0009, 1.0001, 0.1 + 0.2])('recusa porções inválidas sem resultado parcial: %#', p => {
    expect(api.porcionarReceita(origem(), p)).toMatchObject({ estado: 'indisponivel' });
  });
  it.each([
    { ...origem(), metadados: undefined },
    { ...origem(), metadados: { schemaVersao: 1, etiquetas: [], rendimentoPorcoes: 4 } },
    origem('receita_inteira', null), origem('receita_inteira', 0), origem('adivinhar'),
    { ...origem(), itens: [] }, { ...origem(), itens: [null] }, { ...origem(), itens: [ { ...origem().itens[0], quantidade: 0 } ] },
    { ...origem(), itens: [ { ...origem().itens[0], porcaoGramas: 0.0001 } ] },
    { ...origem(), itens: [ { ...origem().itens[0], porcaoGramas: NaN } ] },
    { ...origem(), itens: [ { ...origem().itens[0], alimentoComposicaoId: 'invalido' } ] }
  ])('não infere base ou aceita conteúdo inválido: %#', entrada => {
    expect(api.porcionarReceita(entrada, 1)).toMatchObject({ estado: 'indisponivel' });
  });
  it('bloqueia todo resultado se um ingrediente ou alternativa fica fora dos limites antes de arredondar', () => {
    expect(api.porcionarReceita(origem('por_porcao', 1, 10000), 1.001)).toMatchObject({ estado: 'indisponivel' });
    expect(api.porcionarReceita(origem('por_porcao', 1, 0.001), 0.5)).toMatchObject({ estado: 'indisponivel' });
    const entrada = origem();
    expect(api.porcionarReceita({ ...entrada, itens: [...entrada.itens, { ...entrada.itens[0], porcaoGramas: 0.001 }] }, 0.5)).toMatchObject({ estado: 'indisponivel' });
    const falha = api.porcionarReceita({ ...entrada, itens: [{ ...entrada.itens[0], substituicoes: [{ ...entrada.itens[0], quantidade: 0.001 }] }] }, 0.5);
    expect(falha).toMatchObject({ estado: 'indisponivel', motivos: [{ codigo: 'QUANTIDADE_FORA_DO_LIMITE', item: 0, substituicao: 0 }] });
    expect(falha).not.toHaveProperty('itens');
  });
});

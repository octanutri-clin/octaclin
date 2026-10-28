import * as receitas from './receitas-nutricionais';
import { contarItensReceita, type ConteudoReceitaNutricional } from './receitas-nutricionais';

describe('FOOD07 — metadados da receita', () => {
  it('rejeita base desconhecida mesmo quando a receita tem ingredientes válidos', () => {
    const receita = {
      itens: [{ alimentoComposicaoId: '10000000-0000-4000-8000-000000000001', quantidade: 1, unidade: 'g', porcaoGramas: 125 }],
      metadados: { schemaVersao: 1, etiquetas: [], baseQuantidades: 'adivinhar' }
    } as unknown as ConteudoReceitaNutricional;
    expect(() => contarItensReceita(receita)).toThrow('Metadados da receita inválidos.');
  });
});

describe('FOOD07 — leitura e projeção do conteúdo', () => {
  const api = receitas as unknown as {
    lerConteudoReceita: (valor: unknown) => ConteudoReceitaNutricional;
    projetarConteudoReceitaPaciente: (valor: unknown) => unknown;
  };
  const item = { alimentoComposicaoId: '10000000-0000-4000-8000-000000000001', quantidade: 1, unidade: 'medida', porcaoGramas: 125 };
  beforeEach(() => {
    expect(api.lerConteudoReceita).toEqual(expect.any(Function));
    expect(api.projetarConteudoReceitaPaciente).toEqual(expect.any(Function));
  });
  it('lê legado sem inventar metadados e devolve uma cópia independente', () => {
    const legado = { instrucoes: 'Prepare 125 g.', itens: [item] };
    const copia = api.lerConteudoReceita(legado);
    expect(copia).toEqual(legado);
    expect(Object.hasOwn(copia, 'metadados')).toBe(false);
    copia.itens[0].porcaoGramas = 999;
    expect(legado.itens[0].porcaoGramas).toBe(125);
  });
  it('a saída validada pode ser lida novamente sem falhar em outra etapa', () => {
    const json = { itens: [item], metadados: { baseQuantidades: 'por_porcao' } };
    const primeira = api.lerConteudoReceita(json);
    expect(api.lerConteudoReceita(primeira)).toEqual(primeira);
  });
  it('preserva limites legados em caracteres Unicode, não unidades UTF-16', () => {
    const instrucoes = '🍋'.repeat(4000);
    expect(api.lerConteudoReceita({ instrucoes, itens: [item] }).instrucoes).toBe(instrucoes);
    const manual = { descricao: '🍋'.repeat(240), quantidade: 1, unidade: '🍋'.repeat(40), porcaoGramas: 1,
      nutrientesPor100g: { energiaKcal: 1, proteinasG: 1, carboidratosG: 1, gordurasG: 1 } };
    expect(api.lerConteudoReceita({ itens: [manual] }).itens[0]).toEqual(manual);
  });
  it('projeta apenas instruções, ingredientes e rendimento/tempo públicos', () => {
    const entrada = { instrucoes: 'Prepare.', itens: [{ ...item, substituicoesVisiveisInicialmente: 1,
      substituicoes: [{ ...item, liberadaParaPaciente: false, preferida: true }] }],
      metadados: { schemaVersao: 1, baseQuantidades: 'receita_inteira', etiquetas: ['Interna'], rendimentoPorcoes: 4, tempoPreparoMinutos: 20 } };
    const publico = api.projetarConteudoReceitaPaciente(entrada);
    expect(publico).toMatchObject({ instrucoes: 'Prepare.', itens: entrada.itens, metadados: { schemaVersao: 1, rendimentoPorcoes: 4, tempoPreparoMinutos: 20 } });
    expect(JSON.stringify(publico)).not.toMatch(/Interna|etiquetas|baseQuantidades/);
    expect(entrada.metadados.etiquetas).toEqual(['Interna']);
  });
  it('mantém composição manual completa e campos opcionais realmente ausentes', () => {
    const manual = { descricao: 'Alimento sintético', quantidade: 1, unidade: 'g', porcaoGramas: 1,
      nutrientesPor100g: { energiaKcal: 100, proteinasG: 2, carboidratosG: 20, gordurasG: 1 } };
    expect(api.lerConteudoReceita({ itens: [manual] })).toEqual({ itens: [manual] });
    expect(() => api.lerConteudoReceita({ itens: [{ ...manual, nutrientesPor100g: { energiaKcal: 100 } }] })).toThrow();
  });
  it('lê nulls opcionais legados como ausência sem alterar origem nem inventar zero', () => {
    const legado = { itens: [{ ...item, descricao: null, nutrientesPor100g: { energiaKcal: null, fibrasG: null, sodioMg: null },
      substituicoesVisiveisInicialmente: null, substituicoes: [{ ...item, descricao: null, nutrientesPor100g: null, liberadaParaPaciente: null, preferida: null }] }] };
    const antes = JSON.stringify(legado);
    const r = api.lerConteudoReceita(legado);
    expect(r.itens[0]).not.toHaveProperty('descricao');
    expect(r.itens[0]).not.toHaveProperty('substituicoesVisiveisInicialmente');
    expect(r.itens[0].nutrientesPor100g).toEqual({});
    expect(r.itens[0].substituicoes?.[0]).not.toHaveProperty('nutrientesPor100g');
    expect(r.itens[0].substituicoes?.[0]).not.toHaveProperty('liberadaParaPaciente');
    expect(r.itens[0].substituicoes?.[0]).not.toHaveProperty('preferida');
    expect(JSON.stringify(legado)).toBe(antes);
  });
  it.each([
    { descricao: 'Controle', alimentoComposicaoId: null, quantidade: 1, unidade: 'g', porcaoGramas: 1,
      nutrientesPor100g: { energiaKcal: 1, proteinasG: 1, carboidratosG: 1, gordurasG: 1, fibrasG: null, sodioMg: null } }
  ])('preserva manual legado com id ausente/null e opcionais desconhecidos', manual => {
    const lido = api.lerConteudoReceita({ itens: [manual] }).itens[0];
    expect(lido).not.toHaveProperty('alimentoComposicaoId');
    expect(lido.nutrientesPor100g).toEqual({ energiaKcal: 1, proteinasG: 1, carboidratosG: 1, gordurasG: 1 });
    expect(() => api.lerConteudoReceita({ itens: [{ ...manual, nutrientesPor100g: { ...manual.nutrientesPor100g, energiaKcal: null } }] })).toThrow();
    expect(() => api.lerConteudoReceita({ itens: [{ ...manual, porcaoGramas: null }] })).toThrow();
    expect(() => api.lerConteudoReceita({ itens: [{ ...manual, micronutrientesPor100g: null }] })).toThrow();
  });
  it('preserva precisão já existente no catálogo, inclusive notação exponencial pequena', () => {
    const nutrientesPor100g = { energiaKcal: 0.123456789, proteinasG: 1e-7 };
    expect(api.lerConteudoReceita({ itens: [{ ...item, nutrientesPor100g }] }).itens[0].nutrientesPor100g).toEqual(nutrientesPor100g);
  });
  it('não introduz teto novo nem rejeita inteiro finito manual por notação exponencial', () => {
    const nutrientesPor100g = { energiaKcal: 1e21, proteinasG: 0, carboidratosG: 0, gordurasG: 0 };
    const manual = { descricao: 'Controle sintético de compatibilidade', quantidade: 1, unidade: 'g', porcaoGramas: 1, nutrientesPor100g };
    expect(api.lerConteudoReceita({ itens: [manual] }).itens[0].nutrientesPor100g).toEqual(nutrientesPor100g);
  });
  it.each([null, [], {}, { itens: [] }, { itens: Array(101).fill(item) }, { itens: [null] },
    { itens: [item], instrucoes: 'x'.repeat(4001) }, { itens: [item], contextoEquivalencia: {} },
    { itens: [{ ...item, porcaoGramas: -1 }] }, { itens: [{ ...item, quantidade: '1' }] },
    { itens: [{ ...item, nutrientesPor100g: { energiaKcal: NaN } }] },
    { itens: [{ ...item, nutrientesPor100g: { energiaKcal: -1 } }] },
    { itens: [{ ...item, nutrientesPor100g: { desconhecido: 2 } }] },
    { itens: [{ ...item, micronutrientesPor100g: { calcioMg: '2' } }] },
    { itens: [{ ...item, substituicoes: Array(21).fill(item) }] },
    { itens: [{ ...item, substituicoes: [{ ...item, preferida: 'sim' }] }] },
    { itens: [{ ...item, substituicoes: [{ ...item, substituicoes: [item] }] }] },
    { itens: [{ ...item, equivalencia: { pacienteId: 'nao-autorizado' } }] },
    JSON.parse('{"itens":[],"__proto__":{"poluido":true}}')])('falha fechado sem devolver conteúdo malformado: %#', entrada => {
    expect(() => api.lerConteudoReceita(entrada)).toThrow('Conteúdo da receita inválido.');
  });
});

// O contrato público ainda não existe no RED. O guard é uma asserção de API,
// não um import de módulo inexistente nem um TypeError tratado como validação.
describe('FOOD07 — normalização e omissão', () => {
  const api = receitas as unknown as {
    normalizarMetadadosReceita: (v: unknown) => unknown;
    mesclarMetadadosReceita: (anterior: unknown, alteracao: unknown) => unknown;
  };
  beforeEach(() => {
    expect(api.normalizarMetadadosReceita).toEqual(expect.any(Function));
    expect(api.mesclarMetadadosReceita).toEqual(expect.any(Function));
  });

  it('normaliza/deduplica etiquetas e conserva a primeira grafia', () => {
    expect(api.normalizarMetadadosReceita({ etiquetas: [' Café  da manhã ', 'cafe da MANHA', 'Lanche'], baseQuantidades: 'por_porcao' }))
      .toEqual({ schemaVersao: 1, etiquetas: ['Café da manhã', 'Lanche'], baseQuantidades: 'por_porcao' });
    expect(api.normalizarMetadadosReceita({})).toEqual({ schemaVersao: 1, etiquetas: [] });
  });

  it('preserva omissão de writer antigo sem criar metadata fictícia no legado', () => {
    const anterior = { schemaVersao: 1, etiquetas: ['Lanche'], baseQuantidades: 'receita_inteira', rendimentoPorcoes: 4, tempoPreparoMinutos: 20 };
    expect(api.mesclarMetadadosReceita(undefined, undefined)).toBeUndefined();
    expect(api.mesclarMetadadosReceita(anterior, undefined)).toEqual(anterior);
    expect(api.mesclarMetadadosReceita(anterior, { tempoPreparoMinutos: 30 })).toEqual({ ...anterior, tempoPreparoMinutos: 30 });
    expect(api.mesclarMetadadosReceita(anterior, { etiquetas: [], rendimentoPorcoes: null, tempoPreparoMinutos: null, baseQuantidades: null }))
      .toEqual({ schemaVersao: 1, etiquetas: [] });
    expect(anterior.rendimentoPorcoes).toBe(4);
  });

  it.each([1, 1000])('aceita rendimento inteiro no limite %s', rendimentoPorcoes => {
    expect(api.normalizarMetadadosReceita({ rendimentoPorcoes })).toMatchObject({ rendimentoPorcoes });
  });
  it.each([1, 10080])('aceita tempo inteiro no limite %s', tempoPreparoMinutos => {
    expect(api.normalizarMetadadosReceita({ tempoPreparoMinutos })).toMatchObject({ tempoPreparoMinutos });
  });
  it.each([undefined, null, [], 'x', 1, { baseQuantidades: 'desconhecida' }, { schemaVersao: 2 },
    { etiquetas: null }, { etiquetas: [''] }, { etiquetas: ['x'.repeat(41)] }, { etiquetas: Array(11).fill('x') },
    { etiquetas: ['a\nb'] }, { etiquetas: ['\u0301'] }, { etiquetas: ['a@exemplo.test'] }, { etiquetas: ['12345678'] },
    { etiquetas: ['10000000-0000-4000-8000-000000000001'] }, { etiquetas: [1] },
    { rendimentoPorcoes: 0 }, { rendimentoPorcoes: 1001 }, { rendimentoPorcoes: 1.5 }, { rendimentoPorcoes: '4' },
    { tempoPreparoMinutos: 0 }, { tempoPreparoMinutos: 10081 }, { tempoPreparoMinutos: 1.5 },
    { tempoPreparoMinutos: NaN }, { rendimentoPorcoes: Infinity }, { rendimentoPorcoes: null },
    { surpresa: true }, JSON.parse('{"__proto__":{"poluido":true}}'), { constructor: {} },
    Object.create({ baseQuantidades: 'por_porcao' })])('rejeita entrada malformada sem refletir conteúdo: %#', valor => {
    expect(() => api.normalizarMetadadosReceita(valor)).toThrow('Metadados da receita inválidos.');
  });
  it('rejeita propriedades acessoras sem executar o getter', () => {
    const getter = jest.fn(() => ['privado']);
    expect(() => api.normalizarMetadadosReceita(Object.defineProperty({}, 'etiquetas', { enumerable: true, get: getter }))).toThrow();
    expect(getter).not.toHaveBeenCalled();
    expect(() => api.mesclarMetadadosReceita(undefined, { etiquetas: null })).toThrow();
    expect(() => api.mesclarMetadadosReceita(undefined, null)).toThrow();
  });
});

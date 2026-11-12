import { validarConteudoRestricao, ConteudoRestricaoInvalidoError, ESQUEMA_CONTEUDO_RESTRICAO } from './conteudo-restricao';

/** FOOD06 D2 (#531): o objeto clínico é validado por inteiro ANTES de cifrar e persistir. Só dados sintéticos. */
const CANARIO = 'CANARIO_CONTEUDO_NAO_VAZAR';
const alergia = { schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alergeno', id: 'sintetico-1' }, gravidade: 'grave' };

describe('FOOD06 D2: conteúdo clínico da restrição', () => {
  it('aceita as combinações válidas e devolve cópia normalizada e congelada', () => {
    const r = validarConteudoRestricao({ ...alergia, observacao: 'nota sintética' });
    expect(r).toEqual({ ...alergia, observacao: 'nota sintética' });
    expect(Object.isFrozen(r)).toBe(true);
    expect(validarConteudoRestricao({ schemaVersao: 1, natureza: 'preferencia', alvo: { tipo: 'alimento', id: 'a1' } })).toEqual({ schemaVersao: 1, natureza: 'preferencia', alvo: { tipo: 'alimento', id: 'a1' } });
    expect(validarConteudoRestricao({ schemaVersao: 1, natureza: 'escolha', alvo: { tipo: 'categoria_escolha', id: 'c1' } }).natureza).toBe('escolha');
    expect(validarConteudoRestricao({ schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'intolerancia_alimentar', alvo: { tipo: 'nao_catalogado' }, alvoDeclarado: 'texto sintético' }).alvoDeclarado).toBe('texto sintético');
    expect(ESQUEMA_CONTEUDO_RESTRICAO).toBe(1);
  });
  it('recusa combinações clínicas incoerentes', () => {
    for (const ruim of [
      { ...alergia, subtipoClinico: undefined },                                  // clínica sem subtipo
      { ...alergia, natureza: 'escolha' },                                        // subtipo fora de clínica
      { schemaVersao: 1, natureza: 'preferencia', alvo: { tipo: 'alimento', id: 'a1' }, gravidade: 'leve' }, // gravidade fora de clínica
      { ...alergia, alvo: { tipo: 'nao_catalogado', id: 'x' } },                   // não catalogado com id
      { ...alergia, alvo: { tipo: 'nao_catalogado' } },                            // não catalogado sem texto declarado
      { ...alergia, alvoDeclarado: 'x' },                                          // texto declarado com alvo catalogado
      { ...alergia, alvo: { tipo: 'alergeno' } },                                  // catalogado sem id
      { ...alergia, alvo: { tipo: 'categoria_escolha', id: 'c1' } },               // categoria de escolha em restrição clínica
      { schemaVersao: 1, natureza: 'preferencia', alvo: { tipo: 'categoria_escolha', id: 'c1' } }
    ]) expect(() => validarConteudoRestricao(ruim)).toThrow(ConteudoRestricaoInvalidoError);
  });
  it('recusa tipos, valores fora do vocabulário, versão desconhecida, campos extras e protótipos', () => {
    for (const ruim of [
      null, [], 'x', { ...alergia, schemaVersao: 2 }, { ...alergia, schemaVersao: undefined }, { ...alergia, natureza: 'outra' },
      { ...alergia, subtipoClinico: 'diagnostico' }, { ...alergia, gravidade: 'altissima' }, { ...alergia, alvo: { tipo: 'alergeno', id: 'com espaço' } },
      { ...alergia, alvo: { tipo: 'x', id: 'a' } }, { ...alergia, razao: 'religiosa' }, { ...alergia, extra: 1 }, { ...alergia, alvo: { tipo: 'alergeno', id: 'a', extra: 1 } },
      { ...alergia, observacao: 1 }, { ...alergia, observacao: 'a'.repeat(1001) }, { ...alergia, observacao: 'linha\u0000' }, Object.create({ ...alergia })
    ]) expect(() => validarConteudoRestricao(ruim)).toThrow(ConteudoRestricaoInvalidoError);
  });
  it('erro genérico, sem eco do conteúdo', () => {
    try { validarConteudoRestricao({ ...alergia, observacao: CANARIO + '\u0007' }); fail('deveria falhar'); } catch (e) {
      expect(e).toBeInstanceOf(ConteudoRestricaoInvalidoError); expect(String((e as Error).message)).not.toContain(CANARIO);
    }
  });
});

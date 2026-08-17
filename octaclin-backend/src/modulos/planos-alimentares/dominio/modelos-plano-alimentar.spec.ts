import {
  ORIGENS_MODELO_PLANO_ALIMENTAR,
  contarEstruturaModelo,
  podeAcessarModelo,
  resumirAlimentosDoModelo
} from './modelos-plano-alimentar';

describe('modelos de plano alimentar', () => {
  describe('origens', () => {
    it('aceita apenas pessoal e clinica', () => {
      // `catalogo` fica fora ate os modelos de sistema referenciarem alimento
      // por codigo de origem: UUID de `alimentos_composicao` nao e portavel
      // entre a base de integracao e a de producao.
      expect(ORIGENS_MODELO_PLANO_ALIMENTAR).toEqual(['pessoal', 'clinica']);
    });
  });

  describe('contarEstruturaModelo', () => {
    it('conta refeicoes e itens principais, ignorando substituicoes', () => {
      expect(
        contarEstruturaModelo([
          { nome: 'Cafe', itens: [{ descricao: 'Pao' }, { descricao: 'Cafe' }] },
          { nome: 'Almoco', itens: [{ descricao: 'Arroz', substituicoes: [{ descricao: 'Macarrao' }] }] }
        ] as never)
      ).toEqual({ totalRefeicoes: 2, totalItens: 3 });
    });

    it('rejeita modelo sem refeicao ou sem item', () => {
      expect(() => contarEstruturaModelo([])).toThrow();
      expect(() => contarEstruturaModelo([{ nome: 'Cafe', itens: [] }] as never)).toThrow();
    });
  });

  describe('podeAcessarModelo', () => {
    const pessoalDeOutro = { origem: 'pessoal' as const, profissionalId: 'prof-2' };
    const pessoalProprio = { origem: 'pessoal' as const, profissionalId: 'prof-1' };
    const daClinica = { origem: 'clinica' as const, profissionalId: undefined };

    it('libera modelo da clinica para qualquer profissional do tenant', () => {
      expect(podeAcessarModelo(daClinica, { papel: 'Professional', profissionalId: 'prof-1' })).toBe(true);
    });

    it('libera modelo pessoal apenas para o profissional dono', () => {
      expect(podeAcessarModelo(pessoalProprio, { papel: 'Professional', profissionalId: 'prof-1' })).toBe(true);
    });

    // Sem isso, o modelo pessoal de um profissional vazaria para os colegas do
    // mesmo tenant, que e justamente o que a origem `pessoal` promete evitar.
    it('nega modelo pessoal de outro profissional', () => {
      expect(podeAcessarModelo(pessoalDeOutro, { papel: 'Professional', profissionalId: 'prof-1' })).toBe(false);
    });

    it('nega modelo pessoal quando o profissional do usuario nao foi resolvido', () => {
      expect(podeAcessarModelo(pessoalProprio, { papel: 'Professional', profissionalId: undefined })).toBe(false);
    });

    it('libera tudo para SuperAdmin, como no restante do modulo', () => {
      expect(podeAcessarModelo(pessoalDeOutro, { papel: 'SuperAdmin', profissionalId: undefined })).toBe(true);
    });
  });

  describe('resumirAlimentosDoModelo', () => {
    it('reune os ids de catalogo de itens e substituicoes, sem repetir', () => {
      expect(
        resumirAlimentosDoModelo([
          {
            nome: 'Cafe',
            itens: [
              { descricao: 'Pao', alimentoComposicaoId: 'a1', substituicoes: [{ descricao: 'Tapioca', alimentoComposicaoId: 'a2' }] },
              { descricao: 'Leite', alimentoComposicaoId: 'a1' }
            ]
          }
        ] as never)
      ).toEqual(['a1', 'a2']);
    });

    it('ignora item manual, que nao depende do catalogo', () => {
      expect(
        resumirAlimentosDoModelo([{ nome: 'Cafe', itens: [{ descricao: 'Receita da casa' }] }] as never)
      ).toEqual([]);
    });
  });
});

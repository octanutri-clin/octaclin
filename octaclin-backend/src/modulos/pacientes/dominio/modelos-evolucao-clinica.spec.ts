import { ORIGENS_MODELO_EVOLUCAO_CLINICA, podeAcessarModeloEvolucao } from './modelos-evolucao-clinica';

describe('modelos de evolucao clinica', () => {
  describe('origens', () => {
    it('aceita apenas pessoal e clinica, mesmo vocabulario dos modelos de plano alimentar', () => {
      expect(ORIGENS_MODELO_EVOLUCAO_CLINICA).toEqual(['pessoal', 'clinica']);
    });
  });

  describe('podeAcessarModeloEvolucao', () => {
    const pessoalDeOutro = { origem: 'pessoal' as const, profissionalId: 'prof-2' };
    const pessoalProprio = { origem: 'pessoal' as const, profissionalId: 'prof-1' };
    const daClinica = { origem: 'clinica' as const, profissionalId: undefined };

    it('libera modelo da clinica para qualquer profissional do tenant', () => {
      expect(podeAcessarModeloEvolucao(daClinica, { papel: 'Professional', profissionalId: 'prof-1' })).toBe(true);
    });

    it('libera modelo pessoal apenas para o profissional dono', () => {
      expect(podeAcessarModeloEvolucao(pessoalProprio, { papel: 'Professional', profissionalId: 'prof-1' })).toBe(
        true
      );
    });

    // Sem isso, o modelo pessoal de um profissional vazaria para os colegas do
    // mesmo tenant, que e justamente o que a origem `pessoal` promete evitar.
    it('nega modelo pessoal de outro profissional', () => {
      expect(podeAcessarModeloEvolucao(pessoalDeOutro, { papel: 'Professional', profissionalId: 'prof-1' })).toBe(
        false
      );
    });

    it('nega modelo pessoal quando o profissional do usuario nao foi resolvido', () => {
      expect(
        podeAcessarModeloEvolucao(pessoalProprio, { papel: 'Professional', profissionalId: undefined })
      ).toBe(false);
    });

    it('libera tudo para SuperAdmin, como no restante do modulo de pacientes', () => {
      expect(podeAcessarModeloEvolucao(pessoalDeOutro, { papel: 'SuperAdmin', profissionalId: undefined })).toBe(
        true
      );
    });
  });
});

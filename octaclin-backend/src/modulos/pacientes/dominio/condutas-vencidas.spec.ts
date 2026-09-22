import { condutaEstaVencida, resolverVersaoVigentePorConduta } from './condutas-vencidas';

describe('condutas vencidas', () => {
  describe('resolverVersaoVigentePorConduta', () => {
    it('escolhe a versao publicada e nao descartada de maior numero por conduta', () => {
      const versoes = [
        { condutaTerapeuticaId: 'c1', numero: 1, publicadaEm: new Date(), descartadaEm: undefined, validadeFim: '2026-01-01' },
        { condutaTerapeuticaId: 'c1', numero: 2, publicadaEm: new Date(), descartadaEm: undefined, validadeFim: '2026-06-01' }
      ];
      const vigentes = resolverVersaoVigentePorConduta(versoes);
      expect(vigentes.get('c1')?.numero).toBe(2);
    });

    it('ignora versao nao publicada', () => {
      const versoes = [{ condutaTerapeuticaId: 'c1', numero: 1, publicadaEm: undefined, descartadaEm: undefined, validadeFim: '2026-01-01' }];
      expect(resolverVersaoVigentePorConduta(versoes).has('c1')).toBe(false);
    });

    it('ignora versao descartada', () => {
      const versoes = [{ condutaTerapeuticaId: 'c1', numero: 1, publicadaEm: new Date(), descartadaEm: new Date(), validadeFim: '2026-01-01' }];
      expect(resolverVersaoVigentePorConduta(versoes).has('c1')).toBe(false);
    });

    it('resolve cada conduta independentemente', () => {
      const versoes = [
        { condutaTerapeuticaId: 'c1', numero: 1, publicadaEm: new Date(), descartadaEm: undefined, validadeFim: '2026-01-01' },
        { condutaTerapeuticaId: 'c2', numero: 1, publicadaEm: new Date(), descartadaEm: undefined, validadeFim: '2026-02-01' }
      ];
      const vigentes = resolverVersaoVigentePorConduta(versoes);
      expect(vigentes.size).toBe(2);
    });
  });

  describe('condutaEstaVencida', () => {
    it('vencida quando validade_fim e estritamente anterior a hoje', () => {
      expect(condutaEstaVencida({ validadeFim: '2026-01-01' }, '2026-01-02')).toBe(true);
    });

    // Zero dias de tolerancia: no proprio dia do vencimento a conduta ainda
    // esta valida, mesma regra ja usada no alerta do dashboard clinico.
    it('nao vencida no proprio dia da validade final', () => {
      expect(condutaEstaVencida({ validadeFim: '2026-01-02' }, '2026-01-02')).toBe(false);
    });

    it('nao vencida sem validade_fim definida', () => {
      expect(condutaEstaVencida({ validadeFim: undefined }, '2026-01-02')).toBe(false);
    });
  });
});

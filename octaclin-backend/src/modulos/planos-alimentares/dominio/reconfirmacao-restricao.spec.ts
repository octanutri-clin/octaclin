import { registrarReconfirmacao, PRAZO_RECONFIRMACAO_DIAS, ReconfirmacaoInvalidaError } from './reconfirmacao-restricao';

/** FOOD06 PR-D (Q10): atestação de reconfirmação. Vence só a avaliação; a restrição não muda. */
const CANARIO = 'CANARIO_RECONF_NAO_VAZAR';
const base = { agora: '2026-11-12T12:00:00.000Z', restricaoId: 'r1', revisaoRestricao: 3, atestadoPor: 'usuario-1', atestacao: true };

describe('FOOD06 PR-D: reconfirmação de restrições', () => {
  it('o prazo é de 180 dias', () => { expect(PRAZO_RECONFIRMACAO_DIAS).toBe(180); });
  it('calcula o novo vencimento em 180 dias exatos (UTC)', () => {
    const r = registrarReconfirmacao(base);
    expect(r.venceEm).toBe('2027-05-11T12:00:00.000Z');
    expect(r).toMatchObject({ restricaoId: 'r1', revisaoRestricao: 3, atestadoPor: 'usuario-1', atestadoEm: base.agora });
  });
  it('não altera a restrição nem a revisão', () => {
    const r = registrarReconfirmacao(base);
    expect(r.alteraRestricao).toBe(false);
    expect(r.revisaoRestricao).toBe(base.revisaoRestricao);
  });
  it('exige atestação explícita verdadeira', () => {
    for (const a of [false, undefined, 'true', 1]) expect(() => registrarReconfirmacao({ ...base, atestacao: a as never })).toThrow(ReconfirmacaoInvalidaError);
  });
  it('exige autor, restrição, revisão e instante válidos', () => {
    for (const ruim of [{ atestadoPor: '' }, { restricaoId: '' }, { revisaoRestricao: 0 }, { revisaoRestricao: 1.5 }, { agora: 'ontem' }, { agora: '2026-11-12' }]) {
      expect(() => registrarReconfirmacao({ ...base, ...ruim } as never)).toThrow(ReconfirmacaoInvalidaError);
    }
  });
  it('entrada fechada e erro sem eco', () => {
    for (const ruim of [null, { ...base, extra: 1 }, { ...base, atestadoPor: CANARIO + '\n' }]) {
      try { registrarReconfirmacao(ruim as never); fail('deveria falhar'); } catch (e) {
        expect(e).toBeInstanceOf(ReconfirmacaoInvalidaError); expect(String((e as Error).message)).not.toContain(CANARIO);
      }
    }
  });
});

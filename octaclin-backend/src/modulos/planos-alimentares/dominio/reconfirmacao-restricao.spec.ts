import { registrarReconfirmacao, validarResultadoReconfirmacao, PRAZO_RECONFIRMACAO_DIAS, ReconfirmacaoInvalidaError } from './reconfirmacao-restricao';

/**
 * FOOD06 PR-D (Q10) alinhado à decisão D4 da PR #531: a AVALIAÇÃO global e sua revisão exata são a referência
 * obrigatória; a restrição individual é opcional (com a sua revisão). Vence só a avaliação; a restrição não muda.
 */
const CANARIO = 'CANARIO_RECONF_NAO_VAZAR';
const base = {
  agora: '2026-11-12T12:00:00.000Z', pacienteId: 'paciente-1', avaliacaoId: 'av-1', revisaoAvaliacao: 2, atestadoPor: 'usuario-1',
  meio: 'teleconsulta', resultado: 'sem_alteracao', atestacao: true
};

describe('FOOD06 Q10/D4: reconfirmação referenciada à avaliação global', () => {
  it('o prazo é de 180 dias', () => { expect(PRAZO_RECONFIRMACAO_DIAS).toBe(180); });
  it('global sem alteração renova a avaliação em 180 dias exatos (UTC) e registra os seis campos', () => {
    const r = registrarReconfirmacao(base);
    expect(r).toEqual({
      pacienteId: 'paciente-1', avaliacaoId: 'av-1', revisaoAvaliacao: 2, atestadoPor: 'usuario-1', atestadoEm: base.agora, meio: 'teleconsulta',
      resultado: 'sem_alteracao', escopo: 'avaliacao_global', renovaAvaliacao: true, venceEm: '2027-05-11T12:00:00.000Z',
      declaraAusenciaRestricoes: false, alteraRestricao: false
    });
  });
  it('não exige restrição individual; quando há, exige a revisão dela e nunca renova a avaliação global', () => {
    const r = registrarReconfirmacao({ ...base, restricao: { id: 'r1', revisao: 3 } });
    expect(r).toMatchObject({ escopo: 'restricao_individual', restricaoId: 'r1', revisaoRestricao: 3, renovaAvaliacao: false, declaraAusenciaRestricoes: false });
    expect(r.venceEm).toBeUndefined();
    for (const ruim of [{ id: 'r1' }, { revisao: 3 }, { id: 'r1', revisao: 0 }, { id: '', revisao: 1 }, { id: 'r1', revisao: 1, extra: 1 }]) {
      expect(() => registrarReconfirmacao({ ...base, restricao: ruim } as never)).toThrow(ReconfirmacaoInvalidaError);
    }
  });
  it('ausência de restrições só com escopo global e confirmação explícita; nunca a partir de reconfirmação individual', () => {
    const r = registrarReconfirmacao({ ...base, resultado: 'sem_restricoes_declaradas', confirmacaoExplicitaAusencia: true });
    expect(r).toMatchObject({ declaraAusenciaRestricoes: true, renovaAvaliacao: true, escopo: 'avaliacao_global' });
    for (const ruim of [
      { resultado: 'sem_restricoes_declaradas' },
      { resultado: 'sem_restricoes_declaradas', confirmacaoExplicitaAusencia: false },
      { resultado: 'sem_restricoes_declaradas', confirmacaoExplicitaAusencia: 'true' },
      { resultado: 'sem_restricoes_declaradas', confirmacaoExplicitaAusencia: true, restricao: { id: 'r1', revisao: 1 } },
      { resultado: 'sem_alteracao', confirmacaoExplicitaAusencia: true }
    ]) expect(() => registrarReconfirmacao({ ...base, ...ruim } as never)).toThrow(ReconfirmacaoInvalidaError);
  });
  it('pendência mantida e alteração informada não renovam nem declaram ausência (sem declaração falsa)', () => {
    for (const resultado of ['pendencia_mantida', 'alteracao_informada']) {
      const r = registrarReconfirmacao({ ...base, resultado });
      expect(r).toMatchObject({ renovaAvaliacao: false, declaraAusenciaRestricoes: false, alteraRestricao: false });
      expect(r.venceEm).toBeUndefined();
    }
  });
  it('exige atestação explícita verdadeira', () => {
    for (const a of [false, undefined, 'true', 1]) expect(() => registrarReconfirmacao({ ...base, atestacao: a as never })).toThrow(ReconfirmacaoInvalidaError);
  });
  it('exige paciente, avaliação, revisão da avaliação, autor, meio, resultado e instante válidos', () => {
    for (const ruim of [{ atestadoPor: '' }, { pacienteId: '' }, { avaliacaoId: '' }, { revisaoAvaliacao: 0 }, { revisaoAvaliacao: 1.5 },
      { revisaoAvaliacao: undefined }, { meio: 'clique' }, { meio: undefined }, { resultado: 'ok' }, { resultado: undefined },
      { agora: 'ontem' }, { agora: '2026-11-12' }]) {
      expect(() => registrarReconfirmacao({ ...base, ...ruim } as never)).toThrow(ReconfirmacaoInvalidaError);
    }
    for (const meio of ['presencial', 'teleconsulta', 'portal', 'contato_documentado']) expect(registrarReconfirmacao({ ...base, meio }).meio).toBe(meio);
  });
  it('não aceita mais o formato antigo só por restrição (sem avaliação)', () => {
    expect(() => registrarReconfirmacao({ agora: base.agora, restricaoId: 'r1', revisaoRestricao: 3, atestadoPor: 'usuario-1', atestacao: true } as never))
      .toThrow(ReconfirmacaoInvalidaError);
  });
  it('entrada fechada e erro sem eco', () => {
    for (const ruim of [null, { ...base, extra: 1 }, { ...base, atestadoPor: CANARIO + '\n' }, { ...base, resultado: CANARIO }]) {
      try { registrarReconfirmacao(ruim as never); fail('deveria falhar'); } catch (e) {
        expect(e).toBeInstanceOf(ReconfirmacaoInvalidaError); expect(String((e as Error).message)).not.toContain(CANARIO);
      }
    }
  });
});

describe('FOOD06 R3: resultado cifrado da reconfirmação', () => {
  it('só o vocabulário fechado, com observação opcional', () => {
    expect(validarResultadoReconfirmacao({ resultado: 'pendencia_mantida' })).toEqual({ resultado: 'pendencia_mantida' });
    expect(validarResultadoReconfirmacao({ resultado: 'sem_alteracao', observacao: 'nota' })).toEqual({ resultado: 'sem_alteracao', observacao: 'nota' });
    for (const ruim of [{ resultado: 'ok' }, {}, { resultado: 'sem_alteracao', observacao: '' }, { resultado: 'sem_alteracao', extra: 1 }, null]) {
      expect(() => validarResultadoReconfirmacao(ruim)).toThrow(ReconfirmacaoInvalidaError);
    }
  });
});

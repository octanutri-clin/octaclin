import { avaliarInativacao, InativacaoInvalidaError } from './inativacao-restricao-protegida';

/** FOOD06 PR-D (Q3): inativar alergia/celíaca confirmada. Sem reautenticação; caixa de confirmação em dois passos. */
const CANARIO = 'CANARIO_INATIVACAO_NAO_VAZAR';
const base = {
  restricao: { id: 'r1', revisao: 2, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', confirmacao: 'confirmada', estado: 'ativa', gravidade: 'leve' },
  motivo: 'Paciente refez teste e não há mais alergia', justificativa: 'Laudo apresentado em consulta', confirmacaoEmDoisPassos: true,
  impressoesAfetadas: ['imp-b', 'imp-a']
};

describe('FOOD06 PR-D: inativação protegida', () => {
  it('alergia confirmada: protegida, exige motivo e justificativa, dois passos e nenhuma reautenticação', () => {
    const r = avaliarInativacao(base);
    expect(r).toMatchObject({ protegida: true, permitida: true, exigeReautenticacao: false, invalidaPrevias: true });
    expect(r.impressoesInvalidadas).toEqual(['imp-a', 'imp-b']);
  });
  it('protegida em qualquer gravidade, inclusive não informada ou ausente', () => {
    for (const g of ['leve', 'moderada', 'grave', 'nao_informada', undefined]) {
      const r = avaliarInativacao({ ...base, restricao: { ...base.restricao, gravidade: g } });
      expect(r.protegida).toBe(true); expect(r.exigeReautenticacao).toBe(false);
    }
  });
  it('doença celíaca (doença com restrição) confirmada também é protegida', () => {
    expect(avaliarInativacao({ ...base, restricao: { ...base.restricao, subtipoClinico: 'doenca_ou_condicao_com_restricao' } }).protegida).toBe(true);
  });
  it('sem motivo, sem justificativa ou sem confirmação em dois passos: não permitida', () => {
    for (const ruim of [{ motivo: '   ' }, { justificativa: '' }, { confirmacaoEmDoisPassos: false }]) {
      expect(avaliarInativacao({ ...base, ...ruim })).toMatchObject({ permitida: false, protegida: true });
    }
  });
  it('intolerância confirmada e escolha: não protegidas, mas ainda exigem motivo', () => {
    const intol = avaliarInativacao({ ...base, restricao: { ...base.restricao, subtipoClinico: 'intolerancia_alimentar' } });
    expect(intol).toMatchObject({ protegida: false, permitida: true, exigeReautenticacao: false });
    const sem = avaliarInativacao({ ...base, motivo: '', restricao: { ...base.restricao, subtipoClinico: 'intolerancia_alimentar' } });
    expect(sem.permitida).toBe(false);
  });
  it('restrição pendente ou rejeitada não é protegida (não há confirmação a proteger)', () => {
    expect(avaliarInativacao({ ...base, restricao: { ...base.restricao, confirmacao: 'pendente' } }).protegida).toBe(false);
  });
  it('já inativa não pode ser inativada de novo', () => {
    expect(avaliarInativacao({ ...base, restricao: { ...base.restricao, estado: 'inativa' } }).permitida).toBe(false);
  });
  it('gravidade fora do vocabulário é recusada', () => {
    expect(() => avaliarInativacao({ ...base, restricao: { ...base.restricao, gravidade: 'x' } })).toThrow(InativacaoInvalidaError);
  });
  it('entrada fechada e erro sem eco', () => {
    for (const ruim of [null, { ...base, extra: 1 }, { ...base, motivo: CANARIO + '\u0000' }, { ...base, impressoesAfetadas: 'x' }, { ...base, restricao: { ...base.restricao, natureza: CANARIO } }]) {
      try { avaliarInativacao(ruim as never); fail('deveria falhar'); } catch (e) {
        expect(e).toBeInstanceOf(InativacaoInvalidaError); expect(String((e as Error).message)).not.toContain(CANARIO);
      }
    }
  });
});

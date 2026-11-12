import { transicionarSolicitacao, SolicitacaoInvalidaError, type EstadoSolicitacao } from './solicitacao-restricao-paciente';

/** FOOD06 PR-D (D7-a, contrato v3): máquina de estados da solicitação do paciente. Só dados sintéticos. */
const CANARIO = 'CANARIO_SOLICITACAO_NAO_VAZAR';
const ESTADOS: EstadoSolicitacao[] = ['criada', 'em_analise', 'atendida', 'recusada', 'cancelada_pelo_paciente'];
const VALIDAS: Array<[EstadoSolicitacao, string, EstadoSolicitacao]> = [
  ['criada', 'iniciar_analise', 'em_analise'], ['criada', 'cancelar', 'cancelada_pelo_paciente'],
  ['em_analise', 'atender', 'atendida'], ['em_analise', 'recusar', 'recusada'], ['em_analise', 'cancelar', 'cancelada_pelo_paciente']
];
const ACOES = ['iniciar_analise', 'atender', 'recusar', 'cancelar'];

describe('FOOD06 PR-D: solicitação do paciente', () => {
  it.each(VALIDAS)('%s + %s -> %s', (de, acao, para) => {
    expect(transicionarSolicitacao({ estado: de, acao, ator: acao === 'cancelar' ? 'paciente' : 'profissional' }).estado).toBe(para);
  });
  it('todo par fora da tabela é recusado (produto cartesiano)', () => {
    for (const de of ESTADOS) for (const acao of ACOES) {
      if (VALIDAS.some(v => v[0] === de && v[1] === acao)) continue;
      expect(() => transicionarSolicitacao({ estado: de, acao, ator: 'profissional' })).toThrow(SolicitacaoInvalidaError);
    }
  });
  it('estados finais não saem', () => {
    for (const f of ['atendida', 'recusada', 'cancelada_pelo_paciente'] as const) for (const a of ACOES) {
      // Com o ator correto para a ação: só o estado final impede a saída.
      expect(() => transicionarSolicitacao({ estado: f, acao: a, ator: a === 'cancelar' ? 'paciente' : 'profissional' })).toThrow(SolicitacaoInvalidaError);
    }
  });
  it('só o paciente cancela e só o profissional analisa, atende ou recusa', () => {
    expect(() => transicionarSolicitacao({ estado: 'criada', acao: 'cancelar', ator: 'profissional' })).toThrow(SolicitacaoInvalidaError);
    expect(() => transicionarSolicitacao({ estado: 'criada', acao: 'iniciar_analise', ator: 'paciente' })).toThrow(SolicitacaoInvalidaError);
    expect(() => transicionarSolicitacao({ estado: 'em_analise', acao: 'atender', ator: 'paciente' })).toThrow(SolicitacaoInvalidaError);
  });
  it('devolve chave de texto, nunca texto, e nunca altera restrição', () => {
    const r = transicionarSolicitacao({ estado: 'em_analise', acao: 'recusar', ator: 'profissional' });
    expect(r).toEqual({ estado: 'recusada', chaveTexto: 'restricoes.solicitacao.recusada', alteraRestricao: false });
    for (const [de, acao, ] of VALIDAS) expect(transicionarSolicitacao({ estado: de, acao, ator: acao === 'cancelar' ? 'paciente' : 'profissional' }).alteraRestricao).toBe(false);
  });
  it('entrada fechada e erro sem eco', () => {
    for (const ruim of [null, [], { estado: 'criada', acao: 'cancelar', ator: 'paciente', extra: 1 }, { estado: CANARIO, acao: 'cancelar', ator: 'paciente' }, { estado: 'criada', acao: CANARIO, ator: 'paciente' }]) {
      try { transicionarSolicitacao(ruim as never); fail('deveria falhar'); } catch (e) {
        expect(e).toBeInstanceOf(SolicitacaoInvalidaError); expect(String((e as Error).message)).not.toContain(CANARIO);
      }
    }
  });
});

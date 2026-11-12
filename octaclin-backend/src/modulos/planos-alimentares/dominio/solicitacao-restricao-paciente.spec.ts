import { transicionarSolicitacao, validarDesfechoSolicitacao, validarPedidoSolicitacao, SolicitacaoInvalidaError, ESTADOS_SOLICITACAO, ESTADOS_FINAIS_SOLICITACAO, type EstadoSolicitacao } from './solicitacao-restricao-paciente';

/** FOOD06 PR-D (D7-a, contrato v3): máquina de estados da solicitação do paciente. Só dados sintéticos. */
const CANARIO = 'CANARIO_SOLICITACAO_NAO_VAZAR';
const ESTADOS: EstadoSolicitacao[] = ['criada', 'em_analise', 'atendida', 'parcial', 'recusada', 'cancelada_pelo_paciente'];
const VALIDAS: Array<[EstadoSolicitacao, string, EstadoSolicitacao]> = [
  ['criada', 'iniciar_analise', 'em_analise'], ['criada', 'cancelar', 'cancelada_pelo_paciente'],
  ['em_analise', 'atender', 'atendida'], ['em_analise', 'atender_parcialmente', 'parcial'], ['em_analise', 'recusar', 'recusada'], ['em_analise', 'cancelar', 'cancelada_pelo_paciente']
];
const ACOES = ['iniciar_analise', 'atender', 'atender_parcialmente', 'recusar', 'cancelar'];

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
    for (const f of ['atendida', 'parcial', 'recusada', 'cancelada_pelo_paciente'] as const) for (const a of ACOES) {
      // Com o ator correto para a ação: só o estado final impede a saída.
      expect(() => transicionarSolicitacao({ estado: f, acao: a, ator: a === 'cancelar' ? 'paciente' : 'profissional' })).toThrow(SolicitacaoInvalidaError);
    }
  });
  it('só o paciente cancela e só o profissional analisa, atende ou recusa', () => {
    expect(() => transicionarSolicitacao({ estado: 'criada', acao: 'cancelar', ator: 'profissional' })).toThrow(SolicitacaoInvalidaError);
    expect(() => transicionarSolicitacao({ estado: 'criada', acao: 'iniciar_analise', ator: 'paciente' })).toThrow(SolicitacaoInvalidaError);
    expect(() => transicionarSolicitacao({ estado: 'em_analise', acao: 'atender', ator: 'paciente' })).toThrow(SolicitacaoInvalidaError);
    expect(() => transicionarSolicitacao({ estado: 'em_analise', acao: 'atender_parcialmente', ator: 'paciente' })).toThrow(SolicitacaoInvalidaError);
    expect(() => transicionarSolicitacao({ estado: 'criada', acao: 'atender_parcialmente', ator: 'profissional' })).toThrow(SolicitacaoInvalidaError);
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
  it('D1 (#531): parcial é terminal, tem chave própria e as listas exportadas batem com a tabela do banco', () => {
    expect(transicionarSolicitacao({ estado: 'em_analise', acao: 'atender_parcialmente', ator: 'profissional' }))
      .toEqual({ estado: 'parcial', chaveTexto: 'restricoes.solicitacao.parcial', alteraRestricao: false });
    expect([...ESTADOS_SOLICITACAO]).toEqual(['criada', 'em_analise', 'atendida', 'parcial', 'recusada', 'cancelada_pelo_paciente']);
    expect([...ESTADOS_FINAIS_SOLICITACAO]).toEqual(['atendida', 'parcial', 'recusada', 'cancelada_pelo_paciente']);
    // chaves de texto são independentes do estado interno: nenhuma chave expõe "em_analise" nem nome técnico
    const chaves = VALIDAS.map(([de, acao]) => transicionarSolicitacao({ estado: de, acao, ator: acao === 'cancelar' ? 'paciente' : 'profissional' }).chaveTexto);
    for (const c of chaves) expect(c).toMatch(/^restricoes\.solicitacao\.(em_analise|atendida|parcial|recusada|cancelada)$/);
  });
});

describe('FOOD06 D1 (#531): desfecho distingue o que mudou do que não mudou, sem alterar restrição', () => {
  const alterado = { item: 'item-1', restricaoId: 'r1', revisaoResultante: 4 };
  it('parcial exige ao menos um item alterado (com a revisão da operação clínica) e um inalterado, disjuntos', () => {
    expect(validarDesfechoSolicitacao({ estadoFinal: 'parcial', alterados: [alterado], inalterados: ['item-2'] }))
      .toEqual({ estadoFinal: 'parcial', alterados: [alterado], inalterados: ['item-2'], alteraRestricao: false });
    for (const ruim of [
      { estadoFinal: 'parcial', alterados: [], inalterados: ['item-2'] },
      { estadoFinal: 'parcial', alterados: [alterado], inalterados: [] },
      { estadoFinal: 'parcial', alterados: [alterado], inalterados: ['item-1'] },
      { estadoFinal: 'parcial', alterados: [alterado, alterado], inalterados: ['item-2'] },
      { estadoFinal: 'parcial', alterados: [{ item: 'item-1', restricaoId: 'r1' }], inalterados: ['item-2'] },
      { estadoFinal: 'parcial', alterados: [{ ...alterado, revisaoResultante: 0 }], inalterados: ['item-2'] },
      { estadoFinal: 'parcial', alterados: [alterado], inalterados: ['item-2', 'item-2'] }
    ]) expect(() => validarDesfechoSolicitacao(ruim as never)).toThrow(SolicitacaoInvalidaError);
  });
  it('atendida só com alterados; recusada só com inalterados; nenhum outro estado tem desfecho', () => {
    expect(validarDesfechoSolicitacao({ estadoFinal: 'atendida', alterados: [alterado], inalterados: [] }).alterados).toHaveLength(1);
    expect(validarDesfechoSolicitacao({ estadoFinal: 'recusada', alterados: [], inalterados: ['item-1'] }).inalterados).toEqual(['item-1']);
    for (const ruim of [
      { estadoFinal: 'atendida', alterados: [alterado], inalterados: ['item-2'] }, { estadoFinal: 'atendida', alterados: [], inalterados: [] },
      { estadoFinal: 'recusada', alterados: [alterado], inalterados: ['item-2'] }, { estadoFinal: 'recusada', alterados: [], inalterados: [] },
      { estadoFinal: 'em_analise', alterados: [], inalterados: ['item-1'] }, { estadoFinal: 'cancelada_pelo_paciente', alterados: [], inalterados: ['item-1'] }
    ]) expect(() => validarDesfechoSolicitacao(ruim as never)).toThrow(SolicitacaoInvalidaError);
  });
  it('ordena de forma estável, limita o tamanho e não ecoa conteúdo no erro', () => {
    const r = validarDesfechoSolicitacao({ estadoFinal: 'parcial', alterados: [{ ...alterado, item: 'b' }, { ...alterado, item: 'a' }], inalterados: ['d', 'c'] });
    expect(r.alterados.map(a => a.item)).toEqual(['a', 'b']); expect(r.inalterados).toEqual(['c', 'd']);
    expect(() => validarDesfechoSolicitacao({ estadoFinal: 'recusada', alterados: [], inalterados: Array.from({ length: 201 }, (_, i) => `i${i}`) })).toThrow(SolicitacaoInvalidaError);
    for (const ruim of [null, { estadoFinal: 'parcial', alterados: [alterado], inalterados: [CANARIO + ' x'] }, { estadoFinal: 'parcial', alterados: [alterado], inalterados: ['i'], extra: 1 }]) {
      try { validarDesfechoSolicitacao(ruim as never); fail('deveria falhar'); } catch (e) {
        expect(e).toBeInstanceOf(SolicitacaoInvalidaError); expect(String((e as Error).message)).not.toContain(CANARIO);
      }
    }
  });
});

describe('FOOD06 R3: pedido do paciente (conteúdo cifrado da solicitação)', () => {
  it('itens com chave única e texto; recusa vazio, duplicado, extra, controle e limites', () => {
    expect(validarPedidoSolicitacao({ itens: [{ item: 'a', texto: 'x' }] })).toEqual({ itens: [{ item: 'a', texto: 'x' }] });
    for (const ruim of [{ itens: [] }, { itens: [{ item: 'a', texto: 'x' }, { item: 'a', texto: 'y' }] }, { itens: [{ item: 'a', texto: '' }] },
      { itens: [{ item: 'a b', texto: 'x' }] }, { itens: [{ item: 'a', texto: 'x', extra: 1 }] }, { itens: [{ item: 'a', texto: 'x\u0007' }] },
      { itens: [{ item: 'a', texto: 'x'.repeat(1001) }] }, { itens: Array.from({ length: 201 }, (_, i) => ({ item: `i${i}`, texto: 'x' })) }, { itens: [], extra: 1 }, null]) {
      expect(() => validarPedidoSolicitacao(ruim)).toThrow(SolicitacaoInvalidaError);
    }
  });
});

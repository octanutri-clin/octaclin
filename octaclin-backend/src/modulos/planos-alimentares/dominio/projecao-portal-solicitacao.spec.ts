import { CHAVES_TEXTO_PORTAL_SOLICITACAO, projetarSolicitacaoPortal } from './projecao-portal-solicitacao';
import { ESTADOS_SOLICITACAO } from './solicitacao-restricao-paciente';

/** FOOD06 P2c (D7-a, Q11): o que o portal pode mostrar de um pedido. Allowlist; nada interno passa. */
const base = { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', tipo: 'correcao', criadoEm: '2026-11-10T10:00:00.000Z' };
const interno = { justificativaInterna: 'CANARIO_JUSTIFICATIVA', autorUsuarioId: 'CANARIO_AUTOR', decididoPorUsuarioId: 'CANARIO_DECISOR',
  restricaoId: 'CANARIO_RESTRICAO', revisao: 7, desfecho: { alterados: ['CANARIO_DESFECHO'] } };

describe('projeção do pedido para o portal', () => {
  it.each(ESTADOS_SOLICITACAO.map(e => [e]))('estado %s vira só uma chave de texto, sem o estado interno', estado => {
    const decidida = ['atendida', 'parcial', 'recusada'].includes(estado);
    const saida = projetarSolicitacaoPortal({ ...base, ...interno, estado,
      ...(decidida ? { decididoEm: '2026-11-11T10:00:00.000Z', explicacaoPaciente: 'Conferimos e mantivemos.' } : {}) });
    expect(Object.keys(saida).sort()).toEqual(decidida ? ['chaveTexto', 'criadoEm', 'decididoEm', 'explicacao', 'id', 'tipo'] : ['chaveTexto', 'criadoEm', 'id', 'tipo']);
    expect(CHAVES_TEXTO_PORTAL_SOLICITACAO).toContain(saida.chaveTexto);
    expect(JSON.stringify(saida)).not.toMatch(/CANARIO_|estado|em_analise|cancelada_pelo_paciente/);
  });
  it('as chaves de texto são distintas por estado e prefixadas', () => {
    const chaves = ESTADOS_SOLICITACAO.map(estado => projetarSolicitacaoPortal({ ...base, estado,
      ...(['atendida', 'parcial', 'recusada'].includes(estado) ? { decididoEm: '2026-11-11T10:00:00.000Z', explicacaoPaciente: 'x' } : {}) }).chaveTexto);
    expect(new Set(chaves).size).toBe(ESTADOS_SOLICITACAO.length);
    for (const c of chaves) expect(c).toMatch(/^restricoes\.solicitacao\.[a-z_]+$/);
  });
  it('decidida sem explicação ao paciente falha fechado (nunca mostra decisão sem explicação)', () => {
    expect(() => projetarSolicitacaoPortal({ ...base, estado: 'recusada', decididoEm: '2026-11-11T10:00:00.000Z' })).toThrow();
  });
  it('pedido aberto nunca mostra explicação, mesmo se vier', () => {
    expect(projetarSolicitacaoPortal({ ...base, estado: 'em_analise', explicacaoPaciente: 'CANARIO_EXPLICACAO' })).not.toHaveProperty('explicacao');
  });
  it.each([{ ...base, estado: 'desconhecido' }, { ...base, tipo: 'outro', estado: 'criada' }, { ...base, id: 'x', estado: 'criada' }, null])(
    'entrada inválida %p falha fechado sem eco', entrada => {
      expect(() => projetarSolicitacaoPortal(entrada as never)).toThrow('Projeção indisponível.');
    });
});

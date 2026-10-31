import { AJUDA_DIETETICA, EXPLICACOES_DIETETICAS } from './explicacoes-dieteticas';
const motivos = ['contexto_nao_elegivel', 'dia_nao_confirmado', 'dados_incompletos', 'valor_invalido',
  'referencia_indisponivel', 'definicao_incompativel', 'unidade_incompativel', 'abrangencia_ul_incompativel',
  'tabagismo_nao_informado', 'nao_estabelecido', 'limite_precisao'] as const;
describe('FOOD06 M03/M09 catálogo explicativo sem dados clínicos', () => {
  it.each(motivos)('motivo %s possui mensagem, detalhe e ação específica', motivo => {
    expect(EXPLICACOES_DIETETICAS[motivo]).toEqual({ mensagem: expect.any(String), detalhe: expect.any(String), acao: expect.any(String) });
    expect(EXPLICACOES_DIETETICAS[motivo].mensagem.length).toBeGreaterThan(15);
  });
  it('não confunde contexto, dados, fonte, forma e precisão', () => {
    expect(new Set(motivos.map(m => EXPLICACOES_DIETETICAS[m]?.mensagem)).size).toBe(motivos.length);
    expect(EXPLICACOES_DIETETICAS.tabagismo_nao_informado.acao).toBe('informar_tabagismo');
    expect(EXPLICACOES_DIETETICAS.dia_nao_confirmado.acao).toBe('confirmar_dia');
    expect(EXPLICACOES_DIETETICAS.abrangencia_ul_incompativel.detalhe).toContain('suplementos');
  });
  it('não equipara AI à RDA ou ingestão planejada à real', () => {
    expect(AJUDA_DIETETICA.RDA).toContain('não comprova deficiência');
    expect(AJUDA_DIETETICA.AI).toContain('não permite concluir inadequação');
    expect(AJUDA_DIETETICA.UL).toContain('não garante segurança individual');
    expect(AJUDA_DIETETICA.UL).toContain('não é uma meta');
    expect(AJUDA_DIETETICA.planejado).toContain('não representa consumo efetivo');
    expect(AJUDA_DIETETICA.parcial).toContain('total real desconhecido');
  });
  it('catálogos são imutáveis e não admitem dados livres de paciente', () => {
    expect(Object.isFrozen(EXPLICACOES_DIETETICAS)).toBe(true);
    expect(Object.isFrozen(AJUDA_DIETETICA)).toBe(true);
    for (const explicacao of Object.values(EXPLICACOES_DIETETICAS)) expect(Object.isFrozen(explicacao)).toBe(true);
  });
});

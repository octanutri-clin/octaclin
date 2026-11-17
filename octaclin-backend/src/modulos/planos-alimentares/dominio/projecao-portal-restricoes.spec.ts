import { CHAVES_SELO_PORTAL_RESTRICAO, projetarResumoPortal } from './projecao-portal-restricoes';

const id = (n: number) => `${String(n).repeat(8)}-1111-4111-8111-111111111111`;
const alergia = { schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alergeno', id: 'alvo-sintetico' },
  gravidade: 'grave', observacao: 'CANARIO_OBSERVACAO_DA_EQUIPE' } as const;
const linha = (n: number, extra: Record<string, unknown> = {}) => ({ id: id(n), origem: 'profissional', estado: 'ativa', confirmacao: 'confirmada', conteudo: alergia, ...extra });

describe('resumo de restrições do portal (Q11, P2d-3b)', () => {
  it('confirmadas e ativas viram "registrada"; pendentes do paciente e da equipe têm selos próprios', () => {
    const r = projetarResumoPortal([
      linha(1),
      linha(2, { confirmacao: 'pendente', origem: 'declaracao_paciente' }),
      linha(3, { confirmacao: 'pendente', origem: 'colaborador' }),
      linha(4, { confirmacao: 'pendente', origem: 'profissional' }),
      linha(5, { estado: 'em_reavaliacao' })
    ], { confirmadoEm: new Date('2026-11-10T12:00:00.000Z') });
    expect(r.restricoes.map(x => [x.id, x.selo])).toEqual([
      [id(1), 'restricoes.portal.registrada'], [id(2), 'restricoes.portal.informada_por_voce'],
      [id(3), 'restricoes.portal.anotada_pela_equipe'], [id(4), 'restricoes.portal.anotada_pela_equipe'], [id(5), 'restricoes.portal.registrada']]);
    expect(r.ultimaConfirmacaoEm).toBe('2026-11-10T12:00:00.000Z');
  });
  it('só a allowlist: natureza, subtipo, alvo, alvo declarado e gravidade; nunca observação, origem, estado ou confirmação crus', () => {
    const r = projetarResumoPortal([linha(1)], null);
    expect(r).toEqual({ restricoes: [{ id: id(1), selo: 'restricoes.portal.registrada', natureza: 'clinica', subtipoClinico: 'alergia_alimentar',
      alvo: { tipo: 'alergeno', id: 'alvo-sintetico' }, gravidade: 'grave' }] });
    expect(JSON.stringify(r)).not.toMatch(/CANARIO_|observacao|origem|"estado"|confirmacao|revisao|autor/);
  });
  it('rejeitadas, inativas e preferências não aparecem', () => {
    const r = projetarResumoPortal([
      linha(1, { confirmacao: 'rejeitada' }), linha(2, { estado: 'inativa' }),
      linha(3, { conteudo: { schemaVersao: 1, natureza: 'preferencia', alvo: { tipo: 'alimento', id: 'x' } } })
    ], null);
    expect(r.restricoes).toEqual([]);
  });
  it('não catalogada leva o texto declarado do alvo, sem id', () => {
    const r = projetarResumoPortal([linha(1, { conteudo: { schemaVersao: 1, natureza: 'escolha', alvo: { tipo: 'nao_catalogado' }, alvoDeclarado: 'Item sintético' } })], null);
    expect(r.restricoes[0]).toEqual({ id: id(1), selo: 'restricoes.portal.registrada', natureza: 'escolha', alvo: { tipo: 'nao_catalogado' }, alvoDeclarado: 'Item sintético' });
  });
  it.each([
    ['id inválido', [linha(1, { id: 'CANARIO' })]],
    ['estado desconhecido', [linha(1, { estado: 'CANARIO' })]],
    ['origem desconhecida', [linha(1, { origem: 'CANARIO' })]],
    ['conteúdo inválido', [linha(1, { conteudo: { natureza: 'clinica' } })]]
  ])('%s: falha fechado sem eco', (_caso, entradas) => {
    expect(() => projetarResumoPortal(entradas as never, null)).toThrow('Projeção indisponível.');
  });
  it('as chaves de selo são fechadas', () => {
    expect(CHAVES_SELO_PORTAL_RESTRICAO).toEqual(['restricoes.portal.registrada', 'restricoes.portal.informada_por_voce', 'restricoes.portal.anotada_pela_equipe']);
  });
});

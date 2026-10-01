import type { EntityManager } from 'typeorm';
import { condicaoFaixaEfetivaPrioridade, consultarPrioridadesOperacionais } from './projecao-prioridade-acompanhamento';

describe('projecao da prioridade de acompanhamento', () => {
  const agora = new Date('2026-10-01T12:00:00.000Z');

  it('distingue calculo real, override ativo e linha criada sem calculo', async () => {
    const query = jest.fn(async () => [
      { paciente_id: 'calculado', score: 75, faixa: 'alta', override_faixa: null,
        override_expira_em: null, calculado_em: agora, possui_calculo: true },
      { paciente_id: 'ajustado', score: 15, faixa: 'baixa', override_faixa: 'media',
        override_expira_em: '2026-10-02T12:00:00.000Z', calculado_em: agora, possui_calculo: false },
      { paciente_id: 'sem-calculo', score: 0, faixa: 'baixa', override_faixa: null,
        override_expira_em: null, calculado_em: agora, possui_calculo: false },
      { paciente_id: 'expirado', score: 0, faixa: 'baixa', override_faixa: 'alta',
        override_expira_em: '2026-09-30T12:00:00.000Z', calculado_em: agora, possui_calculo: false },
      { paciente_id: 'fora-do-escopo', score: 100, faixa: 'alta', override_faixa: null,
        override_expira_em: null, calculado_em: agora, possui_calculo: true }
    ]);
    const ids = ['calculado', 'ajustado', 'sem-calculo', 'expirado'];
    const prioridades = await consultarPrioridadesOperacionais({ query } as unknown as EntityManager, 'tenant-1', ids, agora);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('prioridade.tenant_id = $1'), ['tenant-1', ids]);
    expect(prioridades.get('calculado')).toEqual({ faixa: 'alta', origem: 'calculado', scoreCalculado: 75, calculadoEm: agora });
    expect(prioridades.get('ajustado')).toEqual({ faixa: 'media', origem: 'override', scoreCalculado: null, calculadoEm: null });
    expect(prioridades.has('sem-calculo')).toBe(false);
    expect(prioridades.has('expirado')).toBe(false);
    expect(prioridades.has('fora-do-escopo')).toBe(false);
  });

  it('nao consulta dados sem pacientes autorizados e filtra por evento real de calculo no SQL', async () => {
    const query = jest.fn();
    expect(await consultarPrioridadesOperacionais({ query } as unknown as EntityManager, 'tenant-1', [])).toEqual(new Map());
    expect(query).not.toHaveBeenCalled();
    expect(condicaoFaixaEfetivaPrioridade('paciente.id')).toContain("historico.tipo_evento = 'calculo'");
    expect(condicaoFaixaEfetivaPrioridade('paciente.id')).toContain('prioridade.paciente_id = paciente.id');
  });
});

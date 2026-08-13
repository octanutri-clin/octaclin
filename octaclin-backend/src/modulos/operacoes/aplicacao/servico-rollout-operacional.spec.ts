import { ServicoRolloutOperacional } from './servico-rollout-operacional';

describe('ServicoRolloutOperacional', () => {
  function criarServico(opcoes: { health?: 'ok' | 'degradado' | 'falha'; falhasFila?: number; taxaErro?: number } = {}) {
    const telemetria = {
      obterSnapshot: jest.fn(() => ({
        processo: { iniciadoEm: '2026-08-13T00:00:00.000Z', uptimeSegundos: 60 },
        http: {
          total: 100,
          sucesso: 98,
          errosCliente: 1,
          errosServidor: opcoes.taxaErro ? opcoes.taxaErro * 100 : 0,
          taxaErro5xx: opcoes.taxaErro ?? 0,
          duracaoMediaMs: 120,
          duracaoP95Ms: 400,
          amostrasDuracao: 100,
          porRota: []
        },
        tracesRecentes: []
      }))
    };
    const saude = {
      verificarDetalhado: jest.fn(async () => ({ status: opcoes.health ?? 'ok', checks: {} }))
    };
    const flags = {
      listar: jest.fn(async () => ({
        configuracaoValida: true,
        flags: [{ chave: 'ia.clinica', habilitada: false, origem: 'padrao' }]
      }))
    };
    const fila = {
      getJobCounts: jest.fn(async () => ({ waiting: 2, active: 1, delayed: 0, failed: opcoes.falhasFila ?? 0 })),
      isPaused: jest.fn(async () => false)
    };
    return new ServicoRolloutOperacional(
      telemetria as never,
      saude as never,
      flags as never,
      fila as never,
      fila as never,
      fila as never
    );
  }

  it('consolida release, HTTP, filas, integracoes e flags sem payloads', async () => {
    const servico = criarServico();
    const resultado = await servico.obter('tenant-1');

    expect(resultado.status).toBe('ok');
    expect(resultado.filas).toHaveLength(3);
    expect(resultado.filas[0]).toEqual(
      expect.objectContaining({ esperando: 2, ativas: 1, atrasadas: 0, falharam: 0, pausada: false })
    );
    expect(resultado.flags.flags[0]).toEqual(expect.objectContaining({ chave: 'ia.clinica', habilitada: false }));
    expect(JSON.stringify(resultado)).not.toContain('payload');
  });

  it('recomenda rollback diante de erro 5xx e observacao para falha historica de fila', async () => {
    await expect(criarServico({ taxaErro: 0.06 }).obter('tenant-1')).resolves.toEqual(
      expect.objectContaining({ status: 'critico', decisaoSugerida: 'rollback' })
    );
    await expect(criarServico({ falhasFila: 1 }).obter('tenant-1')).resolves.toEqual(
      expect.objectContaining({ status: 'atencao', decisaoSugerida: 'observar' })
    );
  });
});

import { EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { registrarNotificacao } from '../../notificacoes/aplicacao/registrar-notificacao';
import { AcaoAutomacaoNaoDisponivel, DespachanteAcoesAutomacao } from './despachante-acoes-automacao';

jest.mock('../../notificacoes/aplicacao/registrar-notificacao', () => ({
  registrarNotificacao: jest.fn()
}));

const registrarNotificacaoMock = jest.mocked(registrarNotificacao);

function criarDespachante() {
  const gerenciador = {} as EntityManager;
  const executar = jest.fn(async (_tenantId: string, operacao: (manager: EntityManager) => Promise<unknown>) =>
    operacao(gerenciador)
  );
  const despachante = new DespachanteAcoesAutomacao({ executar } as unknown as ExecutorTenant);
  return { despachante, executar, gerenciador };
}

const entrada = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  execucaoId: '22222222-2222-4222-8222-222222222222',
  regraId: '33333333-3333-4333-8333-333333333333',
  profissionalId: '44444444-4444-4444-8444-444444444444',
  pacienteId: '55555555-5555-4555-8555-555555555555',
  contexto: { observacaoPrivada: 'nao deve ir para a notificacao' },
  acao: { tipo: 'notificar_profissional' as const },
  chaveIdempotencia: 'automacao:22222222-2222-4222-8222-222222222222:acao:0'
};

describe('DespachanteAcoesAutomacao', () => {
  beforeEach(() => {
    registrarNotificacaoMock.mockReset().mockResolvedValue(1);
  });

  it('registra a notificacao em transacao tenant-aware sem copiar o contexto', async () => {
    const { despachante, executar, gerenciador } = criarDespachante();

    await expect(despachante.executar(entrada)).resolves.toEqual({ status: 'executada' });

    expect(executar).toHaveBeenCalledWith(entrada.tenantId, expect.any(Function));
    expect(registrarNotificacaoMock).toHaveBeenCalledWith(gerenciador, entrada.tenantId, {
      tipo: 'automacao_executada',
      recursoTipo: 'execucao_automacao',
      recursoId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
      pacienteId: entrada.pacienteId,
      profissionalId: entrada.profissionalId
    });
    expect(JSON.stringify(registrarNotificacaoMock.mock.calls)).not.toContain('observacaoPrivada');
  });

  it('usa a mesma identidade em retry e outra identidade para outra acao', async () => {
    const { despachante } = criarDespachante();

    await despachante.executar(entrada);
    await despachante.executar(entrada);
    await despachante.executar({ ...entrada, chaveIdempotencia: `${entrada.chaveIdempotencia.slice(0, -1)}1` });

    const recursos = registrarNotificacaoMock.mock.calls.map(([, , evento]) => evento.recursoId);
    expect(recursos[0]).toBe(recursos[1]);
    expect(recursos[2]).not.toBe(recursos[0]);
  });

  it.each(['criar_tarefa', 'enviar_template'] as const)('mantem %s indisponivel neste incremento', async (tipo) => {
    const { despachante, executar } = criarDespachante();

    await expect(despachante.executar({ ...entrada, acao: { tipo } })).rejects.toBeInstanceOf(
      AcaoAutomacaoNaoDisponivel
    );
    expect(executar).not.toHaveBeenCalled();
  });

  it('propaga falha de persistencia para o retry do processador', async () => {
    registrarNotificacaoMock.mockRejectedValueOnce(new Error('banco indisponivel'));
    const { despachante } = criarDespachante();

    await expect(despachante.executar(entrada)).rejects.toThrow('banco indisponivel');
  });
});

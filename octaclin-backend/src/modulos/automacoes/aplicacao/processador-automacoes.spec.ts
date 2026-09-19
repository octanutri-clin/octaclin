import { Job } from 'bullmq';
import { In } from 'typeorm';
import { ExecucaoRegraOrm } from '../infraestrutura/execucao-regra.orm';
import { RegraAutomacaoOrm } from '../infraestrutura/regra-automacao.orm';
import {
  AcaoAutomacaoNaoDisponivel,
  DestinoAcaoAutomacaoInvalido,
  DespachanteAcoesAutomacao
} from './despachante-acoes-automacao';
import { ProcessadorAutomacoes } from './processador-automacoes';

function criarCenario(opcoes: {
  status?: ExecucaoRegraOrm['status'];
  resultado?: Record<string, unknown>;
  condicoes?: Array<Record<string, unknown>>;
  acoes?: Array<Record<string, unknown>>;
  gatilho?: Record<string, unknown>;
  executarAcao?: jest.Mock;
} = {}) {
  const execucao = {
    id: 'execucao-1',
    tenantId: 'tenant-1',
    regraId: 'regra-1',
    pacienteId: 'paciente-1',
    status: opcoes.status ?? 'pendente',
    resultado: opcoes.resultado ?? { contexto: { checkinsPerdidos: 3 } },
    criadoEm: new Date('2026-09-19T12:00:00.000Z')
  } as ExecucaoRegraOrm;
  const regra = {
    id: 'regra-1',
    tenantId: 'tenant-1',
    profissionalId: 'profissional-1',
    ativa: true,
    gatilho: opcoes.gatilho ?? { tipo: 'checkin.atrasado' },
    condicoes: opcoes.condicoes ?? [{ campo: 'checkinsPerdidos', operador: 'maior_ou_igual', valor: 3 }],
    acoes: opcoes.acoes ?? [{ tipo: 'notificar_profissional' }]
  } as unknown as RegraAutomacaoOrm;

  const repositorioExecucoes = {
    update: jest.fn(async (criterios: { status: unknown }, alteracao: Partial<ExecucaoRegraOrm>) => {
      const valorStatus = criterios.status as { _value?: ExecucaoRegraOrm['status'][] } | ExecucaoRegraOrm['status'];
      const permitidos = typeof valorStatus === 'string' ? [valorStatus] : valorStatus._value ?? [];
      if (!permitidos.includes(execucao.status)) return { affected: 0 };
      Object.assign(execucao, alteracao);
      return { affected: 1 };
    }),
    findOne: jest.fn(async () => execucao),
    save: jest.fn(async (valor: ExecucaoRegraOrm) => Object.assign(execucao, valor))
  };
  const repositorioRegras = { findOne: jest.fn(async () => regra) };
  const gerenciador = {
    getRepository: jest.fn((entidade: unknown) => {
      if (entidade === ExecucaoRegraOrm) return repositorioExecucoes;
      if (entidade === RegraAutomacaoOrm) return repositorioRegras;
      throw new Error('Repositorio inesperado.');
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (manager: typeof gerenciador) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };
  const executarAcao = opcoes.executarAcao ?? jest.fn(async () => ({ status: 'executada' as const }));
  const despachante = { executar: executarAcao } as unknown as DespachanteAcoesAutomacao;
  const processador = new ProcessadorAutomacoes(executorTenant as never, despachante);

  function job(attemptsMade = 0, stalledCounter = 0, attemptsStarted = attemptsMade + stalledCounter + 1) {
    return {
      data: {
        tenantId: 'tenant-1',
        execucaoId: 'execucao-1',
        contexto: { checkinsPerdidos: 3 }
      },
      attemptsMade,
      stalledCounter,
      attemptsStarted,
      opts: { attempts: 3 }
    } as Job;
  }

  return { processador, execucao, regra, executarAcao, repositorioExecucoes, job };
}

describe('ProcessadorAutomacoes', () => {
  it('ignora a execucao sem chamar efeitos quando as condicoes nao sao atendidas', async () => {
    const cenario = criarCenario({ condicoes: [{ campo: 'checkinsPerdidos', operador: 'maior_que', valor: 5 }] });

    await cenario.processador.process(cenario.job());

    expect(cenario.executarAcao).not.toHaveBeenCalled();
    expect(cenario.execucao.status).toBe('ignorado');
    expect(cenario.execucao.resultado).toEqual(
      expect.objectContaining({ executar: false, acoes: [], acoesPlanejadas: [] })
    );
  });

  it('conclui somente depois de persistir o resultado individual da acao', async () => {
    const cenario = criarCenario();

    await cenario.processador.process(cenario.job());

    expect(cenario.executarAcao).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        execucaoId: 'execucao-1',
        chaveIdempotencia: 'automacao:execucao-1:acao:0',
        acao: { tipo: 'notificar_profissional' }
      })
    );
    expect(cenario.execucao.status).toBe('executado');
    expect(cenario.execucao.resultado).toEqual(
      expect.objectContaining({
        executar: true,
        acoes: [
          expect.objectContaining({
            indice: 0,
            tipo: 'notificar_profissional',
            status: 'executada',
            tentativas: 1,
            chaveIdempotencia: 'automacao:execucao-1:acao:0'
          })
        ]
      })
    );
  });

  it('devolve a execucao para pendente e retoma a acao depois de falha transitoria', async () => {
    const executarAcao = jest
      .fn()
      .mockRejectedValueOnce(new Error('indisponivel'))
      .mockResolvedValueOnce({ status: 'executada' as const });
    const cenario = criarCenario({ executarAcao });

    await expect(cenario.processador.process(cenario.job())).rejects.toThrow('indisponivel');
    expect(cenario.execucao.status).toBe('pendente');
    expect(cenario.execucao.erro).toBe('Falha temporaria ao executar acao de automacao.');

    await cenario.processador.process(cenario.job(1));

    expect(executarAcao).toHaveBeenCalledTimes(2);
    expect(cenario.execucao.status).toBe('executado');
    expect(cenario.execucao.resultado).toEqual(
      expect.objectContaining({ acoes: [expect.objectContaining({ status: 'executada', tentativas: 2 })] })
    );
  });

  it('encerra como falhou quando a falha transitoria ocorre na ultima tentativa', async () => {
    const executarAcao = jest.fn(async () => {
      throw new Error('indisponivel');
    });
    const cenario = criarCenario({ executarAcao });

    await expect(cenario.processador.process(cenario.job(2))).resolves.toBeUndefined();

    expect(cenario.execucao.status).toBe('falhou');
    expect(cenario.execucao.erro).toBe('Falha definitiva ao executar acao de automacao.');
    expect(cenario.execucao.resultado).toEqual(
      expect.objectContaining({ acoes: [expect.objectContaining({ status: 'falhou', tentativas: 1 })] })
    );
  });

  it('registra falha definitiva sem retry quando um executor recusa a acao', async () => {
    const executarAcao = jest.fn(async () => {
      throw new AcaoAutomacaoNaoDisponivel('enviar_template');
    });
    const cenario = criarCenario({
      acoes: [
        {
          tipo: 'enviar_template',
          canalId: '11111111-1111-4111-8111-111111111111',
          templateId: '22222222-2222-4222-8222-222222222222',
          intervaloMinimoHoras: 24
        }
      ],
      executarAcao
    });

    await expect(cenario.processador.process(cenario.job())).resolves.toBeUndefined();

    expect(cenario.execucao.status).toBe('falhou');
    expect(cenario.execucao.erro).toBe('Acao de automacao ainda nao habilitada.');
    expect(cenario.execucao.resultado).toEqual(
      expect.objectContaining({
        acoes: [expect.objectContaining({ status: 'falhou', codigoErro: 'acao_nao_disponivel' })]
      })
    );
  });

  it('preserva o contrato especializado de template somente no gatilho de inatividade', async () => {
    const cenario = criarCenario({
      gatilho: { tipo: 'paciente.inativo', diasSemConsulta: 60 },
      acoes: [{ tipo: 'enviar_template' }]
    });

    await cenario.processador.process(cenario.job());

    expect(cenario.executarAcao).toHaveBeenCalledWith(
      expect.objectContaining({ acao: { tipo: 'enviar_template' } })
    );
  });

  it('registra o codigo fechado de destino invalido sem retry', async () => {
    const executarAcao = jest.fn(async () => {
      throw new DestinoAcaoAutomacaoInvalido('paciente_obrigatorio');
    });
    const cenario = criarCenario({
      acoes: [{ tipo: 'criar_tarefa', titulo: 'Revisar acompanhamento', prioridade: 'media', prazoDias: 1 }],
      executarAcao
    });

    await expect(cenario.processador.process(cenario.job())).resolves.toBeUndefined();

    expect(executarAcao).toHaveBeenCalledTimes(1);
    expect(cenario.execucao.status).toBe('falhou');
    expect(cenario.execucao.erro).toBe('A acao exige um paciente.');
    expect(cenario.execucao.resultado).toEqual(
      expect.objectContaining({
        acoes: [expect.objectContaining({ status: 'falhou', codigoErro: 'paciente_obrigatorio' })]
      })
    );
  });

  it('recupera uma reivindicacao processando somente em tentativa posterior', async () => {
    const cenario = criarCenario({ status: 'processando' });

    await cenario.processador.process(cenario.job(1));

    expect(cenario.repositorioExecucoes.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: In(['pendente', 'processando']) }),
      { status: 'processando', erro: null }
    );
    expect(cenario.execucao.status).toBe('executado');
  });

  it('recupera processando quando o BullMQ devolve um job stalled sem incrementar attemptsMade', async () => {
    const cenario = criarCenario({ status: 'processando' });

    await cenario.processador.process(cenario.job(0, 1, 2));

    expect(cenario.executarAcao).toHaveBeenCalledTimes(1);
    expect(cenario.execucao.status).toBe('executado');
  });

  it('retoma plano parcial sem repetir uma acao ja concluida', async () => {
    const cenario = criarCenario({
      status: 'processando',
      acoes: [
        { tipo: 'notificar_profissional' },
        { tipo: 'criar_tarefa', titulo: 'Revisar acompanhamento', prioridade: 'media', prazoDias: 1 }
      ],
      resultado: {
        executar: true,
        acoes: [
          {
            indice: 0,
            tipo: 'notificar_profissional',
            chaveIdempotencia: 'automacao:execucao-1:acao:0',
            status: 'executada',
            tentativas: 1
          },
          {
            indice: 1,
            tipo: 'criar_tarefa',
            chaveIdempotencia: 'automacao:execucao-1:acao:1',
            status: 'executando',
            tentativas: 1
          }
        ]
      }
    });

    await cenario.processador.process(cenario.job(1));

    expect(cenario.executarAcao).toHaveBeenCalledTimes(1);
    expect(cenario.executarAcao).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: { tipo: 'criar_tarefa', titulo: 'Revisar acompanhamento', prioridade: 'media', prazoDias: 1 },
        chaveIdempotencia: 'automacao:execucao-1:acao:1'
      })
    );
    expect(cenario.execucao.resultado).toEqual(
      expect.objectContaining({
        acoes: [
          expect.objectContaining({ tipo: 'notificar_profissional', status: 'executada', tentativas: 1 }),
          expect.objectContaining({ tipo: 'criar_tarefa', status: 'executada', tentativas: 2 })
        ]
      })
    );
  });

  it('nao repete uma execucao ja finalizada', async () => {
    const cenario = criarCenario({ status: 'executado' });

    await cenario.processador.process(cenario.job(1));

    expect(cenario.executarAcao).not.toHaveBeenCalled();
  });
});

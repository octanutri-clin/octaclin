import { NotFoundException } from '@nestjs/common';
import { ExecucaoRegraOrm } from '../infraestrutura/execucao-regra.orm';
import { RegraAutomacaoOrm } from '../infraestrutura/regra-automacao.orm';
import { ServicoAutomacoes } from './servico-automacoes';

function criarRepositorioFake(nome: string, dados: Record<string, unknown>) {
  return {
    create: jest.fn((entrada: Record<string, unknown>) => ({ id: `${nome}-1`, ...entrada })),
    save: jest.fn(async (entrada: Record<string, unknown>) => entrada),
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => dados.regra ?? null)
  };
}

function criarServico(dados: Record<string, unknown> = {}) {
  const repositorios = {
    regra: criarRepositorioFake('regra', dados),
    execucao: criarRepositorioFake('execucao', dados)
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === RegraAutomacaoOrm) return repositorios.regra;
      if (entidade === ExecucaoRegraOrm) return repositorios.execucao;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };
  const fila = { add: jest.fn(async () => undefined) };

  return { servico: new ServicoAutomacoes(executorTenant as never, fila as never), fila, repositorios, executorTenant };
}

describe('ServicoAutomacoes', () => {
  it('deve criar regra no contexto do tenant', async () => {
    const { servico, executorTenant, repositorios } = criarServico();

    await servico.criarRegra('tenant-1', {
      profissionalId: 'profissional-1',
      nome: 'Risco alto',
      gatilho: { tipo: 'checkin' },
      condicoes: [{ campo: 'frustracaoScore', operador: 'maior_que', valor: 70 }],
      acoes: [{ tipo: 'notificar_profissional' }]
    });

    expect(executorTenant.executar).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    expect(repositorios.regra.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', profissionalId: 'profissional-1', ativa: true })
    );
  });

  it('deve solicitar avaliacao com busca isolada por tenant e job idempotente', async () => {
    const { servico, fila, repositorios } = criarServico({ regra: { id: 'regra-1', ativa: true } });

    const execucao = await servico.solicitarAvaliacao('tenant-1', {
      regraId: 'regra-1',
      pacienteId: 'paciente-1',
      contexto: { frustracaoScore: 80 }
    });

    expect(repositorios.regra.findOne).toHaveBeenCalledWith({
      where: { id: 'regra-1', tenantId: 'tenant-1', ativa: true }
    });
    expect(repositorios.execucao.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', regraId: 'regra-1', status: 'pendente' })
    );
    expect(fila.add).toHaveBeenCalledWith(
      'avaliar',
      expect.objectContaining({ tenantId: 'tenant-1', execucaoId: execucao.id }),
      expect.objectContaining({ jobId: `execucao-regra:${execucao.id}`, attempts: 3 })
    );
  });

  it('deve rejeitar avaliacao de regra inexistente ou fora do tenant', async () => {
    const { servico } = criarServico({ regra: null });

    await expect(servico.solicitarAvaliacao('tenant-1', { regraId: 'regra-x' })).rejects.toBeInstanceOf(NotFoundException);
  });
});

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { AvaliarRegraDto, CriarRegraAutomacaoDto } from './dtos';
import { ExecucaoRegraOrm } from '../infraestrutura/execucao-regra.orm';
import { RegraAutomacaoOrm } from '../infraestrutura/regra-automacao.orm';

export const FILA_AUTOMACOES = 'automacoes';

@Injectable()
export class ServicoAutomacoes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    @InjectQueue(FILA_AUTOMACOES) private readonly filaAutomacoes: Queue
  ) {}

  async criarRegra(tenantId: string, dados: CriarRegraAutomacaoDto): Promise<RegraAutomacaoOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(RegraAutomacaoOrm).save(
        gerenciador.getRepository(RegraAutomacaoOrm).create({
          tenantId,
          profissionalId: dados.profissionalId,
          nome: dados.nome,
          gatilho: dados.gatilho,
          condicoes: dados.condicoes,
          acoes: dados.acoes,
          ativa: dados.ativa ?? true
        })
      )
    );
  }

  async listarRegras(tenantId: string): Promise<RegraAutomacaoOrm[]> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(RegraAutomacaoOrm).find({ where: { tenantId }, order: { criadoEm: 'DESC' } })
    );
  }

  async listarExecucoes(tenantId: string): Promise<ExecucaoRegraOrm[]> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(ExecucaoRegraOrm).find({
        where: { tenantId },
        order: { criadoEm: 'DESC' },
        take: 50
      })
    );
  }

  async solicitarAvaliacao(tenantId: string, dados: AvaliarRegraDto): Promise<ExecucaoRegraOrm> {
    const execucao = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const regra = await gerenciador.getRepository(RegraAutomacaoOrm).findOne({
        where: { id: dados.regraId, tenantId, ativa: true }
      });
      if (!regra) throw new NotFoundException('Regra de automacao nao encontrada ou inativa.');

      return gerenciador.getRepository(ExecucaoRegraOrm).save(
        gerenciador.getRepository(ExecucaoRegraOrm).create({
          tenantId,
          regraId: dados.regraId,
          pacienteId: dados.pacienteId,
          status: 'pendente',
          resultado: { contexto: dados.contexto ?? {} }
        })
      );
    });

    await this.filaAutomacoes.add(
      'avaliar',
      { tenantId, execucaoId: execucao.id, contexto: dados.contexto ?? {} },
      { jobId: `execucao-regra:${execucao.id}`, attempts: 3, backoff: { type: 'exponential', delay: 3000 } }
    );

    return execucao;
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Job } from 'bullmq';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { avaliarCondicoes } from '../dominio/avaliador-regras';
import { ExecucaoRegraOrm } from '../infraestrutura/execucao-regra.orm';
import { RegraAutomacaoOrm } from '../infraestrutura/regra-automacao.orm';
import { FILA_AUTOMACOES } from './servico-automacoes';

interface JobAutomacao {
  tenantId: string;
  execucaoId: string;
  contexto: Record<string, unknown>;
}

@Injectable()
@Processor(FILA_AUTOMACOES)
export class ProcessadorAutomacoes extends WorkerHost {
  constructor(private readonly executorTenant: ExecutorTenant) {
    super();
  }

  async process(job: Job<JobAutomacao>): Promise<void> {
    await this.executorTenant.executar(job.data.tenantId, async (gerenciador) => {
      const repositorioExecucoes = gerenciador.getRepository(ExecucaoRegraOrm);
      const execucao = await repositorioExecucoes.findOne({
        where: { id: job.data.execucaoId, tenantId: job.data.tenantId }
      });
      if (!execucao) throw new NotFoundException('Execucao de regra nao encontrada.');

      execucao.status = 'processando';
      await repositorioExecucoes.save(execucao);

      const regra = await gerenciador.getRepository(RegraAutomacaoOrm).findOne({
        where: { id: execucao.regraId, tenantId: job.data.tenantId, ativa: true }
      });
      if (!regra) throw new NotFoundException('Regra de automacao nao encontrada.');

      const avaliacao = avaliarCondicoes(regra.condicoes, job.data.contexto);
      execucao.status = avaliacao.executar ? 'executado' : 'ignorado';
      execucao.resultado = {
        executar: avaliacao.executar,
        motivos: avaliacao.motivos,
        acoesPlanejadas: avaliacao.executar ? regra.acoes : [],
        contexto: job.data.contexto
      };
      await repositorioExecucoes.save(execucao);
    });
  }
}

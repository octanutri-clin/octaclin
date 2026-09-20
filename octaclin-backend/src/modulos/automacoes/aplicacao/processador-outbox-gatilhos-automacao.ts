import { InjectQueue } from '@nestjs/bullmq';
import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { executarPorTenantAtivo } from '../../../infraestrutura/processamento/rodada-por-tenant';
import { TIPO_OUTBOX_GATILHO_AUTOMACAO } from './disparar-gatilho-automacao';
import { FILA_AUTOMACOES } from './servico-automacoes';

const TENTATIVAS_MAXIMAS = 5;

interface PayloadGatilhoAutomacao {
  execucaoId: string;
  jobId: string;
  contexto: Record<string, unknown>;
}

/**
 * Publica na fila de automacoes os gatilhos duraveis gravados por
 * `dispararGatilhoAutomacao`. E o unico caminho de publicacao: a criacao da
 * execucao e do outbox e transacional, mas o enfileiramento no BullMQ nao e,
 * entao esta rodada e quem garante que uma falha de fila apos o commit nao
 * perde o disparo. `jobId` e `execucaoId` sao deterministicos, entao
 * reprocessar o mesmo evento de outbox (retry ou concorrencia) nunca duplica
 * a execucao nem a acao: o BullMQ ignora um `add` com `jobId` ja existente, e
 * a reivindicacao por status em `ProcessadorAutomacoes.preparar` faz o
 * mesmo para a execucao.
 */
@Injectable()
export class ProcessadorOutboxGatilhosAutomacao {
  private readonly logger = new Logger(ProcessadorOutboxGatilhosAutomacao.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant,
    @InjectQueue(FILA_AUTOMACOES) private readonly filaAutomacoes: Queue
  ) {}

  @Cron('*/15 * * * * *')
  async processarPendentes(): Promise<void> {
    await executarPorTenantAtivo(
      this.fonteDados,
      this.logger,
      'Outbox de gatilhos de automacao',
      async (tenantId) => {
        await this.executorTenant.executar(tenantId, async (gerenciador) => {
          const repositorio = gerenciador.getRepository(OutboxEventoOrm);
          const eventos = await repositorio.find({
            where: { tenantId, tipo: TIPO_OUTBOX_GATILHO_AUTOMACAO, status: 'pendente', processadoEm: IsNull() },
            order: { criadoEm: 'ASC' },
            take: 100
          });

          for (const evento of eventos) {
            await this.processarEvento(tenantId, repositorio, evento);
          }
        });
      },
      { timeoutMs: 25_000 }
    );
  }

  private async processarEvento(
    tenantId: string,
    repositorio: Repository<OutboxEventoOrm>,
    evento: OutboxEventoOrm
  ): Promise<void> {
    try {
      const reivindicacao = await repositorio.update(
        { id: evento.id, tenantId, status: 'pendente', processadoEm: IsNull() },
        { status: 'processando', tentativas: evento.tentativas + 1 }
      );
      if (!reivindicacao.affected) return;
      evento.tentativas += 1;

      const payload = evento.payload as unknown as PayloadGatilhoAutomacao;
      await this.filaAutomacoes.add(
        'avaliar',
        { tenantId, execucaoId: payload.execucaoId, contexto: payload.contexto },
        {
          jobId: payload.jobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: 1000,
          removeOnFail: 5000
        }
      );

      evento.status = 'processado';
      evento.processadoEm = new Date();
      await repositorio.save(evento);
    } catch (erro) {
      evento.status = evento.tentativas >= TENTATIVAS_MAXIMAS ? 'falhou' : 'pendente';
      evento.erro = erro instanceof Error ? erro.message : 'Falha desconhecida ao publicar gatilho de automacao.';
      await repositorio.save(evento);
      this.logger.warn(`Falha ao publicar gatilho de automacao (outbox ${evento.id}): ${evento.erro}`);
    }
  }
}

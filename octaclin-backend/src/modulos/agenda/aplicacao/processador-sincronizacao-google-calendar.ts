import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OPCOES_WORKER_BULLMQ } from '../../../infraestrutura/processamento/opcoes-worker-bullmq';
import { FILA_SINCRONIZACAO_GOOGLE, ServicoSincronizacaoGoogleCalendar } from './servico-sincronizacao-google-calendar';

interface JobNotificacaoGoogle {
  canalWatchId: string;
  tenantId: string;
}

@Injectable()
@Processor(FILA_SINCRONIZACAO_GOOGLE, OPCOES_WORKER_BULLMQ)
export class ProcessadorSincronizacaoGoogleCalendar extends WorkerHost {
  private readonly logger = new Logger(ProcessadorSincronizacaoGoogleCalendar.name);

  constructor(private readonly servicoSincronizacao: ServicoSincronizacaoGoogleCalendar) {
    super();
  }

  async process(job: Job<JobNotificacaoGoogle>): Promise<void> {
    try {
      await this.servicoSincronizacao.processarNotificacao(job.data.canalWatchId, job.data.tenantId);
    } catch (erro) {
      this.logger.error(
        `Falha ao processar notificacao do canal ${job.data.canalWatchId}: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`
      );
      throw erro;
    }
  }
}

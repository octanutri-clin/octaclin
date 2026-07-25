import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FILA_SINCRONIZACAO_GOOGLE, ServicoSincronizacaoGoogleCalendar } from './servico-sincronizacao-google-calendar';

interface JobNotificacaoGoogle {
  canalWatchId: string;
}

@Injectable()
@Processor(FILA_SINCRONIZACAO_GOOGLE)
export class ProcessadorSincronizacaoGoogleCalendar extends WorkerHost {
  private readonly logger = new Logger(ProcessadorSincronizacaoGoogleCalendar.name);

  constructor(private readonly servicoSincronizacao: ServicoSincronizacaoGoogleCalendar) {
    super();
  }

  async process(job: Job<JobNotificacaoGoogle>): Promise<void> {
    try {
      await this.servicoSincronizacao.processarNotificacao(job.data.canalWatchId);
    } catch (erro) {
      this.logger.error(
        `Falha ao processar notificacao do canal ${job.data.canalWatchId}: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`
      );
      throw erro;
    }
  }
}

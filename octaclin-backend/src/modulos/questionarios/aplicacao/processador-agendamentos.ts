import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { executarPorTenantAtivo } from '../../../infraestrutura/processamento/rodada-por-tenant';
import { ServicoQuestionarios } from './servico-questionarios';

@Injectable()
export class ProcessadorAgendamentosQuestionario {
  private readonly logger = new Logger(ProcessadorAgendamentosQuestionario.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly servicoQuestionarios: ServicoQuestionarios
  ) {}

  @Cron('*/1 * * * *')
  async processar(): Promise<void> {
    await executarPorTenantAtivo(this.fonteDados, this.logger, 'Agendamentos de questionario', async (tenantId) => {
      const total = await this.servicoQuestionarios.processarAgendamentosVencidos(tenantId);
      if (total > 0) {
        this.logger.log(`Agendamentos processados para tenant ${tenantId}: ${total} envios gerados.`);
      }
    });
  }
}

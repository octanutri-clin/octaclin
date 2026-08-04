import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { executarPorTenantAtivo } from '../../../infraestrutura/processamento/rodada-por-tenant';
import { ServicoLembretesAgenda } from './servico-lembretes-agenda';

@Injectable()
export class ProcessadorLembretesAgenda {
  private readonly logger = new Logger(ProcessadorLembretesAgenda.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly servicoLembretesAgenda: ServicoLembretesAgenda
  ) {}

  @Cron('*/5 * * * *')
  async processarLembretes(): Promise<void> {
    await executarPorTenantAtivo(this.fonteDados, this.logger, 'Lembretes de agenda', (tenantId) =>
      this.servicoLembretesAgenda.processarLembretesConsulta(tenantId).then(() => undefined)
    );
  }
}

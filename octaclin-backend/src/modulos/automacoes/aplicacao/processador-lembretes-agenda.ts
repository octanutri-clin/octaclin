import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
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
    const tenants = await this.fonteDados.getRepository(TenantOrm).find({ where: { status: 'ativo' } });
    for (const tenant of tenants) {
      try {
        await this.servicoLembretesAgenda.processarLembretesConsulta(tenant.id);
      } catch (erro) {
        this.logger.warn(
          `Falha ao processar lembretes de agenda do tenant ${tenant.id}: ${
            erro instanceof Error ? erro.message : 'erro desconhecido'
          }`
        );
      }
    }
  }
}

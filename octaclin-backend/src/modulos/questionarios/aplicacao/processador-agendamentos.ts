import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
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
    const tenantsAtivos = await this.fonteDados.getRepository(TenantOrm).find({ where: { status: 'ativo' } });

    for (const tenant of tenantsAtivos) {
      const total = await this.servicoQuestionarios.processarAgendamentosVencidos(tenant.id);
      if (total > 0) {
        this.logger.log(`Agendamentos processados para tenant ${tenant.id}: ${total} envios gerados.`);
      }
    }
  }
}

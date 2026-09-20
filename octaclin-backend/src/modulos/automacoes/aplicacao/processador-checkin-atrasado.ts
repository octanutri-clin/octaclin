import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { executarPorTenantAtivo } from '../../../infraestrutura/processamento/rodada-por-tenant';
import { ServicoCheckinAtrasado } from './servico-checkin-atrasado';

@Injectable()
export class ProcessadorCheckinAtrasado {
  private readonly logger = new Logger(ProcessadorCheckinAtrasado.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly servicoCheckinAtrasado: ServicoCheckinAtrasado
  ) {}

  /**
   * Uma rodada por dia, no inicio da manha, mesma cadencia do recall de
   * inatividade: check-in atrasado tambem se mede em dias, nao em horas.
   */
  @Cron('0 9 * * *')
  async processarRodada(): Promise<void> {
    await executarPorTenantAtivo(this.fonteDados, this.logger, 'Checkin atrasado', async (tenantId) => {
      const resultado = await this.servicoCheckinAtrasado.processarRodada(tenantId);
      if (resultado.pacientesDisparados || resultado.pacientesComErro) {
        this.logger.log(
          `Checkin atrasado do tenant ${tenantId}: ${resultado.pacientesDisparados} disparado(s), ` +
            `${resultado.pacientesIgnorados} ignorado(s), ${resultado.pacientesComErro} com erro.`
        );
      }
      if (resultado.regrasComErro) {
        this.logger.error(`Checkin atrasado do tenant ${tenantId}: ${resultado.regrasComErro} regra(s) nao avaliada(s).`);
      }
    });
  }
}

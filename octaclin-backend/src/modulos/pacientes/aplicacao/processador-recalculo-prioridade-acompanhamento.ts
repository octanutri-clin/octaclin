import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { executarPorTenantAtivo } from '../../../infraestrutura/processamento/rodada-por-tenant';
import { ServicoRecalculoPrioridadeAcompanhamento } from './servico-recalculo-prioridade-acompanhamento';

@Injectable()
export class ProcessadorRecalculoPrioridadeAcompanhamento {
  private readonly logger = new Logger(ProcessadorRecalculoPrioridadeAcompanhamento.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly servicoRecalculoPrioridadeAcompanhamento: ServicoRecalculoPrioridadeAcompanhamento
  ) {}

  /**
   * Uma rodada por dia, mesmo horario do recall de inatividade (0900 UTC):
   * os sinais da formula 265.1 (faltas, retorno, adesao) se medem em dias,
   * rodar com mais frequencia so multiplicaria consulta sem mudar resultado
   * dentro do mesmo dia -- e a janela de idempotencia do servico e por dia.
   */
  @Cron('0 9 * * *')
  async recalcular(): Promise<void> {
    await executarPorTenantAtivo(this.fonteDados, this.logger, 'Recalculo de prioridade de acompanhamento', async (tenantId) => {
      const resultado = await this.servicoRecalculoPrioridadeAcompanhamento.recalcularTenant(tenantId);
      if (resultado.pacientesAtualizados || resultado.pacientesComFalha) {
        this.logger.log(
          `Recalculo de prioridade do tenant ${tenantId}: ${resultado.pacientesAtualizados} atualizados, ` +
            `${resultado.pacientesInalterados} ja calculados hoje, ${resultado.pacientesComFalha} com falha.`
        );
      }
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { executarPorTenantAtivo } from '../../../infraestrutura/processamento/rodada-por-tenant';
import { ServicoRecallInatividade } from './servico-recall-inatividade';

@Injectable()
export class ProcessadorRecallInatividade {
  private readonly logger = new Logger(ProcessadorRecallInatividade.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly servicoRecallInatividade: ServicoRecallInatividade
  ) {}

  /**
   * Uma rodada por dia, no inicio da manha. Inatividade se mede em dezenas de dias:
   * rodar de hora em hora so multiplicaria consulta ao banco sem mudar o resultado.
   * O horario preferido de cada paciente ainda e respeitado no envio.
   */
  @Cron('0 9 * * *')
  async processarRecalls(): Promise<void> {
    await executarPorTenantAtivo(this.fonteDados, this.logger, 'Recall de inatividade', async (tenantId) => {
      const resultado = await this.servicoRecallInatividade.processarRecalls(tenantId);
      if (resultado.recallsEnviados || resultado.recallsFalhados) {
        this.logger.log(
          `Recall de inatividade do tenant ${tenantId}: ${resultado.recallsEnviados} enviados, ` +
            `${resultado.recallsFalhados} falharam, ${resultado.pacientesIgnorados} ignorados.`
        );
      }
      // Contato ilegivel e falha de chave/criptografia, nao cadastro incompleto: precisa
      // aparecer separado, senao some no meio dos ignorados.
      if (resultado.contatosIlegiveis || resultado.regrasComErro) {
        this.logger.error(
          `Recall de inatividade do tenant ${tenantId} com problemas: ${resultado.contatosIlegiveis} contato(s) ilegivel(is), ` +
            `${resultado.regrasComErro} regra(s) nao avaliada(s).`
        );
      }
    });
  }
}

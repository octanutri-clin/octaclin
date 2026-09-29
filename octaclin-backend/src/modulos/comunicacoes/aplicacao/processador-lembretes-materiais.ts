import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource, IsNull, LessThanOrEqual } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { executarPorTenantAtivo } from '../../../infraestrutura/processamento/rodada-por-tenant';
import { EnvioMaterialPacienteOrm } from '../../materiais/infraestrutura/envio-material-paciente.orm';
import { INTERVALO_LEMBRETE_MATERIAL_MS } from '../../materiais/dominio/lembrete-material';

const LIMITE_ENVIO_POR_TENANT = 100;

@Injectable()
export class ProcessadorLembretesMateriais {
  private readonly logger = new Logger(ProcessadorLembretesMateriais.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant
  ) {}

  @Cron('0 * * * * *')
  async agendarPendentes(): Promise<void> {
    const agora = new Date();
    await executarPorTenantAtivo(
      this.fonteDados,
      this.logger,
      'Lembretes de materiais',
      async (tenantId) => {
        await this.executorTenant.executar(tenantId, async (gerenciador) => {
          const repositorioEnvios = gerenciador.getRepository(EnvioMaterialPacienteOrm);
          const envios = await repositorioEnvios.find({
            where: {
              tenantId,
              status: 'enviado',
              visualizadoEm: IsNull(),
              proximoLembreteEm: LessThanOrEqual(agora)
            },
            order: { proximoLembreteEm: 'ASC' },
            take: LIMITE_ENVIO_POR_TENANT,
            lock: { mode: 'pessimistic_write', onLocked: 'skip_locked' }
          });
          const repositorioOutbox = gerenciador.getRepository(OutboxEventoOrm);

          for (const envio of envios) {
            if (!envio.proximoLembreteEm) continue;
            const chaveIdempotencia = `material-nao-visualizado:${envio.id}:${envio.proximoLembreteEm.getTime()}`;
            envio.proximoLembreteEm = new Date(agora.getTime() + INTERVALO_LEMBRETE_MATERIAL_MS);
            await repositorioEnvios.save(envio);
            await repositorioOutbox.save(repositorioOutbox.create({
              tenantId,
              tipo: 'material.nao_visualizado.lembrete',
              status: 'pendente',
              payload: { envioId: envio.id, chaveIdempotencia }
            }));
          }
        });
      },
      { timeoutMs: 25_000 }
    );
  }
}

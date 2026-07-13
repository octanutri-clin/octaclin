import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { ServicoComunicacoes } from './servico-comunicacoes';

@Injectable()
export class ProcessadorOutboxComunicacoes {
  private readonly logger = new Logger(ProcessadorOutboxComunicacoes.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant,
    private readonly servicoComunicacoes: ServicoComunicacoes
  ) {}

  @Cron('*/30 * * * * *')
  async processarPendentes(): Promise<void> {
    const tenants = await this.fonteDados.getRepository(TenantOrm).find({ where: { status: 'ativo' } });

    for (const tenant of tenants) {
      await this.executorTenant.executar(tenant.id, async (gerenciador) => {
        const repositorio = gerenciador.getRepository(OutboxEventoOrm);
        const eventos = await repositorio.find({
          where: { tenantId: tenant.id, tipo: 'notificacao.enviar', status: 'pendente', processadoEm: IsNull() },
          order: { criadoEm: 'ASC' },
          take: 100
        });

        for (const evento of eventos) {
          try {
            evento.status = 'processando';
            evento.tentativas += 1;
            await repositorio.save(evento);
            await this.servicoComunicacoes.publicarEventoNotificacao(tenant.id, String(evento.payload.mensagemId));
            evento.status = 'processado';
            evento.processadoEm = new Date();
            await repositorio.save(evento);
          } catch (erro) {
            evento.status = evento.tentativas >= 5 ? 'falhou' : 'pendente';
            evento.erro = erro instanceof Error ? erro.message : 'Falha desconhecida no outbox.';
            await repositorio.save(evento);
            this.logger.warn(`Falha ao publicar outbox ${evento.id}: ${evento.erro}`);
          }
        }
      });
    }
  }
}

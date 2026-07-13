import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { ProcessadorNotificacoes } from './processador-notificacoes';
import { ServicoComunicacoes } from './servico-comunicacoes';

@Injectable()
export class ProcessadorOutboxComunicacoes {
  private readonly logger = new Logger(ProcessadorOutboxComunicacoes.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant,
    private readonly servicoComunicacoes: ServicoComunicacoes,
    private readonly processadorNotificacoes: ProcessadorNotificacoes
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
          await this.processarEvento(tenant.id, repositorio, evento);
        }
      });
    }
  }

  async processarMensagemPendente(tenantId: string, mensagemId: string): Promise<void> {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(OutboxEventoOrm);
      const eventos = await repositorio.find({
        where: { tenantId, tipo: 'notificacao.enviar', status: 'pendente', processadoEm: IsNull() },
        order: { criadoEm: 'ASC' },
        take: 100
      });
      const evento = eventos.find((eventoAtual) => String(eventoAtual.payload.mensagemId) === mensagemId);
      if (evento) await this.processarEvento(tenantId, repositorio, evento);
    });
  }

  private deveProcessarDiretamente(): boolean {
    return !process.env.REDIS_URL && !process.env.REDIS_HOST && !process.env.REDIS_PORTA;
  }

  private async processarEvento(
    tenantId: string,
    repositorio: Repository<OutboxEventoOrm>,
    evento: OutboxEventoOrm
  ): Promise<void> {
    try {
      evento.status = 'processando';
      evento.tentativas += 1;
      await repositorio.save(evento);
      const mensagemId = String(evento.payload.mensagemId);
      if (this.deveProcessarDiretamente()) {
        await this.processadorNotificacoes.processarMensagem(tenantId, mensagemId);
      } else {
        try {
          await this.servicoComunicacoes.publicarEventoNotificacao(tenantId, mensagemId);
        } catch (erroPublicacao) {
          this.logger.warn(
            `Fila de notificacoes indisponivel para outbox ${evento.id}; processando envio diretamente. ` +
              `Causa: ${erroPublicacao instanceof Error ? erroPublicacao.message : 'falha desconhecida'}`
          );
          await this.processadorNotificacoes.processarMensagem(tenantId, mensagemId);
        }
      }
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
}

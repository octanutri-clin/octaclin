import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { executarPorTenantAtivo } from '../../../infraestrutura/processamento/rodada-por-tenant';
import { redisConfigurado } from './configuracao-redis';
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
    // Timeout curto: esta rodada roda a cada 30s e e o caminho de entrega das mensagens.
    // Um tenant lento nao pode atrasar a entrega dos demais.
    await executarPorTenantAtivo(
      this.fonteDados,
      this.logger,
      'Outbox de comunicacoes',
      async (tenantId) => {
        await this.executorTenant.executar(tenantId, async (gerenciador) => {
          const repositorio = gerenciador.getRepository(OutboxEventoOrm);
          const eventos = await repositorio.find({
            where: {
              tenantId,
              tipo: In(['notificacao.enviar', 'plano_alimentar.publicado']),
              status: 'pendente',
              processadoEm: IsNull()
            },
            order: { criadoEm: 'ASC' },
            take: 100
          });

          for (const evento of eventos) {
            await this.processarEvento(tenantId, repositorio, evento);
          }
        });
      },
      { timeoutMs: 25_000 }
    );
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
    return !redisConfigurado();
  }

  private async processarEvento(
    tenantId: string,
    repositorio: Repository<OutboxEventoOrm>,
    evento: OutboxEventoOrm
  ): Promise<void> {
    try {
      const reivindicacao = await repositorio.update(
        { id: evento.id, tenantId, status: 'pendente', processadoEm: IsNull() },
        { status: 'processando', tentativas: evento.tentativas + 1 }
      );
      if (!reivindicacao.affected) return;

      evento.status = 'processando';
      evento.tentativas += 1;
      if (evento.tipo === 'plano_alimentar.publicado') {
        const { pacienteId, planoId, versaoId } = evento.payload;
        if (
          typeof pacienteId !== 'string' ||
          typeof planoId !== 'string' ||
          typeof versaoId !== 'string'
        ) {
          throw new Error('Payload invalido no evento de plano publicado.');
        }
        await this.servicoComunicacoes.processarAvisoPlanoPublicado(tenantId, {
          pacienteId,
          planoId,
          versaoId
        });
      } else {
        const mensagemId = evento.payload.mensagemId;
        if (typeof mensagemId !== 'string') throw new Error('Payload invalido no evento de comunicacao.');
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

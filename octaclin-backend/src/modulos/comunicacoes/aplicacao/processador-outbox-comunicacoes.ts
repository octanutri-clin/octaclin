import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource, In, IsNull, LessThan } from 'typeorm';
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
        const ids = await this.executorTenant.executar(tenantId, async (gerenciador) => {
          const repositorio = gerenciador.getRepository(OutboxEventoOrm);
          const eventos = await repositorio.find({
            where: [
              { tenantId, tipo: In(['notificacao.enviar', 'plano_alimentar.publicado', 'material.nao_visualizado.lembrete']), status: 'pendente', processadoEm: IsNull() },
              { tenantId, tipo: In(['notificacao.enviar', 'plano_alimentar.publicado', 'material.nao_visualizado.lembrete']), status: 'processando', reivindicadoEm: LessThan(new Date(Date.now() - 5 * 60000)), processadoEm: IsNull() }
            ],
            order: { criadoEm: 'ASC' },
            take: 100
          });

          return eventos.map((evento) => evento.id);
        });
        for (const id of ids) await this.processarEvento(tenantId, id);
      },
      { timeoutMs: 25_000 }
    );
  }

  async processarMensagemPendente(tenantId: string, mensagemId: string): Promise<void> {
    const id = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(OutboxEventoOrm);
      const eventos = await repositorio.find({
        where: { tenantId, tipo: 'notificacao.enviar', status: 'pendente', processadoEm: IsNull() },
        order: { criadoEm: 'ASC' },
        take: 100
      });
      const evento = eventos.find((eventoAtual) => String(eventoAtual.payload.mensagemId) === mensagemId);
      return evento?.id;
    });
    if (id) await this.processarEvento(tenantId, id);
  }

  private deveProcessarDiretamente(): boolean {
    return !redisConfigurado();
  }

  private async processarEvento(tenantId: string, id: string): Promise<void> {
    const evento = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(OutboxEventoOrm);
      const atual = await repositorio.findOne({ where: { id, tenantId }, lock: { mode: 'pessimistic_write' } });
      if (!atual || atual.processadoEm || (atual.status !== 'pendente' && !(atual.status === 'processando' && atual.reivindicadoEm && atual.reivindicadoEm < new Date(Date.now() - 5 * 60000)))) return undefined;
      atual.status = 'processando';
      atual.tentativas += 1;
      atual.reivindicadoEm = new Date();
      await repositorio.save(atual);
      return atual;
    });
    if (!evento) return;
    try {
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
      } else if (evento.tipo === 'material.nao_visualizado.lembrete') {
        const { envioId, chaveIdempotencia } = evento.payload;
        if (typeof envioId !== 'string' || typeof chaveIdempotencia !== 'string') {
          throw new Error('Payload invalido no evento de lembrete de material.');
        }
        await this.servicoComunicacoes.processarLembreteMaterialNaoVisualizado(tenantId, {
          envioId,
          chaveIdempotencia
        });
      } else {
        const mensagemId = evento.payload.mensagemId;
        if (typeof mensagemId !== 'string') throw new Error('Payload invalido no evento de comunicacao.');
        if (this.deveProcessarDiretamente()) {
          await this.processadorNotificacoes.processarMensagem(tenantId, mensagemId);
        } else {
          try {
            await this.servicoComunicacoes.publicarEventoNotificacao(tenantId, mensagemId);
          } catch {
            this.logger.warn(
              'Fila de notificacoes indisponivel; processando envio diretamente.'
            );
            await this.processadorNotificacoes.processarMensagem(tenantId, mensagemId);
          }
        }
      }
      await this.finalizarReivindicacao(tenantId, evento, true);
    } catch (erro) {
      await this.finalizarReivindicacao(tenantId, evento, false, erro);
      this.logger.warn('Falha ao publicar evento de comunicacao; tentativa registrada no outbox.');
    }
  }

  private async finalizarReivindicacao(tenantId: string, evento: OutboxEventoOrm, sucesso: boolean, erro?: unknown): Promise<void> {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repo = gerenciador.getRepository(OutboxEventoOrm);
      const atual = await repo.findOne({ where: { id: evento.id, tenantId }, lock: { mode: 'pessimistic_write' } });
      // Uma tentativa antiga nao pode sobrescrever a reivindicacao de outro worker.
      if (!atual || atual.status !== 'processando' || atual.reivindicadoEm?.getTime() !== evento.reivindicadoEm?.getTime()) return;
      atual.status = sucesso ? 'processado' : atual.tentativas >= 5 ? 'falhou' : 'pendente';
      if (sucesso) atual.processadoEm = new Date();
      else atual.erro = erro instanceof Error ? erro.message : 'Falha desconhecida no outbox.';
      await repo.save(atual);
    });
  }
}

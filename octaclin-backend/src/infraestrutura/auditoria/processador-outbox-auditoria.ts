import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { executarPorTenantAtivo } from '../processamento/rodada-por-tenant';
import { ServicoAuditoria } from './servico-auditoria';

/**
 * Drena o outbox de auditoria (`ServicoAuditoria.processarOutboxPendente`)
 * a cada tenant ativo. Cadencia mais folgada que
 * `ProcessadorOutboxComunicacoes` (30s): o outbox de auditoria so recebe
 * evento quando a escrita direta ja falhou, entao nao e caminho de entrega
 * de uso normal -- e rede de retentativa para o caso raro.
 */
@Injectable()
export class ProcessadorOutboxAuditoria {
  private readonly logger = new Logger(ProcessadorOutboxAuditoria.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Cron('0 * * * * *')
  async processarPendentes(): Promise<void> {
    await executarPorTenantAtivo(
      this.fonteDados,
      this.logger,
      'Outbox de auditoria',
      (tenantId) => this.servicoAuditoria.processarOutboxPendente(tenantId)
    );
  }
}

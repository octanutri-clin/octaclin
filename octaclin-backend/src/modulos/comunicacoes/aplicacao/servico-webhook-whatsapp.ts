import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';

export interface StatusWebhookWhatsapp {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: unknown[];
}

interface ResultadoProcessamentoStatus {
  atualizados: number;
  ignorados: number;
}

@Injectable()
export class ServicoWebhookWhatsapp {
  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant
  ) {}

  async registrarStatus(statuses: StatusWebhookWhatsapp[]): Promise<ResultadoProcessamentoStatus> {
    const statusesComId = statuses.filter((status) => status.id);
    if (!statusesComId.length) return { atualizados: 0, ignorados: statuses.length };

    const tenants = await this.fonteDados.getRepository(TenantOrm).find({
      select: { id: true },
      where: { status: 'ativo' }
    });

    let atualizados = 0;
    let ignorados = statuses.length - statusesComId.length;

    for (const status of statusesComId) {
      const atualizado = await this.registrarStatusEmAlgumTenant(tenants, status);
      if (atualizado) {
        atualizados += 1;
      } else {
        ignorados += 1;
      }
    }

    return { atualizados, ignorados };
  }

  private async registrarStatusEmAlgumTenant(
    tenants: Array<Pick<TenantOrm, 'id'>>,
    status: StatusWebhookWhatsapp
  ): Promise<boolean> {
    for (const tenant of tenants) {
      const atualizado = await this.executorTenant.executar(tenant.id, (gerenciador) =>
        this.registrarStatusNoTenant(gerenciador.getRepository(MensagemNotificacaoOrm), status)
      );
      if (atualizado) return true;
    }

    return false;
  }

  private async registrarStatusNoTenant(
    repositorioMensagens: Repository<MensagemNotificacaoOrm>,
    status: StatusWebhookWhatsapp
  ): Promise<boolean> {
    const mensagem = await repositorioMensagens
      .createQueryBuilder('mensagem')
      .where("mensagem.payload #>> '{resultadoEnvio,idExterno}' = :idExterno", { idExterno: status.id })
      .getOne();
    if (!mensagem) return false;

    mensagem.payload = {
      ...mensagem.payload,
      ultimoStatusMeta: this.limparObjeto({
        status: status.status,
        timestamp: status.timestamp,
        recipientId: status.recipient_id,
        errors: status.errors
      })
    };

    if (status.status === 'failed') {
      mensagem.status = 'falhou';
      mensagem.erro = this.resumirErro(status.errors);
    }

    await repositorioMensagens.save(mensagem);
    return true;
  }

  private limparObjeto(objeto: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(objeto).filter(([, valor]) => valor !== undefined));
  }

  private resumirErro(errors?: unknown[]): string {
    if (!errors?.length) return 'Falha reportada pela Meta Cloud API.';

    const primeiroErro = errors[0] as { title?: unknown; message?: unknown; code?: unknown };
    return String(primeiroErro.title ?? primeiroErro.message ?? primeiroErro.code ?? 'Falha reportada pela Meta Cloud API.');
  }
}

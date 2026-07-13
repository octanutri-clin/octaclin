import { Injectable, Logger } from '@nestjs/common';
import { ExecutorTenant } from '../banco-dados/executor-tenant';
import { UserActionLogOrm } from './user-action-log.orm';

export interface RegistrarAuditoriaEntrada {
  tenantId: string;
  usuarioId?: string;
  acao: string;
  recursoTipo?: string;
  recursoId?: string;
  ip?: string;
  userAgent?: string;
  metadados?: Record<string, unknown>;
}

@Injectable()
export class ServicoAuditoria {
  private readonly logger = new Logger(ServicoAuditoria.name);

  constructor(private readonly executorTenant: ExecutorTenant) {}

  async registrar(entrada: RegistrarAuditoriaEntrada): Promise<void> {
    try {
      await this.executorTenant.executar(entrada.tenantId, async (gerenciador) => {
        const repositorio = gerenciador.getRepository(UserActionLogOrm);
        await repositorio.save(
          repositorio.create({
            tenantId: entrada.tenantId,
            usuarioId: entrada.usuarioId,
            acao: entrada.acao,
            recursoTipo: entrada.recursoTipo,
            recursoId: entrada.recursoId,
            ip: entrada.ip,
            userAgent: entrada.userAgent,
            metadados: entrada.metadados ?? {}
          })
        );
      });
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'falha desconhecida';
      this.logger.warn(`Falha ao registrar auditoria: ${mensagem}`);
    }
  }
}

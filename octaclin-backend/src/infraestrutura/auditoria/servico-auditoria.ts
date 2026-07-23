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
  requestId?: string;
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
            metadados: {
              ...(entrada.metadados ?? {}),
              ...(entrada.requestId ? { requestId: entrada.requestId } : {})
            }
          })
        );
      });
    } catch (erro) {
      this.logger.warn({
        evento: 'auditoria.falha',
        tenantId: entrada.tenantId,
        usuarioId: entrada.usuarioId,
        acao: entrada.acao,
        requestId: entrada.requestId,
        erroNome: erro instanceof Error ? erro.name : 'ErroDesconhecido'
      });
    }
  }
}

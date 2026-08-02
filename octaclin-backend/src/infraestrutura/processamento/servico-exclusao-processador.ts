import { Injectable } from '@nestjs/common';
import { ExecutorTenant } from '../banco-dados/executor-tenant';

@Injectable()
export class ServicoExclusaoProcessador {
  constructor(private readonly executorTenant: ExecutorTenant) {}

  async executar<T>(tenantId: string, chave: string, operacao: () => Promise<T>): Promise<T | undefined> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const [{ bloqueado }] = await gerenciador.query(
        'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS bloqueado',
        [`octaclin:processador:${chave}`]
      );
      if (!bloqueado) return undefined;
      return operacao();
    });
  }
}

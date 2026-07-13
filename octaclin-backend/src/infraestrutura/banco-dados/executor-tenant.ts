import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class ExecutorTenant {
  constructor(private readonly fonteDados: DataSource) {}

  async executar<T>(
    tenantId: string,
    operacao: (gerenciador: EntityManager) => Promise<T>
  ): Promise<T> {
    return this.fonteDados.transaction(async (gerenciador) => {
      await gerenciador.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
      return operacao(gerenciador);
    });
  }
}

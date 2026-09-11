import { TenantOrm } from '../../modulos/tenancy/infraestrutura/tenant.orm';
import { ProcessadorOutboxAuditoria } from './processador-outbox-auditoria';

describe('ProcessadorOutboxAuditoria', () => {
  it('drena o outbox de cada tenant ativo', async () => {
    const fonteDados = {
      createQueryRunner: jest.fn(() => ({
        connect: jest.fn(async () => undefined),
        release: jest.fn(async () => undefined),
        query: jest.fn(async (sql: string) => (sql.includes('pg_try_advisory_lock') ? [{ obtida: true }] : []))
      })),
      getRepository: (entidade: unknown) => {
        if (entidade === TenantOrm) {
          return { find: jest.fn(async () => [{ id: 'tenant-1', status: 'ativo' }, { id: 'tenant-2', status: 'ativo' }]) };
        }
        throw new Error('Repositorio inesperado');
      }
    };
    const servicoAuditoria = { processarOutboxPendente: jest.fn(async () => undefined) };

    const processador = new ProcessadorOutboxAuditoria(fonteDados as never, servicoAuditoria as never);
    await processador.processarPendentes();

    expect(servicoAuditoria.processarOutboxPendente).toHaveBeenCalledWith('tenant-1');
    expect(servicoAuditoria.processarOutboxPendente).toHaveBeenCalledWith('tenant-2');
    expect(servicoAuditoria.processarOutboxPendente).toHaveBeenCalledTimes(2);
  });
});

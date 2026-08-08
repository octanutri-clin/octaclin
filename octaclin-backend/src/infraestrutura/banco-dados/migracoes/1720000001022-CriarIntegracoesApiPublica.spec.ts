import { QueryRunner } from 'typeorm';
import { CriarIntegracoesApiPublica1720000001022 } from './1720000001022-CriarIntegracoesApiPublica';

describe('CriarIntegracoesApiPublica1720000001022', () => {
  const sqlDa = async (metodo: 'up' | 'down') => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new CriarIntegracoesApiPublica1720000001022()[metodo]({ query } as unknown as QueryRunner);
    return query.mock.calls.map(([sql]) => String(sql).toLowerCase()).join('\n');
  };

  it('cria chaves, assinaturas e entregas com RLS forcada', async () => {
    const sql = await sqlDa('up');
    for (const tabela of ['api_chaves', 'webhook_assinaturas', 'webhook_entregas']) {
      expect(sql).toContain(`create table if not exists ${tabela}`);
      expect(sql).toContain(`alter table ${tabela} enable row level security`);
      expect(sql).toContain(`alter table ${tabela} force row level security`);
      expect(sql).toContain(`isolamento_tenant_${tabela}`);
    }
  });

  it('impede vinculos cruzados entre tenants e deduplica entregas', async () => {
    const sql = await sqlDa('up');
    expect(sql).toContain('foreign key (tenant_id, assinatura_id)');
    expect(sql).toContain('references webhook_assinaturas (tenant_id, id)');
    expect(sql).toContain('ux_webhook_entregas_evento_recurso');
    expect(sql).toContain('ux_pacientes_referencia_externa');
    expect(sql).toContain('ux_agenda_consultas_referencia_externa');
    expect(sql).toContain('references usuarios (tenant_id, id) on delete restrict');
  });

  it('restringe escopos, eventos, status e tentativas', async () => {
    const sql = await sqlDa('up');
    expect(sql).toContain('api_chaves_escopos_check');
    expect(sql).toContain('webhook_assinaturas_eventos_check');
    expect(sql).toContain('webhook_entregas_status_check');
    expect(sql).toContain('webhook_entregas_tentativas_check');
  });
});

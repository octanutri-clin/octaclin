import { QueryRunner } from 'typeorm';
import { ConfigurarResumosNotificacoes1720000001065 } from './1720000001065-ConfigurarResumosNotificacoes';

describe('migration 1065 de preferencias e resumos de notificacoes', () => {
  const migration = new ConfigurarResumosNotificacoes1720000001065();

  it('cria snapshots e resumos com defaults legados seguros, deduplicacao e tenant composto', async () => {
    const query = jest.fn(async (_sql: string) => undefined);

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toMatch(/email_resumo boolean not null default false/i);
    expect(sql).toMatch(/modo_entrega varchar\(20\) not null default 'imediato'/i);
    expect(sql).toMatch(/foreign key \(tenant_id, usuario_id\) references usuarios \(tenant_id, id\)/i);
    expect(sql).toMatch(/foreign key \(tenant_id, usuario_id, resumo_id\)\s+references resumos_notificacao_usuario/i);
    expect(sql).toContain("check (tipo not in ('mensagem_recebida', 'solicitacao_agendamento', 'falha_envio')");
    expect(sql).toMatch(/alter table preferencias_notificacao_usuario force row level security/i);
    expect(sql).toMatch(/alter table resumos_notificacao_usuario force row level security/i);
    expect(sql).toMatch(/create index.*notificacoes_digest_pendente/is);
  });

  it('recusa rollback destrutivo das preferencias, resumos e snapshots', async () => {
    const query = jest.fn();

    await expect(migration.down({ query } as unknown as QueryRunner)).rejects.toThrow('Rollback recusado');
    expect(query).not.toHaveBeenCalled();
  });
});

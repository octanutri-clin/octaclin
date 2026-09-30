import { CriarRespostaPortalPaciente1720000001058 } from './1720000001058-CriarRespostaPortalPaciente';

describe('CriarRespostaPortalPaciente1720000001058', () => {
  it('cria armazenamento cifrado tenant-aware com RLS forçada e rollback protegido', async () => {
    const migration = new CriarRespostaPortalPaciente1720000001058();
    let linhas: Array<{ total: string }> = [];
    const query = jest.fn(async (_sql: string) => linhas);
    await migration.up({ query } as never);
    const sql = query.mock.calls.map(([texto]) => String(texto)).join('\n');

    expect(sql).toContain('create table conversas_portal_paciente');
    expect(sql).toContain('create table mensagens_portal_paciente');
    expect(sql).toContain("where autor_tipo = 'paciente'");
    expect(sql).toContain('conteudo_criptografado bytea not null');
    expect(sql).toContain('foreign key (tenant_id, paciente_id) references pacientes(tenant_id, id)');
    expect(sql).toContain('foreign key (tenant_id, profissional_responsavel_id) references profissionais(tenant_id, id)');
    expect(sql).toContain('foreign key (tenant_id, conversa_id) references conversas_portal_paciente(tenant_id, id) on delete cascade');
    expect(sql).toContain('foreign key (tenant_id, autor_usuario_id) references usuarios(tenant_id, id)');
    expect(sql.match(/enable row level security/g)).toHaveLength(2);
    expect(sql.match(/force row level security/g)).toHaveLength(2);
    expect(sql).toContain("current_setting('app.tenant_id', true)");

    linhas = [{ total: '1' }];
    await expect(migration.down({ query } as never)).rejects.toThrow('conversas clínicas persistidas');
    expect(query.mock.calls.slice(-3).map(([texto]) => texto)).toEqual([
      'set row_security = off',
      'select count(*)::text as total from mensagens_portal_paciente',
      'reset row_security'
    ]);

    linhas = [{ total: '0' }];
    await migration.down({ query } as never);
    expect(query).toHaveBeenLastCalledWith('drop table if exists conversas_portal_paciente');
  });

  it('falha fechado e restaura row_security se o papel nao puder contar fora da RLS', async () => {
    const migration = new CriarRespostaPortalPaciente1720000001058();
    const query = jest.fn(async (sql: string) => {
      if (sql.startsWith('select count')) throw new Error('row-level security policy would be applied');
      return [];
    });

    await expect(migration.down({ query } as never)).rejects.toThrow('row-level security policy');
    expect(query).toHaveBeenCalledWith('reset row_security');
    expect(query).not.toHaveBeenCalledWith('drop table if exists mensagens_portal_paciente');
  });
});

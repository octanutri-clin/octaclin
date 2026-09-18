import { QueryRunner } from 'typeorm';
import { EndurecerIntegridadeOverridePrioridade1720000001047 } from './1720000001047-EndurecerIntegridadeOverridePrioridade';

describe('EndurecerIntegridadeOverridePrioridade1720000001047', () => {
  async function executar() {
    const query = jest.fn(async (_comando: string) => undefined);
    const migration = new EndurecerIntegridadeOverridePrioridade1720000001047();
    await migration.up({ query } as unknown as QueryRunner);
    const sqlUp = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    query.mockClear();
    await migration.down({ query } as unknown as QueryRunner);
    const sqlDown = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    return { sqlUp, sqlDown };
  }

  it('inclui a justificativa cifrada na constraint tudo ou nada do override', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('override_justificativa_criptografada is null');
    expect(sqlUp).toContain('override_justificativa_criptografada is not null');
    expect(sqlUp).toContain('prioridades_acompanhamento_override_completo_check');
  });

  it('localiza e remove a constraint anonima legada sem depender do nome gerado pelo Postgres', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain("pg_get_constraintdef(oid) like '%override_faixa IS NULL%'");
    expect(sqlUp).toContain("pg_get_constraintdef(oid) not like '%override_justificativa_criptografada%'");
  });

  it('restaura a constraint anterior no rollback sem remover dados', async () => {
    const { sqlDown } = await executar();

    expect(sqlDown).toContain('drop constraint if exists prioridades_acompanhamento_override_completo_check');
    expect(sqlDown).toMatch(/override_faixa is null\s+and override_codigo_motivo is null/);
    expect(sqlDown).not.toContain('drop table');
  });

  it('declara aplicacao fora de banda por conter DDL', async () => {
    const conteudo = await import('node:fs/promises').then((fs) =>
      fs.readFile(require.resolve('./1720000001047-EndurecerIntegridadeOverridePrioridade.ts'), 'utf8')
    );

    expect(conteudo).toMatch(/@aplicacao\s+fora-de-banda/);
  });
});

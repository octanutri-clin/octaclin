import { QueryRunner } from 'typeorm';
import { AdicionarConsultaIdEntidadesClinicas1720000001051 } from './1720000001051-AdicionarConsultaIdEntidadesClinicas';

describe('AdicionarConsultaIdEntidadesClinicas1720000001051', () => {
  async function executar() {
    const query = jest.fn(async (_sql: string) => undefined);
    const migration = new AdicionarConsultaIdEntidadesClinicas1720000001051();

    await migration.up({ query } as unknown as QueryRunner);
    const sqlUp = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    query.mockClear();
    await migration.down({ query } as unknown as QueryRunner);
    const sqlDown = query.mock.calls.map(([comando]) => String(comando)).join('\n');

    return { sqlUp, sqlDown };
  }

  const tabelas = [
    'evolucoes_clinicas',
    'avaliacoes_antropometricas',
    'condutas_terapeuticas_versoes',
    'coletas_exames_laboratoriais'
  ];

  it.each(tabelas)('adiciona consulta_id nullable referenciando agenda_consultas em %s', async (tabela) => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain(
      `alter table ${tabela}\n        add column if not exists consulta_id uuid references agenda_consultas(id);`
    );
  });

  it('nao marca consulta_id como not null em nenhuma tabela', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).not.toMatch(/consulta_id uuid not null/);
  });

  it.each(tabelas)('cria indice parcial de consulta_id por tenant em %s', async (tabela) => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain(
      `create index if not exists idx_${tabela}_consulta\n        on ${tabela} (tenant_id, consulta_id)\n        where consulta_id is not null;`
    );
  });

  it('e reversivel: down remove indices e colunas nas quatro tabelas', async () => {
    const { sqlDown } = await executar();

    for (const tabela of tabelas) {
      expect(sqlDown).toContain(`drop index if exists idx_${tabela}_consulta;`);
      expect(sqlDown).toContain(`alter table ${tabela} drop column if exists consulta_id;`);
    }
  });
});

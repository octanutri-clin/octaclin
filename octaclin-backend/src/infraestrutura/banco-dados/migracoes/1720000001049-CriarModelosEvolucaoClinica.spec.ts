import { QueryRunner } from 'typeorm';
import { CriarModelosEvolucaoClinica1720000001049 } from './1720000001049-CriarModelosEvolucaoClinica';

describe('CriarModelosEvolucaoClinica1720000001049', () => {
  async function executar() {
    const query = jest.fn(async (_sql: string) => undefined);
    const migration = new CriarModelosEvolucaoClinica1720000001049();

    await migration.up({ query } as unknown as QueryRunner);
    const sqlUp = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    query.mockClear();
    await migration.down({ query } as unknown as QueryRunner);
    const sqlDown = query.mock.calls.map(([comando]) => String(comando)).join('\n');

    return { sqlUp, sqlDown };
  }

  it('cria a tabela com origem restrita a pessoal/clinica', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('create table if not exists modelos_evolucao_clinica');
    expect(sqlUp).toContain("check (origem in ('pessoal', 'clinica'))");
  });

  // Modelo pessoal pertence a um profissional; modelo da clinica nao pode
  // ficar preso a um, senao deixaria de ser compartilhado no dia em que esse
  // profissional fosse desligado -- mesma regra do PB-13.
  it('exige profissional so na origem pessoal', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toMatch(
      /check \(\s*\(origem = 'pessoal' and profissional_id is not null\)\s*or \(origem = 'clinica' and profissional_id is null\)\s*\)/
    );
  });

  it('referencia tenant, profissional e usuario com FK composta por tenant', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('tenant_id uuid not null references tenants(id)');
    expect(sqlUp).toContain(
      'foreign key (tenant_id, profissional_id) references profissionais (tenant_id, id) on delete restrict'
    );
    expect(sqlUp).toContain(
      'foreign key (tenant_id, criado_por_usuario_id) references usuarios (tenant_id, id) on delete restrict'
    );
  });

  it('habilita e forca RLS com policy completa de isolamento por tenant', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('alter table modelos_evolucao_clinica enable row level security');
    expect(sqlUp).toContain('alter table modelos_evolucao_clinica force row level security');
    expect(sqlUp).toMatch(
      /create policy isolamento_tenant_modelos_evolucao_clinica on modelos_evolucao_clinica\s+using \(tenant_id = nullif\(current_setting\('app\.tenant_id', true\), ''\)::uuid\)\s+with check \(tenant_id = nullif\(current_setting\('app\.tenant_id', true\), ''\)::uuid\)/
    );
  });

  it('cria indices de listagem por tenant e por profissional', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toMatch(
      /create index if not exists idx_modelos_evolucao_clinica_listagem\s+on modelos_evolucao_clinica \(tenant_id, origem, arquivado_em, atualizado_em desc\)/
    );
    expect(sqlUp).toMatch(
      /create index if not exists idx_modelos_evolucao_clinica_profissional\s+on modelos_evolucao_clinica \(tenant_id, profissional_id, arquivado_em, atualizado_em desc\)\s+where profissional_id is not null/
    );
  });

  it('e reversivel: down remove a tabela', async () => {
    const { sqlDown } = await executar();

    expect(sqlDown).toContain('drop table if exists modelos_evolucao_clinica cascade');
  });
});

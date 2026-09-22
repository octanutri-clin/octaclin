import { QueryRunner } from 'typeorm';
import { CriarBibliotecaCondutas1720000001050 } from './1720000001050-CriarBibliotecaCondutas';

describe('CriarBibliotecaCondutas1720000001050', () => {
  async function executar() {
    const query = jest.fn(async (_sql: string) => undefined);
    const migration = new CriarBibliotecaCondutas1720000001050();

    await migration.up({ query } as unknown as QueryRunner);
    const sqlUp = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    query.mockClear();
    await migration.down({ query } as unknown as QueryRunner);
    const sqlDown = query.mock.calls.map(([comando]) => String(comando)).join('\n');

    return { sqlUp, sqlDown };
  }

  it('cria a tabela com tipo restrito ao enum de conduta terapeutica', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('create table if not exists biblioteca_condutas');
    expect(sqlUp).toMatch(
      /check \(tipo in \('meta', 'orientacao', 'suplemento', 'produto', 'formula_manipulada'\)\)/
    );
  });

  // Biblioteca e sempre do tenant inteiro: diferente dos modelos de plano
  // alimentar/evolucao clinica (PB-13/PB-15), nao ha coluna de profissional
  // nem constraint de origem.
  it('nao tem coluna de profissional nem de origem', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).not.toContain('profissional_id');
    expect(sqlUp).not.toContain('origem');
  });

  it('referencia tenant e usuario com FK composta por tenant', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('tenant_id uuid not null references tenants(id)');
    expect(sqlUp).toContain(
      'foreign key (tenant_id, criado_por_usuario_id) references usuarios (tenant_id, id) on delete restrict'
    );
  });

  it('habilita e forca RLS com policy completa de isolamento por tenant', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('alter table biblioteca_condutas enable row level security');
    expect(sqlUp).toContain('alter table biblioteca_condutas force row level security');
    expect(sqlUp).toMatch(
      /create policy isolamento_tenant_biblioteca_condutas on biblioteca_condutas\s+using \(tenant_id = nullif\(current_setting\('app\.tenant_id', true\), ''\)::uuid\)\s+with check \(tenant_id = nullif\(current_setting\('app\.tenant_id', true\), ''\)::uuid\)/
    );
  });

  it('cria indice de listagem por tenant e tipo', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toMatch(
      /create index if not exists idx_biblioteca_condutas_listagem\s+on biblioteca_condutas \(tenant_id, tipo, arquivado_em, atualizado_em desc\)/
    );
  });

  it('e reversivel: down remove a tabela', async () => {
    const { sqlDown } = await executar();

    expect(sqlDown).toContain('drop table if exists biblioteca_condutas cascade');
  });
});

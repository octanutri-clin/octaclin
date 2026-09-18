import { QueryRunner } from 'typeorm';
import { AdicionarPrioridadeAcompanhamento1720000001046 } from './1720000001046-AdicionarPrioridadeAcompanhamento';

describe('AdicionarPrioridadeAcompanhamento1720000001046', () => {
  async function executar() {
    const query = jest.fn(async (_sql: string) => undefined);
    const migration = new AdicionarPrioridadeAcompanhamento1720000001046();

    await migration.up({ query } as unknown as QueryRunner);
    const sqlUp = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    query.mockClear();
    await migration.down({ query } as unknown as QueryRunner);
    const sqlDown = query.mock.calls.map(([comando]) => String(comando)).join('\n');

    return { sqlUp, sqlDown };
  }

  it('cria a tabela de estado atual com score, faixa, fatores e versao da formula', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('create table if not exists prioridades_acompanhamento_paciente');
    expect(sqlUp).toContain('tenant_id uuid not null references tenants(id)');
    expect(sqlUp).toContain('paciente_id uuid not null references pacientes(id)');
    expect(sqlUp).toContain('score integer not null');
    expect(sqlUp).toContain("faixa varchar(10) not null check (faixa in ('baixa', 'media', 'alta'))");
    expect(sqlUp).toContain("fatores jsonb not null default '[]'");
    expect(sqlUp).toContain('versao_formula varchar(20) not null');
    expect(sqlUp).toContain('calculado_em timestamptz not null');
    expect(sqlUp).toContain('unique (tenant_id, paciente_id)');
  });

  it('restringe score entre 0 e 100', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toMatch(/check \(score between 0 and 100\)/);
  });

  it('adiciona colunas de override com expiracao, motivo, justificativa cifrada e ator', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain("override_faixa varchar(10) check (override_faixa in ('baixa', 'media', 'alta'))");
    expect(sqlUp).toContain('override_codigo_motivo varchar(60)');
    expect(sqlUp).toContain('override_justificativa_criptografada bytea');
    expect(sqlUp).toContain('override_expira_em timestamptz');
    expect(sqlUp).toContain('override_ator_usuario_id uuid references usuarios(id)');
    expect(sqlUp).toContain('override_criado_em timestamptz');
  });

  it('exige todos os campos de override juntos ou nenhum (tudo ou nada)', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toMatch(
      /check \(\s*\(override_faixa is null and override_codigo_motivo is null and override_expira_em is null and override_ator_usuario_id is null and override_criado_em is null\)\s*or\s*\(override_faixa is not null and override_codigo_motivo is not null and override_expira_em is not null and override_ator_usuario_id is not null and override_criado_em is not null\)\s*\)/
    );
  });

  it('cria indice parcial para localizar overrides ativos por expiracao', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain(
      'create index if not exists idx_prioridades_acompanhamento_paciente_override_expira'
    );
    expect(sqlUp).toContain('where override_expira_em is not null');
  });

  it('habilita e forca RLS em prioridades_acompanhamento_paciente com policy completa de isolamento por tenant', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('alter table prioridades_acompanhamento_paciente enable row level security');
    expect(sqlUp).toContain('alter table prioridades_acompanhamento_paciente force row level security');
    expect(sqlUp).toContain(
      'create policy isolamento_tenant_prioridades_acompanhamento_paciente on prioridades_acompanhamento_paciente'
    );
    expect(sqlUp).toMatch(
      /create policy isolamento_tenant_prioridades_acompanhamento_paciente on prioridades_acompanhamento_paciente\s+using \(tenant_id = nullif\(current_setting\('app\.tenant_id', true\), ''\)::uuid\)\s+with check \(tenant_id = nullif\(current_setting\('app\.tenant_id', true\), ''\)::uuid\)/
    );
  });

  it('cria o historico append-only com tipo de evento fechado e indice por paciente/data', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('create table if not exists prioridades_acompanhamento_historico');
    expect(sqlUp).toMatch(
      /check \(tipo_evento in \('calculo', 'override_criado', 'override_alterado', 'override_expirado', 'override_removido'\)\)/
    );
    expect(sqlUp).toContain(
      'create index if not exists idx_prioridades_acompanhamento_historico_tenant_paciente'
    );
    expect(sqlUp).toContain('on prioridades_acompanhamento_historico (tenant_id, paciente_id, criado_em desc)');
  });

  it('habilita e forca RLS no historico com policy completa de isolamento por tenant', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('alter table prioridades_acompanhamento_historico enable row level security');
    expect(sqlUp).toContain('alter table prioridades_acompanhamento_historico force row level security');
    expect(sqlUp).toMatch(
      /create policy isolamento_tenant_prioridades_acompanhamento_historico on prioridades_acompanhamento_historico\s+using \(tenant_id = nullif\(current_setting\('app\.tenant_id', true\), ''\)::uuid\)\s+with check \(tenant_id = nullif\(current_setting\('app\.tenant_id', true\), ''\)::uuid\)/
    );
  });

  it('impede update, delete e truncate no historico via trigger, mesmo para o dono da tabela', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('rejeitar_mutacao_prioridades_acompanhamento_historico');
    expect(sqlUp).toContain('before update or delete on prioridades_acompanhamento_historico');
    expect(sqlUp).toContain('before truncate on prioridades_acompanhamento_historico');
    expect(sqlUp).toContain(
      'alter table prioridades_acompanhamento_historico\n        enable always trigger trg_prioridades_acompanhamento_historico_append_only'
    );
    expect(sqlUp).toContain(
      'alter table prioridades_acompanhamento_historico\n        enable always trigger trg_prioridades_acompanhamento_historico_sem_truncate'
    );
  });

  it('declara aplicacao fora de banda por conter DDL', async () => {
    const conteudo = await import('node:fs/promises').then((fs) =>
      fs.readFile(
        require.resolve('./1720000001046-AdicionarPrioridadeAcompanhamento.ts'),
        'utf8'
      )
    );

    expect(conteudo).toMatch(/@aplicacao\s+fora-de-banda/);
  });

  it('e parcialmente reversivel: down remove o estado atual (recomputavel), mas preserva o historico ja gravado', async () => {
    const { sqlDown } = await executar();

    expect(sqlDown).toContain('drop table if exists prioridades_acompanhamento_paciente cascade');
    expect(sqlDown).not.toContain('drop table if exists prioridades_acompanhamento_historico');
    expect(sqlDown).not.toContain('drop table prioridades_acompanhamento_historico');
  });
});

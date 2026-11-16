import type { QueryRunner } from 'typeorm';
import { DelegacoesCarteiraEVinculosRepresentacao1720000001085 } from './1720000001085-DelegacoesCarteiraEVinculosRepresentacao';
import { criarOpcoesTypeOrm } from '../opcoes-typeorm';
import { DelegacaoCarteiraProfissionalOrm } from '../../../modulos/profissionais/infraestrutura/delegacao-carteira-profissional.orm';
import { VinculoRepresentacaoPacienteOrm } from '../../../modulos/pacientes/infraestrutura/vinculo-representacao-paciente.orm';

/** FOOD06 P2d-1: estrutura vazia de delegação de carteira e vínculo de representação. Nenhum consumidor. */
const Migracao = DelegacoesCarteiraEVinculosRepresentacao1720000001085;
async function sqlDoUp(): Promise<string> {
  const query = jest.fn(async () => []);
  await new Migracao().up({ query } as unknown as QueryRunner);
  return query.mock.calls.flat().join('\n').toLowerCase();
}

describe('1085 delegação de carteira e vínculo de representação', () => {
  it('registra a migration e as duas entidades uma única vez, sem synchronize', () => {
    const opcoes = criarOpcoesTypeOrm();
    expect((opcoes.migrations as unknown[]).filter(m => m === Migracao)).toHaveLength(1);
    for (const e of [DelegacaoCarteiraProfissionalOrm, VinculoRepresentacaoPacienteOrm]) {
      expect((opcoes.entities as unknown[]).filter(x => x === e)).toHaveLength(1);
    }
    expect(opcoes.synchronize).toBe(false);
  });

  it('delegação: FKs compostas por tenant, um ativo por par titular-colaborador e revogação coerente', async () => {
    const sql = await sqlDoUp();
    expect(sql).toContain('create table delegacoes_carteira_profissional');
    expect(sql).toContain('foreign key (tenant_id, profissional_id) references profissionais(tenant_id, id) on delete restrict');
    for (const campo of ['colaborador_usuario_id', 'concedida_por', 'revogada_por']) {
      expect(sql).toContain(`foreign key (tenant_id, ${campo}) references usuarios(tenant_id, id) on delete restrict`);
    }
    expect(sql).toMatch(/create unique index ux_delegacoes_carteira_ativa[\s\S]*\(tenant_id, profissional_id, colaborador_usuario_id\)[\s\S]*where revogada_em is null/);
    expect(sql).toMatch(/\(revogada_por is null\) = \(revogada_em is null\)/);
  });

  it('vínculo: tipo de verificação fechado, sem auto-outorga, um ativo por par e índice por representante', async () => {
    const sql = await sqlDoUp();
    expect(sql).toContain('create table vinculos_representacao_paciente');
    expect(sql).toContain("check (tipo_verificacao in ('documento_apresentado', 'presencial', 'procuracao', 'outro'))");
    expect(sql).toContain('check (verificado_por <> representante_usuario_id)');
    expect(sql).toContain('foreign key (tenant_id, paciente_id) references pacientes(tenant_id, id) on delete restrict');
    for (const campo of ['representante_usuario_id', 'verificado_por', 'revogado_por']) {
      expect(sql).toContain(`foreign key (tenant_id, ${campo}) references usuarios(tenant_id, id) on delete restrict`);
    }
    expect(sql).toMatch(/create unique index ux_vinculos_representacao_ativo[\s\S]*\(tenant_id, paciente_id, representante_usuario_id\)[\s\S]*where revogado_em is null/);
    expect(sql).toMatch(/create index idx_vinculos_representacao_representante[\s\S]*\(tenant_id, representante_usuario_id\)[\s\S]*where revogado_em is null/);
  });

  it('as duas tabelas têm RLS ENABLE+FORCE só por tenant, sem DELETE, e só a revogação altera a linha', async () => {
    const sql = await sqlDoUp();
    expect(sql.match(/enable row level security/g)).toHaveLength(2);
    expect(sql.match(/force row level security/g)).toHaveLength(2);
    expect(sql.match(/current_setting\('app.tenant_id', true\)/g)).toHaveLength(8);
    expect(sql).not.toMatch(/for (all|delete)\b|insert into|on delete cascade|bypassrls/);
    expect(sql.match(/before delete or truncate/g)).toHaveLength(2);
    expect(sql.match(/before update on/g)).toHaveLength(2);
    expect(sql.match(/revoke delete, truncate/g)).toHaveLength(2);
  });

  it.each([
    { isTransactionActive: false, isolamento: 'read committed' },
    { isTransactionActive: true, isolamento: 'repeatable read' }
  ])('down falha fechado fora de transação READ COMMITTED: %p', async c => {
    const query = jest.fn(async () => [{ transaction_isolation: c.isolamento }]);
    await expect(new Migracao().down({ query, isTransactionActive: c.isTransactionActive } as unknown as QueryRunner)).rejects.toThrow('Rollback recusado');
    expect(query.mock.calls.flat().join('\n')).not.toMatch(/drop |delete |truncate /i);
  });

  it.each([[true, false], [false, true], [undefined, false]])('down preserva qualquer tabela com dados (delegações %p, vínculos %p)', async (delegacoes, vinculos) => {
    const query = jest.fn(async (sql: string) => sql.includes('transaction_isolation') ? [{ transaction_isolation: 'read committed' }]
      : sql.includes("current_setting('row_security')") ? [{ rs: 'off' }]
        : sql.includes('from delegacoes_carteira_profissional') ? [{ existe: delegacoes }]
          : sql.includes('from vinculos_representacao_paciente') ? [{ existe: vinculos }] : []);
    await expect(new Migracao().down({ query, isTransactionActive: true } as unknown as QueryRunner)).rejects.toThrow('Rollback recusado');
    expect(query.mock.calls.flat().join('\n')).not.toMatch(/drop |delete |truncate /i);
  });
});

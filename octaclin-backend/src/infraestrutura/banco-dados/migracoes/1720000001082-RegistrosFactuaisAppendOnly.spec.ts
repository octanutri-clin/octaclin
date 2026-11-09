import type { QueryRunner } from 'typeorm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RegistrosFactuaisAppendOnly1720000001082 } from './1720000001082-RegistrosFactuaisAppendOnly';
import { criarOpcoesTypeOrm } from '../opcoes-typeorm';

const sqlDe = async (f: (q: QueryRunner) => Promise<void>) => {
  const query = jest.fn(async (_s: string) => []);
  await f({ query } as unknown as QueryRunner);
  return query.mock.calls.map(c => c[0]).join('\n').toLowerCase();
};

it('1082 bloqueia UPDATE/DELETE/TRUNCATE por instrução, revoga das roles conhecidas e indexa profissional', async () => {
  const sql = await sqlDe(q => new RegistrosFactuaisAppendOnly1720000001082().up(q));
  // Por instrução: dispara mesmo quando o RLS deixa zero linhas visíveis para a runtime.
  expect(sql).toMatch(/before update or delete or truncate on registros_analises_factuais\s+for each statement/);
  expect(sql).toMatch(/enable always trigger trg_registros_factuais_append_only/);
  expect(sql).toMatch(/errcode = '42501'/);
  expect(sql).toMatch(/revoke update, delete, truncate on registros_analises_factuais from public/);
  expect(sql).toMatch(/octaclin_runtime_integracao.*octaclin_app_producao/s);
  expect(sql).toMatch(/create index if not exists idx_registros_analises_profissional\s+on registros_analises_factuais\s*\(tenant_id, profissional_id\)/);
  expect(sql).not.toMatch(/drop table|alter table registros_analises_factuais disable|for each row/);
});

it('1082 declara aplicação fora de banda e fica registrada uma vez, depois da 1081', () => {
  const fonte = readFileSync(join(__dirname, '1720000001082-RegistrosFactuaisAppendOnly.ts'), 'utf8');
  expect(fonte).toMatch(/@aplicacao fora-de-banda/);
  const nomes = (criarOpcoesTypeOrm().migrations as Array<{ name: string }>).map(m => m.name);
  expect(nomes.filter(n => n === 'RegistrosFactuaisAppendOnly1720000001082')).toHaveLength(1);
  expect(nomes.indexOf('RegistrosFactuaisAppendOnly1720000001082')).toBe(nomes.indexOf('RegistrosAnalisesFactuais1720000001081') + 1);
});

it('1082 down remove o bloqueio e o índice e devolve UPDATE/DELETE, sem tocar em dados', async () => {
  const sql = await sqlDe(q => new RegistrosFactuaisAppendOnly1720000001082().down(q));
  expect(sql).toMatch(/drop trigger if exists trg_registros_factuais_append_only on registros_analises_factuais/);
  expect(sql).toMatch(/drop function if exists rejeitar_mutacao_registros_factuais\(\)/);
  expect(sql).toMatch(/drop index if exists idx_registros_analises_profissional/);
  expect(sql).toMatch(/grant update, delete on registros_analises_factuais to %i/);
  expect(sql).not.toMatch(/delete from|truncate registros|drop table/);
});

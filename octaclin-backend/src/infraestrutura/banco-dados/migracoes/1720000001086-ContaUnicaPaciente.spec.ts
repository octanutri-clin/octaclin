import type { QueryRunner } from 'typeorm';
import { ContaUnicaPaciente1720000001086 } from './1720000001086-ContaUnicaPaciente';
import { DelegacoesCarteiraEVinculosRepresentacao1720000001085 } from './1720000001085-DelegacoesCarteiraEVinculosRepresentacao';
import { criarOpcoesTypeOrm } from '../opcoes-typeorm';

const Migracao = ContaUnicaPaciente1720000001086;
function runner(existe: boolean, emTransacao = true) {
  const query = jest.fn(async (sql: string) => sql.includes('select exists') ? [{ existe }] : []);
  return { query, q: { isTransactionActive: emTransacao, query } as unknown as QueryRunner };
}

describe('1086 conta única por ficha de paciente', () => {
  it('registrada uma única vez, depois da 1085', () => {
    const migracoes = criarOpcoesTypeOrm().migrations as unknown[];
    expect(migracoes.filter(m => m === Migracao)).toHaveLength(1);
    const antecessora = DelegacoesCarteiraEVinculosRepresentacao1720000001085;
    expect(migracoes.filter(m => m === antecessora)).toHaveLength(1);
    // Later migrations may be appended; this contract is the 1085 → 1086 ordering.
    expect(migracoes.indexOf(Migracao)).toBe(migracoes.indexOf(antecessora) + 1);
  });
  it('sem duplicata: desliga o filtro de RLS, trava a tabela e cria o índice parcial único', async () => {
    const { query, q } = runner(false);
    await new Migracao().up(q);
    const sqls = query.mock.calls.map(([s]) => String(s).toLowerCase());
    expect(sqls[0]).toBe('set local row_security = off');
    expect(sqls[1]).toBe('lock table pacientes in share row exclusive mode');
    expect(sqls[2]).toMatch(/group by tenant_id, usuario_id having count\(\*\) > 1/);
    expect(sqls[3]).toBe('create unique index ux_pacientes_conta_unica on pacientes (tenant_id, usuario_id) where usuario_id is not null');
  });
  it('com duplicata: recusa sem criar o índice e sem expor identificadores', async () => {
    const { query, q } = runner(true);
    await expect(new Migracao().up(q)).rejects.toThrow('Migration recusada');
    expect(query.mock.calls.some(([s]) => String(s).includes('create unique index'))).toBe(false);
    await expect(new Migracao().up(runner(true).q)).rejects.not.toThrow(/[0-9a-f]{8}-[0-9a-f]{4}/);
  });
  it('fora de transação recusa antes de qualquer SQL', async () => {
    const { query, q } = runner(false, false);
    await expect(new Migracao().up(q)).rejects.toThrow('transacao');
    expect(query).not.toHaveBeenCalled();
  });
  it('down só remove o índice (sem alterar dado)', async () => {
    const { query, q } = runner(false);
    await new Migracao().down(q);
    expect(query.mock.calls.map(([s]) => s)).toEqual(['drop index if exists ux_pacientes_conta_unica']);
  });
});

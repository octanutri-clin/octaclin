import { QueryRunner } from 'typeorm';
import { PilotoGamificacao1720000001070 } from './1720000001070-PilotoGamificacao';
describe('migration317 aditiva', () => {
  it('preserva legado, exige RLS/FKs e nao habilita nenhuma clinica', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new PilotoGamificacao1720000001070().up({ query } as unknown as QueryRunner);
    const sql = query.mock.calls.map(([s]) => s).join('\n');
    for (const table of ['consentimentos_conquistas','comentarios_comunidade','curtidas_comunidade','denuncias_comunidade','revisoes_publicacao','comandos_gamificacao']) expect(sql).toContain(`alter table ${table} force row level security`);
    expect(sql).toContain('foreign key (tenant_id,circulo_id,post_id)');
    expect(sql).toContain('snapshot_criptografado bytea');
    expect(sql).not.toContain('update tenant_configuracoes');
    expect(sql).not.toContain('update posts_comunidade');
  });
  it('recusa rollback com historia do piloto, mesmo se RLS escondesse dados', async () => {
    const query = jest.fn(async (sql: string) => sql.startsWith('select') ? [{ existe: true }] : undefined);
    await expect(new PilotoGamificacao1720000001070().down({ query } as unknown as QueryRunner)).rejects.toThrow('Rollback recusado');
    expect(query.mock.calls[0][0]).toBe('set local row_security = off');
    expect(query.mock.calls).toHaveLength(2);
  });
  it('protege ator do aceite e revisoes contra troca de tenant ou reescrita',async()=>{
    const query=jest.fn(async (_sql:string)=>undefined);
    await new PilotoGamificacao1720000001070().up({query} as unknown as QueryRunner);
    const sql=query.mock.calls.map(([s])=>s).join('\n');
    expect(sql).toContain('fk_membro317_aceite');
    expect(sql).toContain('trg_revisao317_imutavel');
    expect(sql).toContain('ck_comando317_expiracao');
  });

  it('nao remove o registro da migration mesmo quando schema nao contem dados',async()=>{
    const query=jest.fn(async (sql:string)=>sql.startsWith('select') ? [{existe:false}] : undefined);
    await expect(new PilotoGamificacao1720000001070().down({query} as unknown as QueryRunner)).rejects.toThrow('Rollback funcional');
  });

});

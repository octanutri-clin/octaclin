import { EntityManager } from 'typeorm';
import { bloquearContextoPiloto317, invalidarContextoPiloto317 } from './invalidar-contexto-piloto';

describe('invalidacao transacional317', () => {
  const cenario = (membros: {circulo_id:string;paciente_id:string}[] = []) => {
    const query = jest.fn(async (sql:string) => sql.includes('select mb.circulo_id') ? membros : []);
    return {query,m:{query} as unknown as EntityManager};
  };
  it('usa o mesmo lock antes de tocar participacao e conserva prazos menores', async () => {
    const {query,m}=cenario([{circulo_id:'circulo-sintetico',paciente_id:'paciente-sintetico'}]);
    await bloquearContextoPiloto317(m,'tenant-sintetico');
    await invalidarContextoPiloto317(m,'tenant-sintetico',{pacienteId:'paciente-sintetico'});
    expect(query.mock.calls[0]).toEqual(['select pg_advisory_xact_lock(hashtextextended($1,0))',['gamificacao317:tenant-sintetico']]);
    const sql=query.mock.calls.map(([s])=>s).join('\n');
    expect(sql).toContain("estado_piloto='revogado'");
    expect(sql).toContain('eliminar_em=least(coalesce(eliminar_em');
    expect(sql).toContain('modelo_versao=317');
    expect(sql).not.toContain('snapshot_criptografado');
  });
  it('a autoria historica de conquista nao revoga o compartilhamento de outro profissional',async()=>{
    const {query,m}=cenario();
    await invalidarContextoPiloto317(m,'tenant-sintetico',{profissionalId:'profissional-sintetico'});
    const sql=query.mock.calls.filter(([s])=>s.includes('consentimentos_conquistas') || s.includes('update paciente_badges')).map(([s])=>s).join('\n');
    expect(sql).toContain('profissional_compartilhamento_id=$3');
    expect(sql).not.toMatch(/(?:\.|\s)profissional_id=\$3/);
  });
  it('recusa escopo vazio sem tocar no banco',async()=>{
    const {query,m}=cenario();
    await expect(invalidarContextoPiloto317(m,'tenant-sintetico',{pacienteId:''})).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});

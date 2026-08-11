import { QueryRunner } from 'typeorm';
import { CriarExamesEFotosClinicas1720000001024 } from './1720000001024-CriarExamesEFotosClinicas';

describe('CriarExamesEFotosClinicas1720000001024', () => {
  it('cria estruturas clinicas aditivas com RLS forcada', async () => {
    const query = jest.fn<Promise<void>, [string]>(async () => undefined);
    await new CriarExamesEFotosClinicas1720000001024().up({ query } as unknown as QueryRunner);
    const sql = query.mock.calls.map(([item]) => item.toLowerCase()).join('\n');
    for (const tabela of ['coletas_exames_laboratoriais', 'marcadores_exames_laboratoriais', 'consentimentos_evolucao_fotografica', 'evolucoes_fotograficas']) {
      expect(sql).toContain(`create table if not exists ${tabela}`);
      expect(sql).toContain(`alter table ${tabela} force row level security`);
    }
    expect(sql).toContain('resultado_criptografado bytea not null');
    expect(sql).toContain('evidencia_criptografada bytea');
  });
});

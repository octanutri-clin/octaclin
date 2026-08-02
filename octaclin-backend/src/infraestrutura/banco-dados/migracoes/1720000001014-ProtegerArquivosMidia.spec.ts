import { QueryRunner } from 'typeorm';
import { ProtegerArquivosMidia1720000001014 } from './1720000001014-ProtegerArquivosMidia';

describe('ProtegerArquivosMidia1720000001014', () => {
  it('adiciona ciclo de confirmacao e indice unico reversivel', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    const migration = new ProtegerArquivosMidia1720000001014();

    await migration.up({ query } as unknown as QueryRunner);
    await migration.down({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    expect(sql).toContain("status varchar(20) NOT NULL DEFAULT 'pendente'");
    expect(sql).toContain('nome_original_criptografado bytea');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS uq_arquivos_midia_bucket_chave');
    expect(sql).toContain('ON arquivos_midia (bucket, chave_objeto)');
    expect(sql).toContain('DROP COLUMN IF EXISTS status');
  });
});

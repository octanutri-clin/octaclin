import { QueryRunner } from 'typeorm';
import { CriptografarConteudoNotificacoes1720000001018 } from './1720000001018-CriptografarConteudoNotificacoes';

describe('CriptografarConteudoNotificacoes1720000001018', () => {
  it('adiciona a coluna de conteudo criptografado de forma reversivel', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    const migration = new CriptografarConteudoNotificacoes1720000001018();

    await migration.up({ query } as unknown as QueryRunner);
    await migration.down({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    expect(sql).toContain('add column if not exists conteudo_criptografado bytea');
    // Nulavel de proposito: linha antiga continua legivel pelo payload em claro.
    expect(sql).not.toContain('conteudo_criptografado bytea not null');
    expect(sql).toContain('drop column if exists conteudo_criptografado');
  });
});

import { QueryRunner } from 'typeorm';
import { AdicionarEncaminhamentoDocumento1720000001067 } from './1720000001067-AdicionarEncaminhamentoDocumento';

describe('AdicionarEncaminhamentoDocumento1720000001067', () => {
  it('registra idempotência por autor e impede alterar snapshot emitido', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new AdicionarEncaminhamentoDocumento1720000001067().up({ query } as unknown as QueryRunner);
    const sql = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    expect(sql).toContain("'encaminhamento'");
    expect(sql).toContain('uq_documentos_emitidos_encaminhamento_chave');
    expect(sql).toContain('old.cabecalho_criptografado is distinct from new.cabecalho_criptografado');
    expect(sql).toContain('create trigger trg_documento_encaminhamento_imutavel');
    expect(sql).not.toContain('before delete');
  });

  it('preserva documentos emitidos e recusa o rollback antes do DDL', async () => {
    const query = jest.fn(async (sql: string) => sql.startsWith('select exists') ? [{ existe: true }] : undefined);
    await expect(new AdicionarEncaminhamentoDocumento1720000001067().down({ query } as unknown as QueryRunner))
      .rejects.toThrow('existem encaminhamentos emitidos');
    expect(query).toHaveBeenCalledTimes(2);
  });
});

import { QueryRunner } from 'typeorm';
import { AdicionarRascunhoEnviosQuestionario1720000001010 } from './1720000001010-AdicionarRascunhoEnviosQuestionario';

describe('AdicionarRascunhoEnviosQuestionario1720000001010', () => {
  it('adiciona rascunho, data e versao na tabela tenant-aware existente', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await new AdicionarRascunhoEnviosQuestionario1720000001010().up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([comando]) => comando as string).join('\n').toLowerCase();
    expect(sql).toContain('alter table envios_questionario');
    expect(sql).toContain('respostas_rascunho jsonb');
    expect(sql).toContain('rascunho_atualizado_em timestamptz');
    expect(sql).toContain('rascunho_versao integer not null default 0');
  });

  it('remove somente as colunas de rascunho no rollback', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await new AdicionarRascunhoEnviosQuestionario1720000001010().down({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([comando]) => comando as string).join('\n').toLowerCase();
    expect(sql).toContain('drop column if exists rascunho_versao');
    expect(sql).toContain('drop column if exists respostas_rascunho');
    expect(sql).not.toContain('drop table');
  });
});

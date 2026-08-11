import { QueryRunner } from 'typeorm';
import { CriarPerfisCadastroPaciente1720000001023 } from './1720000001023-CriarPerfisCadastroPaciente';

describe('CriarPerfisCadastroPaciente1720000001023', () => {
  it('cria blocos cifrados de cadastro com RLS forcada', async () => {
    const query = jest.fn<Promise<void>, [string]>(async () => undefined);
    await new CriarPerfisCadastroPaciente1720000001023().up({ query } as unknown as QueryRunner);
    const sql = query.mock.calls.map(([item]) => String(item).toLowerCase()).join('\n');

    expect(sql).toContain('create table if not exists pacientes_perfis');
    for (const coluna of ['identificacao_criptografada', 'contato_criptografado', 'operacao_criptografada', 'fiscal_criptografado']) {
      expect(sql).toContain(coluna);
    }
    expect(sql).toContain('force row level security');
    expect(sql).toContain('isolamento_tenant_pacientes_perfis');
    expect(sql).toContain('unique (tenant_id, paciente_id)');
  });
});

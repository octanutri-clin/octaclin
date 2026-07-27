import type { QueryRunner } from 'typeorm';
import { CorrigeAgendamentoPublicoPosMigracaoInicial1720000001001 } from './1720000001001-CorrigeAgendamentoPublicoPosMigracaoInicial';

describe('CorrigeAgendamentoPublicoPosMigracaoInicial1720000001001', () => {
  it('remove a unicidade antiga e cria o indice parcial para um unico link ativo por tenant e profissional', async () => {
    const migration = new CorrigeAgendamentoPublicoPosMigracaoInicial1720000001001();
    const query = jest.fn().mockResolvedValue(undefined);

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map((call) => call[0] as string).join('\n');

    expect(sql).toMatch(/drop constraint if exists agenda_links_publicos_tenant_id_profissional_id_key/i);
    expect(sql).toMatch(
      /create unique index if not exists idx_agenda_links_publicos_tenant_profissional_ativo\s+on agenda_links_publicos\s+\(tenant_id, profissional_id\)\s+where ativo = true/i
    );
  });

  it('substitui o check legado por um contrato que aceita o estado processando', async () => {
    const migration = new CorrigeAgendamentoPublicoPosMigracaoInicial1720000001001();
    const query = jest.fn().mockResolvedValue(undefined);

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map((call) => call[0] as string).join('\n');

    expect(sql).toMatch(/agenda_solicitacoes/i);
    expect(sql).toMatch(/status = 'processando'/i);
    expect(sql).toMatch(/add constraint chk_agenda_solicitacoes_estado/i);
  });
});

import { QueryRunner } from 'typeorm';
import { CriptografarCamposResiduaisFase2611720000001042 } from './1720000001042-CriptografarCamposResiduaisFase261';

describe('CriptografarCamposResiduaisFase2611720000001042', () => {
  async function executar() {
    const query = jest.fn(async (_sql: string) => undefined);
    const migration = new CriptografarCamposResiduaisFase2611720000001042();

    await migration.up({ query } as unknown as QueryRunner);
    const sqlUp = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    query.mockClear();
    await migration.down({ query } as unknown as QueryRunner);
    const sqlDown = query.mock.calls.map(([comando]) => String(comando)).join('\n');

    return { sqlUp, sqlDown };
  }

  it('adiciona as cinco colunas cifradas de forma nulavel', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('add column if not exists valor_criptografado bytea');
    expect(sqlUp).toContain('add column if not exists titulo_criptografado bytea');
    expect(sqlUp).toContain('add column if not exists motivo_cancelamento_criptografado bytea');
    // Nulaveis de proposito: nenhuma delas pode ser not null antes da Fase B
    // gravar nelas; e a mesma regra que 1720000001018 ja aplica.
    expect(sqlUp).not.toMatch(/criptografado bytea not null/);
  });

  it('relaxa o not null das colunas em claro que a Fase B vai deixar de preencher', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('alter column valor drop not null');
    expect(sqlUp).toMatch(/evolucoes_clinicas[\s\S]*?alter column titulo drop not null/);
    expect(sqlUp).toMatch(/acompanhamento_tarefas[\s\S]*?alter column titulo drop not null/);
  });

  it('nao mexe na nullability de documentos_emitidos.motivo_cancelamento (ja e nullable)', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).not.toMatch(/documentos_emitidos[\s\S]*?alter column motivo_cancelamento/);
  });

  it('e reversivel: down remove as colunas novas e restaura o not null das antigas', async () => {
    const { sqlDown } = await executar();

    expect(sqlDown).toContain('drop column if exists valor_criptografado');
    expect(sqlDown).toContain('drop column if exists titulo_criptografado');
    expect(sqlDown).toContain('drop column if exists motivo_cancelamento_criptografado');
    expect(sqlDown).toContain('alter column valor set not null');
    expect(sqlDown).toMatch(/evolucoes_clinicas[\s\S]*?alter column titulo set not null/);
    expect(sqlDown).toMatch(/acompanhamento_tarefas[\s\S]*?alter column titulo set not null/);
  });

  it('toca exatamente as cinco tabelas do desenho, nenhuma a mais', async () => {
    const { sqlUp } = await executar();
    const tabelas = [...sqlUp.matchAll(/alter table (\w+)/g)].map(([, tabela]) => tabela);

    expect(new Set(tabelas)).toEqual(
      new Set(['logs_diario_rapido', 'evolucoes_clinicas', 'acompanhamento_tarefas', 'documentos_emitidos', 'agenda_consultas'])
    );
  });
});

import { QueryRunner } from 'typeorm';
import { CriarRecorrenciaConsulta1720000001053 } from './1720000001053-CriarRecorrenciaConsulta';

describe('CriarRecorrenciaConsulta1720000001053', () => {
  async function executar() {
    const query = jest.fn(async (_sql: string) => undefined);
    const migration = new CriarRecorrenciaConsulta1720000001053();

    await migration.up({ query } as unknown as QueryRunner);
    const sqlUp = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    query.mockClear();
    await migration.down({ query } as unknown as QueryRunner);
    const sqlDown = query.mock.calls.map(([comando]) => String(comando)).join('\n');

    return { sqlUp, sqlDown };
  }

  it('cria agenda_recorrencias com frequencia e criterio de termino validos', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('create table if not exists agenda_recorrencias');
    expect(sqlUp).toContain("check (frequencia in ('diaria', 'semanal'))");
    expect(sqlUp).toContain("check (criterio_termino in ('contagem', 'data'))");
  });

  it('exige exatamente um criterio de termino preenchido', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain(
      "(criterio_termino = 'contagem' and total_ocorrencias is not null and termina_em is null)"
    );
    expect(sqlUp).toContain(
      "(criterio_termino = 'data' and termina_em is not null and total_ocorrencias is null)"
    );
  });

  it('nao tem coluna de dia da semana: e sempre o dia de inicio_primeira_ocorrencia', async () => {
    const { sqlUp } = await executar();
    const trecho = sqlUp.slice(
      sqlUp.indexOf('create table if not exists agenda_recorrencias'),
      sqlUp.indexOf('create index if not exists idx_agenda_recorrencias_tenant_paciente')
    );

    expect(trecho).not.toContain('dia_semana');
  });

  it('habilita e forca RLS em agenda_recorrencias com policy de isolamento por tenant', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('alter table agenda_recorrencias enable row level security');
    expect(sqlUp).toContain('alter table agenda_recorrencias force row level security');
    expect(sqlUp).toMatch(
      /create policy isolamento_tenant_agenda_recorrencias\s+on agenda_recorrencias\s+using \(tenant_id = nullif\(current_setting\('app\.tenant_id', true\), ''\)::uuid\)\s+with check \(tenant_id = nullif\(current_setting\('app\.tenant_id', true\), ''\)::uuid\)/
    );
  });

  it('adiciona recorrencia_id opcional em agenda_consultas com indice parcial', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain(
      'alter table agenda_consultas\n        add column if not exists recorrencia_id uuid references agenda_recorrencias(id);'
    );
    expect(sqlUp).toContain(
      'create index if not exists idx_agenda_consultas_recorrencia\n        on agenda_consultas (tenant_id, recorrencia_id)\n        where recorrencia_id is not null;'
    );
  });

  it('e reversivel: down remove o indice, a coluna nova e a tabela, nessa ordem', async () => {
    const { sqlDown } = await executar();
    const ordem = [
      sqlDown.indexOf('drop index if exists idx_agenda_consultas_recorrencia'),
      sqlDown.indexOf('alter table agenda_consultas drop column if exists recorrencia_id'),
      sqlDown.indexOf('drop table if exists agenda_recorrencias cascade')
    ];

    expect(ordem.every((indice) => indice >= 0)).toBe(true);
    expect(ordem[0]).toBeLessThan(ordem[1]);
    expect(ordem[1]).toBeLessThan(ordem[2]);
  });
});

import { QueryRunner } from 'typeorm';
import { CriarExpedientesETiposAtendimento1720000001052 } from './1720000001052-CriarExpedientesETiposAtendimento';

describe('CriarExpedientesETiposAtendimento1720000001052', () => {
  async function executar() {
    const query = jest.fn(async (_sql: string) => undefined);
    const migration = new CriarExpedientesETiposAtendimento1720000001052();

    await migration.up({ query } as unknown as QueryRunner);
    const sqlUp = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    query.mockClear();
    await migration.down({ query } as unknown as QueryRunner);
    const sqlDown = query.mock.calls.map(([comando]) => String(comando)).join('\n');

    return { sqlUp, sqlDown };
  }

  it('cria tipos_atendimento com duracao limitada e flag de ativo', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('create table if not exists tipos_atendimento');
    expect(sqlUp).toContain('check (duracao_minutos > 0 and duracao_minutos <= 480)');
    expect(sqlUp).toContain('ativo boolean not null default true');
  });

  it('cria expedientes_profissionais com dia da semana e faixa de horario validos', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('create table if not exists expedientes_profissionais');
    expect(sqlUp).toContain('check (dia_semana between 0 and 6)');
    expect(sqlUp).toContain('check (hora_fim > hora_inicio)');
  });

  it('nao tem coluna ativo em expedientes_profissionais: substituicao e sempre da jornada inteira', async () => {
    const { sqlUp } = await executar();
    const trechoExpedientes = sqlUp.slice(sqlUp.indexOf('create table if not exists expedientes_profissionais'));

    expect(trechoExpedientes.slice(0, trechoExpedientes.indexOf(');'))).not.toContain('ativo');
  });

  it('habilita e forca RLS nas duas tabelas novas com policy de isolamento por tenant', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('alter table tipos_atendimento enable row level security');
    expect(sqlUp).toContain('alter table tipos_atendimento force row level security');
    expect(sqlUp).toMatch(
      /create policy isolamento_tenant_tipos_atendimento\s+on tipos_atendimento\s+using \(tenant_id = nullif\(current_setting\('app\.tenant_id', true\), ''\)::uuid\)\s+with check \(tenant_id = nullif\(current_setting\('app\.tenant_id', true\), ''\)::uuid\)/
    );

    expect(sqlUp).toContain('alter table expedientes_profissionais enable row level security');
    expect(sqlUp).toContain('alter table expedientes_profissionais force row level security');
    expect(sqlUp).toMatch(
      /create policy isolamento_tenant_expedientes_profissionais\s+on expedientes_profissionais\s+using \(tenant_id = nullif\(current_setting\('app\.tenant_id', true\), ''\)::uuid\)\s+with check \(tenant_id = nullif\(current_setting\('app\.tenant_id', true\), ''\)::uuid\)/
    );
  });

  it('adiciona tipo_atendimento_id opcional em agenda_links_publicos, referenciando o catalogo novo', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain(
      'alter table agenda_links_publicos\n        add column if not exists tipo_atendimento_id uuid references tipos_atendimento(id);'
    );
  });

  it('e reversivel: down remove a coluna nova e as duas tabelas, nessa ordem', async () => {
    const { sqlDown } = await executar();
    const ordem = [
      sqlDown.indexOf('alter table agenda_links_publicos drop column if exists tipo_atendimento_id'),
      sqlDown.indexOf('drop table if exists expedientes_profissionais cascade'),
      sqlDown.indexOf('drop table if exists tipos_atendimento cascade')
    ];

    expect(ordem.every((indice) => indice >= 0)).toBe(true);
    expect(ordem[0]).toBeLessThan(ordem[1]);
    expect(ordem[1]).toBeLessThan(ordem[2]);
  });
});

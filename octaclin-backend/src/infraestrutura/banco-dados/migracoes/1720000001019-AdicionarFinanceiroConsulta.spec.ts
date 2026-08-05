import { QueryRunner } from 'typeorm';
import { AdicionarFinanceiroConsulta1720000001019 } from './1720000001019-AdicionarFinanceiroConsulta';

describe('AdicionarFinanceiroConsulta1720000001019', () => {
  const sqlDa = async (metodo: 'up' | 'down') => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new AdicionarFinanceiroConsulta1720000001019()[metodo]({ query } as unknown as QueryRunner);
    return query.mock.calls.map(([comando]) => String(comando)).join('\n');
  };

  it('cria pacotes de sessao com RLS e invariantes de dinheiro', async () => {
    const sql = await sqlDa('up');

    expect(sql).toContain('create table if not exists pacotes_sessao');
    expect(sql).toContain('alter table pacotes_sessao force row level security');
    expect(sql).toContain("current_setting('app.tenant_id', true)");
    expect(sql).toContain('check (valor_total_centavos >= 0 and valor_total_centavos <= 100000000)');
  });

  it('poe o financeiro da consulta no banco com as invariantes que o servico nao pode garantir sozinho', async () => {
    const sql = await sqlDa('up');

    expect(sql).toContain('add column if not exists valor_centavos integer not null default 0');
    expect(sql).toContain("check (status_pagamento in ('pendente', 'pago', 'isento'))");
    // Pago sem data (ou data sem pago) nao fecha conciliacao.
    expect(sql).toContain("check ((status_pagamento = 'pago') = (pago_em is not null))");
    // Consulta de pacote com valor proprio contaria o mesmo atendimento duas vezes.
    expect(sql).toContain("check (pacote_id is null or (forma_pagamento = 'pacote' and valor_centavos = 0))");
  });

  it('abre o gerador de documentos para o recibo mantendo uma emissao viva por consulta', async () => {
    const sql = await sqlDa('up');

    expect(sql).toContain("check (tipo in ('declaracao_comparecimento', 'relatorio_alta', 'recibo_consulta'))");
    expect(sql).toContain(
      "check (tipo not in ('declaracao_comparecimento', 'recibo_consulta') or consulta_id is not null)"
    );
    expect(sql).toContain('create unique index if not exists idx_documentos_emitidos_recibo_consulta');
    expect(sql).toContain("where tipo = 'recibo_consulta' and cancelado_em is null");
  });

  it('devolve documentos_emitidos ao estado da fase 208 no down', async () => {
    const sql = await sqlDa('down');

    expect(sql).toContain("check (tipo in ('declaracao_comparecimento', 'relatorio_alta'))");
    expect(sql).toContain("check (tipo <> 'declaracao_comparecimento' or consulta_id is not null)");
    expect(sql).toContain('drop table if exists pacotes_sessao cascade');
  });
});

import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class AdicionarFinanceiroConsulta1720000001019 implements MigrationInterface {
  name = 'AdicionarFinanceiroConsulta1720000001019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists pacotes_sessao (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        profissional_id uuid references profissionais(id),
        titulo varchar(180) not null,
        sessoes_contratadas integer not null,
        valor_total_centavos integer not null default 0,
        forma_pagamento varchar(30),
        status_pagamento varchar(20) not null default 'pendente',
        pago_em timestamptz,
        validade_em date,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        cancelado_em timestamptz,
        constraint pacotes_sessao_sessoes_check
          check (sessoes_contratadas between 1 and 200),
        -- Dinheiro e inteiro em centavos: nao existe valor negativo nem fracao de centavo.
        constraint pacotes_sessao_valor_check
          check (valor_total_centavos >= 0 and valor_total_centavos <= 100000000),
        constraint pacotes_sessao_status_check
          check (status_pagamento in ('pendente', 'pago', 'isento')),
        constraint pacotes_sessao_pago_em_check
          check ((status_pagamento = 'pago') = (pago_em is not null))
      );

      create index if not exists idx_pacotes_sessao_paciente
        on pacotes_sessao (tenant_id, paciente_id, criado_em desc);

      alter table pacotes_sessao enable row level security;
      alter table pacotes_sessao force row level security;

      drop policy if exists isolamento_tenant_pacotes_sessao on pacotes_sessao;
      create policy isolamento_tenant_pacotes_sessao
        on pacotes_sessao
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

      alter table agenda_consultas
        add column if not exists valor_centavos integer not null default 0,
        add column if not exists forma_pagamento varchar(30),
        add column if not exists status_pagamento varchar(20) not null default 'pendente',
        add column if not exists pago_em timestamptz,
        add column if not exists pacote_id uuid references pacotes_sessao(id);

      alter table agenda_consultas
        drop constraint if exists agenda_consultas_valor_check,
        drop constraint if exists agenda_consultas_status_pagamento_check,
        drop constraint if exists agenda_consultas_pago_em_check,
        drop constraint if exists agenda_consultas_pacote_check;

      alter table agenda_consultas
        add constraint agenda_consultas_valor_check
          check (valor_centavos >= 0 and valor_centavos <= 100000000),
        add constraint agenda_consultas_status_pagamento_check
          check (status_pagamento in ('pendente', 'pago', 'isento')),
        -- "Pago" sem data de pagamento nao fecha conciliacao nenhuma, e data de
        -- pagamento em consulta nao paga e o mesmo erro pelo avesso.
        add constraint agenda_consultas_pago_em_check
          check ((status_pagamento = 'pago') = (pago_em is not null)),
        -- Consulta de pacote nao carrega valor proprio: o dinheiro vive no pacote.
        -- Sem isto o mesmo atendimento entraria duas vezes no total do mes.
        add constraint agenda_consultas_pacote_check
          check (pacote_id is null or (forma_pagamento = 'pacote' and valor_centavos = 0));

      create index if not exists idx_agenda_consultas_financeiro
        on agenda_consultas (tenant_id, inicio_em, status_pagamento);

      create index if not exists idx_agenda_consultas_pacote
        on agenda_consultas (tenant_id, pacote_id)
        where pacote_id is not null;

      -- O recibo e um documento emitido como os outros (Fase 208).
      alter table documentos_emitidos
        drop constraint if exists documentos_emitidos_tipo_check;
      alter table documentos_emitidos
        add constraint documentos_emitidos_tipo_check
          check (tipo in ('declaracao_comparecimento', 'relatorio_alta', 'recibo_consulta'));

      alter table documentos_emitidos
        drop constraint if exists documentos_emitidos_consulta_check;
      alter table documentos_emitidos
        add constraint documentos_emitidos_consulta_check
          check (tipo not in ('declaracao_comparecimento', 'recibo_consulta') or consulta_id is not null);

      -- Um recibo valido por consulta: dois recibos vivos do mesmo atendimento e
      -- o caminho para o paciente declarar a mesma despesa duas vezes.
      create unique index if not exists idx_documentos_emitidos_recibo_consulta
        on documentos_emitidos (tenant_id, consulta_id)
        where tipo = 'recibo_consulta' and cancelado_em is null;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop index if exists idx_documentos_emitidos_recibo_consulta;

      alter table documentos_emitidos
        drop constraint if exists documentos_emitidos_consulta_check;
      alter table documentos_emitidos
        add constraint documentos_emitidos_consulta_check
          check (tipo <> 'declaracao_comparecimento' or consulta_id is not null);

      alter table documentos_emitidos
        drop constraint if exists documentos_emitidos_tipo_check;
      alter table documentos_emitidos
        add constraint documentos_emitidos_tipo_check
          check (tipo in ('declaracao_comparecimento', 'relatorio_alta'));

      alter table agenda_consultas
        drop constraint if exists agenda_consultas_valor_check,
        drop constraint if exists agenda_consultas_status_pagamento_check,
        drop constraint if exists agenda_consultas_pago_em_check,
        drop constraint if exists agenda_consultas_pacote_check;

      drop index if exists idx_agenda_consultas_pacote;
      drop index if exists idx_agenda_consultas_financeiro;

      alter table agenda_consultas
        drop column if exists pacote_id,
        drop column if exists pago_em,
        drop column if exists status_pagamento,
        drop column if exists forma_pagamento,
        drop column if exists valor_centavos;

      drop table if exists pacotes_sessao cascade;
    `);
  }
}

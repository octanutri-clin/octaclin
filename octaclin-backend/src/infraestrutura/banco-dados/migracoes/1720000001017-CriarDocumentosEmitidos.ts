import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class CriarDocumentosEmitidos1720000001017 implements MigrationInterface {
  name = 'CriarDocumentosEmitidos1720000001017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists documentos_emitidos (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        profissional_id uuid references profissionais(id),
        autor_usuario_id uuid not null references usuarios(id),
        tipo varchar(40) not null,
        consulta_id uuid references agenda_consultas(id),
        titulo varchar(200) not null,
        corpo_criptografado bytea not null,
        cabecalho_criptografado bytea not null,
        emitido_em timestamptz not null default now(),
        cancelado_em timestamptz,
        motivo_cancelamento varchar(300),
        enviado_em timestamptz,
        criado_em timestamptz not null default now(),
        constraint documentos_emitidos_tipo_check
          check (tipo in ('declaracao_comparecimento', 'relatorio_alta')),
        -- Declaracao de comparecimento sem consulta nao prova comparecimento nenhum.
        constraint documentos_emitidos_consulta_check
          check (tipo <> 'declaracao_comparecimento' or consulta_id is not null),
        constraint documentos_emitidos_cancelamento_check
          check (cancelado_em is not null or motivo_cancelamento is null)
      );

      -- Uma declaracao valida por consulta: reemissao exige cancelar a anterior.
      create unique index if not exists idx_documentos_emitidos_declaracao_consulta
        on documentos_emitidos (tenant_id, consulta_id)
        where tipo = 'declaracao_comparecimento' and cancelado_em is null;

      create index if not exists idx_documentos_emitidos_paciente
        on documentos_emitidos (tenant_id, paciente_id, emitido_em desc);

      alter table documentos_emitidos enable row level security;
      alter table documentos_emitidos force row level security;

      drop policy if exists isolamento_tenant_documentos_emitidos on documentos_emitidos;
      create policy isolamento_tenant_documentos_emitidos
        on documentos_emitidos
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists documentos_emitidos cascade`);
  }
}

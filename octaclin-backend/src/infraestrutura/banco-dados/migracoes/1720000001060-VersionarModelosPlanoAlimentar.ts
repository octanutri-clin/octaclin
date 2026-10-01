import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class VersionarModelosPlanoAlimentar1720000001060 implements MigrationInterface {
  name = 'VersionarModelosPlanoAlimentar1720000001060';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table modelos_plano_alimentar
        add column if not exists versao_atual integer not null default 1;
      alter table modelos_plano_alimentar
        add constraint ck_modelos_plano_alimentar_versao_atual check (versao_atual > 0);

      create table revisoes_modelo_plano_alimentar (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null,
        modelo_id uuid not null,
        numero integer not null check (numero > 0),
        nome_criptografado bytea not null,
        conteudo_criptografado bytea not null,
        total_refeicoes integer not null check (total_refeicoes > 0),
        total_itens integer not null check (total_itens > 0),
        autor_usuario_id uuid not null,
        criado_em timestamptz not null default now(),
        constraint ux_revisoes_modelo_plano_alimentar_tenant_modelo_numero
          unique (tenant_id, modelo_id, numero),
        constraint fk_revisoes_modelo_plano_alimentar_modelo
          foreign key (tenant_id, modelo_id)
          references modelos_plano_alimentar (tenant_id, id) on delete restrict,
        constraint fk_revisoes_modelo_plano_alimentar_autor
          foreign key (tenant_id, autor_usuario_id)
          references usuarios (tenant_id, id) on delete restrict
      );
      create index idx_revisoes_modelo_plano_alimentar_historico
        on revisoes_modelo_plano_alimentar (tenant_id, modelo_id, numero desc);

      alter table revisoes_modelo_plano_alimentar enable row level security;
      alter table revisoes_modelo_plano_alimentar force row level security;
      create policy isolamento_tenant_revisoes_modelo_plano_alimentar
        on revisoes_modelo_plano_alimentar
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

      create function impedir_alteracao_revisao_modelo_plano_alimentar()
      returns trigger language plpgsql as $$
      begin
        raise exception 'Revisoes de modelo sao imutaveis.' using errcode = '55000';
      end;
      $$;
      create trigger revisoes_modelo_plano_alimentar_imutaveis
        before update or delete on revisoes_modelo_plano_alimentar
        for each row execute function impedir_alteracao_revisao_modelo_plano_alimentar();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    void queryRunner;
    throw new Error('Migration 1060 nao pode ser revertida automaticamente porque removeria historico clinico.');
  }
}

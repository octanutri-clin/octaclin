import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Biblioteca de receitas e refeicoes prontas reutilizaveis.
 *
 * O conteudo e cifrado e aplicado por copia no rascunho de plano; nao ha FK
 * para itens de catalogo porque o UUID e local a cada banco. A aplicacao
 * revalida o catalogo ativo antes do rascunho ser salvo.
 *
 * @aplicacao fora-de-banda
 */
export class CriarReceitasNutricionais1720000001033 implements MigrationInterface {
  name = 'CriarReceitasNutricionais1720000001033';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists receitas_nutricionais (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        origem varchar(20) not null check (origem in ('pessoal', 'clinica')),
        tipo varchar(20) not null check (tipo in ('receita', 'refeicao_pronta')),
        profissional_id uuid,
        nome_criptografado bytea not null,
        conteudo_criptografado bytea not null,
        total_itens integer not null check (total_itens > 0),
        criado_por_usuario_id uuid not null,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        arquivado_em timestamptz,
        constraint ux_receitas_nutricionais_tenant_id_id unique (tenant_id, id),
        constraint fk_receitas_nutricionais_profissional
          foreign key (tenant_id, profissional_id) references profissionais (tenant_id, id) on delete restrict,
        constraint fk_receitas_nutricionais_usuario
          foreign key (tenant_id, criado_por_usuario_id) references usuarios (tenant_id, id) on delete restrict,
        constraint receitas_nutricionais_origem_profissional_check check (
          (origem = 'pessoal' and profissional_id is not null)
          or (origem = 'clinica' and profissional_id is null)
        )
      );
      create index if not exists idx_receitas_nutricionais_listagem
        on receitas_nutricionais (tenant_id, origem, tipo, arquivado_em, atualizado_em desc);
      create index if not exists idx_receitas_nutricionais_profissional
        on receitas_nutricionais (tenant_id, profissional_id, arquivado_em, atualizado_em desc)
        where profissional_id is not null;
      alter table receitas_nutricionais enable row level security;
      alter table receitas_nutricionais force row level security;
      create policy isolamento_tenant_receitas_nutricionais on receitas_nutricionais
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('drop table if exists receitas_nutricionais cascade;');
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Modelos de plano alimentar reutilizaveis, de origem pessoal ou da clinica.
 *
 * A origem `catalogo` nao aparece aqui de proposito: modelos fornecidos pelo
 * sistema vivem em codigo, como os `MODELOS_QUESTIONARIO` da Fase 71, onde
 * ficam versionados junto do repositorio e sao imutaveis por construcao.
 *
 * O conteudo e um snapshot criptografado em JSON, e nao um espelho relacional
 * de refeicoes e itens: um modelo existe para ser copiado para dentro de um
 * rascunho, nunca para ser consultado item a item. Como consequencia, os
 * `alimentoComposicaoId` embutidos nao tem chave estrangeira — a aplicacao
 * revalida cada um contra as fontes ativas na hora de aplicar o modelo e avisa
 * o profissional sobre o que saiu do catalogo, em vez de apagar em silencio.
 *
 * Migration aditiva: apenas cria tabela e indices, sem reescrever nada.
 *
 * @aplicacao fora-de-banda
 */
export class CriarModelosPlanoAlimentar1720000001031 implements MigrationInterface {
  name = 'CriarModelosPlanoAlimentar1720000001031';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists modelos_plano_alimentar (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        origem varchar(20) not null check (origem in ('pessoal', 'clinica')),
        profissional_id uuid,
        nome_criptografado bytea not null,
        conteudo_criptografado bytea not null,
        total_refeicoes integer not null check (total_refeicoes > 0),
        total_itens integer not null check (total_itens > 0),
        criado_por_usuario_id uuid not null,
        arquivado_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint ux_modelos_plano_alimentar_tenant_id_id unique (tenant_id, id),
        constraint fk_modelos_plano_alimentar_profissional
          foreign key (tenant_id, profissional_id) references profissionais (tenant_id, id) on delete restrict,
        constraint fk_modelos_plano_alimentar_usuario
          foreign key (tenant_id, criado_por_usuario_id) references usuarios (tenant_id, id) on delete restrict,
        -- Modelo pessoal pertence a um profissional. Modelo da clinica nao pode
        -- ficar presa a um, senao deixaria de ser compartilhado no dia em que
        -- esse profissional fosse desligado.
        constraint modelos_plano_alimentar_origem_profissional_check check (
          (origem = 'pessoal' and profissional_id is not null)
          or (origem = 'clinica' and profissional_id is null)
        )
      );
      create index if not exists idx_modelos_plano_alimentar_listagem
        on modelos_plano_alimentar (tenant_id, origem, arquivado_em, atualizado_em desc);
      -- Modelo pessoal so e listado pelo dono, entao a busca filtra por
      -- profissional antes de ordenar.
      create index if not exists idx_modelos_plano_alimentar_profissional
        on modelos_plano_alimentar (tenant_id, profissional_id, arquivado_em, atualizado_em desc)
        where profissional_id is not null;
      alter table modelos_plano_alimentar enable row level security;
      alter table modelos_plano_alimentar force row level security;
      create policy isolamento_tenant_modelos_plano_alimentar on modelos_plano_alimentar
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('drop table if exists modelos_plano_alimentar cascade;');
  }
}

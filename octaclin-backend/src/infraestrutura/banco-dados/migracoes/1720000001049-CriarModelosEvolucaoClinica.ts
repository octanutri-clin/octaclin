import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Modelos de evolucao clinica reutilizaveis, de origem pessoal ou da clinica
 * -- mesmo desenho da Fase 269 (`modelos_plano_alimentar`), PB-15.
 *
 * O conteudo e um snapshot criptografado do corpo do texto, no mesmo formato
 * aceito por `conteudo` de `evolucoes_clinicas`. Nao existe rota de "aplicar":
 * o cliente le o modelo e o formulario de nova evolucao pre-preenche
 * tipo/conteudo localmente, e o salvamento continua passando pela validacao
 * normal de `POST /pacientes/:id/evolucoes`.
 *
 * Migration aditiva: apenas cria tabela e indices, sem reescrever nada.
 *
 * @aplicacao fora-de-banda
 */
export class CriarModelosEvolucaoClinica1720000001049 implements MigrationInterface {
  name = 'CriarModelosEvolucaoClinica1720000001049';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists modelos_evolucao_clinica (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        origem varchar(20) not null check (origem in ('pessoal', 'clinica')),
        profissional_id uuid,
        nome_criptografado bytea not null,
        tipo varchar(40) not null,
        conteudo_criptografado bytea not null,
        tamanho_conteudo integer not null check (tamanho_conteudo > 0),
        criado_por_usuario_id uuid not null,
        arquivado_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint ux_modelos_evolucao_clinica_tenant_id_id unique (tenant_id, id),
        constraint fk_modelos_evolucao_clinica_profissional
          foreign key (tenant_id, profissional_id) references profissionais (tenant_id, id) on delete restrict,
        constraint fk_modelos_evolucao_clinica_usuario
          foreign key (tenant_id, criado_por_usuario_id) references usuarios (tenant_id, id) on delete restrict,
        -- Modelo pessoal pertence a um profissional. Modelo da clinica nao pode
        -- ficar preso a um, senao deixaria de ser compartilhado no dia em que
        -- esse profissional fosse desligado.
        constraint modelos_evolucao_clinica_origem_profissional_check check (
          (origem = 'pessoal' and profissional_id is not null)
          or (origem = 'clinica' and profissional_id is null)
        )
      );
      create index if not exists idx_modelos_evolucao_clinica_listagem
        on modelos_evolucao_clinica (tenant_id, origem, arquivado_em, atualizado_em desc);
      -- Modelo pessoal so e listado pelo dono, entao a busca filtra por
      -- profissional antes de ordenar.
      create index if not exists idx_modelos_evolucao_clinica_profissional
        on modelos_evolucao_clinica (tenant_id, profissional_id, arquivado_em, atualizado_em desc)
        where profissional_id is not null;
      alter table modelos_evolucao_clinica enable row level security;
      alter table modelos_evolucao_clinica force row level security;
      create policy isolamento_tenant_modelos_evolucao_clinica on modelos_evolucao_clinica
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('drop table if exists modelos_evolucao_clinica cascade;');
  }
}

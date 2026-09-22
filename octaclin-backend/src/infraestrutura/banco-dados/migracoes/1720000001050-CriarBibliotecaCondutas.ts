import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Biblioteca de condutas/orientacoes reutilizaveis -- PB-23, Fase 272, no
 * molde da biblioteca de perguntas do modulo questionarios.
 *
 * Diferente dos modelos de plano alimentar/evolucao clinica (PB-13/PB-15),
 * que tem origem pessoal/clinica, a biblioteca de condutas e sempre do
 * tenant inteiro: e conhecimento da clinica, nao de um profissional
 * individual, mesma decisao ja usada na biblioteca de perguntas. Por isso
 * nao ha coluna de profissional nem constraint de origem.
 *
 * `tipo` reaproveita o mesmo enum fechado de `condutas_terapeuticas.tipo`,
 * em vez de uma tabela de categorias livre como `categorias_pergunta`: a
 * conduta ja tem uma taxonomia fechada usada em todo o sistema, e uma
 * segunda categorizacao livre ao lado dela duplicaria classificacao.
 *
 * `nome`/`conteudo` sao cifrados em repouso, como a tabela real
 * `condutas_terapeuticas_versoes` -- e o mesmo tipo de orientacao clinica,
 * merece a mesma protecao. Por isso, diferente da biblioteca de perguntas
 * (que busca por texto em `enunciado`, armazenado em claro), esta tabela
 * nao suporta busca textual no banco -- filtro server-side e so por `tipo`.
 *
 * Migration aditiva: apenas cria tabela e indices, sem reescrever nada.
 *
 * @aplicacao fora-de-banda
 */
export class CriarBibliotecaCondutas1720000001050 implements MigrationInterface {
  name = 'CriarBibliotecaCondutas1720000001050';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists biblioteca_condutas (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        tipo varchar(40) not null check (tipo in ('meta', 'orientacao', 'suplemento', 'produto', 'formula_manipulada')),
        nome_criptografado bytea not null,
        conteudo_criptografado bytea not null,
        tamanho_conteudo integer not null check (tamanho_conteudo > 0),
        criado_por_usuario_id uuid not null,
        arquivado_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint ux_biblioteca_condutas_tenant_id_id unique (tenant_id, id),
        constraint fk_biblioteca_condutas_usuario
          foreign key (tenant_id, criado_por_usuario_id) references usuarios (tenant_id, id) on delete restrict
      );
      create index if not exists idx_biblioteca_condutas_listagem
        on biblioteca_condutas (tenant_id, tipo, arquivado_em, atualizado_em desc);
      alter table biblioteca_condutas enable row level security;
      alter table biblioteca_condutas force row level security;
      create policy isolamento_tenant_biblioteca_condutas on biblioteca_condutas
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('drop table if exists biblioteca_condutas cascade;');
  }
}

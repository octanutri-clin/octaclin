import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Substituicoes liberadas ao paciente e trilha auditavel de escolha.
 *
 * Nao existe tabela de grupos de substituicao de proposito:
 * `plano_alimentar_substituicoes` ja e a lista ordenada ancorada no item, com
 * `unique (tenant_id, item_id, ordem)`. O grupo "escolha uma opcao" *e* o item,
 * entao uma tabela de grupos teria exatamente uma linha por item.
 *
 * A escolha do paciente grava em tabela separada, nunca na versao: e assim que
 * a imutabilidade da publicacao se mantem enquanto o paciente registra trocas.
 * A trilha e append-only e nao leva `unique`, porque sobrescrever a escolha
 * anterior apagaria justamente o historico que torna o evento auditavel. A
 * escolha vigente e a ultima linha, e nao a unica.
 *
 * Migration aditiva: cria colunas, tabela e indices, sem reescrever estrutura.
 */
export class LiberarSubstituicoesAoPaciente1720000001032 implements MigrationInterface {
  name = 'LiberarSubstituicoesAoPaciente1720000001032';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table plano_alimentar_substituicoes
        add column if not exists liberada_para_paciente boolean not null default false,
        add column if not exists preferida boolean not null default false;

      -- O portal do paciente ja devolvia toda substituicao antes desta fase.
      -- Deixar a coluna nascer 'false' sem backfill faria todo plano publicado
      -- perder em silencio as trocas que o paciente enxerga hoje, dentro de uma
      -- versao que e imutavel por contrato. O backfill preserva o comportamento
      -- atual; o default 'false' vale so para o que for escrito daqui em diante.
      update plano_alimentar_substituicoes set liberada_para_paciente = true;

      alter table plano_alimentar_itens
        add column if not exists substituicoes_visiveis_inicialmente integer;
      alter table plano_alimentar_itens
        drop constraint if exists plano_alimentar_itens_substituicoes_visiveis_check;
      -- Nulo significa "mostrar todas as liberadas". Zero seria um grupo de
      -- troca que nunca aparece, o que e a mesma coisa que nao liberar nenhuma.
      alter table plano_alimentar_itens
        add constraint plano_alimentar_itens_substituicoes_visiveis_check check (
          substituicoes_visiveis_inicialmente is null
          or (substituicoes_visiveis_inicialmente between 1 and 20)
        );

      create table if not exists plano_alimentar_escolhas_paciente (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        versao_id uuid not null,
        item_id uuid not null,
        substituicao_id uuid,
        escolhido_por_usuario_id uuid not null,
        criado_em timestamptz not null default now(),
        constraint ux_plano_alimentar_escolhas_paciente_tenant_id_id unique (tenant_id, id),
        constraint fk_plano_alimentar_escolhas_paciente_versao
          foreign key (tenant_id, versao_id) references plano_alimentar_versoes (tenant_id, id) on delete cascade,
        constraint fk_plano_alimentar_escolhas_paciente_item
          foreign key (tenant_id, item_id) references plano_alimentar_itens (tenant_id, id) on delete cascade,
        -- Nulo registra o retorno ao alimento principal, que tambem e uma
        -- decisao do paciente e precisa aparecer na trilha.
        constraint fk_plano_alimentar_escolhas_paciente_substituicao
          foreign key (tenant_id, substituicao_id) references plano_alimentar_substituicoes (tenant_id, id) on delete cascade,
        constraint fk_plano_alimentar_escolhas_paciente_usuario
          foreign key (tenant_id, escolhido_por_usuario_id) references usuarios (tenant_id, id) on delete restrict
      );
      -- Escolha vigente de um item: ultima linha, por isso a ordenacao desc.
      create index if not exists idx_plano_alimentar_escolhas_paciente_vigente
        on plano_alimentar_escolhas_paciente (tenant_id, item_id, criado_em desc);
      -- Trilha completa de uma versao publicada, para leitura do portal e
      -- conferencia do profissional.
      create index if not exists idx_plano_alimentar_escolhas_paciente_versao
        on plano_alimentar_escolhas_paciente (tenant_id, versao_id, criado_em desc);
      alter table plano_alimentar_escolhas_paciente enable row level security;
      alter table plano_alimentar_escolhas_paciente force row level security;
      create policy isolamento_tenant_plano_alimentar_escolhas_paciente on plano_alimentar_escolhas_paciente
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop table if exists plano_alimentar_escolhas_paciente cascade;
      alter table plano_alimentar_itens
        drop constraint if exists plano_alimentar_itens_substituicoes_visiveis_check;
      alter table plano_alimentar_itens
        drop column if exists substituicoes_visiveis_inicialmente;
      alter table plano_alimentar_substituicoes
        drop column if exists liberada_para_paciente,
        drop column if exists preferida;
    `);
  }
}

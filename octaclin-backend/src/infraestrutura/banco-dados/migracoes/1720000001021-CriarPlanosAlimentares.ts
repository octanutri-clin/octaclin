import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarPlanosAlimentares1720000001021 implements MigrationInterface {
  name = 'CriarPlanosAlimentares1720000001021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create unique index if not exists ux_pacientes_tenant_id_id on pacientes (tenant_id, id);
      create unique index if not exists ux_profissionais_tenant_id_id on profissionais (tenant_id, id);
      create unique index if not exists ux_usuarios_tenant_id_id on usuarios (tenant_id, id);
      create unique index if not exists ux_avaliacoes_antropometricas_tenant_id_id
        on avaliacoes_antropometricas (tenant_id, id);

      create table fontes_composicao_alimentos (
        id uuid primary key default gen_random_uuid(),
        codigo varchar(80) not null,
        nome varchar(180) not null,
        versao varchar(80) not null,
        licenca text not null,
        url_fonte text,
        hash_conteudo char(64) not null,
        publicada_em date,
        importada_em timestamptz not null default now(),
        constraint ux_fontes_composicao_alimentos_codigo_versao unique (codigo, versao),
        constraint fontes_composicao_alimentos_hash_check
          check (hash_conteudo ~ '^[0-9a-f]{64}$')
      );

      create table alimentos_composicao (
        id uuid primary key default gen_random_uuid(),
        fonte_id uuid not null references fontes_composicao_alimentos(id) on delete restrict,
        codigo_origem varchar(120) not null,
        nome varchar(240) not null,
        preparacao varchar(180),
        base_gramas numeric(12,3) not null default 100,
        energia_kcal numeric(12,4),
        proteinas_g numeric(12,4),
        carboidratos_g numeric(12,4),
        lipidios_g numeric(12,4),
        fibras_g numeric(12,4),
        sodio_mg numeric(12,4),
        micronutrientes jsonb not null default '{}'::jsonb,
        criado_em timestamptz not null default now(),
        constraint ux_alimentos_composicao_fonte_codigo unique (fonte_id, codigo_origem),
        constraint alimentos_composicao_base_check check (base_gramas > 0),
        constraint alimentos_composicao_nutrientes_check check (
          (energia_kcal is null or energia_kcal >= 0) and
          (proteinas_g is null or proteinas_g >= 0) and
          (carboidratos_g is null or carboidratos_g >= 0) and
          (lipidios_g is null or lipidios_g >= 0) and
          (fibras_g is null or fibras_g >= 0) and
          (sodio_mg is null or sodio_mg >= 0)
        ),
        constraint alimentos_composicao_micronutrientes_check
          check (jsonb_typeof(micronutrientes) = 'object')
      );

      create index idx_alimentos_composicao_nome on alimentos_composicao (lower(nome));

      create table planos_alimentares (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null,
        profissional_id uuid not null,
        criado_por_usuario_id uuid not null,
        titulo_criptografado bytea not null,
        versao_publicada_atual_id uuid,
        arquivado_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint ux_planos_alimentares_tenant_id_id unique (tenant_id, id),
        constraint fk_planos_alimentares_paciente
          foreign key (tenant_id, paciente_id) references pacientes (tenant_id, id) on delete restrict,
        constraint fk_planos_alimentares_profissional
          foreign key (tenant_id, profissional_id) references profissionais (tenant_id, id) on delete restrict,
        constraint fk_planos_alimentares_autor
          foreign key (tenant_id, criado_por_usuario_id) references usuarios (tenant_id, id) on delete restrict
      );

      create table plano_alimentar_versoes (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        plano_id uuid not null,
        numero integer not null,
        criado_por_usuario_id uuid not null,
        avaliacao_antropometrica_id uuid,
        formula_codigo varchar(80),
        formula_versao varchar(40),
        motor_calculo_versao varchar(40),
        objetivos_criptografados bytea,
        observacoes_criptografadas bytea,
        calculo_snapshot_criptografado bytea,
        totais_snapshot_criptografado bytea,
        hash_conteudo char(64),
        revisada_em timestamptz,
        revisada_por_usuario_id uuid,
        publicada_em timestamptz,
        descartada_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint ux_plano_alimentar_versoes_tenant_id_id unique (tenant_id, id),
        constraint ux_plano_alimentar_versoes_ponteiro unique (tenant_id, plano_id, id),
        constraint ux_plano_alimentar_versoes_numero unique (tenant_id, plano_id, numero),
        constraint fk_plano_alimentar_versoes_plano
          foreign key (tenant_id, plano_id) references planos_alimentares (tenant_id, id) on delete restrict,
        constraint fk_plano_alimentar_versoes_autor
          foreign key (tenant_id, criado_por_usuario_id) references usuarios (tenant_id, id) on delete restrict,
        constraint fk_plano_alimentar_versoes_revisor
          foreign key (tenant_id, revisada_por_usuario_id) references usuarios (tenant_id, id) on delete restrict,
        constraint fk_plano_alimentar_versoes_avaliacao
          foreign key (tenant_id, avaliacao_antropometrica_id)
          references avaliacoes_antropometricas (tenant_id, id) on delete restrict,
        constraint plano_alimentar_versoes_numero_check check (numero > 0),
        constraint plano_alimentar_versoes_revisao_check check (
          (revisada_em is null and revisada_por_usuario_id is null) or
          (revisada_em is not null and revisada_por_usuario_id is not null)
        ),
        constraint plano_alimentar_versoes_datas_check
          check (publicada_em is null or descartada_em is null),
        constraint plano_alimentar_versoes_publicacao_check check (
          publicada_em is null or (
            revisada_em is not null and revisada_por_usuario_id is not null and
            objetivos_criptografados is not null and
            formula_codigo is not null and formula_versao is not null and
            motor_calculo_versao is not null and calculo_snapshot_criptografado is not null and
            totais_snapshot_criptografado is not null and hash_conteudo is not null
          )
        ),
        constraint plano_alimentar_versoes_hash_check
          check (hash_conteudo is null or hash_conteudo ~ '^[0-9a-f]{64}$')
      );

      alter table planos_alimentares
        add constraint fk_planos_alimentares_versao_publicada
        foreign key (tenant_id, id, versao_publicada_atual_id)
        references plano_alimentar_versoes (tenant_id, plano_id, id)
        on delete restrict;

      create table plano_alimentar_refeicoes (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        versao_id uuid not null,
        ordem integer not null,
        nome_criptografado bytea not null,
        horario_local time,
        orientacoes_criptografadas bytea,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint ux_plano_alimentar_refeicoes_tenant_id_id unique (tenant_id, id),
        constraint ux_plano_alimentar_refeicoes_ordem unique (tenant_id, versao_id, ordem),
        constraint fk_plano_alimentar_refeicoes_versao
          foreign key (tenant_id, versao_id) references plano_alimentar_versoes (tenant_id, id) on delete restrict,
        constraint plano_alimentar_refeicoes_ordem_check check (ordem >= 0)
      );

      create table plano_alimentar_itens (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        refeicao_id uuid not null,
        alimento_composicao_id uuid references alimentos_composicao(id) on delete restrict,
        ordem integer not null,
        descricao_criptografada bytea not null,
        quantidade numeric(12,3) not null,
        unidade varchar(40) not null,
        porcao_gramas numeric(12,3) not null,
        composicao_snapshot_criptografada bytea not null,
        motor_calculo_versao varchar(40) not null,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint ux_plano_alimentar_itens_tenant_id_id unique (tenant_id, id),
        constraint ux_plano_alimentar_itens_ordem unique (tenant_id, refeicao_id, ordem),
        constraint fk_plano_alimentar_itens_refeicao
          foreign key (tenant_id, refeicao_id) references plano_alimentar_refeicoes (tenant_id, id) on delete restrict,
        constraint plano_alimentar_itens_ordem_check check (ordem >= 0),
        constraint plano_alimentar_itens_quantidade_check check (quantidade > 0),
        constraint plano_alimentar_itens_porcao_check check (porcao_gramas > 0)
      );

      create table plano_alimentar_substituicoes (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        item_id uuid not null,
        alimento_composicao_id uuid references alimentos_composicao(id) on delete restrict,
        ordem integer not null,
        descricao_criptografada bytea not null,
        quantidade numeric(12,3) not null,
        unidade varchar(40) not null,
        porcao_gramas numeric(12,3) not null,
        composicao_snapshot_criptografada bytea not null,
        motor_calculo_versao varchar(40) not null,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint ux_plano_alimentar_substituicoes_tenant_id_id unique (tenant_id, id),
        constraint ux_plano_alimentar_substituicoes_ordem unique (tenant_id, item_id, ordem),
        constraint fk_plano_alimentar_substituicoes_item
          foreign key (tenant_id, item_id) references plano_alimentar_itens (tenant_id, id) on delete restrict,
        constraint plano_alimentar_substituicoes_ordem_check check (ordem >= 0),
        constraint plano_alimentar_substituicoes_quantidade_check check (quantidade > 0),
        constraint plano_alimentar_substituicoes_porcao_check check (porcao_gramas > 0)
      );

      create index idx_planos_alimentares_paciente_ativos
        on planos_alimentares (tenant_id, paciente_id, criado_em desc)
        where arquivado_em is null;
      create index idx_planos_alimentares_profissional
        on planos_alimentares (tenant_id, profissional_id, paciente_id);
      create unique index ux_plano_alimentar_versao_rascunho
        on plano_alimentar_versoes (tenant_id, plano_id)
        where publicada_em is null and descartada_em is null;
      create index idx_plano_alimentar_versoes_publicadas
        on plano_alimentar_versoes (tenant_id, plano_id, publicada_em desc)
        where publicada_em is not null;
      create index idx_plano_alimentar_itens_alimento
        on plano_alimentar_itens (alimento_composicao_id)
        where alimento_composicao_id is not null;
      create index idx_plano_alimentar_substituicoes_alimento
        on plano_alimentar_substituicoes (alimento_composicao_id)
        where alimento_composicao_id is not null;
    `);

    for (const tabela of [
      'planos_alimentares',
      'plano_alimentar_versoes',
      'plano_alimentar_refeicoes',
      'plano_alimentar_itens',
      'plano_alimentar_substituicoes'
    ]) {
      await queryRunner.query(`
        alter table ${tabela} enable row level security;
        alter table ${tabela} force row level security;
        create policy isolamento_tenant_${tabela}
          on ${tabela}
          using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
          with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
      `);
    }

    await queryRunner.query(`
      create function bloquear_mutacao_versao_plano_publicada()
      returns trigger
      language plpgsql
      as $$
      begin
        if old.publicada_em is not null then
          raise exception 'Versao publicada e imutavel.';
        end if;
        if tg_op = 'DELETE' then
          return old;
        end if;
        return new;
      end;
      $$;

      create trigger trg_bloquear_mutacao_versao_plano_publicada
        before update or delete on plano_alimentar_versoes
        for each row execute function bloquear_mutacao_versao_plano_publicada();

      create function bloquear_mutacao_refeicao_plano_publicado()
      returns trigger
      language plpgsql
      as $$
      begin
        if tg_op <> 'INSERT' and exists (
          select 1 from plano_alimentar_versoes v
          where v.tenant_id = old.tenant_id and v.id = old.versao_id and v.publicada_em is not null
        ) then
          raise exception 'Filhos de versao publicada sao imutaveis.';
        end if;
        if tg_op <> 'DELETE' and exists (
          select 1 from plano_alimentar_versoes v
          where v.tenant_id = new.tenant_id and v.id = new.versao_id and v.publicada_em is not null
        ) then
          raise exception 'Filhos de versao publicada sao imutaveis.';
        end if;
        if tg_op = 'DELETE' then return old; end if;
        return new;
      end;
      $$;

      create trigger trg_bloquear_mutacao_refeicao_plano_publicado
        before insert or update or delete on plano_alimentar_refeicoes
        for each row execute function bloquear_mutacao_refeicao_plano_publicado();

      create function bloquear_mutacao_item_plano_publicado()
      returns trigger
      language plpgsql
      as $$
      begin
        if tg_op <> 'INSERT' and exists (
          select 1
          from plano_alimentar_refeicoes r
          join plano_alimentar_versoes v on v.tenant_id = r.tenant_id and v.id = r.versao_id
          where r.tenant_id = old.tenant_id and r.id = old.refeicao_id and v.publicada_em is not null
        ) then
          raise exception 'Filhos de versao publicada sao imutaveis.';
        end if;
        if tg_op <> 'DELETE' and exists (
          select 1
          from plano_alimentar_refeicoes r
          join plano_alimentar_versoes v on v.tenant_id = r.tenant_id and v.id = r.versao_id
          where r.tenant_id = new.tenant_id and r.id = new.refeicao_id and v.publicada_em is not null
        ) then
          raise exception 'Filhos de versao publicada sao imutaveis.';
        end if;
        if tg_op = 'DELETE' then return old; end if;
        return new;
      end;
      $$;

      create trigger trg_bloquear_mutacao_item_plano_publicado
        before insert or update or delete on plano_alimentar_itens
        for each row execute function bloquear_mutacao_item_plano_publicado();

      create function bloquear_mutacao_substituicao_plano_publicado()
      returns trigger
      language plpgsql
      as $$
      begin
        if tg_op <> 'INSERT' and exists (
          select 1
          from plano_alimentar_itens i
          join plano_alimentar_refeicoes r on r.tenant_id = i.tenant_id and r.id = i.refeicao_id
          join plano_alimentar_versoes v on v.tenant_id = r.tenant_id and v.id = r.versao_id
          where i.tenant_id = old.tenant_id and i.id = old.item_id and v.publicada_em is not null
        ) then
          raise exception 'Filhos de versao publicada sao imutaveis.';
        end if;
        if tg_op <> 'DELETE' and exists (
          select 1
          from plano_alimentar_itens i
          join plano_alimentar_refeicoes r on r.tenant_id = i.tenant_id and r.id = i.refeicao_id
          join plano_alimentar_versoes v on v.tenant_id = r.tenant_id and v.id = r.versao_id
          where i.tenant_id = new.tenant_id and i.id = new.item_id and v.publicada_em is not null
        ) then
          raise exception 'Filhos de versao publicada sao imutaveis.';
        end if;
        if tg_op = 'DELETE' then return old; end if;
        return new;
      end;
      $$;

      create trigger trg_bloquear_mutacao_substituicao_plano_publicado
        before insert or update or delete on plano_alimentar_substituicoes
        for each row execute function bloquear_mutacao_substituicao_plano_publicado();

      create function validar_publicacao_plano_alimentar()
      returns trigger
      language plpgsql
      as $$
      begin
        if new.publicada_em is not null and (
          not exists (
            select 1 from plano_alimentar_refeicoes r
            where r.tenant_id = new.tenant_id and r.versao_id = new.id
          ) or exists (
            select 1
            from plano_alimentar_refeicoes r
            where r.tenant_id = new.tenant_id
              and r.versao_id = new.id
              and not exists (
                select 1 from plano_alimentar_itens i
                where i.tenant_id = r.tenant_id and i.refeicao_id = r.id
              )
          )
        ) then
          raise exception 'Plano publicado precisa ter refeicoes preenchidas com ao menos um item em cada uma.';
        end if;
        return new;
      end;
      $$;

      create constraint trigger trg_validar_publicacao_plano_alimentar
        after insert or update on plano_alimentar_versoes
        deferrable initially deferred
        for each row execute function validar_publicacao_plano_alimentar();

      create function validar_ponteiro_versao_publicada_plano()
      returns trigger
      language plpgsql
      as $$
      begin
        if new.versao_publicada_atual_id is not null and not exists (
          select 1 from plano_alimentar_versoes v
          where v.tenant_id = new.tenant_id
            and v.plano_id = new.id
            and v.id = new.versao_publicada_atual_id
            and v.publicada_em is not null
        ) then
          raise exception 'Versao apontada precisa estar publicada e pertencer ao mesmo plano e tenant.';
        end if;
        return new;
      end;
      $$;

      create trigger trg_validar_ponteiro_versao_publicada_plano
        before insert or update on planos_alimentares
        for each row execute function validar_ponteiro_versao_publicada_plano();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop trigger if exists trg_validar_ponteiro_versao_publicada_plano on planos_alimentares;
      drop trigger if exists trg_validar_publicacao_plano_alimentar on plano_alimentar_versoes;
      drop trigger if exists trg_bloquear_mutacao_substituicao_plano_publicado on plano_alimentar_substituicoes;
      drop trigger if exists trg_bloquear_mutacao_item_plano_publicado on plano_alimentar_itens;
      drop trigger if exists trg_bloquear_mutacao_refeicao_plano_publicado on plano_alimentar_refeicoes;
      drop trigger if exists trg_bloquear_mutacao_versao_plano_publicada on plano_alimentar_versoes;

      drop function if exists validar_ponteiro_versao_publicada_plano();
      drop function if exists validar_publicacao_plano_alimentar();
      drop function if exists bloquear_mutacao_substituicao_plano_publicado();
      drop function if exists bloquear_mutacao_item_plano_publicado();
      drop function if exists bloquear_mutacao_refeicao_plano_publicado();
      drop function if exists bloquear_mutacao_versao_plano_publicada();

      drop table if exists plano_alimentar_substituicoes;
      drop table if exists plano_alimentar_itens;
      drop table if exists plano_alimentar_refeicoes;
      alter table planos_alimentares drop constraint if exists fk_planos_alimentares_versao_publicada;
      drop table if exists plano_alimentar_versoes;
      drop table if exists planos_alimentares;
      drop table if exists alimentos_composicao;
      drop table if exists fontes_composicao_alimentos;

      drop index if exists ux_avaliacoes_antropometricas_tenant_id_id;
      drop index if exists ux_usuarios_tenant_id_id;
      drop index if exists ux_profissionais_tenant_id_id;
      drop index if exists ux_pacientes_tenant_id_id;

    `);
  }
}

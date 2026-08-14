import { MigrationInterface, QueryRunner } from 'typeorm';

export class GovernancaCatalogoMultifonte1720000001028 implements MigrationInterface {
  name = 'GovernancaCatalogoMultifonte1720000001028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table catalogos_composicao_alimentos (
        id uuid primary key default gen_random_uuid(),
        codigo varchar(80) not null,
        nome varchar(180) not null,
        instituicao varchar(180),
        url_oficial text,
        criado_em timestamptz not null default now(),
        constraint ux_catalogos_composicao_alimentos_codigo unique (codigo)
      );

      insert into catalogos_composicao_alimentos (codigo, nome, url_oficial)
      select codigo, min(nome), min(url_fonte)
        from fontes_composicao_alimentos
       group by codigo
      on conflict (codigo) do nothing;

      alter table fontes_composicao_alimentos
        add column catalogo_id uuid,
        add column base_codigo varchar(80),
        add column url_artefato text,
        add column checksum_arquivo char(64),
        add column capturada_em timestamptz,
        add column esquema_versao varchar(40),
        add column esquema_nutrientes jsonb not null default '{}'::jsonb,
        add column direito_uso_status varchar(24) not null default 'pendente',
        add column direito_uso_referencia text,
        add column direito_uso_aprovado_em timestamptz,
        add column responsavel_aprovacao varchar(180),
        add column situacao varchar(20) not null default 'em_validacao';

      update fontes_composicao_alimentos fonte
         set catalogo_id = catalogo.id,
             base_codigo = fonte.codigo
        from catalogos_composicao_alimentos catalogo
       where catalogo.codigo = fonte.codigo;

      update catalogos_composicao_alimentos
         set instituicao = 'NEPA/UNICAMP'
       where codigo = 'taco_nepa_unicamp';

      update fontes_composicao_alimentos
         set base_codigo = 'cmvcol_taco3',
             url_artefato = 'https://www.nepa.unicamp.br/arquivo/uploads/taco-4a-edicao/taco-4a-edicao-2/',
             checksum_arquivo = 'a66b8ec528daeabc63bc2b015fc9bd8c6d76b941c2fc0ed93a4311d449302d14',
             capturada_em = importada_em,
             esquema_versao = 'octaclin-composicao-v1',
             esquema_nutrientes = jsonb_build_object(
               'baseGramas', 100,
               'campos', jsonb_build_object(
                 'energiaKcal', 'kcal',
                 'proteinasG', 'g',
                 'carboidratosG', 'g',
                 'lipidiosG', 'g',
                 'fibrasG', 'g',
                 'sodioMg', 'mg'
               )
             ),
             direito_uso_status = 'aprovado',
             direito_uso_referencia = url_fonte,
             direito_uso_aprovado_em = importada_em,
             responsavel_aprovacao = 'legado-validado-fase-216',
             situacao = 'ativa'
       where codigo = 'taco_nepa_unicamp'
         and versao = 'taco-4a-cmvcol-taco3-v1'
         and hash_conteudo = '82c22bc4c72720f9786478b5ba0c6947316b23c4cddfd365781ee2ffb7f481e7';

      alter table fontes_composicao_alimentos
        drop constraint ux_fontes_composicao_alimentos_codigo_versao,
        alter column catalogo_id set not null,
        alter column base_codigo set not null,
        add constraint fk_fontes_composicao_alimentos_catalogo
          foreign key (catalogo_id) references catalogos_composicao_alimentos(id) on delete restrict,
        add constraint ux_fontes_composicao_alimentos_catalogo_versao_base
          unique (catalogo_id, versao, base_codigo),
        add constraint fontes_composicao_alimentos_situacao_check
          check (situacao in ('em_validacao', 'ativa', 'suspensa', 'revogada')),
        add constraint fontes_composicao_alimentos_direito_uso_check
          check (direito_uso_status in ('pendente', 'aprovado', 'negado', 'expirado')),
        add constraint fontes_composicao_alimentos_checksum_arquivo_check
          check (checksum_arquivo is null or checksum_arquivo ~ '^[0-9a-f]{64}$'),
        add constraint fontes_composicao_alimentos_esquema_check
          check (jsonb_typeof(esquema_nutrientes) = 'object'),
        add constraint fontes_composicao_alimentos_ativacao_check
          check (
            situacao <> 'ativa' or (
              nullif(trim(codigo), '') is not null and
              nullif(trim(nome), '') is not null and
              nullif(trim(licenca), '') is not null and
              direito_uso_status = 'aprovado' and
              nullif(trim(direito_uso_referencia), '') is not null and
              direito_uso_aprovado_em is not null and
              nullif(trim(responsavel_aprovacao), '') is not null and
              nullif(trim(url_artefato), '') is not null and
              checksum_arquivo is not null and
              capturada_em is not null and
              nullif(trim(esquema_versao), '') is not null and
              esquema_nutrientes <> '{}'::jsonb
            )
          );

      create table importacoes_catalogo_composicao (
        id uuid primary key default gen_random_uuid(),
        fonte_versao_id uuid not null references fontes_composicao_alimentos(id) on delete restrict,
        checksum_arquivo char(64) not null,
        hash_conteudo char(64) not null,
        status varchar(20) not null,
        total_registros integer,
        manifesto jsonb not null default '{}'::jsonb,
        iniciada_em timestamptz not null default now(),
        concluida_em timestamptz,
        erro_sanitizado text,
        executor varchar(180) not null,
        constraint importacoes_catalogo_status_check
          check (status in ('em_execucao', 'concluida', 'falhou', 'ignorada')),
        constraint importacoes_catalogo_checksums_check
          check (checksum_arquivo ~ '^[0-9a-f]{64}$' and hash_conteudo ~ '^[0-9a-f]{64}$'),
        constraint importacoes_catalogo_total_check check (total_registros is null or total_registros >= 0),
        constraint importacoes_catalogo_manifesto_check check (jsonb_typeof(manifesto) = 'object'),
        constraint ux_importacoes_catalogo_identidade
          unique (fonte_versao_id, checksum_arquivo, hash_conteudo)
      );

      create table eventos_governanca_fontes (
        id uuid primary key default gen_random_uuid(),
        fonte_versao_id uuid not null references fontes_composicao_alimentos(id) on delete restrict,
        situacao_anterior varchar(20) not null,
        situacao_nova varchar(20) not null,
        motivo text not null,
        ator varchar(180) not null,
        criado_em timestamptz not null default now()
      );

      alter table alimentos_composicao
        add column importacao_id uuid references importacoes_catalogo_composicao(id) on delete restrict,
        add column hash_registro char(64),
        add constraint alimentos_composicao_hash_registro_check
          check (hash_registro is null or hash_registro ~ '^[0-9a-f]{64}$');

      create index idx_fontes_composicao_alimentos_situacao
        on fontes_composicao_alimentos (situacao, catalogo_id, versao, base_codigo);
      create index idx_alimentos_composicao_fonte_nome
        on alimentos_composicao (fonte_id, lower(nome));
      create index idx_importacoes_catalogo_fonte_data
        on importacoes_catalogo_composicao (fonte_versao_id, iniciada_em desc);
      create index idx_eventos_governanca_fonte_data
        on eventos_governanca_fontes (fonte_versao_id, criado_em desc);

      create function proteger_catalogo_composicao_referenciado()
      returns trigger
      language plpgsql
      as $$
      begin
        if exists (
          select 1 from fontes_composicao_alimentos where catalogo_id = old.id
        ) then
          raise exception 'Catalogo de composicao referenciado e imutavel.';
        end if;
        if tg_op = 'DELETE' then return old; end if;
        return new;
      end;
      $$;

      create trigger trg_proteger_catalogo_composicao_referenciado
        before update or delete on catalogos_composicao_alimentos
        for each row execute function proteger_catalogo_composicao_referenciado();

      create function proteger_fonte_composicao_ativa()
      returns trigger
      language plpgsql
      as $$
      declare
        ator text;
        motivo text;
      begin
        if tg_op = 'DELETE' then
          if old.situacao <> 'em_validacao' or exists (
            select 1 from alimentos_composicao where fonte_id = old.id
          ) then
            raise exception 'Fonte de composicao versionada nao pode ser removida.';
          end if;
          return old;
        end if;

        if old.situacao = 'revogada' then
          raise exception 'Fonte de composicao revogada e imutavel.';
        end if;

        if old.situacao in ('ativa', 'suspensa') and (
          new.catalogo_id is distinct from old.catalogo_id or
          new.codigo is distinct from old.codigo or
          new.nome is distinct from old.nome or
          new.versao is distinct from old.versao or
          new.base_codigo is distinct from old.base_codigo or
          new.licenca is distinct from old.licenca or
          new.url_fonte is distinct from old.url_fonte or
          new.url_artefato is distinct from old.url_artefato or
          new.checksum_arquivo is distinct from old.checksum_arquivo or
          new.hash_conteudo is distinct from old.hash_conteudo or
          new.capturada_em is distinct from old.capturada_em or
          new.esquema_versao is distinct from old.esquema_versao or
          new.esquema_nutrientes is distinct from old.esquema_nutrientes or
          new.publicada_em is distinct from old.publicada_em or
          new.direito_uso_status is distinct from old.direito_uso_status or
          new.direito_uso_referencia is distinct from old.direito_uso_referencia or
          new.direito_uso_aprovado_em is distinct from old.direito_uso_aprovado_em or
          new.responsavel_aprovacao is distinct from old.responsavel_aprovacao
        ) then
          raise exception 'Conteudo e proveniencia de fonte ativa ou suspensa sao imutaveis.';
        end if;

        if new.situacao is distinct from old.situacao then
          if not (
            (old.situacao = 'em_validacao' and new.situacao in ('ativa', 'revogada')) or
            (old.situacao = 'ativa' and new.situacao in ('suspensa', 'revogada')) or
            (old.situacao = 'suspensa' and new.situacao in ('ativa', 'revogada'))
          ) then
            raise exception 'Transicao de governanca da fonte invalida.';
          end if;
          ator := nullif(current_setting('app.catalogo_ator', true), '');
          motivo := nullif(current_setting('app.catalogo_motivo', true), '');
          if ator is null or motivo is null then
            raise exception 'Transicao de governanca exige ator e motivo.';
          end if;
          insert into eventos_governanca_fontes (
            fonte_versao_id, situacao_anterior, situacao_nova, motivo, ator
          ) values (old.id, old.situacao, new.situacao, motivo, ator);
        end if;
        return new;
      end;
      $$;

      create trigger trg_proteger_fonte_composicao_ativa
        before update or delete on fontes_composicao_alimentos
        for each row execute function proteger_fonte_composicao_ativa();

      create function proteger_alimento_fonte_versionada()
      returns trigger
      language plpgsql
      as $$
      declare
        fonte uuid;
        estado varchar(20);
      begin
        fonte := case when tg_op = 'DELETE' then old.fonte_id else new.fonte_id end;
        select situacao into estado from fontes_composicao_alimentos where id = fonte;
        if tg_op <> 'DELETE' and new.importacao_id is not null and not exists (
          select 1
            from importacoes_catalogo_composicao importacao
           where importacao.id = new.importacao_id
             and importacao.fonte_versao_id = new.fonte_id
        ) then
          raise exception 'Importacao do alimento nao pertence a fonte versionada.';
        end if;
        if tg_op = 'INSERT' and estado <> 'em_validacao' then
          raise exception 'Alimentos so podem ser carregados em fonte em validacao.';
        end if;
        if tg_op in ('UPDATE', 'DELETE') and estado in ('ativa', 'suspensa', 'revogada') then
          raise exception 'Alimento de fonte versionada ativa, suspensa ou revogada e imutavel.';
        end if;
        if tg_op = 'DELETE' then return old; end if;
        return new;
      end;
      $$;

      create trigger trg_proteger_alimento_fonte_versionada
        before insert or update or delete on alimentos_composicao
        for each row execute function proteger_alimento_fonte_versionada();

      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'octaclin_runtime_integracao') then
          grant select on catalogos_composicao_alimentos, fontes_composicao_alimentos,
            alimentos_composicao, importacoes_catalogo_composicao, eventos_governanca_fontes
            to octaclin_runtime_integracao;
          revoke insert, update, delete, truncate on catalogos_composicao_alimentos,
            fontes_composicao_alimentos, alimentos_composicao,
            importacoes_catalogo_composicao, eventos_governanca_fontes
            from octaclin_runtime_integracao;
        end if;
      end;
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop trigger if exists trg_proteger_alimento_fonte_versionada on alimentos_composicao;
      drop trigger if exists trg_proteger_fonte_composicao_ativa on fontes_composicao_alimentos;
      drop trigger if exists trg_proteger_catalogo_composicao_referenciado on catalogos_composicao_alimentos;
      drop function if exists proteger_alimento_fonte_versionada();
      drop function if exists proteger_fonte_composicao_ativa();
      drop function if exists proteger_catalogo_composicao_referenciado();
      drop index if exists idx_eventos_governanca_fonte_data;
      drop index if exists idx_importacoes_catalogo_fonte_data;
      drop index if exists idx_alimentos_composicao_fonte_nome;
      drop index if exists idx_fontes_composicao_alimentos_situacao;
      alter table alimentos_composicao
        drop constraint if exists alimentos_composicao_hash_registro_check,
        drop column if exists hash_registro,
        drop column if exists importacao_id;
      drop table if exists eventos_governanca_fontes;
      drop table if exists importacoes_catalogo_composicao;
      alter table fontes_composicao_alimentos
        drop constraint if exists fontes_composicao_alimentos_ativacao_check,
        drop constraint if exists fontes_composicao_alimentos_esquema_check,
        drop constraint if exists fontes_composicao_alimentos_checksum_arquivo_check,
        drop constraint if exists fontes_composicao_alimentos_direito_uso_check,
        drop constraint if exists fontes_composicao_alimentos_situacao_check,
        drop constraint if exists ux_fontes_composicao_alimentos_catalogo_versao_base,
        drop constraint if exists fk_fontes_composicao_alimentos_catalogo,
        drop column if exists situacao,
        drop column if exists responsavel_aprovacao,
        drop column if exists direito_uso_aprovado_em,
        drop column if exists direito_uso_referencia,
        drop column if exists direito_uso_status,
        drop column if exists esquema_nutrientes,
        drop column if exists esquema_versao,
        drop column if exists capturada_em,
        drop column if exists checksum_arquivo,
        drop column if exists url_artefato,
        drop column if exists base_codigo,
        drop column if exists catalogo_id,
        add constraint ux_fontes_composicao_alimentos_codigo_versao unique (codigo, versao);
      drop table if exists catalogos_composicao_alimentos;
    `);
  }
}

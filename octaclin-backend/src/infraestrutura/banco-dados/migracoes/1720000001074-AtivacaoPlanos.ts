import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda
 * Estado operacional separado dos snapshots publicados imutáveis. */
export class AtivacaoPlanos1720000001074 implements MigrationInterface {
  name = 'AtivacaoPlanos1720000001074';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`alter table planos_alimentares
      add column ativo_para_paciente boolean not null default false,
      add column ativacao_definida boolean not null default false,
      add column ativacao_revisao integer not null default 0 check (ativacao_revisao >= 0);
      alter table plano_alimentar_versoes add column identidades_refeicoes_criptografadas bytea null;
      create table plano_alimentar_refeicao_estados (
        id uuid primary key default gen_random_uuid(), tenant_id uuid not null, plano_id uuid not null,
        ativa boolean not null default true,
        unique (tenant_id, plano_id, id),
        foreign key (tenant_id, plano_id) references planos_alimentares(tenant_id,id) on delete cascade
      );
      create table plano_alimentar_refeicao_vinculos (
        tenant_id uuid not null, plano_id uuid not null, versao_id uuid not null,
        refeicao_id uuid not null, identidade_id uuid not null,
        primary key (tenant_id, refeicao_id), unique (tenant_id, versao_id, identidade_id),
        foreign key (tenant_id, plano_id, identidade_id) references plano_alimentar_refeicao_estados(tenant_id,plano_id,id) on delete cascade,
        foreign key (tenant_id, versao_id) references plano_alimentar_versoes(tenant_id,id) on delete cascade,
        foreign key (tenant_id, refeicao_id) references plano_alimentar_refeicoes(tenant_id,id) on delete cascade
      );
      create index idx_refeicao_estados_plano on plano_alimentar_refeicao_estados(tenant_id,plano_id);
      create index idx_refeicao_vinculos_versao on plano_alimentar_refeicao_vinculos(tenant_id,versao_id);
      create index idx_refeicao_vinculos_identidade on plano_alimentar_refeicao_vinculos(tenant_id,plano_id,identidade_id);
      create table plano_alimentar_ativacao_eventos (
        id uuid primary key default gen_random_uuid(), tenant_id uuid not null, plano_id uuid not null,
        revisao integer not null check (revisao > 0), usuario_id uuid not null,
        refeicao_identidade_id uuid null, ativo boolean not null, criado_em timestamptz not null default now(),
        unique (tenant_id, plano_id, revisao),
        foreign key (tenant_id, plano_id) references planos_alimentares(tenant_id,id) on delete cascade,
        foreign key (tenant_id, plano_id, refeicao_identidade_id) references plano_alimentar_refeicao_estados(tenant_id,plano_id,id)
      );
      create function validar_vinculo_identidade_refeicao() returns trigger language plpgsql as $$
      begin
        if not exists (select 1 from plano_alimentar_refeicoes r
          join plano_alimentar_versoes v on v.tenant_id=r.tenant_id and v.id=r.versao_id
          where r.tenant_id=new.tenant_id and r.id=new.refeicao_id and v.id=new.versao_id and v.plano_id=new.plano_id)
        then raise exception 'Vinculo de refeicao fora do plano/versao.'; end if;
        return new;
      end; $$;
      create trigger trg_validar_vinculo_identidade_refeicao before insert or update on plano_alimentar_refeicao_vinculos
        for each row execute function validar_vinculo_identidade_refeicao();`);
    for (const tabela of ['plano_alimentar_refeicao_estados', 'plano_alimentar_refeicao_vinculos', 'plano_alimentar_ativacao_eventos']) {
      await q.query(`alter table ${tabela} enable row level security;
        alter table ${tabela} force row level security;
        create policy tenant_leitura on ${tabela} for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
        create policy tenant_insercao on ${tabela} for insert with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);`);
      if (tabela !== 'plano_alimentar_ativacao_eventos') await q.query(`
        create policy tenant_atualizacao on ${tabela} for update using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
          with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
        create policy tenant_exclusao on ${tabela} for delete using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);`);
    }
    // FORCE RLS também vale para o owner sem BYPASSRLS. O contexto é local à
    // transação da migration; filtros explícitos valem inclusive para o owner bypass.
    // Sem inferência entre versões: cada linha legada tem identidade própria.
    await q.query(`do $$
      declare clinica record; contexto_anterior text := current_setting('app.tenant_id',true);
      begin
        for clinica in select id from tenants loop
          perform set_config('app.tenant_id', clinica.id::text, true);
          insert into plano_alimentar_refeicao_estados(id,tenant_id,plano_id)
            select r.id,r.tenant_id,v.plano_id from plano_alimentar_refeicoes r
            join plano_alimentar_versoes v on v.tenant_id=r.tenant_id and v.id=r.versao_id
            where r.tenant_id=clinica.id;
          insert into plano_alimentar_refeicao_vinculos(tenant_id,plano_id,versao_id,refeicao_id,identidade_id)
            select r.tenant_id,v.plano_id,v.id,r.id,r.id from plano_alimentar_refeicoes r
            join plano_alimentar_versoes v on v.tenant_id=r.tenant_id and v.id=r.versao_id
            where r.tenant_id=clinica.id;
          update planos_alimentares p set ativacao_definida=true
            where p.tenant_id=clinica.id and p.versao_publicada_atual_id is not null;
          with anteriores as (
            select p.id,p.tenant_id,
              rank() over (partition by p.tenant_id,p.paciente_id order by v.publicada_em desc) as posicao,
              count(*) over (partition by p.tenant_id,p.paciente_id,v.publicada_em) as empatados
            from planos_alimentares p join plano_alimentar_versoes v
              on v.tenant_id=p.tenant_id and v.plano_id=p.id and v.id=p.versao_publicada_atual_id
            where p.tenant_id=clinica.id and p.arquivado_em is null
              and v.publicada_em is not null and v.descartada_em is null
          ) update planos_alimentares p set ativo_para_paciente=true
            from anteriores a where a.tenant_id=p.tenant_id and a.id=p.id
              and p.tenant_id=clinica.id and a.posicao=1 and a.empatados=1;
        end loop;
        perform set_config('app.tenant_id',coalesce(contexto_anterior,''),true);
      end; $$;`);
    // O legado só pode criar identidades antes da primeira decisão ON/OFF.
    // Novos writers informam a identidade UUID internamente, nunca do DTO clínico.
    await q.query(`create function vincular_nova_refeicao_operacional() returns trigger language plpgsql as $$
      declare plano uuid; revisao_operacional integer;
        identidade uuid := nullif(current_setting('app.refeicao_identidade_id',true),'')::uuid;
      begin
        select p.id,p.ativacao_revisao into plano,revisao_operacional
          from plano_alimentar_versoes v join planos_alimentares p on p.tenant_id=v.tenant_id and p.id=v.plano_id
          where v.tenant_id=new.tenant_id and v.id=new.versao_id for update of p;
        if plano is null then raise exception 'Plano da refeicao indisponivel.'; end if;
        if identidade is null and revisao_operacional > 0 then
          raise exception 'Writer legado recusado apos decisao operacional.';
        end if;
        identidade := coalesce(identidade,new.id);
        insert into plano_alimentar_refeicao_estados(id,tenant_id,plano_id)
          values(identidade,new.tenant_id,plano) on conflict(id) do nothing;
        insert into plano_alimentar_refeicao_vinculos(tenant_id,plano_id,versao_id,refeicao_id,identidade_id)
          values(new.tenant_id,plano,new.versao_id,new.id,identidade);
        return new;
      end; $$;
      create trigger trg_vincular_nova_refeicao_operacional after insert on plano_alimentar_refeicoes
        for each row execute function vincular_nova_refeicao_operacional();`);

  }
  async down(_q: QueryRunner): Promise<void> {
    throw new Error('Rollback recusado: preserve estados OFF e histórico operacional; use correção aditiva.');
  }
}

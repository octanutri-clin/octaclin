import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class AcompanhamentoGestacional1720000001068 implements MigrationInterface {
  name = 'AcompanhamentoGestacional1720000001068';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      create table gestacoes_pacientes (
        id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
        paciente_id uuid not null, autor_usuario_id uuid not null,
        chave_criacao uuid not null, criacao_criptografada bytea not null,
        status varchar(12) not null default 'ativa' check (status in ('ativa','encerrada')),
        versao integer not null default 1 check (versao > 0),
        compartilhada boolean not null default false,
        geracao_compartilhamento integer not null default 0 check (geracao_compartilhamento >= 0),
        compartilhada_por_usuario_id uuid, compartilhada_em timestamptz,
        criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
        unique (tenant_id,paciente_id,id), unique (tenant_id,autor_usuario_id,chave_criacao),
        foreign key (tenant_id,paciente_id) references pacientes(tenant_id,id),
        foreign key (tenant_id,autor_usuario_id) references usuarios(tenant_id,id),
        check (not compartilhada or (geracao_compartilhamento > 0 and compartilhada_em is not null))
      );
      create index idx_gestacoes_paciente on gestacoes_pacientes(tenant_id,paciente_id,criado_em desc,id desc);
      create table referencias_gestacao (
        id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
        paciente_id uuid not null, gestacao_id uuid not null, numero integer not null check (numero > 0),
        autor_usuario_id uuid not null, contexto_criptografado bytea not null,
        criado_em timestamptz not null default now(),
        unique (tenant_id,paciente_id,gestacao_id,numero),
        foreign key (tenant_id,paciente_id,gestacao_id) references gestacoes_pacientes(tenant_id,paciente_id,id),
        foreign key (tenant_id,autor_usuario_id) references usuarios(tenant_id,id)
      );
      create table consentimentos_gestacao (
        id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
        paciente_id uuid not null, gestacao_id uuid not null, usuario_id uuid not null,
        geracao integer not null check (geracao > 0), termo_versao varchar(40) not null,
        versao integer not null default 1 check (versao > 0),
        aceito_em timestamptz not null, revogado_em timestamptz,
        unique (tenant_id,paciente_id,gestacao_id,usuario_id,geracao),
        foreign key (tenant_id,paciente_id,gestacao_id) references gestacoes_pacientes(tenant_id,paciente_id,id),
        foreign key (tenant_id,usuario_id) references usuarios(tenant_id,id)
      );
      alter table avaliacoes_antropometricas add column gestacao_id uuid,
        add column gestacao_referencia_numero integer, add column chave_criacao uuid,
        add constraint ck_avaliacao_gestacao_referencia check
          ((gestacao_id is null) = (gestacao_referencia_numero is null)),
        add constraint fk_avaliacao_gestacao_referencia foreign key
          (tenant_id,paciente_id,gestacao_id,gestacao_referencia_numero)
          references referencias_gestacao(tenant_id,paciente_id,gestacao_id,numero);
      create unique index uq_avaliacao_chave_criacao on avaliacoes_antropometricas
        (tenant_id,autor_usuario_id,chave_criacao) where chave_criacao is not null;
      create index idx_avaliacao_gestacao on avaliacoes_antropometricas
        (tenant_id,paciente_id,gestacao_id,avaliada_em desc,criado_em desc,id desc)
        where excluida_em is null;
      create function impedir_mutacao_referencia_gestacao() returns trigger language plpgsql as $$
      begin raise exception 'Referencia gestacional imutavel.'; end; $$;
      create trigger trg_referencia_gestacao_imutavel before update or delete on referencias_gestacao
        for each row execute function impedir_mutacao_referencia_gestacao();
      create function impedir_mutacao_avaliacao_gestacional() returns trigger language plpgsql as $$
      begin
        if old.gestacao_id is not null or new.gestacao_id is not null or old.chave_criacao is not null or new.chave_criacao is not null then
          if (to_jsonb(old) - array['excluida_em','atualizado_em','metricas_compartilhadas_portal'])
             is distinct from (to_jsonb(new) - array['excluida_em','atualizado_em','metricas_compartilhadas_portal']) then
            raise exception 'Snapshot gestacional imutavel.';
          end if;
        end if;
        return new;
      end; $$;
      create trigger trg_avaliacao_gestacional_imutavel before update on avaliacoes_antropometricas
        for each row execute function impedir_mutacao_avaliacao_gestacional();
    `);
    for (const tabela of ['gestacoes_pacientes','referencias_gestacao','consentimentos_gestacao']) {
      await q.query(`alter table ${tabela} enable row level security;
        alter table ${tabela} force row level security;
        create policy isolamento_tenant_${tabela} on ${tabela}
          using (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
          with check (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);`);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('set local row_security = off');
    const rows: Array<{ existe: boolean }> = await q.query(`select
      exists(select 1 from gestacoes_pacientes) or exists(select 1 from referencias_gestacao)
      or exists(select 1 from consentimentos_gestacao)
      or exists(select 1 from avaliacoes_antropometricas where gestacao_id is not null or chave_criacao is not null) as existe`);
    if (rows[0]?.existe) throw new Error('Rollback recusado: acompanhamento gestacional persistido.');
    await q.query(`drop trigger trg_avaliacao_gestacional_imutavel on avaliacoes_antropometricas;
      drop function impedir_mutacao_avaliacao_gestacional();
      drop index idx_avaliacao_gestacao; drop index uq_avaliacao_chave_criacao;
      alter table avaliacoes_antropometricas drop constraint fk_avaliacao_gestacao_referencia,
        drop constraint ck_avaliacao_gestacao_referencia, drop column gestacao_id,
        drop column gestacao_referencia_numero, drop column chave_criacao;
      drop table consentimentos_gestacao; drop table referencias_gestacao;
      drop function impedir_mutacao_referencia_gestacao(); drop table gestacoes_pacientes;`);
  }
}

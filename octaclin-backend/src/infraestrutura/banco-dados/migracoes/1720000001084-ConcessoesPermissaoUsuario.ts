import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Auth-1: estrutura vazia de concessões por usuário. Nenhum papel/JWT ganha permissão.
 * Auth-2 implementará serviço, elegibilidade dos papéis, concessão/revogação e auditoria.
 * Motivo é administrativo, curto e sem dado clínico; nenhum consumidor existe nesta etapa.
 * Owner ainda pode remover triggers: não é proteção contra administrador do banco.
 * @aplicacao fora-de-banda
 */
export class ConcessoesPermissaoUsuario1720000001084 implements MigrationInterface {
  name = 'ConcessoesPermissaoUsuario1720000001084';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      create table concessoes_permissao_usuario (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id) on delete restrict,
        usuario_id uuid not null,
        permissao varchar(80) not null check (permissao in ('restricoes.confirmar')),
        concedida_por uuid not null,
        concedida_em timestamptz not null default now(),
        revogada_por uuid,
        revogada_em timestamptz,
        motivo varchar(160) not null check (char_length(motivo) between 1 and 160 and motivo = btrim(motivo) and motivo !~ '[[:cntrl:]]'),
        unique (tenant_id, id),
        constraint ck_concessoes_permissao_revogacao check (
          (revogada_por is null) = (revogada_em is null)
          and (revogada_em is null or revogada_em >= concedida_em)),
        foreign key (tenant_id, usuario_id) references usuarios(tenant_id, id) on delete restrict,
        foreign key (tenant_id, concedida_por) references usuarios(tenant_id, id) on delete restrict,
        foreign key (tenant_id, revogada_por) references usuarios(tenant_id, id) on delete restrict
      );
      create unique index ux_concessoes_permissao_usuario_ativa
        on concessoes_permissao_usuario (tenant_id, usuario_id, permissao) where revogada_em is null;
      create index idx_concessoes_permissao_usuario_historico
        on concessoes_permissao_usuario (tenant_id, usuario_id, concedida_em desc, id desc);
      alter table concessoes_permissao_usuario enable row level security;
      alter table concessoes_permissao_usuario force row level security;
      create policy concessoes_permissao_leitura on concessoes_permissao_usuario for select
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
      create policy concessoes_permissao_criacao on concessoes_permissao_usuario for insert
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
      create policy concessoes_permissao_revogacao on concessoes_permissao_usuario for update
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
    await q.query(`
      create function rejeitar_exclusao_concessao_permissao() returns trigger language plpgsql as $$
      begin
        raise exception 'Concessoes preservam historico: exclusao recusada.' using errcode = '42501';
      end; $$;
      create trigger trg_concessoes_permissao_sem_exclusao
        before delete or truncate on concessoes_permissao_usuario
        for each statement execute function rejeitar_exclusao_concessao_permissao();
      alter table concessoes_permissao_usuario enable always trigger trg_concessoes_permissao_sem_exclusao;
      revoke delete, truncate on concessoes_permissao_usuario from public;

      create function validar_revogacao_concessao_permissao() returns trigger language plpgsql as $$
      begin
        if (new.id, new.tenant_id, new.usuario_id, new.permissao, new.concedida_por, new.concedida_em, new.motivo)
           is distinct from (old.id, old.tenant_id, old.usuario_id, old.permissao, old.concedida_por, old.concedida_em, old.motivo)
           or old.revogada_em is not null or new.revogada_em is null or new.revogada_por is null then
          raise exception 'Concessao imutavel: apenas revogacao unica e permitida.' using errcode = '23514';
        end if;
        return new;
      end; $$;
      create trigger trg_concessoes_permissao_revogacao
        before update on concessoes_permissao_usuario
        for each row execute function validar_revogacao_concessao_permissao();
      alter table concessoes_permissao_usuario enable always trigger trg_concessoes_permissao_revogacao;
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    if (!q.isTransactionActive) throw new Error('Rollback recusado: execute em transacao.');
    const iso: Array<{ transaction_isolation: string }> = await q.query('show transaction_isolation');
    if (iso[0]?.transaction_isolation !== 'read committed') throw new Error('Rollback recusado: exige READ COMMITTED.');
    await q.query('set local row_security = off');
    const rs: Array<{ rs: string }> = await q.query("select current_setting('row_security') as rs");
    if (rs[0]?.rs !== 'off') throw new Error('Rollback recusado: estado de RLS nao verificavel.');
    await q.query('lock table concessoes_permissao_usuario in access exclusive mode');
    const rows: Array<{ existe: boolean }> = await q.query('select exists(select 1 from concessoes_permissao_usuario) as existe');
    if (rows[0]?.existe !== false) throw new Error('Rollback recusado: preservar concessoes e historico.');
    await q.query(`drop table concessoes_permissao_usuario;
      drop function validar_revogacao_concessao_permissao();
      drop function rejeitar_exclusao_concessao_permissao();`);
  }
}

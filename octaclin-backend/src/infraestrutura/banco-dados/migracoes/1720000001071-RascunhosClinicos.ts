import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adicao fora de banda; nunca habilita IA, credenciais ou modelos. */
export class RascunhosClinicos1720000001071 implements MigrationInterface {
  name='RascunhosClinicos1720000001071';
  async up(q:QueryRunner):Promise<void> {
    for(const [table,condicao] of [
      ['pacientes','new.profissional_responsavel_id is distinct from old.profissional_responsavel_id or new.data_nascimento is distinct from old.data_nascimento or new.arquivado_em is distinct from old.arquivado_em or new.status_ciclo_vida is distinct from old.status_ciclo_vida or new.usuario_id is distinct from old.usuario_id'],
      ['profissionais','new.arquivado_em is distinct from old.arquivado_em or new.usuario_id is distinct from old.usuario_id'],
      ['usuarios','new.ativo is distinct from old.ativo or new.role is distinct from old.role'],
    ]) {
      await q.query(`alter table ${table} add column versao_contexto_ia318 bigint not null default 0;
        create function contexto_ia318_${table}() returns trigger language plpgsql as $$ begin
          new.versao_contexto_ia318=old.versao_contexto_ia318+case when ${condicao} then 1 else 0 end;return new;
        end $$;
        create trigger contexto_ia318_${table} before update on ${table} for each row execute function contexto_ia318_${table}();`);
    }
    await q.query(`
      create table credenciais_ia318(
        tenant_id uuid not null references tenants(id),profissional_id uuid not null,usuario_id uuid not null,
        chave_criptografada bytea,versao integer not null default 0 check(versao>=0),atualizado_em timestamptz not null default now(),
        primary key(tenant_id,profissional_id),foreign key(tenant_id,profissional_id) references profissionais(tenant_id,id),
        foreign key(tenant_id,usuario_id) references usuarios(tenant_id,id));
      create table comandos_ia318(
        tenant_id uuid not null references tenants(id),usuario_id uuid not null,chave uuid not null,paciente_id uuid not null,
        acao varchar(30) not null check(acao in ('gerar','confirmar')),estado varchar(30) not null check(estado in ('iniciado','retornado','incerto','confirmado')),
        fingerprint_criptografado bytea not null,resultado_id uuid,criado_em timestamptz not null default now(),
        primary key(tenant_id,usuario_id,chave),foreign key(tenant_id,usuario_id) references usuarios(tenant_id,id),
        foreign key(tenant_id,paciente_id) references pacientes(tenant_id,id));
      create unique index uq_evolucao318 on evolucoes_clinicas(tenant_id,paciente_id,id);
      alter table comandos_ia318 add constraint fk_comando318_resultado foreign key(tenant_id,paciente_id,resultado_id) references evolucoes_clinicas(tenant_id,paciente_id,id);
      create table proveniencias_ia318(
        tenant_id uuid not null references tenants(id),paciente_id uuid not null,evolucao_id uuid not null,
        snapshot_criptografado bytea not null,criado_em timestamptz not null default now(),
        primary key(tenant_id,evolucao_id),foreign key(tenant_id,paciente_id,evolucao_id) references evolucoes_clinicas(tenant_id,paciente_id,id));
      create index ix_comandos318_quota on comandos_ia318(tenant_id,usuario_id,criado_em) where acao='gerar';
      create function proteger_proveniencia318() returns trigger language plpgsql as $$ begin
        raise exception 'Proveniencia clínica não pode ser reescrita ou removida.';end $$;
      create trigger proteger_proveniencia318 before update or delete on proveniencias_ia318 for each row execute function proteger_proveniencia318();
    `);
    for(const table of ['credenciais_ia318','comandos_ia318','proveniencias_ia318']) await q.query(`alter table ${table} enable row level security;alter table ${table} force row level security;
      create policy tenant_isolation on ${table} using(tenant_id=current_setting('app.tenant_id',true)::uuid) with check(tenant_id=current_setting('app.tenant_id',true)::uuid);`);
  }
  async down(q:QueryRunner):Promise<void> {
    const [row]=await q.query('select (select count(*) from credenciais_ia318)+(select count(*) from comandos_ia318)+(select count(*) from proveniencias_ia318) as total');
    if(Number(row?.total)!==0)throw new Error('Não reverter schema318 com credenciais, comandos ou histórico. Desligue o gate.');
    await q.query('drop table proveniencias_ia318;drop table comandos_ia318;drop table credenciais_ia318;drop function proteger_proveniencia318();drop index uq_evolucao318;');
    for(const table of ['pacientes','profissionais','usuarios'])await q.query(`drop trigger contexto_ia318_${table} on ${table};drop function contexto_ia318_${table}();alter table ${table} drop column versao_contexto_ia318;`);
  }
}

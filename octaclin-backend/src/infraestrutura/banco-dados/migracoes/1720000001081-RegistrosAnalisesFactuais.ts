import type { MigrationInterface,QueryRunner } from 'typeorm';
/** @aplicacao fora-de-banda; desenvolver/ensaiar apenas em descartável nesta etapa. */
export class RegistrosAnalisesFactuais1720000001081 implements MigrationInterface {
 name='RegistrosAnalisesFactuais1720000001081';
 async up(q:QueryRunner):Promise<void>{
  await q.query(`create table registros_analises_factuais (
   id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id) on delete restrict,
   paciente_id uuid not null, profissional_id uuid not null, usuario_id uuid not null,
   chave_idempotencia uuid not null, criado_em timestamptz not null default now(),
   conteudo_criptografado bytea not null check(octet_length(conteudo_criptografado) between 32 and 10485760),
   unique(tenant_id,id),
   constraint ux_registros_analises_idempotencia unique(tenant_id,usuario_id,chave_idempotencia),
   foreign key (tenant_id, paciente_id) references pacientes(tenant_id,id) on delete restrict,
   foreign key (tenant_id, profissional_id) references profissionais(tenant_id,id) on delete restrict,
   foreign key (tenant_id, usuario_id) references usuarios(tenant_id,id) on delete restrict
  );
  create index idx_registros_analises_paciente on registros_analises_factuais(tenant_id,paciente_id,criado_em desc,id desc);
  alter table registros_analises_factuais enable row level security;
  alter table registros_analises_factuais force row level security;
  create policy registros_analises_leitura on registros_analises_factuais for select
   using (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
  create policy registros_analises_criacao on registros_analises_factuais for insert
   with check (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);`);
 }
 async down(_q:QueryRunner):Promise<void>{throw new Error('Rollback recusado: preservar registros clínicos e schema aditivo.');}
}

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { ControleAgendamentosQuestionario1720000001088 } from './1720000001088-ControleAgendamentosQuestionario';

// Somente PostgreSQL 15 descartável, credenciais sintéticas; nenhuma URL externa.
const suite = process.env.RLS_TESTCONTAINERS === 'true' ? describe : describe.skip;
suite('1088 controle de agendamentos em PostgreSQL/RLS descartável', () => {
  let container: StartedTestContainer, owner: Client, runtime: Client;
  let conn: { host: string; port: number; database: string };
  const tenantA = randomUUID(), tenantB = randomUUID(), atorA = randomUUID(), atorB = randomUUID();
  const legado = randomUUID();
  async function aplicar(sentido: 'up' | 'down') {
    const ds = new DataSource({ type: 'postgres', ...conn, username: 'owner', password: 'owner-synthetic', entities: [], synchronize: false, logging: false });
    await ds.initialize(); const q = ds.createQueryRunner();
    try {
      await q.startTransaction();
      try { await new ControleAgendamentosQuestionario1720000001088()[sentido](q); await q.commitTransaction(); }
      catch (e) { await q.rollbackTransaction(); throw e; }
    } finally { await q.release(); await ds.destroy(); }
  }
  beforeAll(async () => {
    container = await new GenericContainer('postgres:15-alpine')
      .withTmpFs({ '/var/lib/postgresql/data': 'rw,noexec,nosuid,size=128m' })
      .withEnvironment({ POSTGRES_USER: 'owner', POSTGRES_PASSWORD: 'owner-synthetic', POSTGRES_DB: 'agendamentos_test' })
      .withExposedPorts(5432).withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i, 2)).start();
    conn = { host: container.getHost(), port: container.getMappedPort(5432), database: 'agendamentos_test' };
    owner = new Client({ ...conn, user: 'owner', password: 'owner-synthetic' }); await owner.connect();
    await owner.query(`create role app_runtime login password 'runtime-synthetic' nosuperuser nobypassrls;
      create table usuarios(id uuid primary key, tenant_id uuid not null, unique(tenant_id,id));
      create table agendamentos_questionario(id uuid primary key, tenant_id uuid not null, ativo boolean not null default true);
      alter table agendamentos_questionario enable row level security;
      alter table agendamentos_questionario force row level security;
      create policy agendamentos_tenant on agendamentos_questionario
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
      grant select, insert, update, delete on agendamentos_questionario to app_runtime;`);
    await owner.query('insert into usuarios(id,tenant_id) values($1,$2),($3,$4)', [atorA, tenantA, atorB, tenantB]);
    await owner.query('insert into agendamentos_questionario(id,tenant_id) values($1,$2)', [legado,tenantA]);
    await aplicar('up');
    runtime = new Client({ ...conn, user: 'app_runtime', password: 'runtime-synthetic' }); await runtime.connect();
    await runtime.query("select set_config('app.tenant_id',$1,false)", [tenantA]);
  }, 90000);
  afterAll(async () => { await runtime?.end(); await owner?.end(); await container?.stop(); }, 30000);
  it('preserva legado sem ator e com revisão inicial, sem inventar pausa', async () => {
    expect((await runtime.query('select revisao, pausado_em, autorizado_por_usuario_id from agendamentos_questionario where id=$1',[legado])).rows)
      .toEqual([{ revisao: 1, pausado_em: null, autorizado_por_usuario_id: null }]);
  });
  it('FK composta rejeita ator de outro tenant', async () => {
    await expect(runtime.query('update agendamentos_questionario set autorizado_por_usuario_id=$1 where id=$2',[atorB,legado])).rejects.toMatchObject({code:'23503'});
  });
  it('runtime não ignora FORCE RLS e não escreve em outro tenant', async () => {
    const outro = randomUUID();
    await owner.query('insert into agendamentos_questionario(id,tenant_id) values($1,$2)',[outro,tenantB]);
    expect((await runtime.query('select * from agendamentos_questionario where id=$1',[outro])).rows).toHaveLength(0);
    expect((await runtime.query('update agendamentos_questionario set revisao=2 where id=$1',[outro])).rowCount).toBe(0);
    await expect(runtime.query('insert into agendamentos_questionario(id,tenant_id) values($1,$2)',[randomUUID(),tenantB])).rejects.toMatchObject({code:'42501'});
  });
  it('recusa revisão inválida e pausa contraditória', async () => {
    await expect(runtime.query('update agendamentos_questionario set revisao=0 where id=$1',[legado])).rejects.toMatchObject({code:'23514'});
    await expect(runtime.query('update agendamentos_questionario set pausado_em=now() where id=$1',[legado])).rejects.toMatchObject({code:'23514'});
  });
  it('CAS permite somente uma alteração da revisão esperada', async () => {
    expect((await runtime.query('update agendamentos_questionario set revisao=revisao+1, ativo=false, pausado_em=now() where id=$1 and revisao=1',[legado])).rowCount).toBe(1);
    expect((await runtime.query('update agendamentos_questionario set revisao=revisao+1 where id=$1 and revisao=1',[legado])).rowCount).toBe(0);
  });
  it('rollback falha fechado depois de uso, preservando controles', async () => {
    await expect(aplicar('down')).rejects.toThrow('preservar controles');
    expect((await runtime.query('select revisao from agendamentos_questionario where id=$1',[legado])).rows[0].revisao).toBe(2);
  });
  it('remoção do ator limpa só a referência, preserva tenant, agendamento e pausa', async () => {
    await runtime.query('update agendamentos_questionario set autorizado_por_usuario_id=$1 where id=$2',[atorA,legado]);
    await owner.query('delete from usuarios where id=$1',[atorA]);
    expect((await runtime.query('select tenant_id,ativo,revisao,autorizado_por_usuario_id from agendamentos_questionario where id=$1',[legado])).rows)
      .toEqual([{tenant_id:tenantA,ativo:false,revisao:2,autorizado_por_usuario_id:null}]);
  });
  it('down antes do uso remove somente controles aditivos; up continua compatível', async () => {
    // Restaura somente fixture sintética do teste para exercitar rollback pré-uso.
    await owner.query('update agendamentos_questionario set revisao=1, ativo=true, pausado_em=null, autorizado_por_usuario_id=null');
    await aplicar('down');
    expect((await owner.query('select count(*)::int n from agendamentos_questionario')).rows[0].n).toBe(2);
    await aplicar('up');
    expect((await runtime.query('select revisao from agendamentos_questionario where id=$1',[legado])).rows[0].revisao).toBe(1);
  });
});

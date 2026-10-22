import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { FavoritosAlimentosProfissional1720000001077 } from './1720000001077-FavoritosAlimentosProfissional';

const rodarPostgres = process.env.FOOD03_RLS_TESTCONTAINERS === 'true';
const descreverPostgres = rodarPostgres ? describe : describe.skip;

descreverPostgres('FOOD03 migration e RLS real em PostgreSQL descartável', () => {
  let container: StartedTestContainer;
  let admin: Client;
  let migrator: DataSource;

  beforeAll(async () => {
    container = await new GenericContainer('postgres:15-alpine')
      .withEnvironment({ POSTGRES_USER: 'owner', POSTGRES_PASSWORD: 'owner-test', POSTGRES_DB: 'food03_test' })
      .withExposedPorts(5432)
      // O postgres image inicia um servidor temporário na inicialização e
      // encerra-o antes do servidor definitivo: aguardar a segunda mensagem.
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i, 2))
      .withStartupTimeout(60_000)
      .start();
    const conexao = { host: container.getHost(), port: container.getMappedPort(5432), database: 'food03_test' };
    admin = new Client({ ...conexao, user: 'owner', password: 'owner-test' });
    await admin.connect();
    await admin.query(`
      create table tenants (id uuid primary key);
      create table profissionais (tenant_id uuid not null references tenants(id), id uuid not null, primary key(tenant_id,id));
      create table alimentos_composicao (id uuid primary key);
      create table alimentos_personalizados (tenant_id uuid not null references tenants(id), id uuid not null, primary key(tenant_id,id));
    `);
    migrator = new DataSource({ type: 'postgres', ...conexao, username: 'owner', password: 'owner-test', synchronize: false, logging: false, entities: [] });
    await migrator.initialize();
    const runner = migrator.createQueryRunner();
    await runner.connect();
    try { await new FavoritosAlimentosProfissional1720000001077().up(runner); }
    finally { await runner.release(); }
    await admin.query(`create role food03_runtime login password 'runtime-test' nosuperuser nocreatedb nocreaterole nobypassrls;
      grant connect on database food03_test to food03_runtime; grant usage on schema public to food03_runtime;
      grant select,insert,update,delete on favoritos_alimentos_profissional to food03_runtime;`);
  }, 90_000);

  afterAll(async () => {
    if (migrator?.isInitialized) await migrator.destroy().catch(() => undefined);
    await admin?.end().catch(() => undefined);
    await container?.stop().catch(() => undefined);
  }, 30_000);

  it('aplica FORCE RLS, isola tenant, nega tenant adulterado e converge inserts concorrentes', async () => {
    const tenantA = randomUUID(), tenantB = randomUUID(), profissionalA = randomUUID(), profissionalB = randomUUID();
    const alimento = randomUUID(), custom = randomUUID();
    await admin.query('insert into tenants(id) values ($1),($2)', [tenantA, tenantB]);
    await admin.query('insert into profissionais(tenant_id,id) values ($1,$2),($3,$4)', [tenantA, profissionalA, tenantB, profissionalB]);
    await admin.query('insert into alimentos_composicao(id) values ($1)', [alimento]);
    await admin.query('insert into alimentos_personalizados(tenant_id,id) values ($1,$2)', [tenantA, custom]);
    const rls = await admin.query(`select relrowsecurity,relforcerowsecurity from pg_class where relname='favoritos_alimentos_profissional'`);
    expect(rls.rows).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }]);

    const conexaoA = await new Client({ host: container.getHost(), port: container.getMappedPort(5432), database: 'food03_test', user: 'food03_runtime', password: 'runtime-test' });
    const conexaoB = await new Client({ host: container.getHost(), port: container.getMappedPort(5432), database: 'food03_test', user: 'food03_runtime', password: 'runtime-test' });
    await Promise.all([conexaoA.connect(), conexaoB.connect()]);
    try {
      await Promise.all([
        conexaoA.query("select set_config('app.tenant_id',$1,false)", [tenantA]),
        conexaoB.query("select set_config('app.tenant_id',$1,false)", [tenantA])
      ]);
      await Promise.all([conexaoA, conexaoB].map((conexao) => conexao.query(`insert into favoritos_alimentos_profissional
        (tenant_id,profissional_id,alimento_composicao_id) values ($1,$2,$3) on conflict do nothing`, [tenantA, profissionalA, alimento])));
      const listaA = await conexaoA.query('select tenant_id,profissional_id,alimento_composicao_id from favoritos_alimentos_profissional');
      expect(listaA.rowCount).toBe(1);
      await expect(conexaoA.query(`insert into favoritos_alimentos_profissional (tenant_id,profissional_id,alimento_personalizado_id)
        values ($1,$2,$3)`, [tenantB, profissionalA, custom])).rejects.toMatchObject({ code: '42501' });
      await conexaoB.query("select set_config('app.tenant_id',$1,false)", [tenantB]);
      const invisivel = await conexaoB.query('select id from favoritos_alimentos_profissional');
      expect(invisivel.rowCount).toBe(0);
    } finally {
      await conexaoA.end(); await conexaoB.end();
    }
  }, 60_000);
});

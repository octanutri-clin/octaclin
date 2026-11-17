import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { ContaUnicaPaciente1720000001086 } from './1720000001086-ContaUnicaPaciente';

// PostgreSQL 15 descartável criado por este teste; não usa URL nem credencial externa.
const suite = process.env.RLS_TESTCONTAINERS === 'true' ? describe : describe.skip;
suite('FOOD06 1086: conta única por ficha de paciente em PostgreSQL descartável', () => {
  let container: StartedTestContainer, owner: Client;
  let conn: { host: string; port: number; database: string };
  const tenantA = randomUUID(), tenantB = randomUUID();

  async function aplicar(sentido: 'up' | 'down') {
    const m = new DataSource({ type: 'postgres', ...conn, username: 'owner', password: 'owner-synthetic', entities: [], synchronize: false, logging: false });
    await m.initialize(); const q = m.createQueryRunner();
    try {
      await q.startTransaction();
      try { await new ContaUnicaPaciente1720000001086()[sentido](q); await q.commitTransaction(); }
      catch (e) { await q.rollbackTransaction(); throw e; }
    } finally { await q.release(); await m.destroy(); }
  }
  const ficha = (tenant: string, usuario: string | null) => owner.query('insert into pacientes(id, tenant_id, usuario_id) values($1,$2,$3)', [randomUUID(), tenant, usuario]);

  beforeAll(async () => {
    container = await new GenericContainer('postgres:15-alpine')
      .withTmpFs({ '/var/lib/postgresql/data': 'rw,noexec,nosuid,size=128m' })
      .withEnvironment({ POSTGRES_USER: 'owner', POSTGRES_PASSWORD: 'owner-synthetic', POSTGRES_DB: 'conta_unica_test' })
      .withExposedPorts(5432).withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i, 2)).start();
    conn = { host: container.getHost(), port: container.getMappedPort(5432), database: 'conta_unica_test' };
    owner = new Client({ ...conn, user: 'owner', password: 'owner-synthetic' }); await owner.connect();
    await owner.query(`create table pacientes(id uuid primary key, tenant_id uuid not null, usuario_id uuid);
      alter table pacientes enable row level security; alter table pacientes force row level security;
      create policy pacientes_tenant on pacientes using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);`);
  }, 90000);
  afterAll(async () => { await owner?.end(); await container?.stop(); }, 30000);

  it('recusa aplicar com duplicata (vista apesar da RLS) sem criar o índice nem expor ids', async () => {
    const conta = randomUUID();
    await ficha(tenantA, conta); await ficha(tenantA, conta);
    const erro = await aplicar('up').then(() => undefined, (e: unknown) => e);
    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toContain('Migration recusada');
    expect((erro as Error).message).not.toContain(conta);
    expect((await owner.query("select count(*)::int n from pg_indexes where indexname='ux_pacientes_conta_unica'")).rows[0].n).toBe(0);
    await owner.query('update pacientes set usuario_id = null where usuario_id = $1', [conta]);
  });

  it('sem duplicata cria o índice: mesma conta em tenants diferentes e fichas sem conta continuam permitidas', async () => {
    const conta = randomUUID();
    await ficha(tenantA, conta); await ficha(tenantB, conta); await ficha(tenantA, null); await ficha(tenantA, null);
    await aplicar('up');
    await expect(ficha(tenantA, conta)).rejects.toMatchObject({ code: '23505' });
    await expect(ficha(tenantA, null)).resolves.toBeDefined();
    await expect(ficha(tenantB, randomUUID())).resolves.toBeDefined();
  });

  it('down remove só o índice; depois a duplicata volta a ser aceita pelo banco', async () => {
    const conta = randomUUID(); await ficha(tenantA, conta);
    const antes = (await owner.query('select count(*)::int n from pacientes')).rows[0].n;
    await aplicar('down');
    expect((await owner.query('select count(*)::int n from pacientes')).rows[0].n).toBe(antes);
    expect((await owner.query("select count(*)::int n from pg_indexes where indexname='ux_pacientes_conta_unica'")).rows[0].n).toBe(0);
    await expect(ficha(tenantA, conta)).resolves.toBeDefined();
  });
});

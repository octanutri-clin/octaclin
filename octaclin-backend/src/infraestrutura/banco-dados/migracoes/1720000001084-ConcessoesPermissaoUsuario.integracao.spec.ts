import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { DataSource, type EntityManager } from 'typeorm';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { ExecutorTenant } from '../executor-tenant';
import { ConcessoesPermissaoUsuario1720000001084 } from './1720000001084-ConcessoesPermissaoUsuario';
import { ConcessaoPermissaoUsuarioOrm } from '../../../modulos/auth/infraestrutura/concessao-permissao-usuario.orm';

// Sempre PostgreSQL15 descartável criado por este teste; não usa URL/credencial externa nem shim local.
const suite = process.env.RLS_TESTCONTAINERS === 'true' ? describe : describe.skip;
suite('Auth-1 1084: constraints, histórico, ORM, RLS FORCE e rollback em PostgreSQL descartável', () => {
  let container: StartedTestContainer, owner: Client, ds: DataSource, executor: ExecutorTenant;
  let conn: { host: string; port: number; database: string };
  const tenantA = randomUUID(), tenantB = randomUUID(), atorA = randomUUID(), atorB = randomUUID();
  const como = <T>(tenant: string, fn: (m: EntityManager) => Promise<T>) => executor.executar(tenant, fn);

  async function aplicar(alvo: typeof conn, sentido: 'up' | 'down') {
    const m = new DataSource({ type: 'postgres', ...alvo, username: 'owner', password: 'owner-synthetic', entities: [], synchronize: false, logging: false });
    await m.initialize(); const q = m.createQueryRunner();
    try {
      await q.startTransaction();
      try { await new ConcessoesPermissaoUsuario1720000001084()[sentido](q); await q.commitTransaction(); }
      catch (e) { await q.rollbackTransaction(); throw e; }
    } finally { await q.release(); await m.destroy(); }
  }
  async function fixture(c: Client) {
    await c.query('create table tenants(id uuid primary key); create table usuarios(id uuid primary key, tenant_id uuid not null references tenants(id), unique(tenant_id,id))');
  }
  async function usuario(tenant = tenantA) {
    const id = randomUUID(); await owner.query('insert into usuarios values($1,$2)', [id, tenant]); return id;
  }
  function inserir(m: EntityManager, usuarioId: string, extra: Record<string, unknown> = {}) {
    const repo = m.getRepository(ConcessaoPermissaoUsuarioOrm);
    return repo.save(repo.create({ tenantId: tenantA, usuarioId, permissao: 'restricoes.confirmar', concedidaPor: atorA,
      motivo: 'Habilitação administrativa sintética', ...extra }));
  }

  beforeAll(async () => {
    container = await new GenericContainer('postgres:15-alpine')
      .withTmpFs({ '/var/lib/postgresql/data': 'rw,noexec,nosuid,size=128m' })
      .withEnvironment({ POSTGRES_USER: 'owner', POSTGRES_PASSWORD: 'owner-synthetic', POSTGRES_DB: 'auth1_concessoes_test' })
      .withExposedPorts(5432).withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i, 2)).start();
    conn = { host: container.getHost(), port: container.getMappedPort(5432), database: 'auth1_concessoes_test' };
    owner = new Client({ ...conn, user: 'owner', password: 'owner-synthetic' }); await owner.connect();
    await fixture(owner);
    await owner.query('insert into tenants values($1),($2)', [tenantA, tenantB]);
    await owner.query('insert into usuarios values($1,$2),($3,$4)', [atorA, tenantA, atorB, tenantB]);
    await aplicar(conn, 'up');
    await owner.query(`create role auth1_runtime login password 'runtime-synthetic' nosuperuser nocreatedb nocreaterole nobypassrls;
      grant connect on database auth1_concessoes_test to auth1_runtime; grant usage on schema public to auth1_runtime;
      grant select,insert,update,delete,truncate on all tables in schema public to auth1_runtime;`);
    ds = new DataSource({ type: 'postgres', ...conn, username: 'auth1_runtime', password: 'runtime-synthetic',
      entities: [ConcessaoPermissaoUsuarioOrm], synchronize: false, logging: false, extra: { max: 6 } });
    await ds.initialize(); executor = new ExecutorTenant(ds);
  }, 90000);
  afterAll(async () => { if (ds?.isInitialized) await ds.destroy(); await owner?.end(); await container?.stop(); }, 30000);

  it('começa vazia e usa role runtime sem ownership/superuser/BYPASSRLS, com ENABLE e FORCE', async () => {
    expect((await owner.query('select count(*)::int n from concessoes_permissao_usuario')).rows[0].n).toBe(0);
    expect((await ds.query('select rolsuper, rolbypassrls from pg_roles where rolname=current_user'))[0])
      .toEqual({ rolsuper: false, rolbypassrls: false });
    expect((await owner.query("select relrowsecurity, relforcerowsecurity, pg_get_userbyid(relowner) dono from pg_class where relname='concessoes_permissao_usuario'")).rows[0])
      .toEqual({ relrowsecurity: true, relforcerowsecurity: true, dono: 'owner' });
  });

  it('ORM grava/lê todos os campos; tenants não veem nem inserem concessões de outros tenants', async () => {
    const a = await como(tenantA, m => inserir(m, atorA));
    const b = await como(tenantB, m => inserir(m, atorB, { tenantId: tenantB, concedidaPor: atorB }));
    const salvo = await como(tenantA, m => m.getRepository(ConcessaoPermissaoUsuarioOrm).findOneByOrFail({ id: a.id }));
    expect(salvo).toMatchObject({ tenantId: tenantA, usuarioId: atorA, concedidaPor: atorA, permissao: 'restricoes.confirmar', revogadaPor: null, revogadaEm: null });
    expect(salvo.concedidaEm).toBeInstanceOf(Date);
    expect(await ds.query('select id from concessoes_permissao_usuario')).toEqual([]);
    expect(await como(tenantB, m => m.query('select id from concessoes_permissao_usuario where id=$1', [a.id]))).toEqual([]);
    expect(await como(tenantA, m => m.query('select id from concessoes_permissao_usuario where id=$1', [b.id]))).toEqual([]);
    const alvo = await usuario();
    await expect(como(tenantB, m => inserir(m, alvo))).rejects.toMatchObject({ code: '42501' });
    await expect(ds.query("insert into concessoes_permissao_usuario(tenant_id,usuario_id,permissao,concedida_por,motivo) values($1,$2,'restricoes.confirmar',$2,'Sintético')", [tenantA, alvo]))
      .rejects.toMatchObject({ code: '42501' });
  });

  it('FKs compostas recusam usuário, concedente e revogador de outro tenant', async () => {
    await expect(como(tenantA, m => inserir(m, atorB))).rejects.toMatchObject({ code: '23503' });
    const alvo = await usuario();
    await expect(como(tenantA, m => inserir(m, alvo, { concedidaPor: atorB }))).rejects.toMatchObject({ code: '23503' });
    const c = await como(tenantA, m => inserir(m, alvo));
    await expect(como(tenantA, m => m.query('update concessoes_permissao_usuario set revogada_por=$1,revogada_em=now() where id=$2', [atorB, c.id])))
      .rejects.toMatchObject({ code: '23503' });
  });

  it.each(['operacoes.tenants.gerenciar', '', 'restricoes.confirmar.extra'])('lista fechada recusa permissão %p', async permissao => {
    const alvo = await usuario(); await expect(como(tenantA, m => inserir(m, alvo, { permissao }))).rejects.toMatchObject({ code: '23514' });
  });

  it.each(['', '   ', 'com\ncontrole', 'x'.repeat(161)])('motivo curto não vazio e sem controles: %p', async motivo => {
    const alvo = await usuario(); await expect(como(tenantA, m => inserir(m, alvo, { motivo }))).rejects.toMatchObject({ code: expect.stringMatching(/23514|22001/) });
  });

  it('revogação exige autor/data juntos e não pode anteceder a concessão', async () => {
    for (const extra of [{ revogadaPor: atorA }, { revogadaEm: new Date() }, { revogadaPor: atorA, revogadaEm: new Date('2000-01-01') }]) {
      const alvo = await usuario(); await expect(como(tenantA, m => inserir(m, alvo, extra))).rejects.toMatchObject({ code: '23514' });
    }
  });

  it('quatro inserções concorrentes da mesma concessão ativa resultam em apenas uma linha', async () => {
    const alvo = await usuario();
    const resultados = await Promise.allSettled(Array.from({ length: 4 }, () => como(tenantA, m => inserir(m, alvo))));
    expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    for (const r of resultados) if (r.status === 'rejected') expect(r.reason).toMatchObject({ code: '23505' });
    expect((await owner.query('select count(*)::int n from concessoes_permissao_usuario where usuario_id=$1', [alvo])).rows[0].n).toBe(1);
  });

  it('revogar permite uma nova concessão independente e preserva a antiga sem reativação', async () => {
    const alvo = await usuario(), c = await como(tenantA, m => inserir(m, alvo));
    await como(tenantA, m => m.query('update concessoes_permissao_usuario set revogada_por=$1, revogada_em=now() where id=$2', [atorA, c.id]));
    const antiga = (await owner.query('select * from concessoes_permissao_usuario where id=$1', [c.id])).rows[0];
    const nova = await como(tenantA, m => inserir(m, alvo)); expect(nova.id).not.toBe(c.id);
    await expect(como(tenantA, m => m.query('update concessoes_permissao_usuario set revogada_por=null, revogada_em=null where id=$1', [c.id])))
      .rejects.toMatchObject({ code: '23514' });
    await expect(como(tenantA, m => m.query('update concessoes_permissao_usuario set revogada_em=now() where id=$1', [c.id])))
      .rejects.toMatchObject({ code: '23514' });
    expect((await owner.query('select * from concessoes_permissao_usuario where id=$1', [c.id])).rows[0]).toEqual(antiga);
    expect((await owner.query('select count(*)::int n from concessoes_permissao_usuario where usuario_id=$1', [alvo])).rows[0].n).toBe(2);
  });

  it('identidade, motivo e dados originais são imutáveis mesmo numa atualização de revogação', async () => {
    const alvo = await usuario(), outro = await usuario(), c = await como(tenantA, m => inserir(m, alvo));
    for (const [coluna, valor] of [['usuario_id', outro], ['concedida_por', outro], ['motivo', 'Motivo reescrito'], ['tenant_id', tenantB], ['id', randomUUID()], ['concedida_em', '2000-01-01']] as const) {
      await expect(como(tenantA, m => m.query(`update concessoes_permissao_usuario set ${coluna}=$1, revogada_por=$2, revogada_em=now() where id=$3`, [valor, atorA, c.id])))
        .rejects.toMatchObject({ code: expect.stringMatching(/23514|42501/) });
    }
    expect((await owner.query('select revogada_em from concessoes_permissao_usuario where id=$1', [c.id])).rows[0].revogada_em).toBeNull();
  });

  it('histórico nunca é apagado: DELETE/TRUNCATE recusados inclusive para owner e sem linhas visíveis', async () => {
    const antes = (await owner.query('select count(*)::int n from concessoes_permissao_usuario')).rows[0].n;
    for (const sql of ['delete from concessoes_permissao_usuario', 'truncate concessoes_permissao_usuario']) {
      await expect(ds.query(sql)).rejects.toMatchObject({ code: '42501' });
      await expect(owner.query(sql)).rejects.toMatchObject({ code: '42501' });
    }
    await owner.query('begin');
    try {
      await owner.query("set local session_replication_role='replica'");
      await expect(owner.query('delete from concessoes_permissao_usuario')).rejects.toMatchObject({ code: '42501' });
    } finally { await owner.query('rollback'); }
    expect((await owner.query('select count(*)::int n from concessoes_permissao_usuario')).rows[0].n).toBe(antes);
  });

  it('down recusa tabela com histórico e rollback mantém os registros legíveis', async () => {
    const alvo = await usuario(); await como(tenantA, m => inserir(m, alvo));
    const antes = (await owner.query('select count(*)::int n from concessoes_permissao_usuario')).rows[0].n;
    expect(antes).toBeGreaterThan(0);
    await expect(aplicar(conn, 'down')).rejects.toThrow('Rollback recusado');
    expect((await owner.query('select count(*)::int n from concessoes_permissao_usuario')).rows[0].n).toBe(antes);
  });

  it('down remove somente estrutura vazia num banco dedicado deste contêiner', async () => {
    await owner.query('create database auth1_down_empty_test');
    const alvo = { ...conn, database: 'auth1_down_empty_test' }, c = new Client({ ...alvo, user: 'owner', password: 'owner-synthetic' });
    await c.connect();
    try {
      await fixture(c); await aplicar(alvo, 'up'); await aplicar(alvo, 'down');
      expect((await c.query("select to_regclass('concessoes_permissao_usuario') tabela")).rows[0].tabela).toBeNull();
      expect((await c.query("select to_regclass('usuarios') tabela")).rows[0].tabela).toBe('usuarios');
      expect((await c.query("select proname from pg_proc where proname in ('validar_revogacao_concessao_permissao','rejeitar_exclusao_concessao_permissao')")).rows).toEqual([]);
    } finally { await c.end(); }
  });
});

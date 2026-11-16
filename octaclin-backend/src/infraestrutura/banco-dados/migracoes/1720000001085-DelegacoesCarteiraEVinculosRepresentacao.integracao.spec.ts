import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { DataSource, type EntityManager } from 'typeorm';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { ExecutorTenant } from '../executor-tenant';
import { DelegacoesCarteiraEVinculosRepresentacao1720000001085 } from './1720000001085-DelegacoesCarteiraEVinculosRepresentacao';
import { DelegacaoCarteiraProfissionalOrm } from '../../../modulos/profissionais/infraestrutura/delegacao-carteira-profissional.orm';
import { VinculoRepresentacaoPacienteOrm } from '../../../modulos/pacientes/infraestrutura/vinculo-representacao-paciente.orm';

// Sempre PostgreSQL 15 descartável criado por este teste; não usa URL nem credencial externa.
const suite = process.env.RLS_TESTCONTAINERS === 'true' ? describe : describe.skip;
suite('FOOD06 P2d-1 1085: delegação de carteira e vínculo de representação em PostgreSQL descartável', () => {
  let container: StartedTestContainer, owner: Client, ds: DataSource, executor: ExecutorTenant;
  let conn: { host: string; port: number; database: string };
  const tenantA = randomUUID(), tenantB = randomUUID();
  const titularA = randomUUID(), titularB = randomUUID(), pacienteA = randomUUID(), pacienteB = randomUUID();
  const como = <T>(tenant: string, fn: (m: EntityManager) => Promise<T>) => executor.executar(tenant, fn);

  async function aplicar(alvo: typeof conn, sentido: 'up' | 'down') {
    const m = new DataSource({ type: 'postgres', ...alvo, username: 'owner', password: 'owner-synthetic', entities: [], synchronize: false, logging: false });
    await m.initialize(); const q = m.createQueryRunner();
    try {
      await q.startTransaction();
      try { await new DelegacoesCarteiraEVinculosRepresentacao1720000001085()[sentido](q); await q.commitTransaction(); }
      catch (e) { await q.rollbackTransaction(); throw e; }
    } finally { await q.release(); await m.destroy(); }
  }
  async function fixture(c: Client) {
    await c.query(`create table tenants(id uuid primary key);
      create table usuarios(id uuid primary key, tenant_id uuid not null references tenants(id), unique(tenant_id,id));
      create table profissionais(id uuid primary key, tenant_id uuid not null references tenants(id), unique(tenant_id,id));
      create table pacientes(id uuid primary key, tenant_id uuid not null references tenants(id), unique(tenant_id,id));`);
  }
  async function usuario(tenant = tenantA) {
    const id = randomUUID(); await owner.query('insert into usuarios values($1,$2)', [id, tenant]); return id;
  }
  async function paciente(tenant = tenantA) {
    const id = randomUUID(); await owner.query('insert into pacientes values($1,$2)', [id, tenant]); return id;
  }
  let autorA: string, autorB: string;
  function delegar(m: EntityManager, colaborador: string, extra: Partial<DelegacaoCarteiraProfissionalOrm> = {}) {
    const repo = m.getRepository(DelegacaoCarteiraProfissionalOrm);
    return repo.save(repo.create({ tenantId: tenantA, profissionalId: titularA, colaboradorUsuarioId: colaborador, concedidaPor: autorA, ...extra }));
  }
  function vincular(m: EntityManager, representante: string, extra: Partial<VinculoRepresentacaoPacienteOrm> = {}) {
    const repo = m.getRepository(VinculoRepresentacaoPacienteOrm);
    return repo.save(repo.create({ tenantId: tenantA, pacienteId: pacienteA, representanteUsuarioId: representante, verificadoPor: autorA,
      tipoVerificacao: 'presencial', ...extra }));
  }

  beforeAll(async () => {
    container = await new GenericContainer('postgres:15-alpine')
      .withTmpFs({ '/var/lib/postgresql/data': 'rw,noexec,nosuid,size=128m' })
      .withEnvironment({ POSTGRES_USER: 'owner', POSTGRES_PASSWORD: 'owner-synthetic', POSTGRES_DB: 'p2d1_test' })
      .withExposedPorts(5432).withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i, 2)).start();
    conn = { host: container.getHost(), port: container.getMappedPort(5432), database: 'p2d1_test' };
    owner = new Client({ ...conn, user: 'owner', password: 'owner-synthetic' }); await owner.connect();
    await fixture(owner);
    await owner.query('insert into tenants values($1),($2)', [tenantA, tenantB]);
    await owner.query('insert into profissionais values($1,$2),($3,$4)', [titularA, tenantA, titularB, tenantB]);
    await owner.query('insert into pacientes values($1,$2),($3,$4)', [pacienteA, tenantA, pacienteB, tenantB]);
    autorA = await usuario(tenantA); autorB = await usuario(tenantB);
    await aplicar(conn, 'up');
    await owner.query(`create role p2d1_runtime login password 'runtime-synthetic' nosuperuser nocreatedb nocreaterole nobypassrls;
      grant connect on database p2d1_test to p2d1_runtime; grant usage on schema public to p2d1_runtime;
      grant select,insert,update,delete,truncate on all tables in schema public to p2d1_runtime;`);
    ds = new DataSource({ type: 'postgres', ...conn, username: 'p2d1_runtime', password: 'runtime-synthetic',
      entities: [DelegacaoCarteiraProfissionalOrm, VinculoRepresentacaoPacienteOrm], synchronize: false, logging: false, extra: { max: 6 } });
    await ds.initialize(); executor = new ExecutorTenant(ds);
  }, 90000);
  afterAll(async () => { if (ds?.isInitialized) await ds.destroy(); await owner?.end(); await container?.stop(); }, 30000);

  it('começa vazia, com role runtime sem superuser nem BYPASSRLS e RLS ENABLE+FORCE nas duas tabelas', async () => {
    for (const t of ['delegacoes_carteira_profissional', 'vinculos_representacao_paciente']) {
      expect((await owner.query(`select count(*)::int n from ${t}`)).rows[0].n).toBe(0);
      expect((await owner.query('select relrowsecurity, relforcerowsecurity from pg_class where relname=$1', [t])).rows[0])
        .toEqual({ relrowsecurity: true, relforcerowsecurity: true });
    }
    expect((await ds.query('select rolsuper, rolbypassrls from pg_roles where rolname=current_user'))[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it('ORM grava e lê; um tenant não vê nem insere linhas de outro (RLS)', async () => {
    const colab = await usuario(), rep = await usuario();
    const d = await como(tenantA, m => delegar(m, colab));
    const v = await como(tenantA, m => vincular(m, rep));
    expect(await como(tenantA, m => m.getRepository(DelegacaoCarteiraProfissionalOrm).findOneByOrFail({ id: d.id })))
      .toMatchObject({ tenantId: tenantA, profissionalId: titularA, colaboradorUsuarioId: colab, revogadaEm: null });
    expect(await como(tenantA, m => m.getRepository(VinculoRepresentacaoPacienteOrm).findOneByOrFail({ id: v.id })))
      .toMatchObject({ pacienteId: pacienteA, representanteUsuarioId: rep, tipoVerificacao: 'presencial', revogadoEm: null });
    expect(await como(tenantB, m => m.query('select id from delegacoes_carteira_profissional where id=$1', [d.id]))).toEqual([]);
    expect(await como(tenantB, m => m.query('select id from vinculos_representacao_paciente where id=$1', [v.id]))).toEqual([]);
    expect(await ds.query('select id from vinculos_representacao_paciente')).toEqual([]);
    await expect(como(tenantB, m => delegar(m, colab))).rejects.toMatchObject({ code: '42501' });
    await expect(como(tenantB, m => vincular(m, rep))).rejects.toMatchObject({ code: '42501' });
  });

  it('FKs compostas recusam titular, colaborador, paciente, representante e autores de outro tenant', async () => {
    const colabB = await usuario(tenantB), colab = await usuario(), rep = await usuario();
    await expect(como(tenantA, m => delegar(m, colab, { profissionalId: titularB }))).rejects.toMatchObject({ code: '23503' });
    await expect(como(tenantA, m => delegar(m, colabB))).rejects.toMatchObject({ code: '23503' });
    await expect(como(tenantA, m => delegar(m, colab, { concedidaPor: autorB }))).rejects.toMatchObject({ code: '23503' });
    await expect(como(tenantA, m => vincular(m, rep, { pacienteId: pacienteB }))).rejects.toMatchObject({ code: '23503' });
    await expect(como(tenantA, m => vincular(m, colabB))).rejects.toMatchObject({ code: '23503' });
    await expect(como(tenantA, m => vincular(m, rep, { verificadoPor: autorB }))).rejects.toMatchObject({ code: '23503' });
    // Revogação por autor de outro tenant (revisão R4 da P2d-1).
    const d = await como(tenantA, m => delegar(m, colab)), v = await como(tenantA, m => vincular(m, rep));
    await expect(como(tenantA, m => m.query('update delegacoes_carteira_profissional set revogada_por=$1, revogada_em=now() where id=$2', [autorB, d.id])))
      .rejects.toMatchObject({ code: '23503' });
    await expect(como(tenantA, m => m.query('update vinculos_representacao_paciente set revogado_por=$1, revogado_em=now() where id=$2', [autorB, v.id])))
      .rejects.toMatchObject({ code: '23503' });
  });

  it('delegação recusa colaborador que concede a si mesmo (revisão R4 da P2d-1)', async () => {
    const colab = await usuario();
    await expect(como(tenantA, m => delegar(m, colab, { concedidaPor: colab }))).rejects.toMatchObject({ code: '23514' });
  });

  it.each(['delegacoes_carteira_profissional', 'vinculos_representacao_paciente'] as const)(
    '%s: o banco fixa as datas (concessão e revogação) e recusa linha que já nasce revogada', async tabela => {
      const alvo = await usuario();
      const [colEm, colPor, colRevEm] = tabela === 'delegacoes_carteira_profissional' ? ['concedida_em', 'revogada_por', 'revogada_em'] : ['verificado_em', 'revogado_por', 'revogado_em'];
      const inserir = (extra: string, valores: unknown[]) => como(tenantA, m => m.query(tabela === 'delegacoes_carteira_profissional'
        ? `insert into delegacoes_carteira_profissional (tenant_id, profissional_id, colaborador_usuario_id, concedida_por${extra}) values ($1,$2,$3,$4${valores.map((_, i) => `,$${5 + i}`).join('')}) returning *`
        : `insert into vinculos_representacao_paciente (tenant_id, paciente_id, representante_usuario_id, verificado_por, tipo_verificacao${extra}) values ($1,$2,$3,$4,'presencial'${valores.map((_, i) => `,$${5 + i}`).join('')}) returning *`,
      [tenantA, tabela === 'delegacoes_carteira_profissional' ? titularA : pacienteA, alvo, autorA, ...valores]));
      await expect(inserir(`, ${colPor}, ${colRevEm}`, [autorA, '2999-01-01'])).rejects.toMatchObject({ code: '23514' });
      const [linha] = await inserir(`, ${colEm}`, ['2000-01-01']) as Array<Record<string, Date>>;
      expect(Math.abs(linha[colEm].getTime() - Date.now())).toBeLessThan(60_000);
      await como(tenantA, m => m.query(`update ${tabela} set ${colPor}=$1, ${colRevEm}='2000-01-02' where id=$2`, [autorA, linha.id]));
      const revogada = (await owner.query(`select ${colRevEm} as em from ${tabela} where id=$1`, [linha.id])).rows[0].em as Date;
      expect(Math.abs(revogada.getTime() - Date.now())).toBeLessThan(60_000);
    });

  it('vínculo recusa auto-outorga e tipo de verificação fora da lista; uma conta pode representar vários pacientes', async () => {
    const rep = await usuario();
    await expect(como(tenantA, m => vincular(m, rep, { verificadoPor: rep }))).rejects.toMatchObject({ code: '23514' });
    for (const tipo of ['documento', '', 'PRESENCIAL']) {
      await expect(como(tenantA, m => vincular(m, rep, { tipoVerificacao: tipo as never }))).rejects.toMatchObject({ code: '23514' });
    }
    const outroPaciente = await paciente();
    await como(tenantA, m => vincular(m, rep));
    await como(tenantA, m => vincular(m, rep, { pacienteId: outroPaciente, tipoVerificacao: 'procuracao' }));
    expect((await owner.query('select count(*)::int n from vinculos_representacao_paciente where representante_usuario_id=$1 and revogado_em is null', [rep])).rows[0].n).toBe(2);
  });

  it.each(['delegacao', 'vinculo'] as const)('%s: inserções concorrentes do mesmo par ativo resultam em uma linha', async tipo => {
    const alvo = await usuario();
    const r = await Promise.allSettled(Array.from({ length: 4 }, () => como<unknown>(tenantA, m => tipo === 'delegacao' ? delegar(m, alvo) : vincular(m, alvo))));
    expect(r.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    for (const x of r) if (x.status === 'rejected') expect(x.reason).toMatchObject({ code: '23505' });
  });

  it.each([
    ['delegacoes_carteira_profissional', 'revogada_por', 'revogada_em', ['profissional_id', 'colaborador_usuario_id', 'concedida_por', 'concedida_em', 'tenant_id', 'id']],
    ['vinculos_representacao_paciente', 'revogado_por', 'revogado_em', ['paciente_id', 'representante_usuario_id', 'verificado_por', 'verificado_em', 'tipo_verificacao', 'tenant_id', 'id']]
  ] as const)('%s: só a revogação única altera a linha, identidade é imutável e o par pode ser reconcedido', async (tabela, por, em, imutaveis) => {
    const alvo = await usuario(), outro = await usuario();
    const linha = tabela === 'delegacoes_carteira_profissional' ? await como(tenantA, m => delegar(m, alvo)) : await como(tenantA, m => vincular(m, alvo));
    for (const coluna of imutaveis) {
      const valor = coluna.endsWith('_em') ? '2000-01-01' : coluna === 'tipo_verificacao' ? 'outro' : coluna === 'tenant_id' ? tenantB : coluna === 'id' ? randomUUID() : outro;
      await expect(como(tenantA, m => m.query(`update ${tabela} set ${coluna}=$1, ${por}=$2, ${em}=now() where id=$3`, [valor, autorA, linha.id])))
        .rejects.toMatchObject({ code: expect.stringMatching(/23514|23503|42501/) });
    }
    await expect(como(tenantA, m => m.query(`update ${tabela} set ${em}=now() where id=$1`, [linha.id]))).rejects.toMatchObject({ code: '23514' });
    await como(tenantA, m => m.query(`update ${tabela} set ${por}=$1, ${em}=now() where id=$2`, [autorA, linha.id]));
    await expect(como(tenantA, m => m.query(`update ${tabela} set ${por}=null, ${em}=null where id=$1`, [linha.id]))).rejects.toMatchObject({ code: '23514' });
    const nova = tabela === 'delegacoes_carteira_profissional' ? await como(tenantA, m => delegar(m, alvo)) : await como(tenantA, m => vincular(m, alvo));
    expect(nova.id).not.toBe(linha.id);
  });

  it('histórico nunca é apagado: DELETE e TRUNCATE recusados para runtime e owner, inclusive em modo replica', async () => {
    for (const t of ['delegacoes_carteira_profissional', 'vinculos_representacao_paciente']) {
      const antes = (await owner.query(`select count(*)::int n from ${t}`)).rows[0].n;
      for (const sql of [`delete from ${t}`, `truncate ${t}`]) {
        await expect(ds.query(sql)).rejects.toMatchObject({ code: '42501' });
        await expect(owner.query(sql)).rejects.toMatchObject({ code: '42501' });
      }
      await owner.query('begin');
      try {
        await owner.query("set local session_replication_role='replica'");
        await expect(owner.query(`delete from ${t}`)).rejects.toMatchObject({ code: '42501' });
      } finally { await owner.query('rollback'); }
      expect((await owner.query(`select count(*)::int n from ${t}`)).rows[0].n).toBe(antes);
    }
  });

  it('down recusa quando só a tabela de delegações tem linhas (banco dedicado)', async () => {
    await owner.query('create database p2d1_down_delegacao_test');
    const alvo = { ...conn, database: 'p2d1_down_delegacao_test' }, c = new Client({ ...alvo, user: 'owner', password: 'owner-synthetic' });
    await c.connect();
    try {
      await fixture(c); await aplicar(alvo, 'up');
      const t = randomUUID(), p = randomUUID(), u1 = randomUUID(), u2 = randomUUID();
      await c.query('insert into tenants values($1)', [t]); await c.query('insert into profissionais values($1,$2)', [p, t]);
      await c.query('insert into usuarios values($1,$3),($2,$3)', [u1, u2, t]);
      await c.query('insert into delegacoes_carteira_profissional (tenant_id, profissional_id, colaborador_usuario_id, concedida_por) values ($1,$2,$3,$4)', [t, p, u1, u2]);
      await expect(aplicar(alvo, 'down')).rejects.toThrow('Rollback recusado');
      expect((await c.query("select to_regclass('delegacoes_carteira_profissional') t")).rows[0].t).toBe('delegacoes_carteira_profissional');
    } finally { await c.end(); }
  });

  it('down recusa enquanto houver linhas e mantém os registros', async () => {
    const antes = (await owner.query('select count(*)::int n from vinculos_representacao_paciente')).rows[0].n;
    expect(antes).toBeGreaterThan(0);
    await expect(aplicar(conn, 'down')).rejects.toThrow('Rollback recusado');
    expect((await owner.query('select count(*)::int n from vinculos_representacao_paciente')).rows[0].n).toBe(antes);
  });

  it('down remove somente a estrutura vazia num banco dedicado deste contêiner', async () => {
    await owner.query('create database p2d1_down_empty_test');
    const alvo = { ...conn, database: 'p2d1_down_empty_test' }, c = new Client({ ...alvo, user: 'owner', password: 'owner-synthetic' });
    await c.connect();
    try {
      await fixture(c); await aplicar(alvo, 'up'); await aplicar(alvo, 'down');
      for (const t of ['delegacoes_carteira_profissional', 'vinculos_representacao_paciente']) {
        expect((await c.query('select to_regclass($1) tabela', [t])).rows[0].tabela).toBeNull();
      }
      expect((await c.query("select proname from pg_proc where proname in ('validar_revogacao_delegacao_carteira','validar_revogacao_vinculo_representacao','rejeitar_exclusao_delegacao_vinculo','validar_criacao_delegacao_carteira','validar_criacao_vinculo_representacao')")).rows).toEqual([]);
      expect((await c.query("select to_regclass('pacientes') tabela")).rows[0].tabela).toBe('pacientes');
    } finally { await c.end(); }
  });
});

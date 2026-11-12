import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { DataSource, type EntityManager } from 'typeorm';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { RestricoesAlimentares1720000001083, TABELAS_RESTRICOES_ALIMENTARES } from './1720000001083-RestricoesAlimentares';
import { ExecutorTenant } from '../executor-tenant';
import { CriptografiaDadosSensiveis } from '../../seguranca/criptografia-dados-sensiveis';
import { RestricaoPacienteOrm } from '../../../modulos/planos-alimentares/infraestrutura/restricao-paciente.orm';
import { RevisaoRestricaoPacienteOrm } from '../../../modulos/planos-alimentares/infraestrutura/revisao-restricao-paciente.orm';
import { AvaliacaoRestricoesPacienteOrm } from '../../../modulos/planos-alimentares/infraestrutura/avaliacao-restricoes-paciente.orm';
import { RevisaoAvaliacaoRestricoesOrm } from '../../../modulos/planos-alimentares/infraestrutura/revisao-avaliacao-restricoes.orm';
import { ReconfirmacaoRestricoesOrm } from '../../../modulos/planos-alimentares/infraestrutura/reconfirmacao-restricoes.orm';
import { SolicitacaoRestricaoPacienteOrm } from '../../../modulos/planos-alimentares/infraestrutura/solicitacao-restricao-paciente.orm';
import { MapeamentoAlimentoAlvoLocalOrm } from '../../../modulos/planos-alimentares/infraestrutura/mapeamento-alimento-alvo-local.orm';

/**
 * FOOD06 P1b: prova da 1083 em PostgreSQL 15 DESCARTÁVEL (Testcontainers, tmpfs), nunca em ambiente real.
 * Owner = superusuário do contêiner (aplica a migration); runtime = role sem superuser, sem BYPASSRLS e sem
 * ownership. Dados 100% sintéticos (canários), nada é semeado pela migration.
 */
const suite = process.env.FOOD06_RESTRICOES_TESTCONTAINERS === 'true' ? describe : describe.skip;
const ENTIDADES = [RestricaoPacienteOrm, RevisaoRestricaoPacienteOrm, AvaliacaoRestricoesPacienteOrm, RevisaoAvaliacaoRestricoesOrm,
  ReconfirmacaoRestricoesOrm, SolicitacaoRestricaoPacienteOrm, MapeamentoAlimentoAlvoLocalOrm];
const CANARIO = 'CANARIO_RESTRICAO_SINTETICA';

async function fixture(c: Client) {
  await c.query(`create table tenants(id uuid primary key);
    create table usuarios(id uuid primary key, tenant_id uuid not null references tenants(id), unique(tenant_id,id));
    create table pacientes(id uuid primary key, tenant_id uuid not null references tenants(id), unique(tenant_id,id));`);
}
async function aplicar(conn: Record<string, unknown>, sentido: 'up' | 'down') {
  const m = new DataSource({ type: 'postgres', ...conn, username: 'owner', password: 'owner-test', entities: [], synchronize: false, logging: false } as never);
  await m.initialize(); const q = m.createQueryRunner();
  try {
    await q.startTransaction();
    try { await new RestricoesAlimentares1720000001083()[sentido](q); await q.commitTransaction(); }
    catch (e) { await q.rollbackTransaction(); throw e; }
  } finally { await q.release(); await m.destroy(); }
}

suite('FOOD06 P1b 1083 restrições: PostgreSQL 15 descartável, RLS FORCE, role runtime não-owner', () => {
  let container: StartedTestContainer, owner: Client, ds: DataSource, executor: ExecutorTenant, conn: Record<string, unknown>;
  const tA = randomUUID(), tB = randomUUID(), uA = randomUUID(), uB = randomUUID(), pacA = randomUUID(), pacA2 = randomUUID(), pacB = randomUUID();
  const crypto = new CriptografiaDadosSensiveis();
  const cifra = (v: unknown) => crypto.criptografar(JSON.stringify(v));

  beforeAll(async () => {
    container = await new GenericContainer('postgres:15-alpine').withTmpFs({ '/var/lib/postgresql/data': 'rw,noexec,nosuid,size=256m' })
      .withEnvironment({ POSTGRES_USER: 'owner', POSTGRES_PASSWORD: 'owner-test', POSTGRES_DB: 'food06_restricoes_test' }).withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i, 2)).withStartupTimeout(60000).start();
    conn = { host: container.getHost(), port: container.getMappedPort(5432), database: 'food06_restricoes_test' };
    owner = new Client({ ...conn, user: 'owner', password: 'owner-test' } as never); await owner.connect();
    await fixture(owner);
    await owner.query('insert into tenants values($1),($2)', [tA, tB]);
    await owner.query('insert into usuarios values($1,$2),($3,$4)', [uA, tA, uB, tB]);
    await owner.query('insert into pacientes values($1,$2),($3,$2),($4,$5)', [pacA, tA, pacA2, pacB, tB]);
    await aplicar(conn, 'up');
    await owner.query(`create role food06_runtime login password 'runtime-test' nosuperuser nocreatedb nocreaterole nobypassrls;
      grant connect on database food06_restricoes_test to food06_runtime; grant usage on schema public to food06_runtime;
      grant select,insert,update,delete,truncate on all tables in schema public to food06_runtime;`);
    ds = new DataSource({ type: 'postgres', ...conn, username: 'food06_runtime', password: 'runtime-test', entities: ENTIDADES, synchronize: false, logging: false } as never);
    await ds.initialize(); executor = new ExecutorTenant(ds);
  }, 120000);
  afterAll(async () => { if (ds?.isInitialized) await ds.destroy(); await owner?.end(); await container?.stop(); }, 30000);

  const comoA = <T>(f: (m: EntityManager) => Promise<T>) => executor.executar(tA, f);
  async function novaRestricao(m: EntityManager, extra: Partial<RestricaoPacienteOrm> = {}) {
    return m.getRepository(RestricaoPacienteOrm).save(m.getRepository(RestricaoPacienteOrm).create({
      tenantId: tA, pacienteId: pacA, autorUsuarioId: uA, chaveCriacao: randomUUID(), origem: 'profissional', estado: 'ativa', confirmacao: 'pendente',
      conteudoCriptografado: cifra({ natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alergeno', id: 'sintetico-1' }, observacao: CANARIO }),
      revisao: 1, ...extra
    }));
  }
  async function novaAvaliacao(m: EntityManager, pacienteId = pacA) {
    const a = await m.getRepository(AvaliacaoRestricoesPacienteOrm).save(m.getRepository(AvaliacaoRestricoesPacienteOrm).create({
      tenantId: tA, pacienteId, situacao: 'restricoes_registradas', confirmadoPorUsuarioId: uA, confirmadoEm: new Date('2026-11-12T10:00:00Z'),
      venceEm: new Date('2027-05-11T10:00:00Z'), revisao: 1
    }));
    await m.getRepository(RevisaoAvaliacaoRestricoesOrm).insert({ tenantId: tA, pacienteId, avaliacaoId: a.id, numero: 1, situacao: a.situacao,
      autorUsuarioId: uA, venceEm: a.venceEm });
    return a;
  }

  it('migration aplicada não semeia nada: as sete tabelas nascem vazias, com RLS ENABLE + FORCE e dono diferente da runtime', async () => {
    const role = (await ds.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user'))[0];
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
    for (const t of TABELAS_RESTRICOES_ALIMENTARES) {
      const meta = (await owner.query('select relrowsecurity,relforcerowsecurity,pg_get_userbyid(relowner) dono from pg_class where relname=$1', [t])).rows[0];
      expect(meta).toEqual({ relrowsecurity: true, relforcerowsecurity: true, dono: 'owner' });
      // owner é superusuário no contêiner: enxerga tudo e confirma que não há backfill.
      expect((await owner.query(`select count(*)::int n from ${t}`)).rows[0].n).toBe(0);
    }
  });

  it('runtime com tenant grava a cadeia completa pelos ORMs; conteúdo sensível fica cifrado no banco', async () => {
    const ids = await comoA(async m => {
      const r = await novaRestricao(m);
      await m.getRepository(RevisaoRestricaoPacienteOrm).insert({ tenantId: tA, pacienteId: pacA, restricaoId: r.id, numero: 1, evento: 'criacao',
        autorUsuarioId: uA, conteudoCriptografado: cifra({ snapshot: CANARIO }) });
      const a = await novaAvaliacao(m);
      await m.getRepository(ReconfirmacaoRestricoesOrm).insert({ tenantId: tA, pacienteId: pacA, avaliacaoId: a.id, revisaoAvaliacao: 1,
        restricaoId: r.id, revisaoRestricao: 1, atestadoPorUsuarioId: uA, atestadoEm: new Date('2026-11-12T10:00:00Z'), meio: 'teleconsulta',
        resultadoCriptografado: cifra({ resultado: CANARIO }), venceEm: new Date('2027-05-11T10:00:00Z'), chaveIdempotencia: randomUUID() });
      const s = await m.getRepository(SolicitacaoRestricaoPacienteOrm).save(m.getRepository(SolicitacaoRestricaoPacienteOrm).create({
        tenantId: tA, pacienteId: pacA, restricaoId: r.id, tipo: 'correcao', estado: 'criada', autorUsuarioId: uA, chaveCriacao: randomUUID(),
        conteudoCriptografado: cifra({ pedido: CANARIO }), revisao: 1 }));
      await m.getRepository(MapeamentoAlimentoAlvoLocalOrm).insert({ tenantId: tA, fonteId: 'fonte-sintetica', codigoOrigem: 'item-1', alvoId: 'sintetico-1',
        relacao: 'contem', granularidade: 'alimento', origem: 'local_profissional', cobertura: 'suficiente', versaoMapeamento: 'v1', autorUsuarioId: uA });
      return { r: r.id, s: s.id };
    });
    const linha = (await owner.query('select * from restricoes_pacientes where id=$1', [ids.r])).rows[0];
    expect(Buffer.isBuffer(linha.conteudo_criptografado)).toBe(true);
    for (const t of TABELAS_RESTRICOES_ALIMENTARES) {
      const bruto = JSON.stringify((await owner.query(`select * from ${t}`)).rows);
      expect(bruto).not.toContain(CANARIO);
      expect(bruto).not.toMatch(/alergia_alimentar|alergeno/);
    }
    const lida = await comoA(m => m.getRepository(RestricaoPacienteOrm).findOneByOrFail({ id: ids.r }));
    expect(JSON.parse(crypto.descriptografar(lida.conteudoCriptografado)).observacao).toBe(CANARIO);
    expect(lida).toMatchObject({ tenantId: tA, pacienteId: pacA, revisao: 1, confirmacao: 'pendente', estado: 'ativa' });
  });

  it('RLS: sem tenant não lê nem grava; outro tenant não enxerga as linhas de A', async () => {
    await comoA(m => novaRestricao(m));
    for (const t of TABELAS_RESTRICOES_ALIMENTARES) {
      expect(await ds.query(`select id from ${t}`)).toEqual([]);
      expect(await executor.executar(tB, m => m.query(`select id from ${t}`))).toEqual([]);
      expect((await comoA(m => m.query(`select count(*)::int n from ${t}`)))[0].n).toBeGreaterThan(0);
    }
    await expect(ds.query(`insert into restricoes_pacientes(tenant_id,paciente_id,autor_usuario_id,chave_criacao,origem,conteudo_criptografado)
      values($1,$2,$3,$4,'profissional',$5)`, [tA, pacA, uA, randomUUID(), cifra({})])).rejects.toMatchObject({ code: '42501' });
  });

  it('negativo cross-tenant: tenant B não grava linha com tenant_id de A, nem A referencia paciente/usuário de B', async () => {
    await expect(executor.executar(tB, m => novaRestricao(m))).rejects.toMatchObject({ code: '42501' });
    await expect(comoA(m => novaRestricao(m, { pacienteId: pacB }))).rejects.toMatchObject({ code: '23503' });
    await expect(comoA(m => novaRestricao(m, { autorUsuarioId: uB }))).rejects.toMatchObject({ code: '23503' });
    // solicitação não aponta restrição de outro paciente do mesmo tenant (FK composta tenant+paciente+restrição)
    const r = await comoA(m => novaRestricao(m));
    await expect(comoA(m => m.getRepository(SolicitacaoRestricaoPacienteOrm).insert({ tenantId: tA, pacienteId: pacA2, restricaoId: r.id,
      tipo: 'correcao', estado: 'criada', autorUsuarioId: uA, chaveCriacao: randomUUID(), conteudoCriptografado: cifra({}), revisao: 1 })))
      .rejects.toMatchObject({ code: '23503' });
    // UPDATE de A tentando mover a linha para B é barrado pelo with check
    await expect(comoA(m => m.query('update restricoes_pacientes set tenant_id=$1, revisao=revisao+1 where id=$2', [tB, r.id]))).rejects.toMatchObject({ code: expect.stringMatching(/42501|23514|23503/) });
  });

  it('histórico append-only: UPDATE/DELETE/TRUNCATE recusados para runtime e owner; estado nunca é apagado', async () => {
    const r = await comoA(async m => {
      const x = await novaRestricao(m);
      await m.getRepository(RevisaoRestricaoPacienteOrm).insert({ tenantId: tA, pacienteId: pacA, restricaoId: x.id, numero: 1, evento: 'criacao',
        autorUsuarioId: uA, conteudoCriptografado: cifra({}) });
      return x;
    });
    for (const t of ['restricoes_pacientes_revisoes', 'avaliacoes_restricoes_revisoes', 'reconfirmacoes_restricoes', 'mapeamentos_alimento_alvo_locais']) {
      await expect(comoA(m => m.query(`update ${t} set criado_em=now()`))).rejects.toMatchObject({ code: '42501' });
      await expect(owner.query(`update ${t} set criado_em=now()`)).rejects.toMatchObject({ code: '42501' });
    }
    for (const t of TABELAS_RESTRICOES_ALIMENTARES) {
      await expect(comoA(m => m.query(`delete from ${t}`))).rejects.toMatchObject({ code: '42501' });
      await expect(owner.query(`delete from ${t}`)).rejects.toMatchObject({ code: '42501' });
      await expect(comoA(m => m.query(`truncate ${t} cascade`))).rejects.toMatchObject({ code: '42501' });
      await expect(owner.query(`truncate ${t} cascade`)).rejects.toMatchObject({ code: '42501' });
    }
    expect((await owner.query('select count(*)::int n from restricoes_pacientes_revisoes where restricao_id=$1', [r.id])).rows[0].n).toBe(1);
  });

  it('ENABLE ALWAYS: nem o owner em modo replica (session_replication_role) contorna o bloqueio', async () => {
    await owner.query('begin');
    try {
      await owner.query("set local session_replication_role = 'replica'");
      for (const t of TABELAS_RESTRICOES_ALIMENTARES) {
        await owner.query('savepoint s');
        await expect(owner.query(`delete from ${t}`)).rejects.toMatchObject({ code: '42501' });
        await owner.query('rollback to savepoint s');
      }
      for (const t of ['restricoes_pacientes_revisoes', 'avaliacoes_restricoes_revisoes', 'reconfirmacoes_restricoes', 'mapeamentos_alimento_alvo_locais']) {
        await owner.query('savepoint s');
        await expect(owner.query(`update ${t} set criado_em=now()`)).rejects.toMatchObject({ code: '42501' });
        await owner.query('rollback to savepoint s');
      }
      await owner.query('savepoint s');
      await expect(owner.query("update restricoes_pacientes set origem='colaborador', revisao=revisao+1")).rejects.toMatchObject({ code: '23514' });
      await owner.query('rollback to savepoint s');
    } finally { await owner.query('rollback'); }
  });

  it('estado: UPDATE só com revisão +1, identidade imutável e inativa é terminal', async () => {
    const r = await comoA(m => novaRestricao(m));
    await comoA(m => m.query("update restricoes_pacientes set estado='em_reavaliacao', revisao=2 where id=$1", [r.id]));
    await expect(comoA(m => m.query("update restricoes_pacientes set estado='ativa', revisao=2 where id=$1", [r.id]))).rejects.toMatchObject({ code: '23514' });
    await expect(comoA(m => m.query('update restricoes_pacientes set paciente_id=$1, revisao=3 where id=$2', [pacA2, r.id]))).rejects.toMatchObject({ code: '23514' });
    await expect(comoA(m => m.query("update restricoes_pacientes set origem='colaborador', revisao=3 where id=$1", [r.id]))).rejects.toMatchObject({ code: '23514' });
    await comoA(m => m.query("update restricoes_pacientes set estado='inativa', revisao=3 where id=$1", [r.id]));
    await expect(comoA(m => m.query("update restricoes_pacientes set estado='ativa', revisao=4 where id=$1", [r.id]))).rejects.toMatchObject({ code: '23514' });
    // confirmada exige quem e quando; decisão não volta a pendente
    const c = await comoA(m => novaRestricao(m));
    await expect(comoA(m => m.query("update restricoes_pacientes set confirmacao='confirmada', revisao=2 where id=$1", [c.id]))).rejects.toMatchObject({ code: '23514' });
    await comoA(m => m.query("update restricoes_pacientes set confirmacao='confirmada', confirmado_por_usuario_id=$1, confirmado_em=now(), revisao=2 where id=$2", [uA, c.id]));
    await expect(comoA(m => m.query("update restricoes_pacientes set confirmacao='pendente', confirmado_por_usuario_id=null, confirmado_em=null, revisao=3 where id=$1", [c.id])))
      .rejects.toMatchObject({ code: '23514' });
  });

  it('Q3: revisão de inativação sem motivo, sem justificativa cifrada ou sem dois passos é recusada', async () => {
    const r = await comoA(m => novaRestricao(m));
    const base = { tenantId: tA, pacienteId: pacA, restricaoId: r.id, evento: 'inativacao' as const, autorUsuarioId: uA, conteudoCriptografado: cifra({}) };
    const repo = (m: EntityManager) => m.getRepository(RevisaoRestricaoPacienteOrm);
    await expect(comoA(m => repo(m).insert({ ...base, numero: 2, justificativaCriptografada: cifra({}), confirmacaoDoisPassos: true }))).rejects.toMatchObject({ code: '23514' });
    await expect(comoA(m => repo(m).insert({ ...base, numero: 2, motivoInativacao: 'outro', confirmacaoDoisPassos: true }))).rejects.toMatchObject({ code: '23514' });
    await expect(comoA(m => repo(m).insert({ ...base, numero: 2, motivoInativacao: 'outro', justificativaCriptografada: cifra({}), confirmacaoDoisPassos: false }))).rejects.toMatchObject({ code: '23514' });
    await expect(comoA(m => repo(m).insert({ ...base, evento: 'edicao', numero: 2, motivoInativacao: 'outro' }))).rejects.toMatchObject({ code: '23514' });
    await comoA(m => repo(m).insert({ ...base, numero: 2, motivoInativacao: 'registro_incorreto', justificativaCriptografada: cifra({ j: CANARIO }), confirmacaoDoisPassos: true }));
  });

  it('origem do mapeamento: tenant não forja "global" e liberação local exige evidência', async () => {
    const base = { tenantId: tA, fonteId: 'fonte-sintetica', codigoOrigem: 'item-2', alvoId: 'sintetico-1', granularidade: 'alimento' as const,
      cobertura: 'suficiente' as const, autorUsuarioId: uA };
    const repo = (m: EntityManager) => m.getRepository(MapeamentoAlimentoAlvoLocalOrm);
    await expect(comoA(m => repo(m).insert({ ...base, relacao: 'contem', origem: 'global' as never, versaoMapeamento: 'g1' }))).rejects.toMatchObject({ code: '23514' });
    await expect(comoA(m => repo(m).insert({ ...base, relacao: 'nao_contem_confirmado', origem: 'local_profissional', versaoMapeamento: 'l1' }))).rejects.toMatchObject({ code: '23514' });
    await expect(comoA(m => repo(m).insert({ ...base, relacao: 'contem', origem: 'local_profissional', versaoMapeamento: 'id com espaço' }))).rejects.toMatchObject({ code: '23514' });
    await comoA(m => repo(m).insert({ ...base, relacao: 'nao_contem_confirmado', origem: 'local_profissional', versaoMapeamento: 'l1', evidenciaCriptografada: cifra({ e: CANARIO }) }));
  });

  it('Q10: reconfirmação sem revisão real da avaliação, com meio inválido ou vencimento não posterior é recusada', async () => {
    const a = await comoA(m => novaAvaliacao(m, pacA2));
    const base = { tenantId: tA, pacienteId: pacA2, avaliacaoId: a.id, atestadoPorUsuarioId: uA, atestadoEm: new Date('2026-11-12T10:00:00Z'),
      resultadoCriptografado: cifra({}), venceEm: new Date('2027-05-11T10:00:00Z') };
    const repo = (m: EntityManager) => m.getRepository(ReconfirmacaoRestricoesOrm);
    await expect(comoA(m => repo(m).insert({ ...base, revisaoAvaliacao: 7, meio: 'presencial', chaveIdempotencia: randomUUID() }))).rejects.toMatchObject({ code: '23503' });
    await expect(comoA(m => repo(m).insert({ ...base, revisaoAvaliacao: 1, meio: 'clique' as never, chaveIdempotencia: randomUUID() }))).rejects.toMatchObject({ code: '23514' });
    await expect(comoA(m => repo(m).insert({ ...base, revisaoAvaliacao: 1, meio: 'portal', venceEm: base.atestadoEm, chaveIdempotencia: randomUUID() }))).rejects.toMatchObject({ code: '23514' });
    await expect(comoA(m => repo(m).insert({ ...base, revisaoAvaliacao: 1, meio: 'portal', restricaoId: randomUUID(), chaveIdempotencia: randomUUID() }))).rejects.toMatchObject({ code: '23514' });
    const chave = randomUUID();
    await comoA(m => repo(m).insert({ ...base, revisaoAvaliacao: 1, meio: 'contato_documentado', chaveIdempotencia: chave }));
    await expect(comoA(m => repo(m).insert({ ...base, revisaoAvaliacao: 1, meio: 'portal', chaveIdempotencia: chave }))).rejects.toMatchObject({ code: '23505' });
    // avaliação: nao_informado nunca carrega confirmação; confirmada exige quem, quando e vencimento
    await expect(comoA(m => m.getRepository(AvaliacaoRestricoesPacienteOrm).insert({ tenantId: tA, pacienteId: pacA, situacao: 'sem_restricoes_confirmadas', revisao: 1 })))
      .rejects.toMatchObject({ code: '23514' });
  });

  it('D7-a: solicitação segue a máquina de estados, decisão exige explicação ao paciente e conteúdo do pedido é imutável', async () => {
    const r = await comoA(m => novaRestricao(m));
    const s = await comoA(m => m.getRepository(SolicitacaoRestricaoPacienteOrm).save(m.getRepository(SolicitacaoRestricaoPacienteOrm).create({
      tenantId: tA, pacienteId: pacA, restricaoId: r.id, tipo: 'remocao', estado: 'criada', autorUsuarioId: uA, chaveCriacao: randomUUID(),
      conteudoCriptografado: cifra({}), revisao: 1 })));
    const upd = (sql: string, p: unknown[] = []) => comoA(m => m.query(sql, [...p, s.id]));
    await expect(upd(`update solicitacoes_restricoes_pacientes set estado='atendida', decidido_por_usuario_id=$1, decidido_em=now(),
      explicacao_paciente_criptografada=$2, revisao=2 where id=$3`, [uA, cifra({})])).rejects.toMatchObject({ code: '23514' });
    await expect(upd("update solicitacoes_restricoes_pacientes set conteudo_criptografado=$1, revisao=2 where id=$2", [cifra({ x: 1 })])).rejects.toMatchObject({ code: '23514' });
    await upd("update solicitacoes_restricoes_pacientes set estado='em_analise', revisao=2 where id=$1");
    await expect(upd("update solicitacoes_restricoes_pacientes set estado='recusada', decidido_por_usuario_id=$1, decidido_em=now(), revisao=3 where id=$2", [uA]))
      .rejects.toMatchObject({ code: '23514' });
    await upd(`update solicitacoes_restricoes_pacientes set estado='recusada', decidido_por_usuario_id=$1, decidido_em=now(),
      explicacao_paciente_criptografada=$2, justificativa_interna_criptografada=$3, revisao=3 where id=$4`, [uA, cifra({ p: 1 }), cifra({ i: CANARIO })]);
    await expect(upd("update solicitacoes_restricoes_pacientes set estado='em_analise', decidido_por_usuario_id=null, decidido_em=null, revisao=4 where id=$1"))
      .rejects.toMatchObject({ code: '23514' });
    // encerrada é terminal mesmo sem mudar o estado: explicação e justificativa não são reescritas depois da decisão
    await expect(upd("update solicitacoes_restricoes_pacientes set explicacao_paciente_criptografada=$1, revisao=4 where id=$2", [cifra({ outra: 1 })]))
      .rejects.toMatchObject({ code: '23514' });
    const linha = (await owner.query('select explicacao_paciente_criptografada e, justificativa_interna_criptografada j from solicitacoes_restricoes_pacientes where id=$1', [s.id])).rows[0];
    expect(Buffer.compare(linha.e, linha.j)).not.toBe(0);
    // inclusão nunca aponta restrição; correção/remoção sempre apontam
    await expect(comoA(m => m.getRepository(SolicitacaoRestricaoPacienteOrm).insert({ tenantId: tA, pacienteId: pacA, tipo: 'correcao', estado: 'criada',
      autorUsuarioId: uA, chaveCriacao: randomUUID(), conteudoCriptografado: cifra({}), revisao: 1 }))).rejects.toMatchObject({ code: '23514' });
  });
});

suite('FOOD06 P1b 1083 down em PostgreSQL 15 descartável', () => {
  let container: StartedTestContainer, owner: Client, conn: Record<string, unknown>;
  beforeAll(async () => {
    container = await new GenericContainer('postgres:15-alpine').withTmpFs({ '/var/lib/postgresql/data': 'rw,noexec,nosuid,size=128m' })
      .withEnvironment({ POSTGRES_USER: 'owner', POSTGRES_PASSWORD: 'owner-test', POSTGRES_DB: 'food06_restricoes_down' }).withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i, 2)).withStartupTimeout(60000).start();
    conn = { host: container.getHost(), port: container.getMappedPort(5432), database: 'food06_restricoes_down' };
    owner = new Client({ ...conn, user: 'owner', password: 'owner-test' } as never); await owner.connect();
    await fixture(owner);
  }, 120000);
  afterAll(async () => { await owner?.end(); await container?.stop(); }, 30000);
  const existentes = async () => (await owner.query("select relname from pg_class where relkind='r' and relname = any($1)", [[...TABELAS_RESTRICOES_ALIMENTARES]])).rows.length;

  it('up → down vazio remove tudo; up de novo é reaplicável; com uma linha o down recusa e preserva o dado', async () => {
    await aplicar(conn, 'up');
    expect(await existentes()).toBe(7);
    await aplicar(conn, 'down');
    expect(await existentes()).toBe(0);
    expect((await owner.query("select count(*)::int n from pg_proc where proname like 'rejeitar_mutacao_restricoes%' or proname like 'validar_%restric%' or proname like 'validar_%solicit%' or proname like 'validar_%avaliac%'")).rows[0].n).toBe(0);
    expect((await owner.query('select count(*)::int n from tenants')).rows[0].n).toBe(0);
    await aplicar(conn, 'up');
    const t = randomUUID(), u = randomUUID(), p = randomUUID();
    await owner.query('insert into tenants values($1)', [t]); await owner.query('insert into usuarios values($1,$2)', [u, t]); await owner.query('insert into pacientes values($1,$2)', [p, t]);
    await owner.query(`insert into avaliacoes_restricoes_pacientes(tenant_id,paciente_id) values($1,$2)`, [t, p]);
    await expect(aplicar(conn, 'down')).rejects.toThrow('Rollback recusado');
    expect(await existentes()).toBe(7);
    expect((await owner.query('select count(*)::int n from avaliacoes_restricoes_pacientes')).rows[0].n).toBe(1);
  });
});

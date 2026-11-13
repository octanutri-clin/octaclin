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
import { cifrarConteudoRestricao, decifrarConteudoRestricao, cifrarCampo, decifrarCampo, ConteudoRestricaoIlegivelError } from '../../../modulos/planos-alimentares/infraestrutura/codec-conteudo-restricao';
import { validarDesfechoSolicitacao } from '../../../modulos/planos-alimentares/dominio/solicitacao-restricao-paciente';

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
  const CONTEUDO = { schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alergeno', id: 'sintetico-1' }, observacao: CANARIO };
  // D2: o conteúdo clínico só entra pelo codec validado, vinculado a tenant, paciente, restrição e revisão.
  async function novaRestricao(m: EntityManager, extra: Partial<RestricaoPacienteOrm> = {}) {
    const id = randomUUID(), tenantId = extra.tenantId ?? tA, pacienteId = extra.pacienteId ?? pacA;
    const linha = {
      id, tenantId, pacienteId, autorUsuarioId: uA, chaveCriacao: randomUUID(), origem: 'profissional' as const, estado: 'ativa' as const,
      confirmacao: 'pendente' as const, revisao: 1,
      conteudoCriptografado: cifrarConteudoRestricao(crypto, CONTEUDO, { finalidade: 'restricao', tenantId, pacienteId, restricaoId: id, revisao: 1 }), ...extra
    };
    await m.getRepository(RestricaoPacienteOrm).insert(linha);
    return linha;
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
        autorUsuarioId: uA, conteudoCriptografado: cifrarConteudoRestricao(crypto, CONTEUDO, { finalidade: 'revisao_restricao', tenantId: tA, pacienteId: pacA, restricaoId: r.id, revisao: 1 }) });
      const a = await novaAvaliacao(m);
      await m.getRepository(ReconfirmacaoRestricoesOrm).insert({ tenantId: tA, pacienteId: pacA, avaliacaoId: a.id, revisaoAvaliacao: 1,
        restricaoId: r.id, revisaoRestricao: 1, atestadoPorUsuarioId: uA, atestadoEm: new Date('2026-11-12T10:00:00Z'), meio: 'teleconsulta',
        resultadoCriptografado: cifra({ resultado: CANARIO }), venceEm: null, chaveIdempotencia: randomUUID() });
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
    expect(decifrarConteudoRestricao(crypto, lida.conteudoCriptografado, { finalidade: 'restricao', tenantId: tA, pacienteId: pacA, restricaoId: ids.r, revisao: 1 }))
      .toEqual(CONTEUDO);
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
    // revisão R4 (#531): decisão de confirmação é imutável — nem quem confirmou, nem quando, nem confirmada↔rejeitada
    const u2 = randomUUID();
    await owner.query('insert into usuarios values($1,$2)', [u2, tA]);
    await expect(comoA(m => m.query('update restricoes_pacientes set confirmado_por_usuario_id=$1, revisao=3 where id=$2', [u2, c.id]))).rejects.toMatchObject({ code: '23514' });
    await expect(comoA(m => m.query("update restricoes_pacientes set confirmado_em=now() - interval '1 day', revisao=3 where id=$1", [c.id]))).rejects.toMatchObject({ code: '23514' });
    await expect(comoA(m => m.query("update restricoes_pacientes set confirmacao='rejeitada', confirmado_por_usuario_id=null, confirmado_em=null, revisao=3 where id=$1", [c.id])))
      .rejects.toMatchObject({ code: '23514' });
    const rj = await comoA(m => novaRestricao(m));
    await comoA(m => m.query("update restricoes_pacientes set confirmacao='rejeitada', revisao=2 where id=$1", [rj.id]));
    await expect(comoA(m => m.query("update restricoes_pacientes set confirmacao='confirmada', confirmado_por_usuario_id=$1, confirmado_em=now(), revisao=3 where id=$2", [uA, rj.id])))
      .rejects.toMatchObject({ code: '23514' });
    // estado clínico continua podendo mudar com a decisão preservada
    await comoA(m => m.query("update restricoes_pacientes set estado='em_reavaliacao', revisao=3 where id=$1", [c.id]));
    // identidade do paciente não muda em nenhuma tabela de estado
    await expect(comoA(m => m.query('update restricoes_pacientes set paciente_id=$1, revisao=4 where id=$2', [pacA2, c.id]))).rejects.toMatchObject({ code: '23514' });
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
    // D4: restrição individual é opcional, exige a revisão real, é do mesmo paciente e nunca renova a avaliação global
    const ind = await comoA(async m => {
      const x = await novaRestricao(m, { pacienteId: pacA2 });
      await m.getRepository(RevisaoRestricaoPacienteOrm).insert({ tenantId: tA, pacienteId: pacA2, restricaoId: x.id, numero: 1, evento: 'criacao', autorUsuarioId: uA,
        conteudoCriptografado: cifrarConteudoRestricao(crypto, CONTEUDO, { finalidade: 'revisao_restricao', tenantId: tA, pacienteId: pacA2, restricaoId: x.id, revisao: 1 }) });
      return x;
    });
    // restrição de outro paciente COM revisão 1 real: só a FK composta tenant+paciente+restrição pode barrar
    const deOutroPaciente = await comoA(async m => {
      const x = await novaRestricao(m);
      await m.getRepository(RevisaoRestricaoPacienteOrm).insert({ tenantId: tA, pacienteId: pacA, restricaoId: x.id, numero: 1, evento: 'criacao', autorUsuarioId: uA,
        conteudoCriptografado: cifrarConteudoRestricao(crypto, CONTEUDO, { finalidade: 'revisao_restricao', tenantId: tA, pacienteId: pacA, restricaoId: x.id, revisao: 1 }) });
      return x;
    });
    await expect(comoA(m => repo(m).insert({ ...base, revisaoAvaliacao: 1, meio: 'portal', restricaoId: ind.id, revisaoRestricao: 1, chaveIdempotencia: randomUUID() })))
      .rejects.toMatchObject({ code: '23514' });
    await expect(comoA(m => repo(m).insert({ ...base, venceEm: null, revisaoAvaliacao: 1, meio: 'portal', restricaoId: ind.id, revisaoRestricao: 9, chaveIdempotencia: randomUUID() })))
      .rejects.toMatchObject({ code: '23503' });
    await expect(comoA(m => repo(m).insert({ ...base, venceEm: null, revisaoAvaliacao: 1, meio: 'portal', restricaoId: deOutroPaciente.id, revisaoRestricao: 1, chaveIdempotencia: randomUUID() })))
      .rejects.toMatchObject({ code: '23503' });
    await comoA(m => repo(m).insert({ ...base, venceEm: null, revisaoAvaliacao: 1, meio: 'portal', restricaoId: ind.id, revisaoRestricao: 1, chaveIdempotencia: randomUUID() }));
    // pendência mantida: global sem vencimento, sem declaração falsa
    await comoA(m => repo(m).insert({ ...base, venceEm: null, revisaoAvaliacao: 1, meio: 'presencial', chaveIdempotencia: randomUUID() }));
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
    // D1: toda decisão guarda o desfecho (o que mudou e o que não mudou); sem ele, recusada também é barrada
    await expect(upd(`update solicitacoes_restricoes_pacientes set estado='recusada', decidido_por_usuario_id=$1, decidido_em=now(),
      explicacao_paciente_criptografada=$2, revisao=3 where id=$3`, [uA, cifra({ p: 1 })])).rejects.toMatchObject({ code: '23514' });
    const desfecho = cifra(validarDesfechoSolicitacao({ estadoFinal: 'recusada', alterados: [], inalterados: ['item-1'] }));
    await upd(`update solicitacoes_restricoes_pacientes set estado='recusada', decidido_por_usuario_id=$1, decidido_em=now(),
      explicacao_paciente_criptografada=$2, justificativa_interna_criptografada=$3, desfecho_criptografado=$4, revisao=3 where id=$5`,
    [uA, cifra({ p: 1 }), cifra({ i: CANARIO }), desfecho]);
    await expect(upd("update solicitacoes_restricoes_pacientes set estado='em_analise', decidido_por_usuario_id=null, decidido_em=null, revisao=4 where id=$1"))
      .rejects.toMatchObject({ code: '23514' });
    // encerrada é terminal mesmo sem mudar o estado: explicação e justificativa não são reescritas depois da decisão
    await expect(upd("update solicitacoes_restricoes_pacientes set explicacao_paciente_criptografada=$1, revisao=4 where id=$2", [cifra({ outra: 1 })]))
      .rejects.toMatchObject({ code: '23514' });
    const linha = (await owner.query('select explicacao_paciente_criptografada e, justificativa_interna_criptografada j from solicitacoes_restricoes_pacientes where id=$1', [s.id])).rows[0];
    expect(Buffer.compare(linha.e, linha.j)).not.toBe(0);
    // a restrição apontada não mudou por causa da solicitação
    expect((await owner.query('select revisao, estado from restricoes_pacientes where id=$1', [r.id])).rows[0]).toEqual({ revisao: 1, estado: 'ativa' });
    // inclusão nunca aponta restrição; correção/remoção sempre apontam
    await expect(comoA(m => m.getRepository(SolicitacaoRestricaoPacienteOrm).insert({ tenantId: tA, pacienteId: pacA, tipo: 'correcao', estado: 'criada',
      autorUsuarioId: uA, chaveCriacao: randomUUID(), conteudoCriptografado: cifra({}), revisao: 1 }))).rejects.toMatchObject({ code: '23514' });
  });

  it('D1 (#531): em_analise → parcial com explicação e desfecho; parcial é terminal e não nasce de criada', async () => {
    const r = await comoA(m => novaRestricao(m));
    const nova = () => comoA(async m => {
      const x = m.getRepository(SolicitacaoRestricaoPacienteOrm).create({ tenantId: tA, pacienteId: pacA, restricaoId: r.id, tipo: 'correcao', estado: 'criada',
        autorUsuarioId: uA, chaveCriacao: randomUUID(), conteudoCriptografado: cifra({ pedido: 1 }), revisao: 1 });
      return m.getRepository(SolicitacaoRestricaoPacienteOrm).save(x);
    });
    const desfecho = cifra(validarDesfechoSolicitacao({ estadoFinal: 'parcial', alterados: [{ item: 'item-1', restricaoId: r.id, revisaoResultante: 2 }], inalterados: ['item-2'] }));
    const parcial = (id: string, revisao: number, extra = '', p: unknown[] = []) => comoA(m => m.query(
      `update solicitacoes_restricoes_pacientes set estado='parcial', decidido_por_usuario_id=$1, decidido_em=now(), revisao=${revisao}${extra} where id=$2`, [uA, id, ...p]));
    const a = await nova();
    await expect(parcial(a.id, 2, ', explicacao_paciente_criptografada=$3, desfecho_criptografado=$4', [cifra({ e: 1 }), desfecho])).rejects.toMatchObject({ code: '23514' });
    await comoA(m => m.query("update solicitacoes_restricoes_pacientes set estado='em_analise', revisao=2 where id=$1", [a.id]));
    await expect(parcial(a.id, 3, ', desfecho_criptografado=$3', [desfecho])).rejects.toMatchObject({ code: '23514' });
    await expect(parcial(a.id, 3, ', explicacao_paciente_criptografada=$3', [cifra({ e: 1 })])).rejects.toMatchObject({ code: '23514' });
    await parcial(a.id, 3, ', explicacao_paciente_criptografada=$3, desfecho_criptografado=$4', [cifra({ e: 1 }), desfecho]);
    for (const sql of ["estado='em_analise', decidido_por_usuario_id=null, decidido_em=null", "estado='atendida'", "desfecho_criptografado=$2"]) {
      await expect(comoA(m => m.query(`update solicitacoes_restricoes_pacientes set ${sql}, revisao=4 where id=$1`, sql.includes('$2') ? [a.id, desfecho] : [a.id])))
        .rejects.toMatchObject({ code: '23514' });
    }
    expect((await owner.query('select estado, revisao from solicitacoes_restricoes_pacientes where id=$1', [a.id])).rows[0]).toEqual({ estado: 'parcial', revisao: 3 });
    // desfecho fora do estado decidido é recusado
    const b = await nova();
    await expect(comoA(m => m.query("update solicitacoes_restricoes_pacientes set desfecho_criptografado=$1, revisao=2 where id=$2", [desfecho, b.id]))).rejects.toMatchObject({ code: '23514' });
    // CAS: revisão que não avança uma unidade é recusada
    await expect(comoA(m => m.query("update solicitacoes_restricoes_pacientes set estado='em_analise', revisao=1 where id=$1", [b.id]))).rejects.toMatchObject({ code: '23514' });
    // idempotência de criação
    const chave = randomUUID();
    const base = { tenantId: tA, pacienteId: pacA, restricaoId: r.id, tipo: 'correcao' as const, estado: 'criada' as const, autorUsuarioId: uA, chaveCriacao: chave,
      conteudoCriptografado: cifra({}), revisao: 1 };
    await comoA(m => m.getRepository(SolicitacaoRestricaoPacienteOrm).insert(base));
    await expect(comoA(m => m.getRepository(SolicitacaoRestricaoPacienteOrm).insert(base))).rejects.toMatchObject({ code: '23505' });
  });

  it('D2 (#531): cifra copiada de outra restrição, de outra revisão ou de outro tenant falha fechada ao decifrar (nunca vira ausência)', async () => {
    const x = await comoA(m => novaRestricao(m));
    const y = await comoA(m => novaRestricao(m));
    const vy = { finalidade: 'restricao' as const, tenantId: tA, pacienteId: pacA, restricaoId: y.id, revisao: 2 };
    // administrador copia a cifra de X para Y (a trigger exige revisão +1; o conteúdo não é coluna imutável)
    await owner.query('update restricoes_pacientes set conteudo_criptografado=(select conteudo_criptografado from restricoes_pacientes where id=$1), revisao=2 where id=$2', [x.id, y.id]);
    const lidaY = await comoA(m => m.getRepository(RestricaoPacienteOrm).findOneByOrFail({ id: y.id }));
    expect(() => decifrarConteudoRestricao(crypto, lidaY.conteudoCriptografado, vy)).toThrow(ConteudoRestricaoIlegivelError);
    // cifra legítima de Y na revisão 1 não vale para a linha na revisão 2
    await owner.query('update restricoes_pacientes set conteudo_criptografado=$1, revisao=3 where id=$2',
      [cifrarConteudoRestricao(crypto, CONTEUDO, { ...vy, revisao: 2 }), y.id]);
    const lida3 = await comoA(m => m.getRepository(RestricaoPacienteOrm).findOneByOrFail({ id: y.id }));
    expect(() => decifrarConteudoRestricao(crypto, lida3.conteudoCriptografado, { ...vy, revisao: 3 })).toThrow(ConteudoRestricaoIlegivelError);
    // cifra feita para o tenant B não é aceita numa linha de A
    const deB = cifrarConteudoRestricao(crypto, CONTEUDO, { ...vy, tenantId: tB, revisao: 4 });
    await owner.query('update restricoes_pacientes set conteudo_criptografado=$1, revisao=4 where id=$2', [deB, y.id]);
    const lida4 = await comoA(m => m.getRepository(RestricaoPacienteOrm).findOneByOrFail({ id: y.id }));
    expect(() => decifrarConteudoRestricao(crypto, lida4.conteudoCriptografado, { ...vy, revisao: 4 })).toThrow(ConteudoRestricaoIlegivelError);
    // bytes adulterados
    const adulterado = Buffer.from(lida4.conteudoCriptografado); adulterado[adulterado.length - 1] ^= 1;
    expect(() => decifrarConteudoRestricao(crypto, adulterado, { ...vy, tenantId: tB, revisao: 4 })).toThrow(ConteudoRestricaoIlegivelError);
    // e o conteúdo legítimo de X continua legível pelo seu vínculo
    const lidaX = await comoA(m => m.getRepository(RestricaoPacienteOrm).findOneByOrFail({ id: x.id }));
    expect(decifrarConteudoRestricao(crypto, lidaX.conteudoCriptografado, { ...vy, restricaoId: x.id, revisao: 1 })).toEqual(CONTEUDO);
  });

  it('R3 (#531): os 10 campos cifrados gravados pelo codec só decifram no próprio registro, campo, revisão, paciente e tenant', async () => {
    const r = await comoA(m => novaRestricao(m));
    const pacR3 = randomUUID();
    await owner.query('insert into pacientes values($1,$2)', [pacR3, tA]);
    const a = await comoA(m => novaAvaliacao(m, pacR3));
    const ids = { rev: r.id, reconf: randomUUID(), sol: randomUUID(), solB: randomUUID(), map: randomUUID() };
    const vP = (registroId: string, revisao: number, pacienteId = pacA) => ({ tenantId: tA, registroId, revisao, pacienteId });
    await comoA(async m => {
      await m.getRepository(RevisaoRestricaoPacienteOrm).insert({ tenantId: tA, pacienteId: pacA, restricaoId: r.id, numero: 1, evento: 'criacao', autorUsuarioId: uA,
        conteudoCriptografado: cifrarCampo(crypto, 'restricoes_pacientes_revisoes.conteudo_criptografado', CONTEUDO, vP(r.id, 1)) });
      await m.getRepository(RevisaoRestricaoPacienteOrm).insert({ tenantId: tA, pacienteId: pacA, restricaoId: r.id, numero: 2, evento: 'inativacao', autorUsuarioId: uA,
        motivoInativacao: 'registro_incorreto', confirmacaoDoisPassos: true,
        conteudoCriptografado: cifrarCampo(crypto, 'restricoes_pacientes_revisoes.conteudo_criptografado', CONTEUDO, vP(r.id, 2)),
        justificativaCriptografada: cifrarCampo(crypto, 'restricoes_pacientes_revisoes.justificativa_criptografada', 'justificativa ' + CANARIO, vP(r.id, 2)) });
      await m.getRepository(ReconfirmacaoRestricoesOrm).insert({ id: ids.reconf, tenantId: tA, pacienteId: pacR3, avaliacaoId: a.id, revisaoAvaliacao: 1, atestadoPorUsuarioId: uA,
        atestadoEm: new Date('2026-11-12T10:00:00Z'), meio: 'presencial', venceEm: null, chaveIdempotencia: randomUUID(),
        resultadoCriptografado: cifrarCampo(crypto, 'reconfirmacoes_restricoes.resultado_criptografado', { resultado: 'pendencia_mantida', observacao: CANARIO }, vP(ids.reconf, 1, pacR3)) });
      for (const id of [ids.sol, ids.solB]) {
        await m.getRepository(SolicitacaoRestricaoPacienteOrm).insert({ id, tenantId: tA, pacienteId: pacA, restricaoId: r.id, tipo: 'correcao', estado: 'criada',
          autorUsuarioId: uA, chaveCriacao: randomUUID(), revisao: 1,
          conteudoCriptografado: cifrarCampo(crypto, 'solicitacoes_restricoes_pacientes.conteudo_criptografado', { itens: [{ item: 'item-1', texto: CANARIO }, { item: 'item-2', texto: 'b' }] }, vP(id, 1)) });
      }
      await m.query("update solicitacoes_restricoes_pacientes set estado='em_analise', revisao=2 where id=$1", [ids.sol]);
      await m.query(`update solicitacoes_restricoes_pacientes set estado='parcial', decidido_por_usuario_id=$1, decidido_em=now(), revisao=3,
        explicacao_paciente_criptografada=$2, justificativa_interna_criptografada=$3, desfecho_criptografado=$4 where id=$5`, [uA,
        cifrarCampo(crypto, 'solicitacoes_restricoes_pacientes.explicacao_paciente_criptografada', 'explicação ' + CANARIO, vP(ids.sol, 3)),
        cifrarCampo(crypto, 'solicitacoes_restricoes_pacientes.justificativa_interna_criptografada', 'interna ' + CANARIO, vP(ids.sol, 3)),
        cifrarCampo(crypto, 'solicitacoes_restricoes_pacientes.desfecho_criptografado',
          { estadoFinal: 'parcial', alterados: [{ item: 'item-1', restricaoId: r.id, revisaoResultante: 2 }], inalterados: ['item-2'] }, vP(ids.sol, 3)), ids.sol]);
      await m.getRepository(MapeamentoAlimentoAlvoLocalOrm).insert({ id: ids.map, tenantId: tA, fonteId: 'fonte-r3', codigoOrigem: 'item-r3', alvoId: 'sintetico-1',
        relacao: 'nao_contem_confirmado', granularidade: 'alimento', origem: 'local_profissional', cobertura: 'suficiente', versaoMapeamento: 'r3', autorUsuarioId: uA,
        evidenciaCriptografada: cifrarCampo(crypto, 'mapeamentos_alimento_alvo_locais.evidencia_criptografada', 'evidência ' + CANARIO, { tenantId: tA, registroId: ids.map, revisao: 1 }),
        justificativaCriptografada: cifrarCampo(crypto, 'mapeamentos_alimento_alvo_locais.justificativa_criptografada', 'justificativa ' + CANARIO, { tenantId: tA, registroId: ids.map, revisao: 1 }) });
    });
    // nada em claro no banco
    for (const t of TABELAS_RESTRICOES_ALIMENTARES) expect(JSON.stringify((await owner.query(`select * from ${t}`)).rows)).not.toContain(CANARIO);
    // leitura certa funciona
    const sol = (await comoA(m => m.query('select * from solicitacoes_restricoes_pacientes where id=$1', [ids.sol])))[0];
    expect(decifrarCampo(crypto, 'solicitacoes_restricoes_pacientes.explicacao_paciente_criptografada', sol.explicacao_paciente_criptografada, vP(ids.sol, 3))).toBe('explicação ' + CANARIO);
    const rev2 = (await comoA(m => m.query('select * from restricoes_pacientes_revisoes where restricao_id=$1 and numero=2', [r.id])))[0];
    expect(decifrarCampo(crypto, 'restricoes_pacientes_revisoes.justificativa_criptografada', rev2.justificativa_criptografada, vP(r.id, 2))).toBe('justificativa ' + CANARIO);
    const rec = (await comoA(m => m.query('select * from reconfirmacoes_restricoes where id=$1', [ids.reconf])))[0];
    expect(decifrarCampo(crypto, 'reconfirmacoes_restricoes.resultado_criptografado', rec.resultado_criptografado, vP(ids.reconf, 1, pacR3))).toEqual({ resultado: 'pendencia_mantida', observacao: CANARIO });
    const map = (await comoA(m => m.query('select * from mapeamentos_alimento_alvo_locais where id=$1', [ids.map])))[0];
    expect(decifrarCampo(crypto, 'mapeamentos_alimento_alvo_locais.evidencia_criptografada', map.evidencia_criptografada, { tenantId: tA, registroId: ids.map, revisao: 1 })).toBe('evidência ' + CANARIO);
    // cópias entre campos, registros, revisões e tenant falham fechadas
    const falha = (f: () => unknown) => expect(f).toThrow(ConteudoRestricaoIlegivelError);
    falha(() => decifrarCampo(crypto, 'solicitacoes_restricoes_pacientes.justificativa_interna_criptografada', sol.explicacao_paciente_criptografada, vP(ids.sol, 3)));
    falha(() => decifrarCampo(crypto, 'solicitacoes_restricoes_pacientes.explicacao_paciente_criptografada', sol.explicacao_paciente_criptografada, vP(ids.solB, 3)));
    falha(() => decifrarCampo(crypto, 'solicitacoes_restricoes_pacientes.explicacao_paciente_criptografada', sol.explicacao_paciente_criptografada, vP(ids.sol, 2)));
    falha(() => decifrarCampo(crypto, 'solicitacoes_restricoes_pacientes.explicacao_paciente_criptografada', sol.explicacao_paciente_criptografada, { ...vP(ids.sol, 3), tenantId: tB }));
    falha(() => decifrarCampo(crypto, 'solicitacoes_restricoes_pacientes.conteudo_criptografado', sol.conteudo_criptografado, vP(ids.solB, 1)));
    falha(() => decifrarCampo(crypto, 'mapeamentos_alimento_alvo_locais.justificativa_criptografada', map.evidencia_criptografada, { tenantId: tA, registroId: ids.map, revisao: 1 }));
    falha(() => decifrarCampo(crypto, 'restricoes_pacientes_revisoes.justificativa_criptografada', rev2.justificativa_criptografada, vP(r.id, 1)));
    falha(() => decifrarCampo(crypto, 'reconfirmacoes_restricoes.resultado_criptografado', rec.resultado_criptografado, vP(ids.reconf, 1, pacA)));
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
    // revisão R4 (#531): fora de transação o `set local` não vale; o down recusa em vez de contar sob RLS
    const m = new DataSource({ type: 'postgres', ...conn, username: 'owner', password: 'owner-test', entities: [], synchronize: false, logging: false } as never);
    await m.initialize(); const q = m.createQueryRunner();
    try { await expect(new RestricoesAlimentares1720000001083().down(q)).rejects.toThrow('Rollback recusado'); } finally { await q.release(); await m.destroy(); }
    expect(await existentes()).toBe(7);
    expect((await owner.query('select count(*)::int n from avaliacoes_restricoes_pacientes')).rows[0].n).toBe(1);
  });
});

suite('FOOD06 P1b 1083 down × escrita concorrente (R4-01 do parecer independente)', () => {
  let container: StartedTestContainer, owner: Client, escritor: Client, conn: Record<string, unknown>;
  const t = randomUUID(), p = randomUUID();
  beforeAll(async () => {
    container = await new GenericContainer('postgres:15-alpine').withTmpFs({ '/var/lib/postgresql/data': 'rw,noexec,nosuid,size=128m' })
      .withEnvironment({ POSTGRES_USER: 'owner', POSTGRES_PASSWORD: 'owner-test', POSTGRES_DB: 'food06_restricoes_corrida' }).withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i, 2)).withStartupTimeout(60000).start();
    conn = { host: container.getHost(), port: container.getMappedPort(5432), database: 'food06_restricoes_corrida' };
    owner = new Client({ ...conn, user: 'owner', password: 'owner-test' } as never); await owner.connect();
    await fixture(owner);
    await owner.query('insert into tenants values($1)', [t]); await owner.query('insert into pacientes values($1,$2)', [p, t]);
    await aplicar(conn, 'up');
    await owner.query(`create role food06_runtime login password 'runtime-test' nosuperuser nocreatedb nocreaterole nobypassrls;
      grant connect on database food06_restricoes_corrida to food06_runtime; grant usage on schema public to food06_runtime;
      grant select,insert,update on all tables in schema public to food06_runtime;`);
    escritor = new Client({ ...conn, user: 'food06_runtime', password: 'runtime-test' } as never); await escritor.connect();
  }, 120000);
  afterAll(async () => { await escritor?.end(); await owner?.end(); await container?.stop(); }, 30000);

  it('com a sessão em row_security=off e sem transação, o down com tabelas VAZIAS recusa e não remove nada', async () => {
    const m = new DataSource({ type: 'postgres', ...conn, username: 'owner', password: 'owner-test', entities: [], synchronize: false, logging: false } as never);
    await m.initialize(); const q = m.createQueryRunner();
    try {
      await q.query('set row_security = off'); // nível de sessão, como na prova do revisor
      expect(q.isTransactionActive).toBe(false);
      await expect(new RestricoesAlimentares1720000001083().down(q)).rejects.toThrow('Rollback recusado');
    } finally { await q.release(); await m.destroy(); }
    expect((await owner.query("select count(*)::int n from pg_class where relkind='r' and relname = any($1)", [[...TABELAS_RESTRICOES_ALIMENTARES]])).rows[0].n).toBe(7);
  });

  it('escrita da runtime iniciada depois da checagem espera o lock e nunca é confirmada para depois sumir', async () => {
    const m = new DataSource({ type: 'postgres', ...conn, username: 'owner', password: 'owner-test', entities: [], synchronize: false, logging: false } as never);
    await m.initialize(); const q = m.createQueryRunner();
    let escrita: Promise<unknown> | undefined;
    const original = q.query.bind(q);
    // Intercala exatamente onde o parecer demonstrou a corrida: logo depois da checagem de existência, antes dos DROP.
    (q as unknown as { query: (s: string, p?: unknown[]) => Promise<unknown> }).query = async (sql: string, params?: unknown[]) => {
      const r = await original(sql, params);
      if (/^\s*select exists/i.test(sql) && !escrita) {
        escrita = (async () => {
          await escritor.query('begin');
          await escritor.query("select set_config('app.tenant_id', $1, true)", [t]);
          await escritor.query('insert into avaliacoes_restricoes_pacientes(tenant_id,paciente_id) values($1,$2)', [t, p]);
          await escritor.query('commit');
        })().catch(async e => { await escritor.query('rollback').catch(() => undefined); throw e; });
        escrita.catch(() => undefined);
        // a escrita precisa estar BLOQUEADA no lock antes de o down seguir
        let esperando = false;
        for (let i = 0; i < 100 && !esperando; i++) {
          esperando = (await owner.query("select 1 from pg_stat_activity where usename='food06_runtime' and wait_event_type='Lock'")).rows.length > 0;
          if (!esperando) await new Promise(res => setTimeout(res, 50));
        }
        expect(esperando).toBe(true);
      }
      return r;
    };
    try {
      await q.startTransaction();
      await new RestricoesAlimentares1720000001083().down(q);
      await q.commitTransaction();
    } finally { await q.release(); await m.destroy(); }
    // a escrita concorrente falha (tabela removida); nada foi confirmado e depois apagado
    await expect(escrita).rejects.toBeTruthy();
    expect((await owner.query("select to_regclass('public.avaliacoes_restricoes_pacientes') tbl")).rows[0].tbl).toBeNull();
  });
});

suite('FOOD06 P1b 1083 down sob snapshot fixo (R4-01 da reverificação independente)', () => {
  let container: StartedTestContainer, owner: Client, escritor: Client, conn: Record<string, unknown>;
  const t = randomUUID(), p1 = randomUUID(), p2 = randomUUID();
  beforeAll(async () => {
    container = await new GenericContainer('postgres:15-alpine').withTmpFs({ '/var/lib/postgresql/data': 'rw,noexec,nosuid,size=128m' })
      .withEnvironment({ POSTGRES_USER: 'owner', POSTGRES_PASSWORD: 'owner-test', POSTGRES_DB: 'food06_restricoes_snapshot' }).withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i, 2)).withStartupTimeout(60000).start();
    conn = { host: container.getHost(), port: container.getMappedPort(5432), database: 'food06_restricoes_snapshot' };
    owner = new Client({ ...conn, user: 'owner', password: 'owner-test' } as never); await owner.connect();
    await fixture(owner);
    await owner.query('insert into tenants values($1)', [t]); await owner.query('insert into pacientes values($1,$2),($3,$2)', [p1, t, p2]);
    await aplicar(conn, 'up');
    await owner.query(`create role food06_runtime login password 'runtime-test' nosuperuser nocreatedb nocreaterole nobypassrls;
      grant connect on database food06_restricoes_snapshot to food06_runtime; grant usage on schema public to food06_runtime;
      grant select,insert,update on all tables in schema public to food06_runtime;`);
    escritor = new Client({ ...conn, user: 'food06_runtime', password: 'runtime-test' } as never); await escritor.connect();
  }, 120000);
  afterAll(async () => { await escritor?.end(); await owner?.end(); await container?.stop(); }, 30000);

  it.each([['REPEATABLE READ', 0], ['SERIALIZABLE', 1]] as const)(
    '%s: escrita confirmada depois da primeira consulta e antes do lock não é apagada; o down recusa', async (isolamento, i) => {
      const paciente = [p1, p2][i];
      const m = new DataSource({ type: 'postgres', ...conn, username: 'owner', password: 'owner-test', entities: [], synchronize: false, logging: false } as never);
      await m.initialize(); const q = m.createQueryRunner();
      const original = q.query.bind(q); let escrito = false;
      const escrever = async () => {
        escrito = true;
        await escritor.query('begin');
        await escritor.query("select set_config('app.tenant_id', $1, true)", [t]);
        await escritor.query('insert into avaliacoes_restricoes_pacientes(tenant_id,paciente_id) values($1,$2)', [t, paciente]);
        await escritor.query('commit');
      };
      // Intercala como na prova do revisor: logo DEPOIS da consulta que fixa o snapshot (SELECT; o SET não fixa) e antes do LOCK.
      (q as unknown as { query: (s: string, p?: unknown[]) => Promise<unknown> }).query = async (sql: string, params?: unknown[]) => {
        const r = await original(sql, params);
        if (!escrito && /current_setting\('row_security'\)/.test(sql)) await escrever();
        return r;
      };
      let resultado: 'recusado' | 'removeu';
      try {
        await q.startTransaction(isolamento);
        try { await new RestricoesAlimentares1720000001083().down(q); resultado = 'removeu'; await q.commitTransaction(); }
        catch (e) { expect(String((e as Error).message)).toContain('Rollback recusado'); resultado = 'recusado'; await q.rollbackTransaction(); }
      } finally { await q.release(); await m.destroy(); }
      // se o down recusou antes do ponto de intercalação, a escrita acontece agora: o dado precisa sobreviver de qualquer jeito
      if (!escrito) await escrever();
      expect(resultado).toBe('recusado');
      expect((await owner.query("select to_regclass('public.avaliacoes_restricoes_pacientes') tbl")).rows[0].tbl).toBe('avaliacoes_restricoes_pacientes');
      expect((await owner.query('select count(*)::int n from avaliacoes_restricoes_pacientes where paciente_id=$1', [paciente])).rows[0].n).toBe(1);
    });
});

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { Test } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { AddressInfo } from 'node:net';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { criarPipeValidacaoHttp } from '../../../infraestrutura/http/pipe-validacao-http';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { ControladorConsultaTeorCatalogo } from '../apresentacao/controlador-consulta-teor-catalogo';
import { ServicoConsultaTeorCatalogo } from './servico-consulta-teor-catalogo';
import { ConsultaTeorCatalogoDto } from './dto-consulta-teor-catalogo';
import { MAPEAMENTO_MICRONUTRIENTES } from '../dominio/micronutrientes';

const suite = process.env.FOOD06_CATALOGO_TESTCONTAINERS === 'true' ? describe : describe.skip;
suite('M11 catálogo HTTP/PostgreSQL15 real, vínculo FORCE RLS e runtime com catálogo somente leitura', () => {
  let container: StartedTestContainer, owner: Client, ds: DataSource, service: ServicoConsultaTeorCatalogo;
  let app: NestExpressApplication, url: string;
  const tenant = randomUUID(), outroTenant = randomUUID(), userId = randomUUID(), profissional = randomUUID();
  const fonte = randomUUID(), fonteBloqueada = randomUUID();
  const u: UsuarioAutenticado = { tenantId: tenant, usuarioId: userId, papel: 'Professional', permissoes: ['planos_alimentares.ler'], emailHash: 'sintetico' };
  let identidade: UsuarioAutenticado | undefined = u;
  const q: ConsultaTeorCatalogoDto = { codigo: 'ferroMg', porcaoGramas: 50, busca: 'Arroz', pagina: 1, limite: 2 };
  async function post(body: unknown = q) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  beforeAll(async () => {
    container = await new GenericContainer('postgres:15-alpine')
      .withTmpFs({ '/var/lib/postgresql/data': 'rw,noexec,nosuid,size=128m' })
      .withEnvironment({ POSTGRES_USER: 'owner', POSTGRES_PASSWORD: 'owner-synthetic', POSTGRES_DB: 'm11_catalogo' })
      .withExposedPorts(5432).withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i, 2)).start();
    const conn = { host: container.getHost(), port: container.getMappedPort(5432), database: 'm11_catalogo' };
    owner = new Client({ ...conn, user: 'owner', password: 'owner-synthetic' }); await owner.connect();
    // Schema representativo mínimo: prova SQL/ORM/RLS desta rota, não ensaio da cadeia de migrations.
    await owner.query(`create table profissionais(id uuid primary key,tenant_id uuid not null,usuario_id uuid not null,
      nome_criptografado bytea not null,registro_profissional varchar(80),especialidade varchar(120),arquivado_em timestamptz,
      preferencias_equivalencia jsonb,preferencias_equivalencia_revisao int,criado_em timestamptz default now(),atualizado_em timestamptz default now());
      alter table profissionais enable row level security; alter table profissionais force row level security;
      create policy tenant_prof on profissionais using(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
      create table fontes_composicao_alimentos(id uuid primary key,codigo text,versao text,base_codigo text,esquema_versao text,situacao text,direito_uso_status text);
      create table alimentos_composicao(id uuid primary key,fonte_id uuid references fontes_composicao_alimentos(id),nome text,preparacao text,base_gramas numeric(12,3),micronutrientes jsonb);
      create role m11_runtime login password 'runtime-synthetic' nosuperuser nobypassrls;
      grant usage on schema public to m11_runtime; grant select on all tables in schema public to m11_runtime; grant update on profissionais to m11_runtime;`);
    await owner.query('insert into profissionais(id,tenant_id,usuario_id,nome_criptografado) values($1,$2,$3,$4)', [profissional, tenant, userId, Buffer.from('synthetic')]);
    for (const [id, status] of [[fonte, 'aprovado'], [fonteBloqueada, 'pendente']])
      await owner.query('insert into fontes_composicao_alimentos values($1,$2,$3,$4,$5,$6,$7)', [id, 'taco_nepa_unicamp', 'synthetic-v1', 'TACO', 'octaclin-composicao-v2-micros1', 'ativa', status]);
    for (let n = 1; n <= 6; n++)
      await owner.query('insert into alimentos_composicao values($1,$2,$3,null,100,$4)', [`30000000-0000-4000-8000-${String(n).padStart(12, '0')}`, n === 6 ? fonteBloqueada : fonte, n === 5 ? 'Ar%_\\ sintético' : 'Arroz sintético', { mapeamentoVersao: MAPEAMENTO_MICRONUTRIENTES, nutrientes: { ferroMg: { estado: 'conhecido', valor: n } } }]);
    ds = new DataSource({ type: 'postgres', ...conn, username: 'm11_runtime', password: 'runtime-synthetic', entities: [ProfissionalOrm, AlimentoComposicaoOrm, FonteComposicaoAlimentoOrm], synchronize: false, logging: false });
    await ds.initialize(); service = new ServicoConsultaTeorCatalogo(new ExecutorTenant(ds));
    const module = await Test.createTestingModule({ controllers: [ControladorConsultaTeorCatalogo], providers: [
      { provide: ServicoConsultaTeorCatalogo, useValue: service }, { provide: ServicoAuditoria, useValue: { registrar: jest.fn() } }
    ] }).overrideGuard(GuardaJwt).useValue({ canActivate: (c: ExecutionContext) => { if (!identidade) throw new UnauthorizedException(); c.switchToHttp().getRequest().usuarioAutenticado = identidade; return true; } }).compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false }); app.useGlobalPipes(criarPipeValidacaoHttp()); await app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/planos-alimentares/catalogo/teor-micronutriente/consulta`;
  }, 90000);
  afterAll(async () => { await app?.close(); if (ds?.isInitialized) await ds.destroy(); await owner?.end(); await container?.stop(); }, 30000);
  afterEach(() => { identidade = u; });
  it('usa role não owner/bypass e FORCE RLS real no vínculo', async () => {
    expect((await ds.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user'))[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    expect((await owner.query("select relrowsecurity,relforcerowsecurity from pg_class where relname='profissionais'")).rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
    expect(await ds.query('select id from profissionais')).toEqual([]);
    expect(await new ExecutorTenant(ds).executar(outroTenant, g => g.query('select id from profissionais'))).toEqual([]);
    await expect(new ExecutorTenant(ds).executar(tenant, g => g.query('delete from profissionais'))).rejects.toMatchObject({ code: '42501' });
  });
  it('pagina sem repetir IDs em catálogo estável e não vaza fonte pendente', async () => {
    const a = await service.consultar(tenant, u, q), b = await service.consultar(tenant, u, { ...q, pagina: 2 });
    expect(a.itens).toHaveLength(2); expect(a.paginacao.temProxima).toBe(true); expect(b.paginacao.temProxima).toBe(false);
    expect(new Set([...a.itens, ...b.itens].map(i => i.alimento.id)).size).toBe(4);
    expect([...a.itens, ...b.itens].map(i => i.nutriente.valorPorcao)).toEqual([1, 0.5, 2, 1.5]);
    expect(a.itens[0].alimento).not.toHaveProperty('preparacao');
  });
  it('escape LIKE trata %, _ e barra como texto literal em PostgreSQL', async () => {
    const r = await service.consultar(tenant, u, { ...q, busca: 'Ar%_\\' }); expect(r.itens).toHaveLength(1); expect(r.itens[0].nutriente.valorPorcao).toBe(2.5);
  });
  it('HTTP valida body, guardas reais de papel/permissão e cache no-store', async () => {
    const ok = await post(); expect(ok.status).toBe(200); expect(ok.headers.get('cache-control')).toBe('private, no-store');
    const body = await ok.json() as {individualizacao:{estado:string}}; expect(body.individualizacao.estado).toBe('bloqueada'); expect(body).not.toHaveProperty('micronutrientes');
    for (const extra of [{ pacienteId: randomUUID() }, { tenantId: outroTenant }, { porcaoGramas: '50' }, { limite: 101 }, { busca: ' ' }, { personalizar: true }]) expect((await post({ ...q, ...extra })).status).toBe(400);
    identidade = undefined; expect((await post()).status).toBe(401);
    for (const papel of ['SuperAdmin', 'Patient', 'Client', 'Collaborator'] as const) { identidade = { ...u, papel }; expect((await post()).status).toBe(403); }
    identidade = { ...u, permissoes: [] }; expect((await post()).status).toBe(403);
  });
  it('tenant trocado e vínculo arquivado são negados antes dos dados do catálogo', async () => {
    identidade = { ...u, tenantId: outroTenant }; expect((await post()).status).toBe(403); identidade = u;
    await owner.query('update profissionais set arquivado_em=now() where id=$1', [profissional]);
    try { expect((await post()).status).toBe(403); } finally { await owner.query('update profissionais set arquivado_em=null where id=$1', [profissional]); }
  });
  it('revalida revogação/inativação/composição em cada nova consulta sem persistir snapshots', async () => {
    for (const [col, value] of [['direito_uso_status', 'expirado'], ['situacao', 'revogada']]) {
      await owner.query(`update fontes_composicao_alimentos set ${col}=$1 where id=$2`, [value, fonte]);
      try { expect((await service.consultar(tenant, u, q)).itens).toEqual([]); }
      finally { await owner.query(`update fontes_composicao_alimentos set ${col}=$1 where id=$2`, [col === 'situacao' ? 'ativa' : 'aprovado', fonte]); }
    }
  });
  it('vínculo bloqueado transacionalmente impede arquivamento concorrente até encerrar leitura', async () => {
    let chegou!: () => void, liberar!: () => void;
    const chegouNaConsulta = new Promise<void>(resolve => { chegou = resolve; });
    const continuar = new Promise<void>(resolve => { liberar = resolve; });
    const executor = new ExecutorTenant(ds);
    const interceptado = { executar: (t: string, operacao: (g: any) => Promise<unknown>) => executor.executar(t, g => {
      const proxy = new Proxy(g, { get(target, prop) {
        if (prop === 'createQueryBuilder') return (...args: any[]) => {
          const qb = (target.createQueryBuilder as any).apply(target, args);
          const ler = qb.getRawMany.bind(qb);
          qb.getRawMany = async () => { chegou(); await continuar; return ler(); };
          return qb;
        };
        const v = Reflect.get(target, prop); return typeof v === 'function' ? v.bind(target) : v;
      } });
      return operacao(proxy);
    }) } as unknown as ExecutorTenant;
    const leitura = new ServicoConsultaTeorCatalogo(interceptado).consultar(tenant, u, q);
    const writer = new Client({ host: container.getHost(), port: container.getMappedPort(5432), database: 'm11_catalogo', user: 'owner', password: 'owner-synthetic' }); await writer.connect();
    try {
      await chegouNaConsulta; // Serviço real já resolveu e bloqueou o vínculo antes do SELECT do catálogo.
      await writer.query('begin'); await writer.query("set local lock_timeout='200ms'");
      await expect(writer.query('update profissionais set arquivado_em=now() where id=$1', [profissional])).rejects.toMatchObject({ code: '55P03' });
      await writer.query('rollback');
    } finally { liberar(); await writer.end(); }
    expect((await leitura).itens).toHaveLength(2);
  });
});

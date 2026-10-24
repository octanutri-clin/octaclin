import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { GruposSubstituicoes1720000001078 } from './1720000001078-GruposSubstituicoes';
import { PreferenciasEquivalencia1720000001079 } from './1720000001079-PreferenciasEquivalencia';
import { GrupoSubstituicoesOrm, FavoritoGrupoSubstituicoesOrm } from '../../../modulos/planos-alimentares/infraestrutura/grupo-substituicoes.orm';
import { ProfissionalOrm } from '../../../modulos/profissionais/infraestrutura/profissional.orm';
import { UserActionLogOrm } from '../../auditoria/user-action-log.orm';
import { ExecutorTenant } from '../executor-tenant';
import { ServicoGruposSubstituicoes } from '../../../modulos/planos-alimentares/aplicacao/servico-grupos-substituicoes';
import { CriptografiaDadosSensiveis } from '../../seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../../modulos/auth/dominio/usuario-autenticado';

const suite=process.env.FOOD04_RLS_TESTCONTAINERS==='true'?describe:describe.skip;
suite('FOOD04 PostgreSQL15 descartável: biblioteca, RLS e concorrência',()=>{
  let container:StartedTestContainer,owner:Client,ds:DataSource,s:ServicoGruposSubstituicoes;
  const tenant=randomUUID(),outroTenant=randomUUID(),p=randomUUID(),p2=randomUUID();
  const profissional=(id=p):UsuarioAutenticado=>({usuarioId:id,tenantId:tenant,papel:'Professional',emailHash:'sintetico',permissoes:['planos_alimentares.ler','planos_alimentares.gerenciar','grupos_substituicoes.compartilhar']});
  const admin:UsuarioAutenticado={...profissional(),usuarioId:randomUUID(),papel:'Client',permissoes:['grupos_substituicoes.administrar']};
  const dados=(escopo:'pessoal'|'clinica'='pessoal',nome='Grupo sintético')=>({chaveIdempotencia:randomUUID(),escopo,conteudo:{nome,etiquetas:['caseiro'],categoria:'Flexível',entradas:[{id:randomUUID(),origem:'catalogo' as const,alimentoId:randomUUID(),quantidade:1,unidade:'porção',porcaoGramas:30}]}});
  beforeAll(async()=>{
    container=await new GenericContainer('postgres:15-alpine').withTmpFs({'/var/lib/postgresql/data':'rw,noexec,nosuid,size=256m'}).withEnvironment({POSTGRES_USER:'owner',POSTGRES_PASSWORD:'owner-test',POSTGRES_DB:'food04_test'}).withExposedPorts(5432).withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i,2)).withStartupTimeout(60000).start();
    const conn={host:container.getHost(),port:container.getMappedPort(5432),database:'food04_test'};
    owner=new Client({...conn,user:'owner',password:'owner-test'});await owner.connect();
    await owner.query(`create table tenants(id uuid primary key);
      create table usuarios(id uuid primary key,tenant_id uuid not null references tenants(id),unique(tenant_id,id));
      create table profissionais(id uuid primary key,tenant_id uuid not null references tenants(id),usuario_id uuid not null,nome_criptografado bytea not null,registro_profissional varchar(80),especialidade varchar(120),arquivado_em timestamptz,criado_em timestamptz not null default now(),atualizado_em timestamptz not null default now(),unique(tenant_id,id));
      create table user_action_logs(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,usuario_id uuid,acao varchar(120) not null,recurso_tipo varchar(120),recurso_id uuid,ip inet,user_agent text,metadados jsonb not null default '{}',criado_em timestamptz not null default now());`);
    const migrator=new DataSource({type:'postgres',...conn,username:'owner',password:'owner-test',entities:[],synchronize:false,logging:false});
    await migrator.initialize();const runner=migrator.createQueryRunner();await runner.connect();
    try{await new GruposSubstituicoes1720000001078().up(runner);await new PreferenciasEquivalencia1720000001079().up(runner);}finally{await runner.release();await migrator.destroy();}
    await owner.query(`create role food04_runtime login password 'runtime-test' nosuperuser nocreatedb nocreaterole nobypassrls;
      grant connect on database food04_test to food04_runtime;grant usage on schema public to food04_runtime;
      grant select,insert,update,delete on all tables in schema public to food04_runtime;`);
    await owner.query('insert into tenants(id) values ($1),($2)',[tenant,outroTenant]);
    for(const id of [p,p2,admin.usuarioId])await owner.query('insert into usuarios(id,tenant_id) values($1,$2)',[id,tenant]);
    for(const id of [p,p2])await owner.query("insert into profissionais(id,tenant_id,usuario_id,nome_criptografado) values($1,$2,$1,decode('00','hex'))",[id,tenant]);
    ds=new DataSource({type:'postgres',...conn,username:'food04_runtime',password:'runtime-test',entities:[GrupoSubstituicoesOrm,FavoritoGrupoSubstituicoesOrm,ProfissionalOrm,UserActionLogOrm],synchronize:false,logging:false,extra:{max:6}});await ds.initialize();
    // Fonte sintética no limite da biblioteca; cálculos/fontes reais têm specs próprios.
    const fontes={resolver:async(_g:unknown,_t:string,_p:unknown,_s:unknown,e:any)=>({...e,composicao:{descricao:'Alimento sintético',nutrientesPor100g:{energiaKcal:100}}})};
    s=new ServicoGruposSubstituicoes(new ExecutorTenant(ds),new CriptografiaDadosSensiveis(),fontes as any);
  },90000);
  afterAll(async()=>{if(ds?.isInitialized)await ds.destroy();await owner?.end();await container?.stop();},30000);
  it('prova role sem bypass/owner, FORCE RLS e tenant ausente/incorreto negados',async()=>{
    expect((await ds.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user'))[0]).toEqual({rolsuper:false,rolbypassrls:false});
    const r=await owner.query("select relname,relrowsecurity,relforcerowsecurity from pg_class where relname in ('grupos_substituicoes','favoritos_grupos_substituicoes')");
    expect(r.rows).toHaveLength(2);expect(r.rows.every(x=>x.relrowsecurity&&x.relforcerowsecurity)).toBe(true);
    await s.criar(tenant,profissional(),dados());
    expect(await ds.query('select id from grupos_substituicoes')).toHaveLength(0);
    const executor=new ExecutorTenant(ds);
    expect(await executor.executar(outroTenant,g=>g.query('select id from grupos_substituicoes'))).toHaveLength(0);
    await expect(executor.executar(outroTenant,g=>g.query("insert into grupos_substituicoes(tenant_id,profissional_id,criado_por_usuario_id,alterado_por_usuario_id,chave_idempotencia,escopo,conteudo_criptografado,criacao_snapshot_criptografado) values($1,$2,$2,$2,$3,'pessoal',decode('00','hex'),decode('00','hex'))",[tenant,p,randomUUID()]))).rejects.toMatchObject({code:'42501'});
  });
  it('converge duas criações iguais inclusive UUID em outra capitalização',async()=>{
    const d=dados(),res=await Promise.all([s.criar(tenant,profissional(),d),s.criar(tenant,profissional(),{...d,chaveIdempotencia:d.chaveIdempotencia.toUpperCase()})]);
    expect(res[0].id).toBe(res[1].id);
    expect((await owner.query('select count(*)::int n from grupos_substituicoes where chave_idempotencia=$1',[d.chaveIdempotencia])).rows[0].n).toBe(1);
  });
  it('CAS concorrente arquiva só uma revisão e restaura explicitamente',async()=>{
    const r=await s.criar(tenant,profissional(),dados());
    const res=await Promise.allSettled([s.atualizar(tenant,profissional(),r.id,{revisaoEsperada:1,estado:'arquivado'}),s.atualizar(tenant,profissional(),r.id,{revisaoEsperada:1,estado:'ativo'})]);
    expect(res.filter(x=>x.status==='fulfilled')).toHaveLength(1);
    expect(await s.atualizar(tenant,profissional(),r.id,{revisaoEsperada:2,estado:'ativo'})).toMatchObject({revisao:3,estado:'ativo'});
  });
  it('consulta/autorização/favoritos/dedup de cópia usam SQL real',async()=>{
    const pessoal=await s.criar(tenant,profissional(),dados()),compartilhado=await s.criar(tenant,profissional(),dados('clinica','Grupo compartilhado'));
    const consulta=await (s as any).consultar(tenant,profissional(p2),{busca:'compartilhado',categoria:'flexível'});
    expect(consulta.itens.map((x:any)=>x.id)).toEqual([compartilhado.id]);
    await expect(s.obter(tenant,admin,pessoal.id,true)).rejects.toMatchObject({status:404});
    await expect((s as any).favoritar(tenant,profissional(p2),pessoal.id,true)).rejects.toMatchObject({status:404});
    await Promise.all([(s as any).favoritar(tenant,profissional(p2),compartilhado.id,true),(s as any).favoritar(tenant,profissional(p2),compartilhado.id,true)]);
    expect((await (s as any).consultar(tenant,profissional(p2),{favoritos:true})).itens.map((x:any)=>x.id)).toEqual([compartilhado.id]);
    expect((await s.obter(tenant,profissional(p2),compartilhado.id)).favorito).toBe(true);
    expect((await (s as any).consultar(tenant,profissional(),{favoritos:true})).itens).toEqual([]);
    const d={...dados(),revisaoEsperada:1},copias=await Promise.all([s.duplicar(tenant,profissional(p2),compartilhado.id,d),s.duplicar(tenant,profissional(p2),compartilhado.id,d)]);
    expect(copias[0].id).toBe(copias[1].id);
    await s.atualizar(tenant,admin,compartilhado.id,{revisaoEsperada:1,estado:'arquivado'},true);
    expect((await (s as any).consultar(tenant,profissional(p2),{favoritos:true})).itens).toEqual([]);
    expect(await s.obter(tenant,profissional(p2),copias[0].id)).toMatchObject({estado:'ativo'});
  });
});

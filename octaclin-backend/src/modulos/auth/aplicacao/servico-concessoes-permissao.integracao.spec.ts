import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ConcessoesPermissaoUsuario1720000001084 } from '../../../infraestrutura/banco-dados/migracoes/1720000001084-ConcessoesPermissaoUsuario';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { ConcessaoPermissaoUsuarioOrm } from '../infraestrutura/concessao-permissao-usuario.orm';
import type { UsuarioAutenticado, PapelUsuario } from '../dominio/usuario-autenticado';
import { revogarConcessoesPorAlteracaoAcesso, ServicoConcessoesPermissao } from './servico-concessoes-permissao';

const suite = process.env.RLS_TESTCONTAINERS === 'true' ? describe : describe.skip;
suite('Auth-2 serviço real com PostgreSQL15 descartável e runtime RLS', () => {
  let container: StartedTestContainer, owner: Client, ds: DataSource, executor: ExecutorTenant, s: ServicoConcessoesPermissao;
  const tenant = randomUUID(), outroTenant = randomUUID();
  async function usuario(papel: PapelUsuario = 'Professional', t=tenant): Promise<UsuarioAutenticado> {
    const id=randomUUID(); await owner.query('insert into usuarios(id,tenant_id,role) values($1,$2,$3)',[id,t,papel]);
    return {tenantId:t,usuarioId:id,papel,emailHash:'',permissoes:['console.acessar','restricoes.confirmar']};
  }
  const dados=(u:UsuarioAutenticado)=>({usuarioId:u.usuarioId,permissao:'restricoes.confirmar' as const,motivo:'habilitacao_administrativa' as const,confirmacaoDoisPassos:true});
  const linhas=async(id:string)=>(await owner.query('select * from concessoes_permissao_usuario where usuario_id=$1',[id])).rows;
  beforeAll(async()=>{
    container=await new GenericContainer('postgres:15-alpine').withTmpFs({'/var/lib/postgresql/data':'rw,noexec,nosuid,size=128m'})
      .withEnvironment({POSTGRES_USER:'owner',POSTGRES_PASSWORD:'owner-synthetic',POSTGRES_DB:'auth2_concessoes_test'})
      .withExposedPorts(5432).withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i,2)).start();
    const conn={host:container.getHost(),port:container.getMappedPort(5432),database:'auth2_concessoes_test'};
    owner=new Client({...conn,user:'owner',password:'owner-synthetic'}); await owner.connect();
    await owner.query(`create table tenants(id uuid primary key);
      create table usuarios(id uuid primary key,tenant_id uuid not null references tenants(id),role varchar(32) not null,ativo boolean not null default true,atualizado_em timestamptz default now(),unique(tenant_id,id));
      create table user_action_logs(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,usuario_id uuid,acao varchar(120),recurso_tipo varchar(120),recurso_id uuid,ip inet,user_agent text,metadados jsonb default '{}',criado_em timestamptz default now());`);
    await owner.query('insert into tenants values($1),($2)',[tenant,outroTenant]);
    const m=new DataSource({type:'postgres',...conn,username:'owner',password:'owner-synthetic',entities:[],synchronize:false,logging:false});await m.initialize();const q=m.createQueryRunner();
    try{await new ConcessoesPermissaoUsuario1720000001084().up(q);}finally{await q.release();await m.destroy();}
    await owner.query(`alter table usuarios enable row level security;alter table usuarios force row level security;
      create policy usuarios_tenant on usuarios using(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) with check(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
      alter table user_action_logs enable row level security;alter table user_action_logs force row level security;
      create policy logs_tenant on user_action_logs using(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) with check(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
      create role auth2_runtime login password 'runtime-synthetic' nosuperuser nocreatedb nocreaterole nobypassrls;
      grant connect on database auth2_concessoes_test to auth2_runtime;grant usage on schema public to auth2_runtime;
      grant select,insert,update on all tables in schema public to auth2_runtime;`);
    ds=new DataSource({type:'postgres',...conn,username:'auth2_runtime',password:'runtime-synthetic',entities:[UsuarioOrm,ConcessaoPermissaoUsuarioOrm,UserActionLogOrm],synchronize:false,logging:false,extra:{max:6}});
    await ds.initialize();executor=new ExecutorTenant(ds);s=new ServicoConcessoesPermissao(executor);
  },90000);
  afterAll(async()=>{if(ds?.isInitialized)await ds.destroy();await owner?.end();await container?.stop();},30000);

  it('JWT com claim clínica não supre ausência da concessão no banco',async()=>{
    const u=await usuario();await expect(s.exigir(tenant,u.usuarioId,'restricoes.confirmar')).rejects.toMatchObject({status:403});
  });
  it.each(['Professional','SuperAdmin'] as const)('%s pode conceder a Professional; autônomo pode habilitar a si mesmo',async papel=>{
    const ator=await usuario(papel),alvo=papel==='Professional'?ator:await usuario();
    const r:any=await s.conceder(ator,dados(alvo));expect(r).toMatchObject({usuarioId:alvo.usuarioId,permissao:'restricoes.confirmar',revogadaEm:null});
    expect(Object.keys(r).sort()).toEqual(['concedidaEm','id','permissao','revogadaEm','usuarioId']);
    await expect(s.exigir(tenant,alvo.usuarioId,'restricoes.confirmar')).resolves.toBeUndefined();
    const audit=(await owner.query('select metadados from user_action_logs where recurso_id=$1',[r.id])).rows;expect(audit).toEqual([{metadados:{}}]);
  });
  it.each(['Collaborator','Patient','Client','SuperAdmin'] as const)('alvo %s nunca recebe concessão clínica',async papel=>{
    const ator=await usuario(),alvo=await usuario(papel);await expect(s.conceder(ator,dados(alvo))).rejects.toMatchObject({status:403});expect(await linhas(alvo.usuarioId)).toEqual([]);
  });
  it.each(['Collaborator','Patient','Client'] as const)('ator %s não pode administrar nem forjando papel no JWT',async papel=>{
    const ator=await usuario(papel),alvo=await usuario();
    for(const u of [ator,{...ator,papel:'Professional' as const}]) {
      await expect(s.conceder(u,dados(alvo))).rejects.toMatchObject({status:403});
      await expect(s.listar(u,alvo.usuarioId)).rejects.toMatchObject({status:403});
    }
  });
  it('outro tenant/usuário, papel não elegível ou desativado falham fechado sem eco',async()=>{
    const ator=await usuario(),alvo=await usuario(),b=await usuario('Professional',outroTenant);await s.conceder(ator,dados(alvo));
    for(const [t,id] of [[outroTenant,alvo.usuarioId],[tenant,b.usuarioId],[tenant,ator.usuarioId]]) await expect(s.exigir(t,id,'restricoes.confirmar')).rejects.toMatchObject({status:403});
    await expect(s.conceder(ator,dados(b))).rejects.toMatchObject({status:403});
    await owner.query('update usuarios set ativo=false where id=$1',[alvo.usuarioId]);
    await expect(s.exigir(tenant,alvo.usuarioId,'restricoes.confirmar')).rejects.toMatchObject({status:403});
  });
  it('SuperAdmin não recebe acesso clínico mesmo com linha forjada pelo administrador do banco',async()=>{
    const u=await usuario('SuperAdmin');await owner.query("insert into concessoes_permissao_usuario(tenant_id,usuario_id,permissao,concedida_por,motivo) values($1,$2,'restricoes.confirmar',$2,'Sintético')",[tenant,u.usuarioId]);
    await expect(s.exigir(tenant,u.usuarioId,'restricoes.confirmar')).rejects.toMatchObject({status:403});
  });
  it('revogação vale imediatamente com o mesmo JWT; histórico permanece e replay não repete auditoria',async()=>{
    const u=await usuario(),r:any=await s.conceder(u,dados(u));
    await s.revogar(u,r.id,{confirmacaoDoisPassos:true});await s.revogar(u,r.id,{confirmacaoDoisPassos:true});
    await expect(s.exigir(tenant,u.usuarioId,'restricoes.confirmar')).rejects.toMatchObject({status:403});
    const h:any=await s.listar(u,u.usuarioId);expect(h.itens).toHaveLength(1);expect(h.itens[0].revogadaEm).not.toBeNull();
    expect((await owner.query('select count(*)::int n from user_action_logs where recurso_id=$1',[r.id])).rows[0].n).toBe(2);
  });
  it('exigir participa da transação fornecida sem abrir executor aninhado',async()=>{
    const u=await usuario();await s.conceder(u,dados(u));const spy=jest.spyOn(executor,'executar');spy.mockClear();
    try{await executor.executar(tenant,g=>s.exigir(tenant,u.usuarioId,'restricoes.confirmar',g));expect(spy).toHaveBeenCalledTimes(1);}finally{spy.mockRestore();}
  });
  it('confirmação ausente/falsa, permissão arbitrária e payload extra são recusados antes de gravar',async()=>{
    const u=await usuario();
    for(const d of [{...dados(u),confirmacaoDoisPassos:false},{...dados(u),confirmacaoDoisPassos:'true'},{...dados(u),tenantId:outroTenant},{...dados(u),permissao:'pacientes.gerenciar'},{...dados(u),motivo:'CANARIO_CLINICO'}]) {
      await expect(s.conceder(u,d as never)).rejects.toMatchObject({status:400});
    }
    expect(await linhas(u.usuarioId)).toEqual([]);
  });
  it('runtime não é owner, superuser ou BYPASSRLS; contexto ausente e outro tenant não leem a concessão',async()=>{
    const u=await usuario();await s.conceder(u,dados(u));
    const [role]=await ds.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user');
    expect(role).toEqual({rolsuper:false,rolbypassrls:false});
    expect(await ds.query('select id from concessoes_permissao_usuario')).toEqual([]);
    expect(await executor.executar(outroTenant,g=>g.query('select id from concessoes_permissao_usuario where usuario_id=$1',[u.usuarioId]))).toEqual([]);
  });
  it('concessões simultâneas produzem uma linha e uma auditoria, sem retry cego',async()=>{
    const ator=await usuario(),alvo=await usuario();
    const resultados=await Promise.allSettled([s.conceder(ator,dados(alvo)),s.conceder(ator,dados(alvo))]);
    expect(resultados.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(resultados.find(r=>r.status==='rejected')).toMatchObject({reason:{status:409}});
    const rows=await linhas(alvo.usuarioId);expect(rows).toHaveLength(1);
    expect((await owner.query('select count(*)::int n from user_action_logs where recurso_id=$1',[rows[0].id])).rows[0].n).toBe(1);
  });
  it('operações recíprocas usam ordem compatível de locks',async()=>{
    const a=await usuario(),b=await usuario();
    const rs=await Promise.allSettled([s.conceder(a,dados(b)),s.conceder(b,dados(a))]);
    expect(rs.map(r=>r.status)).toEqual(['fulfilled','fulfilled']);
  });
  it('JWT antigo não administra após desativação ou mudança de papel; revogação cross-tenant não expõe recurso',async()=>{
    const a=await usuario(),alvo=await usuario(),b=await usuario('Professional',outroTenant);
    const r=await s.conceder(a,dados(alvo));
    await expect(s.revogar(b,r.id,{confirmacaoDoisPassos:true})).rejects.toMatchObject({status:403,message:'Operação não autorizada.'});
    await owner.query("update usuarios set role='Collaborator' where id=$1",[a.usuarioId]);
    await expect(s.listar(a,alvo.usuarioId)).rejects.toMatchObject({status:403});
    await owner.query("update usuarios set role='Professional',ativo=false where id=$1",[a.usuarioId]);
    await expect(s.revogar(a,r.id,{confirmacaoDoisPassos:true})).rejects.toMatchObject({status:403});
    expect((await linhas(alvo.usuarioId))[0].revogada_em).toBeNull();
  });
  it('nova concessão é independente; replay da revogação antiga não a revoga; paginação é limitada',async()=>{
    const u=await usuario(),a=await s.conceder(u,dados(u));await s.revogar(u,a.id,{confirmacaoDoisPassos:true});
    const b=await s.conceder(u,dados(u));await s.revogar(u,a.id,{confirmacaoDoisPassos:true});
    await expect(s.exigir(tenant,u.usuarioId,'restricoes.confirmar')).resolves.toBeUndefined();
    const h=await s.listar(u,u.usuarioId,1,1),h2=await s.listar(u,u.usuarioId,2,1);
    expect(h).toMatchObject({total:2,pagina:1,limite:1,itens:[{id:b.id}]});expect(h2.itens[0].id).toBe(a.id);
    for(const [p,l] of [[0,1],[1,51],[1,0],[1001,1],[1.5,1]])await expect(s.listar(u,u.usuarioId,p,l)).rejects.toMatchObject({status:400});
    await expect(s.exigir(tenant,u.usuarioId,'restricoes.confirmar',ds.manager)).rejects.toMatchObject({status:403});
  });
  it('revogação concorrente aguarda a ação protegida na mesma transação',async()=>{
    const u=await usuario(),r=await s.conceder(u,dados(u));
    let liberar!:()=>void,pronto!:()=>void;const pausa=new Promise<void>(r=>{liberar=r;});const inicio=new Promise<void>(r=>{pronto=r;});
    const acao=executor.executar(tenant,async g=>{await s.exigir(tenant,u.usuarioId,'restricoes.confirmar',g);pronto();await pausa;});
    await inicio;const revogacao=s.revogar(u,r.id,{confirmacaoDoisPassos:true});
    try{
      let bloqueada=false;
      for(let i=0;i<100;i++){
        const rs=await owner.query("select 1 from pg_stat_activity where usename='auth2_runtime' and wait_event_type='Lock'");
        if(rs.rowCount){bloqueada=true;break;}await new Promise(r=>setTimeout(r,20));
      }
      expect(bloqueada).toBe(true);expect((await linhas(u.usuarioId))[0].revogada_em).toBeNull();
    }finally{liberar();await acao;await revogacao;}
    await expect(s.exigir(tenant,u.usuarioId,'restricoes.confirmar')).rejects.toMatchObject({status:403});
  });
  it('cascata persiste usuário, revogação e auditoria atomicamente, preservando outros usuários e o histórico',async()=>{
    const ator=await usuario('Client'),u=await usuario(),outro=await usuario();
    await s.conceder(u,dados(u));await s.conceder(outro,dados(outro));
    const alterar=async(g:import('typeorm').EntityManager)=>{
      await g.getRepository(UsuarioOrm).update({tenantId:tenant,id:u.usuarioId},{ativo:false});
      await revogarConcessoesPorAlteracaoAcesso(g,tenant,u.usuarioId,ator.usuarioId);
    };
    await expect(executor.executar(tenant,async g=>{await alterar(g);throw new Error('Falha sintética posterior');})).rejects.toThrow('Falha sintética posterior');
    expect((await linhas(u.usuarioId))[0].revogada_em).toBeNull();
    expect((await owner.query('select ativo from usuarios where id=$1',[u.usuarioId])).rows[0].ativo).toBe(true);
    expect((await owner.query("select id from user_action_logs where acao='permissoes_usuario.revogar_por_alteracao_acesso' and recurso_id=$1",[(await linhas(u.usuarioId))[0].id])).rows).toHaveLength(0);
    await executor.executar(tenant,alterar);await executor.executar(tenant,alterar);
    expect((await linhas(u.usuarioId))[0]).toMatchObject({revogada_por:ator.usuarioId,usuario_id:u.usuarioId});
    expect((await linhas(u.usuarioId))[0].revogada_em).not.toBeNull();expect((await linhas(outro.usuarioId))[0].revogada_em).toBeNull();
    await expect(s.conceder(outro,dados(u))).rejects.toMatchObject({status:403});
    await owner.query('update usuarios set ativo=true where id=$1',[u.usuarioId]);
    await expect(s.exigir(tenant,u.usuarioId,'restricoes.confirmar')).rejects.toMatchObject({status:403});
    expect((await owner.query("select metadados from user_action_logs where acao='permissoes_usuario.revogar_por_alteracao_acesso' and recurso_id=$1",[(await linhas(u.usuarioId))[0].id])).rows).toEqual([{metadados:{}}]);
  });
  it('falha da auditoria faz rollback integral da concessão e da revogação',async()=>{
    const u=await usuario();await owner.query("alter table user_action_logs add constraint audit_fail check(acao <> 'permissoes_usuario.conceder') not valid");
    try{await expect(s.conceder(u,dados(u))).rejects.toThrow();expect(await linhas(u.usuarioId)).toEqual([]);}finally{await owner.query('alter table user_action_logs drop constraint audit_fail');}
    const r:any=await s.conceder(u,dados(u));await owner.query("alter table user_action_logs add constraint audit_fail check(acao <> 'permissoes_usuario.revogar') not valid");
    try{await expect(s.revogar(u,r.id,{confirmacaoDoisPassos:true})).rejects.toThrow();expect((await linhas(u.usuarioId))[0].revogada_em).toBeNull();}finally{await owner.query('alter table user_action_logs drop constraint audit_fail');}
  });
});

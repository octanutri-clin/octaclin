import { Test } from '@nestjs/testing';
import { ExecutionContext,UnauthorizedException } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { AddressInfo } from 'node:net';
import { GuardaJwt } from '../../../modulos/auth/apresentacao/guarda-jwt';
import { ServicoAuditoria } from '../../auditoria/servico-auditoria';
import { criarPipeValidacaoHttp } from '../../http/pipe-validacao-http';
import { middlewareAnalisesFactuais,middlewareLimiteAnalisesFactuais,middlewareErroAnalisesFactuais } from '../../http/middleware-analises-factuais';
import { ControladorRegistrosFactuais } from '../../../modulos/planos-alimentares/apresentacao/controlador-registros-factuais';
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { DataSource,type MigrationInterface } from 'typeorm';
import { GenericContainer,Wait,type StartedTestContainer } from 'testcontainers';
import { RegistrosAnalisesFactuais1720000001081 } from './1720000001081-RegistrosAnalisesFactuais';
import { RegistroAnaliseFactualOrm } from '../../../modulos/planos-alimentares/infraestrutura/registro-analise-factual.orm';
import { PlanoAlimentarOrm } from '../../../modulos/planos-alimentares/infraestrutura/plano-alimentar.orm';
import { PlanoAlimentarVersaoOrm } from '../../../modulos/planos-alimentares/infraestrutura/plano-alimentar-versao.orm';
import { PlanoAlimentarRefeicaoOrm } from '../../../modulos/planos-alimentares/infraestrutura/plano-alimentar-refeicao.orm';
import { PlanoAlimentarItemOrm } from '../../../modulos/planos-alimentares/infraestrutura/plano-alimentar-item.orm';
import { PacienteOrm } from '../../../modulos/pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../../modulos/profissionais/infraestrutura/profissional.orm';
import { UserActionLogOrm } from '../../auditoria/user-action-log.orm';
import { ExecutorTenant } from '../executor-tenant';
import { CriptografiaDadosSensiveis } from '../../seguranca/criptografia-dados-sensiveis';
import { ServicoRegistrosAnaliseFactual,type ComandoRegistroFactual,type ComandoRegistroDeVersaoFactual } from '../../../modulos/planos-alimentares/aplicacao/servico-registros-analise-factual';
import { criarSnapshotMicronutrientes } from '../../../modulos/planos-alimentares/dominio/micronutrientes';
import { construirAnaliseFactual,type EntradaConstrutorAnaliseFactual } from '../../../modulos/planos-alimentares/aplicacao/construtor-analise-factual';
import type { UsuarioAutenticado } from '../../../modulos/auth/dominio/usuario-autenticado';
const suite=process.env.FOOD06_REGISTRO_TESTCONTAINERS==='true'?describe:describe.skip;
suite('FOOD06 registro cifrado PostgreSQL15 descartável/RLS/runtime',()=>{
 let container:StartedTestContainer,owner:Client,ds:DataSource,s:ServicoRegistrosAnaliseFactual;
 const tenant=randomUUID(),otherTenant=randomUUID(),usuarioId=randomUUID(),p=randomUUID(),p2=randomUUID(),paciente=randomUUID(),outroPaciente=randomUUID(),plano=randomUUID(),versao=randomUUID();
 const u:UsuarioAutenticado={tenantId:tenant,usuarioId,papel:'Professional',emailHash:'sintetico',permissoes:['planos_alimentares.ler','planos_alimentares.gerenciar']};
 const crypto=new CriptografiaDadosSensiveis();
 function dados():EntradaConstrutorAnaliseFactual {return {escopo:{tenantId:tenant,pacienteId:paciente},origem:{planoId:plano,versaoId:versao,numero:1,status:'publicada',registradaEm:'2026-11-03T12:00:00.000Z'},ativo:true,selecionado:true,refeicoes:[{identidadeId:randomUUID(),ativa:true,selecionada:true,itens:[{porcaoGramas:100,snapshot:{origem:'manual',descricao:'CANARIO_PRIVADO',nutrientesPor100g:{energiaKcal:100},nutrientesPorcao:{energiaKcal:100}}}]}]};}
 const comando=(key=randomUUID()):ComandoRegistroFactual=>({chaveIdempotencia:key,origem:{planoId:plano,versaoId:versao,numero:1,status:'publicada'}});
 async function fonte(status:'publicada'|'rascunho'='publicada'){
  const planoId=randomUUID(),versaoId=randomUUID(),refeicaoId=randomUUID(),identidade=randomUUID(),itemId=randomUUID();
  const documento={schemaVersao:1,refeicoes:[{chaveCliente:refeicaoId,nome:'PRIVADO_EDITOR',itens:[{chaveCliente:itemId,descricao:'PRIVADO_ALIMENTO',quantidade:100,unidade:'g',porcaoGramas:100,nutrientesPor100g:{energiaKcal:100}}]}]};
  await owner.query('insert into planos_alimentares values($1,$2,$3,$4,true,0,null)',[planoId,tenant,paciente,p]);
  await owner.query('insert into plano_alimentar_versoes values($1,$2,$3,1,$4,null,1,1,true,$5,$6)',[versaoId,tenant,planoId,status==='publicada'?'2026-11-03T12:00:00.000Z':null,crypto.criptografar(JSON.stringify(documento)),'2026-11-01T12:00:00.000Z']);
  await owner.query('insert into plano_alimentar_refeicoes values($1,$2,$3,0)',[refeicaoId,tenant,versaoId]);
  await owner.query('insert into plano_alimentar_refeicao_estados values($1,$2,$3,true)',[identidade,tenant,planoId]);
  await owner.query('insert into plano_alimentar_refeicao_vinculos values($1,$2,$3,$4,$5)',[tenant,planoId,versaoId,refeicaoId,identidade]);
  await owner.query('insert into plano_alimentar_itens values($1,$2,$3,0,100,$4)',[itemId,tenant,refeicaoId,crypto.criptografar(JSON.stringify({origem:'manual',nutrientesPor100g:{energiaKcal:100},nutrientesPorcao:{energiaKcal:100}}))]);
  const c:ComandoRegistroDeVersaoFactual={registro:{chaveIdempotencia:randomUUID(),origem:{planoId,versaoId,numero:1,status,...(status==='rascunho'?{rascunhoRevisao:1}:{})}},selecao:{ativacaoRevisaoEsperada:0,identidadesRefeicoes:[identidade]}};
  return {planoId,versaoId,refeicaoId,identidade,itemId,c};
 }
 beforeAll(async()=>{
  container=await new GenericContainer('postgres:15-alpine').withTmpFs({'/var/lib/postgresql/data':'rw,noexec,nosuid,size=256m'}).withEnvironment({POSTGRES_USER:'owner',POSTGRES_PASSWORD:'owner-test',POSTGRES_DB:'food06_registry_test'}).withExposedPorts(5432).withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i,2)).withStartupTimeout(60000).start();
  const conn={host:container.getHost(),port:container.getMappedPort(5432),database:'food06_registry_test'};
  owner=new Client({...conn,user:'owner',password:'owner-test'});await owner.connect();
  await owner.query(`create table tenants(id uuid primary key);
   create table usuarios(id uuid primary key,tenant_id uuid not null references tenants(id),unique(tenant_id,id));
   create table profissionais(id uuid primary key,tenant_id uuid not null references tenants(id),usuario_id uuid not null,nome_criptografado bytea not null,registro_profissional varchar(80),especialidade varchar(120),arquivado_em timestamptz,criado_em timestamptz default now(),atualizado_em timestamptz default now(),unique(tenant_id,id));
   create table pacientes(id uuid primary key,tenant_id uuid not null,profissional_responsavel_id uuid not null,arquivado_em timestamptz,unique(tenant_id,id));
   create table planos_alimentares(id uuid primary key,tenant_id uuid not null,paciente_id uuid not null,profissional_id uuid not null,ativo_para_paciente boolean not null,ativacao_revisao integer not null,arquivado_em timestamptz);
   create table plano_alimentar_versoes(id uuid primary key,tenant_id uuid not null,plano_id uuid not null,numero integer not null,publicada_em timestamptz,descartada_em timestamptz,rascunho_revisao integer not null,edicao_materializada_revisao integer,edicao_protegida boolean not null,edicao_snapshot_criptografado bytea,criado_em timestamptz not null);
   create table plano_alimentar_refeicoes(id uuid primary key,tenant_id uuid not null,versao_id uuid not null,ordem integer not null);
   create table plano_alimentar_itens(id uuid primary key,tenant_id uuid not null,refeicao_id uuid not null,ordem integer not null,porcao_gramas numeric(12,3) not null,composicao_snapshot_criptografada bytea not null);
   create table plano_alimentar_refeicao_estados(id uuid primary key,tenant_id uuid not null,plano_id uuid not null,ativa boolean not null);
   create table plano_alimentar_refeicao_vinculos(tenant_id uuid not null,plano_id uuid not null,versao_id uuid not null,refeicao_id uuid not null,identidade_id uuid not null);
   create table user_action_logs(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,usuario_id uuid,acao varchar(120) not null,recurso_tipo varchar(120),recurso_id uuid,ip inet,user_agent text,metadados jsonb default '{}',criado_em timestamptz default now());`);
  for(const tabela of ['profissionais','pacientes','planos_alimentares','plano_alimentar_versoes','plano_alimentar_refeicoes','plano_alimentar_itens','plano_alimentar_refeicao_estados','plano_alimentar_refeicao_vinculos'])await owner.query(`alter table ${tabela} enable row level security;alter table ${tabela} force row level security;create policy tenant_fixture on ${tabela} using(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) with check(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)`);
  await owner.query('insert into tenants values($1),($2)',[tenant,otherTenant]);
  await owner.query('insert into usuarios values($1,$2)',[usuarioId,tenant]);
  for(const id of [p,p2])await owner.query("insert into profissionais(id,tenant_id,usuario_id,nome_criptografado) values($1,$2,$3,decode('00','hex'))",[id,tenant,id===p?usuarioId:randomUUID()]);
  await owner.query('insert into pacientes values($1,$2,$3,null),($4,$2,$5,null)',[paciente,tenant,p,outroPaciente,p2]);
  const migrator=new DataSource({type:'postgres',...conn,username:'owner',password:'owner-test',entities:[],synchronize:false,logging:false});await migrator.initialize();const q=migrator.createQueryRunner();
  try{await new RegistrosAnalisesFactuais1720000001081().up(q);}finally{await q.release();await migrator.destroy();}
  await owner.query(`create role food06_runtime login password 'runtime-test' nosuperuser nocreatedb nocreaterole nobypassrls;
   grant connect on database food06_registry_test to food06_runtime;grant usage on schema public to food06_runtime;
   grant select,insert,update,delete on all tables in schema public to food06_runtime;`);
  ds=new DataSource({type:'postgres',...conn,username:'food06_runtime',password:'runtime-test',entities:[RegistroAnaliseFactualOrm,PacienteOrm,ProfissionalOrm,UserActionLogOrm,PlanoAlimentarOrm,PlanoAlimentarVersaoOrm,PlanoAlimentarRefeicaoOrm,PlanoAlimentarItemOrm],synchronize:false,logging:false,extra:{max:6}});await ds.initialize();
  s=new ServicoRegistrosAnaliseFactual(new ExecutorTenant(ds),crypto);
 },90000);
 afterAll(async()=>{if(ds?.isInitialized)await ds.destroy();await owner?.end();await container?.stop();},30000);
 it('grava de fato cifrado, vinculado ao registro, sem corpo clínico na projeção/auditoria',async()=>{
  const e=dados(),r=await s.registrar(tenant,paciente,u,comando(),async()=>e);
  const row=(await owner.query('select * from registros_analises_factuais where id=$1',[r.id])).rows[0];
  expect(row.paciente_id).toBe(paciente);expect(Buffer.isBuffer(row.conteudo_criptografado)).toBe(true);
  expect(row.conteudo_criptografado.toString()).not.toMatch(/CANARIO|nutrientes|energiaKcal/);expect(Object.keys(r).sort()).toEqual(['criadoEm','id']);
  const audit=(await owner.query('select metadados from user_action_logs where recurso_id=$1',[r.id])).rows;expect(audit).toEqual([{metadados:{}}]);
 });
 it('FORCE RLS e role não owner/bypass negam tenant ausente/incorreto e UPDATE/DELETE/TRUNCATE',async()=>{
  const role=(await ds.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user'))[0];expect(role).toEqual({rolsuper:false,rolbypassrls:false});
  const meta=(await owner.query("select relrowsecurity,relforcerowsecurity,pg_get_userbyid(relowner) dono from pg_class where relname='registros_analises_factuais'")).rows[0];expect(meta).toMatchObject({relrowsecurity:true,relforcerowsecurity:true});expect(meta.dono).not.toBe('food06_runtime');
  const r=await s.registrar(tenant,paciente,u,comando(),async()=>dados());expect(await ds.query('select id from registros_analises_factuais')).toEqual([]);
  const cipherAntes=(await owner.query('select conteudo_criptografado from registros_analises_factuais where id=$1',[r.id])).rows[0].conteudo_criptografado;
  const executor=new ExecutorTenant(ds);expect(await executor.executar(otherTenant,g=>g.query('select id from registros_analises_factuais'))).toEqual([]);
  await executor.executar(tenant,async g=>{await g.query('update registros_analises_factuais set conteudo_criptografado=$1 where id=$2',[Buffer.alloc(40),r.id]);await g.query('delete from registros_analises_factuais where id=$1',[r.id]);});
  expect((await owner.query('select conteudo_criptografado from registros_analises_factuais where id=$1',[r.id])).rows[0].conteudo_criptografado).toEqual(cipherAntes);
  await expect(executor.executar(tenant,g=>g.query('truncate registros_analises_factuais'))).rejects.toMatchObject({code:'42501'});
 });
 it('concorre mesma chave e conteúdo uma vez, preservando ID e uma auditoria',async()=>{
  const c=comando(),e=dados();const rows=await Promise.all(Array.from({length:4},()=>s.registrar(tenant,paciente,u,c,async()=>e)));
  expect(new Set(rows.map(r=>r.id)).size).toBe(1);expect((await owner.query('select id from registros_analises_factuais where chave_idempotencia=$1',[c.chaveIdempotencia])).rows).toHaveLength(1);
  expect((await owner.query('select id from user_action_logs where recurso_id=$1',[rows[0].id])).rows).toHaveLength(1);
  expect((await s.registrar(tenant,paciente,u,{...c,chaveIdempotencia:c.chaveIdempotencia.toUpperCase()},async()=>e)).id).toBe(rows[0].id);
 });
 it('replay com conteúdo/contexto ou paciente diferente falha sem sobrescrever original',async()=>{
  const c=comando(),e=dados(),r=await s.registrar(tenant,paciente,u,c,async()=>e);
  const alterado={...e,refeicoes:[{...e.refeicoes[0],itens:[{porcaoGramas:100,snapshot:{origem:'manual',nutrientesPor100g:{energiaKcal:120},nutrientesPorcao:{energiaKcal:120}}}]}]};await expect(s.registrar(tenant,paciente,u,c,async()=>alterado)).rejects.toMatchObject({status:409});
  await owner.query('update pacientes set profissional_responsavel_id=$1 where id=$2',[p,outroPaciente]);
  try{const outro=dados();outro.escopo.pacienteId=outroPaciente;await expect(s.registrar(tenant,outroPaciente,u,c,async()=>outro)).rejects.toMatchObject({status:409});}
  finally{await owner.query('update pacientes set profissional_responsavel_id=$1 where id=$2',[p2,outroPaciente]);}
  expect((await owner.query('select id from registros_analises_factuais where id=$1',[r.id])).rows).toHaveLength(1);
 });
 it('carteira/transferência/revogação são revalidadas antes de carregar ou listar',async()=>{
  const carregar=jest.fn(async()=>dados());await owner.query('update pacientes set profissional_responsavel_id=$1 where id=$2',[p2,paciente]);
  try{await expect(s.registrar(tenant,paciente,u,comando(),carregar)).rejects.toMatchObject({status:404});await expect(s.listar(tenant,paciente,u)).rejects.toMatchObject({status:404});await expect(s.historico(tenant,paciente,u)).rejects.toMatchObject({status:404});expect(carregar).not.toHaveBeenCalled();}
  finally{await owner.query('update pacientes set profissional_responsavel_id=$1 where id=$2',[p,paciente]);}
  await expect(s.registrar(otherTenant,paciente,u,comando(),carregar)).rejects.toMatchObject({status:403});
  for(const papel of ['SuperAdmin','Client','Collaborator','Patient'] as const)await expect(s.registrar(tenant,paciente,{...u,papel},comando(),carregar)).rejects.toMatchObject({status:403});
  await expect(s.registrar(tenant,paciente,{...u,permissoes:['planos_alimentares.ler']},comando(),carregar)).rejects.toMatchObject({status:403});
 });
 it('origem/revisão/escopo adulterados são rejeitados, sem persistir',async()=>{
  const e=dados();e.escopo.pacienteId=outroPaciente;await expect(s.registrar(tenant,paciente,u,comando(),async()=>e)).rejects.toMatchObject({status:409});
  const f=dados();f.origem.status='rascunho';f.origem.rascunhoRevisao=2;await expect(s.registrar(tenant,paciente,u,{...comando(),origem:{...comando().origem,status:'rascunho',rascunhoRevisao:1}},async()=>f)).rejects.toMatchObject({status:409});
 });
 it('falha da auditoria faz rollback de registro e permite repetir a mesma chave',async()=>{
  const c=comando(),e=dados();await owner.query("alter table user_action_logs add constraint falha_sintetica_audit check(acao <> 'analises_factuais.registrar') not valid");
  try{await expect(s.registrar(tenant,paciente,u,c,async()=>e)).rejects.toThrow();expect((await owner.query('select id from registros_analises_factuais where chave_idempotencia=$1',[c.chaveIdempotencia])).rows).toHaveLength(0);}
  finally{await owner.query('alter table user_action_logs drop constraint falha_sintetica_audit');}
  await expect(s.registrar(tenant,paciente,u,c,async()=>e)).resolves.toHaveProperty('id');
 });
 it('cipher trocado entre registros não vira ACK idempotente nem revela conteúdo',async()=>{
  const a=comando(),b=comando(),e=dados();const x=await s.registrar(tenant,paciente,u,a,async()=>e),y=await s.registrar(tenant,paciente,u,b,async()=>e);
  await owner.query('update registros_analises_factuais set conteudo_criptografado=(select conteudo_criptografado from registros_analises_factuais where id=$1) where id=$2',[y.id,x.id]);
  await expect(s.registrar(tenant,paciente,u,a,async()=>e)).rejects.toMatchObject({status:422});
 });
 it('RLS rejeita INSERT cross-tenant e FK composta não admite paciente de outra clínica',async()=>{
  const executor=new ExecutorTenant(ds);
  const sql="insert into registros_analises_factuais(tenant_id,paciente_id,profissional_id,usuario_id,chave_idempotencia,conteudo_criptografado) values($1,$2,$3,$4,$5,$6)";
  await expect(executor.executar(otherTenant,g=>g.query(sql,[tenant,paciente,p,usuarioId,randomUUID(),Buffer.alloc(40)]))).rejects.toMatchObject({code:'42501'});
  const outro=randomUUID();await owner.query('insert into pacientes values($1,$2,$3,null)',[outro,otherTenant,p2]);
  await expect(executor.executar(tenant,g=>g.query(sql,[tenant,outro,p,usuarioId,randomUUID(),Buffer.alloc(40)]))).rejects.toMatchObject({code:'23503'});
 });
 it('rejeita comandos malformados, campos extras e limites de paginação antes de carregar',async()=>{
  const carregar=jest.fn(async()=>dados());
  for(const c of [null,{...comando(),extra:true},{...comando(),chaveIdempotencia:'invalido'},{...comando(),origem:{...comando().origem,numero:0}},
   {...comando(),origem:{...comando().origem,status:'rascunho'}},{...comando(),origem:{...comando().origem,rascunhoRevisao:1}}])
   await expect(s.registrar(tenant,paciente,u,c as ComandoRegistroFactual,carregar)).rejects.toMatchObject({status:400});
  expect(carregar).not.toHaveBeenCalled();
  for(const [pagina,limite] of [[0,1],[1,0],[1,101],[10001,1],[1.5,1]])await expect(s.listar(tenant,paciente,u,pagina,limite)).rejects.toMatchObject({status:400});
  for(const limite of [0,11,1.5])await expect(s.historico(tenant,paciente,u,limite)).rejects.toMatchObject({status:400});
  await expect(s.historico(tenant,paciente,u,10,randomUUID())).rejects.toMatchObject({status:400});
  await expect(s.historico(tenant,paciente,u,10,randomUUID(),'2026-11-04')).rejects.toMatchObject({status:400});
 });
 it('arquivamento de paciente ou profissional bloqueia índice e escrita',async()=>{
  for(const tabela of ['pacientes','profissionais']){
   const id=tabela==='pacientes'?paciente:p;
   await owner.query(`update ${tabela} set arquivado_em=now() where id=$1`,[id]);
   try{await expect(s.listar(tenant,paciente,u)).rejects.toMatchObject({status:404});await expect(s.registrar(tenant,paciente,u,comando(),async()=>dados())).rejects.toMatchObject({status:404});}
   finally{await owner.query(`update ${tabela} set arquivado_em=null where id=$1`,[id]);}
  }
 });
 it('revogação concorrente do profissional é serializada antes de gravar',async()=>{
  const c=comando();await owner.query('begin');
  await owner.query('select id from profissionais where id=$1 for update',[p]);
  // Inicializa deliberadamente o snapshot estatístico ANTES do concorrente.
  await owner.query("select pid from pg_stat_activity where usename='food06_runtime'");
  const resultado=s.registrar(tenant,paciente,u,c,async()=>dados()).then(valor=>({valor,erro:undefined}),erro=>({valor:undefined,erro}));
  let aguardando=false;
  try{
   // Observa bloqueio real no banco; dormir por si só não é prova de concorrência.
   for(let i=0;i<60&&!aguardando;i++){
    // A transação owner mantém snapshot de estatísticas; renovar a observação
    // sem alterar o snapshot dos dados, o lock, o prazo ou os asserts.
    await owner.query('select pg_stat_clear_snapshot()');
    const linhas=(await owner.query("select pid from pg_stat_activity where usename='food06_runtime' and wait_event_type='Lock' and query ilike '%profissionais%'")).rows;
    aguardando=linhas.length>0;if(!aguardando)await new Promise(r=>setTimeout(r,50));
   }
   await owner.query('update profissionais set arquivado_em=now() where id=$1',[p]);await owner.query('commit');
   const r=await resultado;expect(aguardando).toBe(true);expect(r.erro).toMatchObject({status:404});
   expect((await owner.query('select id from registros_analises_factuais where chave_idempotencia=$1',[c.chaveIdempotencia])).rows).toHaveLength(0);
  }finally{await owner.query('rollback');await resultado;await owner.query('update profissionais set arquivado_em=null where id=$1',[p]);}
 });
 it('leitura e comparação autorizadas usam fatos cifrados sem regravar história',async()=>{
  const a=dados(),b=dados();b.origem={...b.origem,versaoId:randomUUID(),numero:2};b.refeicoes[0].itens[0].snapshot={origem:'manual',nutrientesPor100g:{energiaKcal:150},nutrientesPorcao:{energiaKcal:150}};
  const c=comando(),d={...comando(),origem:{...comando().origem,versaoId:b.origem.versaoId,numero:2}};
  const x=await s.registrar(tenant,paciente,u,c,async()=>a),y=await s.registrar(tenant,paciente,u,d,async()=>b);
  const antes=(await owner.query('select conteudo_criptografado from registros_analises_factuais where id=$1',[x.id])).rows[0].conteudo_criptografado;
  const lido=await s.ler(tenant,paciente,u,x.id);expect(lido.analise.calculo.nutrientes.energiaKcal.total).toBe(100);expect(Object.isFrozen(lido)).toBe(true);
  const comparacao=await s.comparar(tenant,paciente,u,x.id,y.id);expect(comparacao.comparacao.depois.calculo.nutrientes.energiaKcal.total).toBe(150);expect(comparacao.atribuicaoCausal).toBe('nao_estabelecida');
  expect(JSON.stringify(comparacao)).not.toMatch(/tenantId|pacienteId|conteudoHash|nascimento|CANARIO/);
  expect((await owner.query('select conteudo_criptografado from registros_analises_factuais where id=$1',[x.id])).rows[0].conteudo_criptografado).toEqual(antes);
 });
 it('revalida carteira e tenant antes de decifrar leitura ou comparação',async()=>{
  const x=await s.registrar(tenant,paciente,u,comando(),async()=>dados());const decifrar=jest.spyOn(crypto,'descriptografar');
  await owner.query('update pacientes set profissional_responsavel_id=$1 where id=$2',[p2,paciente]);
  try{await expect(s.ler(tenant,paciente,u,x.id)).rejects.toMatchObject({status:404});await expect(s.comparar(tenant,paciente,u,x.id,x.id)).rejects.toMatchObject({status:404});expect(decifrar).not.toHaveBeenCalled();}
  finally{decifrar.mockRestore();await owner.query('update pacientes set profissional_responsavel_id=$1 where id=$2',[p,paciente]);}
  await expect(s.ler(otherTenant,paciente,u,x.id)).rejects.toMatchObject({status:403});
  await expect(s.ler(tenant,paciente,{...u,papel:'SuperAdmin'},x.id)).rejects.toMatchObject({status:403});
  await expect(s.ler(tenant,paciente,{...u,permissoes:[]},x.id)).rejects.toMatchObject({status:403});
  await expect(s.ler(tenant,paciente,u,randomUUID())).rejects.toMatchObject({status:404});
 });
 it('nega registro de outro paciente antes de decifrar qualquer lado da comparação',async()=>{
  const a=await s.registrar(tenant,paciente,u,comando(),async()=>dados());
  await owner.query('update pacientes set profissional_responsavel_id=$1 where id=$2',[p,outroPaciente]);
  let b:{id:string};
  try{const e=dados();e.escopo.pacienteId=outroPaciente;b=await s.registrar(tenant,outroPaciente,u,comando(),async()=>e);}
  finally{await owner.query('update pacientes set profissional_responsavel_id=$1 where id=$2',[p2,outroPaciente]);}
  const decifrar=jest.spyOn(crypto,'descriptografar');
  try{await expect(s.comparar(tenant,paciente,u,a.id,b!.id)).rejects.toMatchObject({status:404});expect(decifrar).not.toHaveBeenCalled();}
  finally{decifrar.mockRestore();}
 });
 it('leitor recusa cipher inválido, binding trocado, schema desconhecido e corpo divergente sem alterar banco',async()=>{
  const e=dados(),a=await s.registrar(tenant,paciente,u,comando(),async()=>e),b=await s.registrar(tenant,paciente,u,comando(),async()=>e);
  const obter=async(id:string)=>(await owner.query('select conteudo_criptografado from registros_analises_factuais where id=$1',[id])).rows[0].conteudo_criptografado as Buffer;
  const original=await obter(a.id),envelope=JSON.parse(crypto.descriptografar(original));
  const schema={...envelope,conteudo:JSON.stringify({...JSON.parse(envelope.conteudo),motorVersao:'futuro'})};
  const escopo=JSON.parse(envelope.conteudo);escopo.versao.escopo.pacienteId=outroPaciente;
  for(const cipher of [Buffer.alloc(40),await obter(b.id),crypto.criptografar(JSON.stringify(schema)),crypto.criptografar(JSON.stringify({...envelope,conteudo:JSON.stringify(escopo)}))]){
   await owner.query('update registros_analises_factuais set conteudo_criptografado=$1 where id=$2',[cipher,a.id]);
   await expect(s.ler(tenant,paciente,u,a.id)).rejects.toMatchObject({status:422,message:'Registro indisponível para conferência.'});expect(await obter(a.id)).toEqual(cipher);
  }
 });
 it('preserva leitura histórica pelo novo responsável sem restaurar acesso do anterior',async()=>{
  const x=await s.registrar(tenant,paciente,u,comando(),async()=>dados());
  const novoId=(await owner.query('select usuario_id from profissionais where id=$1',[p2])).rows[0].usuario_id;
  await owner.query('insert into usuarios values($1,$2)',[novoId,tenant]);
  await owner.query('update pacientes set profissional_responsavel_id=$1 where id=$2',[p2,paciente]);
  try{
   await expect(s.ler(tenant,paciente,u,x.id)).rejects.toMatchObject({status:404});
   const historico=await s.ler(tenant,paciente,{...u,usuarioId:novoId},x.id);expect(historico.analise.calculo.nutrientes.energiaKcal.total).toBe(100);
  }finally{await owner.query('update pacientes set profissional_responsavel_id=$1 where id=$2',[p,paciente]);await owner.query('delete from usuarios where id=$1',[novoId]);}
  await expect(s.ler(otherTenant,paciente,{...u,tenantId:otherTenant},x.id)).rejects.toMatchObject({status:404});
 });
 it.each(['publicada','rascunho'] as const)('registra fonte DB exata %s com snapshots, sem catálogo vivo e replay estável',async status=>{
  const f=await fonte(status),r=await s.registrarVersao(tenant,paciente,u,f.c);
  const lido=await s.ler(tenant,paciente,u,r.id);
  expect(lido.versao.origem).toMatchObject({planoId:f.planoId,versaoId:f.versaoId,numero:1,status});expect(lido.analise.calculo.nutrientes.energiaKcal.total).toBe(100);
  expect(lido.contexto).toBeUndefined();expect(JSON.stringify(lido)).not.toMatch(/PRIVADO|descricao|nascimento/);
  expect((await s.registrarVersao(tenant,paciente,u,f.c)).id).toBe(r.id);
 });
 it('não usa última versão, número solto, revisão ou seleção divergentes',async()=>{
  const f=await fonte('rascunho');
  for(const origem of [{...f.c.registro.origem,versaoId:randomUUID()},{...f.c.registro.origem,numero:2},{...f.c.registro.origem,rascunhoRevisao:2},{...f.c.registro.origem,status:'publicada' as const,rascunhoRevisao:undefined}])
   await expect(s.registrarVersao(tenant,paciente,u,{...f.c,registro:{...f.c.registro,origem}})).rejects.toMatchObject({status:409});
  await expect(s.registrarVersao(tenant,paciente,u,{...f.c,selecao:{...f.c.selecao,ativacaoRevisaoEsperada:1}})).rejects.toMatchObject({status:409});
  await expect(s.registrarVersao(tenant,paciente,u,{...f.c,selecao:{...f.c.selecao,identidadesRefeicoes:[randomUUID()]}})).rejects.toMatchObject({status:409});
  expect((await owner.query('select id from registros_analises_factuais where chave_idempotencia=$1',[f.c.registro.chaveIdempotencia])).rows).toHaveLength(0);
 });
 it('não registra materialização obsoleta ou edição cifrada inválida como revisão atual',async()=>{
  const f=await fonte('rascunho');await owner.query('update plano_alimentar_versoes set edicao_materializada_revisao=0 where id=$1',[f.versaoId]);
  await expect(s.registrarVersao(tenant,paciente,u,f.c)).rejects.toMatchObject({status:409});
  await owner.query('update plano_alimentar_versoes set edicao_materializada_revisao=1,edicao_snapshot_criptografado=$1 where id=$2',[Buffer.alloc(40),f.versaoId]);
  await expect(s.registrarVersao(tenant,paciente,u,f.c)).rejects.toMatchObject({status:409});
 });
 it('estado OFF e seleção vazia preservam fatos excluídos sem abrir sua composição',async()=>{
  const f=await fonte();await owner.query('update plano_alimentar_itens set composicao_snapshot_criptografada=$1 where id=$2',[Buffer.alloc(40),f.itemId]);
  const r=await s.registrarVersao(tenant,paciente,u,{...f.c,selecao:{...f.c.selecao,identidadesRefeicoes:[]}});
  expect((await s.ler(tenant,paciente,u,r.id)).versao.estado.refeicoes[0].itens).toEqual([]);
  await owner.query('update planos_alimentares set ativo_para_paciente=false,ativacao_revisao=1 where id=$1',[f.planoId]);
  const off=await s.registrarVersao(tenant,paciente,u,{...f.c,registro:{...f.c.registro,chaveIdempotencia:randomUUID()},selecao:{...f.c.selecao,ativacaoRevisaoEsperada:1}});
  expect((await s.ler(tenant,paciente,u,off.id)).versao.estado.ativo).toBe(false);
 });
 it('não acessa plano de outro paciente/tenant, arquivado ou versão descartada',async()=>{
  const f=await fonte();await owner.query('update planos_alimentares set paciente_id=$1 where id=$2',[outroPaciente,f.planoId]);
  await expect(s.registrarVersao(tenant,paciente,u,f.c)).rejects.toMatchObject({status:404});
  await owner.query('update planos_alimentares set paciente_id=$1,arquivado_em=now() where id=$2',[paciente,f.planoId]);
  await expect(s.registrarVersao(tenant,paciente,u,f.c)).rejects.toMatchObject({status:404});
  await owner.query('update planos_alimentares set arquivado_em=null where id=$1',[f.planoId]);await owner.query('update plano_alimentar_versoes set descartada_em=now() where id=$1',[f.versaoId]);
  await expect(s.registrarVersao(tenant,paciente,u,f.c)).rejects.toMatchObject({status:409});
  await expect(s.registrarVersao(otherTenant,paciente,{...u,tenantId:otherTenant},f.c)).rejects.toMatchObject({status:404});
 });
 it('composição inválida ou vínculos ambíguos falham sem gravar análise parcial',async()=>{
  const f=await fonte();await owner.query('update plano_alimentar_itens set composicao_snapshot_criptografada=$1 where id=$2',[Buffer.alloc(40),f.itemId]);
  await expect(s.registrarVersao(tenant,paciente,u,f.c)).rejects.toMatchObject({status:422});
  await owner.query('delete from plano_alimentar_refeicao_vinculos where versao_id=$1',[f.versaoId]);
  await expect(s.registrarVersao(tenant,paciente,u,f.c)).rejects.toMatchObject({status:409});
  expect((await owner.query('select id from registros_analises_factuais where chave_idempotencia=$1',[f.c.registro.chaveIdempotencia])).rows).toHaveLength(0);
 });
 it.each(['revisao','ativacao','carteira'])('fonte serializa alteração concorrente de %s antes do registro',async caso=>{
  const f=await fonte('rascunho'),tabela=caso==='revisao'?'plano_alimentar_versoes':caso==='ativacao'?'planos_alimentares':'pacientes',id=caso==='revisao'?f.versaoId:caso==='ativacao'?f.planoId:paciente;
  await owner.query('begin');await owner.query(`select id from ${tabela} where id=$1 for update`,[id]);
  const pedido=s.registrarVersao(tenant,paciente,u,f.c).then(valor=>({valor,erro:undefined}),erro=>({valor:undefined,erro}));
  try{
   let aguardando=false;
   for(let i=0;i<60&&!aguardando;i++){
    await owner.query('select pg_stat_clear_snapshot()');
    aguardando=(await owner.query("select pid from pg_stat_activity where usename='food06_runtime' and wait_event_type='Lock' and query ilike $1",['%'+tabela+'%'])).rows.length>0;
    if(!aguardando)await new Promise(r=>setTimeout(r,50));
   }
   expect(aguardando).toBe(true);
   if(caso==='revisao')await owner.query('update plano_alimentar_versoes set rascunho_revisao=2 where id=$1',[id]);
   if(caso==='ativacao')await owner.query('update planos_alimentares set ativo_para_paciente=false,ativacao_revisao=1 where id=$1',[id]);
   if(caso==='carteira')await owner.query('update pacientes set profissional_responsavel_id=$1 where id=$2',[p2,id]);
   await owner.query('commit');const resultado=await pedido;expect(resultado.erro).toMatchObject({status:caso==='carteira'?404:409});
   expect((await owner.query('select id from registros_analises_factuais where chave_idempotencia=$1',[f.c.registro.chaveIdempotencia])).rows).toHaveLength(0);
   if(caso==='revisao'){
    await owner.query('update plano_alimentar_versoes set edicao_materializada_revisao=2 where id=$1',[id]);
    await expect(s.registrarVersao(tenant,paciente,u,{...f.c,registro:{...f.c.registro,origem:{...f.c.registro.origem,rascunhoRevisao:2}}})).resolves.toHaveProperty('id');
   }
  }finally{await owner.query('rollback');await pedido;if(caso==='carteira')await owner.query('update pacientes set profissional_responsavel_id=$1 where id=$2',[p,paciente]);}
 });
 it('fonte mantém idempotência concorrente e rollback da auditoria com a mesma revisão',async()=>{
  const f=await fonte();const respostas=await Promise.all(Array.from({length:4},()=>s.registrarVersao(tenant,paciente,u,f.c)));
  expect(new Set(respostas.map(r=>r.id)).size).toBe(1);expect((await owner.query('select id from user_action_logs where recurso_id=$1',[respostas[0].id])).rows).toHaveLength(1);
  const c={...f.c,registro:{...f.c.registro,chaveIdempotencia:randomUUID()}};
  await owner.query("alter table user_action_logs add constraint falha_fonte_audit check(acao <> 'analises_factuais.registrar') not valid");
  try{await expect(s.registrarVersao(tenant,paciente,u,c)).rejects.toThrow();expect((await owner.query('select id from registros_analises_factuais where chave_idempotencia=$1',[c.registro.chaveIdempotencia])).rows).toHaveLength(0);}
  finally{await owner.query('alter table user_action_logs drop constraint falha_fonte_audit');}
  await expect(s.registrarVersao(tenant,paciente,u,c)).resolves.toHaveProperty('id');
 });
 it('fonte rejeita payload manipulado, seleção esparsa ou duplicada e preserva leitura legado',async()=>{
  const f=await fonte('rascunho');
  const esparsa=Array(1) as string[];
  const casos=[null,{...f.c,totais:{}},{...f.c,selecao:{...f.c.selecao,extra:true}},{...f.c,selecao:{...f.c.selecao,ativacaoRevisaoEsperada:-1}},
   {...f.c,selecao:{...f.c.selecao,identidadesRefeicoes:esparsa}},{...f.c,selecao:{...f.c.selecao,identidadesRefeicoes:[f.identidade,f.identidade]}},{...f.c,selecao:{...f.c.selecao,identidadesRefeicoes:['invalida']}},
   {...f.c,selecao:{...f.c.selecao,identidadesRefeicoes:Array.from({length:51},()=>randomUUID())}}];
  for(const c of casos)await expect(s.registrarVersao(tenant,paciente,u,c as ComandoRegistroDeVersaoFactual)).rejects.toMatchObject({status:400});
  await owner.query('update plano_alimentar_versoes set edicao_snapshot_criptografado=null,edicao_protegida=false,edicao_materializada_revisao=null where id=$1',[f.versaoId]);
  await expect(s.registrarVersao(tenant,paciente,u,f.c)).resolves.toHaveProperty('id');
 });
 it('fonte de publicação anterior não troca pela versão mais recente nem soma alternativas',async()=>{
  const f=await fonte(),v2=randomUUID(),r2=randomUUID();
  await owner.query('update plano_alimentar_itens set composicao_snapshot_criptografada=$1 where id=$2',[crypto.criptografar(JSON.stringify({origem:'manual',nutrientesPor100g:{energiaKcal:100},nutrientesPorcao:{energiaKcal:100},substituicoes:[{nutrientesPorcao:{energiaKcal:777}}]})),f.itemId]);
  await owner.query('insert into plano_alimentar_versoes select $1,tenant_id,plano_id,2,$2,null,1,1,true,edicao_snapshot_criptografado,criado_em from plano_alimentar_versoes where id=$3',[v2,'2026-11-03T13:00:00.000Z',f.versaoId]);
  await owner.query('insert into plano_alimentar_refeicoes values($1,$2,$3,0)',[r2,tenant,v2]);
  await owner.query('insert into plano_alimentar_refeicao_vinculos values($1,$2,$3,$4,$5)',[tenant,f.planoId,v2,r2,f.identidade]);
  await owner.query('insert into plano_alimentar_itens values($1,$2,$3,0,100,$4)',[randomUUID(),tenant,r2,crypto.criptografar(JSON.stringify({origem:'manual',nutrientesPorcao:{energiaKcal:999},substituicoes:[{nutrientesPorcao:{energiaKcal:777}}]}))]);
  const r=await s.registrarVersao(tenant,paciente,u,f.c),lido=await s.ler(tenant,paciente,u,r.id);
  expect(lido.versao.origem.versaoId).toBe(f.versaoId);expect(lido.versao.origem.registradaEm).toBe('2026-11-03T12:00:00.000Z');expect(lido.analise.calculo.nutrientes.energiaKcal.total).toBe(100);
 });
 it('refeição OFF selecionada permanece excluída sem abrir composição inválida',async()=>{
  const f=await fonte();await owner.query('update plano_alimentar_refeicao_estados set ativa=false where id=$1',[f.identidade]);
  await owner.query('update planos_alimentares set ativacao_revisao=1 where id=$1',[f.planoId]);await owner.query('update plano_alimentar_itens set composicao_snapshot_criptografada=$1 where id=$2',[Buffer.alloc(40),f.itemId]);
  await expect(s.registrarVersao(tenant,paciente,u,f.c)).rejects.toMatchObject({status:409});
  const r=await s.registrarVersao(tenant,paciente,u,{...f.c,selecao:{...f.c.selecao,ativacaoRevisaoEsperada:1}}),lido=await s.ler(tenant,paciente,u,r.id);
  expect(lido.versao.estado.refeicoes[0]).toMatchObject({ativa:false,selecionada:true,itens:[]});
 });
 it('fonte mantém zero conhecido e composição incompleta sem total inventado',async()=>{
  const f=await fonte();await owner.query('update plano_alimentar_itens set composicao_snapshot_criptografada=$1 where id=$2',[crypto.criptografar(JSON.stringify({origem:'manual',nutrientesPor100g:{energiaKcal:0},nutrientesPorcao:{energiaKcal:0}})),f.itemId]);
  const r=await s.registrarVersao(tenant,paciente,u,f.c),lido=await s.ler(tenant,paciente,u,r.id);
  expect(lido.analise.calculo.nutrientes.energiaKcal.total).toBe(0);expect(lido.analise.cobertura.nutrientes.ferroMg.estado).toBe('DESCONHECIDO');expect(lido.referencias.estado).toBe('indisponivel');
 });
 it('recusa limite de refeições e itens antes de qualquer gravação',async()=>{
  const f=await fonte();await owner.query('insert into plano_alimentar_refeicoes select gen_random_uuid(),$1,$2,i from generate_series(1,50) i',[tenant,f.versaoId]);
  await expect(s.registrarVersao(tenant,paciente,u,f.c)).rejects.toMatchObject({status:422});
  const g=await fonte();await owner.query('insert into plano_alimentar_itens select gen_random_uuid(),$1,$2,i,100,$3 from generate_series(1,10000) i',[tenant,g.refeicaoId,crypto.criptografar('{}')]);
  await expect(s.registrarVersao(tenant,paciente,u,g.c)).rejects.toMatchObject({status:422});
  for(const chave of [f.c.registro.chaveIdempotencia,g.c.registro.chaveIdempotencia])expect((await owner.query('select id from registros_analises_factuais where chave_idempotencia=$1',[chave])).rows).toHaveLength(0);
 });
 it('não executa getters nem aceita propriedades extras na seleção',async()=>{
  const f=await fonte(),ids=[f.identidade],getter=jest.fn(()=>f.identidade);Object.defineProperty(ids,'0',{enumerable:true,get:getter});
  await expect(s.registrarVersao(tenant,paciente,u,{...f.c,selecao:{...f.c.selecao,identidadesRefeicoes:ids}})).rejects.toMatchObject({status:400});expect(getter).not.toHaveBeenCalled();
  const extra=[f.identidade];Object.defineProperty(extra,'extra',{value:'CANARIO'});
  await expect(s.registrarVersao(tenant,paciente,u,{...f.c,selecao:{...f.c.selecao,identidadesRefeicoes:extra}})).rejects.toMatchObject({status:400});
 });
 it('mesma chave não confirma outra revisão operacional após OFF→ON com fatos idênticos',async()=>{
  const f=await fonte();await s.registrarVersao(tenant,paciente,u,f.c);
  await owner.query('update planos_alimentares set ativo_para_paciente=false,ativacao_revisao=1 where id=$1',[f.planoId]);
  await owner.query('update planos_alimentares set ativo_para_paciente=true,ativacao_revisao=2 where id=$1',[f.planoId]);
  await expect(s.registrarVersao(tenant,paciente,u,f.c)).rejects.toMatchObject({status:409});
  await expect(s.registrarVersao(tenant,paciente,u,{...f.c,selecao:{...f.c.selecao,ativacaoRevisaoEsperada:2}})).rejects.toMatchObject({status:409});
 });
 it('envelope v2 preserva v1 e não permite retirar vínculo da confirmação para reutilizar chave',async()=>{
  const f=await fonte(),r=await s.registrarVersao(tenant,paciente,u,f.c);
  const row=(await owner.query('select conteudo_criptografado from registros_analises_factuais where id=$1',[r.id])).rows[0];
  const original=row.conteudo_criptografado as Buffer,envelope=JSON.parse(crypto.descriptografar(original));
  expect(envelope).toMatchObject({schemaVersao:2,tipo:'food06-registro-protegido-v2'});expect(JSON.parse(envelope.confirmacaoOrigem)).toMatchObject({ativacaoRevisao:0,identidades:[f.identidade]});
  const e=dados();e.origem={...f.c.registro.origem,registradaEm:'2026-11-03T12:00:00.000Z'};e.refeicoes[0].identidadeId=f.identidade;
  expect(construirAnaliseFactual(e)).toEqual(await s.ler(tenant,paciente,u,r.id));
  await expect(s.registrar(tenant,paciente,u,f.c.registro,async()=>e)).rejects.toMatchObject({status:409});
  for(const alterado of [{...envelope,schemaVersao:1,tipo:'food06-registro-protegido-v1'},{...envelope,confirmacaoOrigem:null},{...envelope,confirmacaoOrigem:''},{...envelope,extra:true}]){
   await owner.query('update registros_analises_factuais set conteudo_criptografado=$1 where id=$2',[crypto.criptografar(JSON.stringify(alterado)),r.id]);
   await expect(s.ler(tenant,paciente,u,r.id)).rejects.toMatchObject({status:422});
  }
  await owner.query('update registros_analises_factuais set conteudo_criptografado=$1 where id=$2',[original,r.id]);
  await expect(s.ler(tenant,paciente,u,r.id)).resolves.toHaveProperty('schemaVersao',1);
 });
 it('API real projeta registro cifrado em PostgreSQL e revoga cada leitura após transferência',async()=>{
  const f=await fonte();
  const module=await Test.createTestingModule({controllers:[ControladorRegistrosFactuais],providers:[{provide:ServicoRegistrosAnaliseFactual,useValue:s},{provide:ServicoAuditoria,useValue:{registrar:async()=>undefined}}]})
   .overrideGuard(GuardaJwt).useValue({canActivate(c:ExecutionContext){const r=c.switchToHttp().getRequest();if(r.headers['x-identidade-sintetica']!=='profissional')throw new UnauthorizedException();r.usuarioAutenticado=u;return true;}}).compile();
  const app=module.createNestApplication<NestExpressApplication>({rawBody:true});app.useLogger(false);app.use(middlewareAnalisesFactuais);app.useBodyParser('json',{limit:'100kb'});app.use(middlewareErroAnalisesFactuais,middlewareLimiteAnalisesFactuais);app.useGlobalPipes(criarPipeValidacaoHttp());await app.listen(0,'127.0.0.1');
  const url=`http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/pacientes/${paciente}/planos-alimentares/analises-factuais`;
  const chamar=(fim:string,body:unknown)=>fetch(url+fim,{method:'POST',headers:{'content-type':'application/json','x-identidade-sintetica':'profissional'},body:JSON.stringify(body)});
  try{
   const criado=await chamar('',f.c);expect(criado.status).toBe(200);const ack=await criado.json() as {registro:{id:string}};expect(ack.registro.id).toBeDefined();
   const consulta=await chamar('/consultar',{registroId:ack.registro.id});expect(consulta.status).toBe(200);const factual=await consulta.json() as any;expect(factual.analise.calculo.nutrientes.energiaKcal.total).toBe(100);
   expect(JSON.stringify(factual)).not.toMatch(/conteudoHash|conteudoCriptografado|confirmacaoOrigem|tenantId|pacienteId|PRIVADO/);expect(consulta.headers.get('cache-control')).toBe('private, no-store');
   const cmp=await chamar('/comparar',{antesId:ack.registro.id,depoisId:ack.registro.id});expect(cmp.status).toBe(200);expect((await cmp.json() as any).atribuicaoCausal).toBe('nao_estabelecida');
   await owner.query('update pacientes set profissional_responsavel_id=$1 where id=$2',[p2,paciente]);
   for(const [fim,body] of [['/consultar',{registroId:ack.registro.id}],['/comparar',{antesId:ack.registro.id,depoisId:ack.registro.id}],['/listar',{pagina:1,limite:25}],['/historico',{limite:10}],['',f.c]] as const){
    const negada=await chamar(fim,body);expect(negada.status).toBe(404);expect(negada.headers.get('cache-control')).toBe('private, no-store');
   }
  }finally{await owner.query('update pacientes set profissional_responsavel_id=$1 where id=$2',[p,paciente]);await app.close();}
 });
 it('histórico decifra apenas a página autorizada e projeta zero/ausência sem expor envelopes ou marcadores',async()=>{
  const e=dados();e.refeicoes[0].itens[0].snapshot={origem:'catalogo',alimentoComposicaoId:'alimento-sintetico',codigoOrigem:'A1',descricao:'CANARIO_HISTORICO',preparacao:'Cozido',
   fonte:{codigo:'TACO-v1',baseCodigo:'TACO',versao:'1',nome:'Fonte sintética',hashConteudo:'a'.repeat(64)},nutrientesPor100g:{energiaKcal:100},nutrientesPorcao:{energiaKcal:100},
   micronutrientes:criarSnapshotMicronutrientes({ferroMg:{estado:'conhecido',valor:0}},100,100)};
  const r=await s.registrar(tenant,paciente,u,comando(),async()=>e);expect((await s.ler(tenant,paciente,u,r.id)).analise.cobertura.nutrientes.ferroMg.total).toBe(0);const antes=(await owner.query('select conteudo_criptografado from registros_analises_factuais where id=$1',[r.id])).rows[0].conteudo_criptografado;
  const historico=await s.historico(tenant,paciente,u,10);expect(historico.itens.length).toBeGreaterThan(0);expect(historico.itens.some(x=>x.registro.id===r.id)).toBe(true);const ponto=historico.itens.find(x=>x.registro.id===r.id)!;expect(ponto.nutrientes.ferroMg).toMatchObject({estado:'COMPLETO',total:0});
  expect(ponto.referencias).toEqual({estado:'indisponivel',motivo:'referencias_nao_habilitadas'});
  expect(JSON.stringify(historico)).not.toMatch(/tenantId|pacienteId|conteudoCriptografado|hashConteudo|CANARIO_HISTORICO/);
  expect((await owner.query('select conteudo_criptografado from registros_analises_factuais where id=$1',[r.id])).rows[0].conteudo_criptografado).toEqual(antes);
 });
 it('cursor histórico permanece estável quando uma análise mais nova entra entre páginas, inclusive timestamp de microssegundos',async()=>{
  const pacienteHistorico=randomUUID();await owner.query('insert into pacientes values($1,$2,$3,null)',[pacienteHistorico,tenant,p]);
  for(let i=0;i<11;i++){const e=dados();e.escopo.pacienteId=pacienteHistorico;await s.registrar(tenant,pacienteHistorico,u,comando(),async()=>e);}
  const primeira=await s.historico(tenant,pacienteHistorico,u,10);expect(primeira.itens).toHaveLength(10);expect(primeira.temMais).toBe(true);
  expect(primeira.proximoCursor?.criadoEm).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
  const e=dados();e.escopo.pacienteId=pacienteHistorico;const nova=await s.registrar(tenant,pacienteHistorico,u,comando(),async()=>e);
  const segunda=await s.historico(tenant,pacienteHistorico,u,10,primeira.proximoCursor!.id,primeira.proximoCursor!.criadoEm);
  expect(segunda.itens).toHaveLength(1);expect(segunda.temMais).toBe(false);
  expect(segunda.itens[0].registro.id).not.toBe(nova.id);
  expect(new Set([...primeira.itens,...segunda.itens].map(x=>x.registro.id)).size).toBe(11);
 });
 it('histórico compara base documentada com registro mais antigo sem expor hashes nem atribuir causa',async()=>{
  const pacienteHistorico=randomUUID();await owner.query('insert into pacientes values($1,$2,$3,null)',[pacienteHistorico,tenant,p]);
  for(const valor of [1,2]){
   const e=dados();e.escopo.pacienteId=pacienteHistorico;
   e.refeicoes[0].itens[0].snapshot={origem:'catalogo',alimentoComposicaoId:'alimento-sintetico',codigoOrigem:'A1',preparacao:'Cozido',
    fonte:{codigo:'TACO-v1',baseCodigo:'TACO',versao:'1',nome:'Fonte sintética',hashConteudo:'a'.repeat(64)},nutrientesPor100g:{energiaKcal:10},nutrientesPorcao:{energiaKcal:10},
    micronutrientes:criarSnapshotMicronutrientes({ferroMg:{estado:'conhecido',valor}},100,100)};
   await s.registrar(tenant,pacienteHistorico,u,comando(),async()=>e);
  }
  const historico=await s.historico(tenant,pacienteHistorico,u,10);
  expect(historico.itens.map(x=>x.comparacaoAnterior.composicaoFonte)).toEqual(['DIFERENTE','SEM_REGISTRO_ANTERIOR']);
  expect(historico.itens[0].comparacaoAnterior).toMatchObject({
   planejamento:'IGUAL',composicaoFonte:'DIFERENTE',referencia:'NAO_COMPARAVEL',contexto:'NAO_COMPARAVEL',
  });
  expect(historico.itens[0].comparacaoAnterior.cobertura.ferroMg).toBe('IGUAL');
  expect(JSON.stringify(historico)).not.toMatch(/conteudoHash|hashConteudo|tenantId|pacienteId/);
 });
 it('índice paginado permite somente metadados, respeitando limites e não abre cipher',async()=>{
  const r=await s.listar(tenant,paciente,u,1,2);expect(r.itens).toHaveLength(2);expect(r.total).toBeGreaterThan(2);
  expect(r.itens.every(x=>Object.keys(x).sort().join(',')==='criadoEm,id')).toBe(true);
  expect((await s.listar(tenant,paciente,u,2,2)).itens.map(x=>x.id)).not.toEqual(r.itens.map(x=>x.id));
 });
});

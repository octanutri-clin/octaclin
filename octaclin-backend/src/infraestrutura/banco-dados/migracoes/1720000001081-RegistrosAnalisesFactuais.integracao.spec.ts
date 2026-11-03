import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { DataSource,type MigrationInterface } from 'typeorm';
import { GenericContainer,Wait,type StartedTestContainer } from 'testcontainers';
import { RegistrosAnalisesFactuais1720000001081 } from './1720000001081-RegistrosAnalisesFactuais';
import { RegistroAnaliseFactualOrm } from '../../../modulos/planos-alimentares/infraestrutura/registro-analise-factual.orm';
import { PacienteOrm } from '../../../modulos/pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../../modulos/profissionais/infraestrutura/profissional.orm';
import { UserActionLogOrm } from '../../auditoria/user-action-log.orm';
import { ExecutorTenant } from '../executor-tenant';
import { CriptografiaDadosSensiveis } from '../../seguranca/criptografia-dados-sensiveis';
import { ServicoRegistrosAnaliseFactual,type ComandoRegistroFactual } from '../../../modulos/planos-alimentares/aplicacao/servico-registros-analise-factual';
import type { EntradaConstrutorAnaliseFactual } from '../../../modulos/planos-alimentares/aplicacao/construtor-analise-factual';
import type { UsuarioAutenticado } from '../../../modulos/auth/dominio/usuario-autenticado';
const suite=process.env.FOOD06_REGISTRO_TESTCONTAINERS==='true'?describe:describe.skip;
suite('FOOD06 registro cifrado PostgreSQL15 descartável/RLS/runtime',()=>{
 let container:StartedTestContainer,owner:Client,ds:DataSource,s:ServicoRegistrosAnaliseFactual;
 const tenant=randomUUID(),otherTenant=randomUUID(),usuarioId=randomUUID(),p=randomUUID(),p2=randomUUID(),paciente=randomUUID(),outroPaciente=randomUUID(),plano=randomUUID(),versao=randomUUID();
 const u:UsuarioAutenticado={tenantId:tenant,usuarioId,papel:'Professional',emailHash:'sintetico',permissoes:['planos_alimentares.ler','planos_alimentares.gerenciar']};
 const crypto=new CriptografiaDadosSensiveis();
 function dados():EntradaConstrutorAnaliseFactual {return {escopo:{tenantId:tenant,pacienteId:paciente},origem:{planoId:plano,versaoId:versao,numero:1,status:'publicada',registradaEm:'2026-11-03T12:00:00.000Z'},ativo:true,selecionado:true,refeicoes:[{identidadeId:randomUUID(),ativa:true,selecionada:true,itens:[{porcaoGramas:100,snapshot:{origem:'manual',descricao:'CANARIO_PRIVADO',nutrientesPor100g:{energiaKcal:100},nutrientesPorcao:{energiaKcal:100}}}]}]};}
 const comando=(key=randomUUID()):ComandoRegistroFactual=>({chaveIdempotencia:key,origem:{planoId:plano,versaoId:versao,numero:1,status:'publicada'}});
 beforeAll(async()=>{
  container=await new GenericContainer('postgres:15-alpine').withTmpFs({'/var/lib/postgresql/data':'rw,noexec,nosuid,size=256m'}).withEnvironment({POSTGRES_USER:'owner',POSTGRES_PASSWORD:'owner-test',POSTGRES_DB:'food06_registry_test'}).withExposedPorts(5432).withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i,2)).withStartupTimeout(60000).start();
  const conn={host:container.getHost(),port:container.getMappedPort(5432),database:'food06_registry_test'};
  owner=new Client({...conn,user:'owner',password:'owner-test'});await owner.connect();
  await owner.query(`create table tenants(id uuid primary key);
   create table usuarios(id uuid primary key,tenant_id uuid not null references tenants(id),unique(tenant_id,id));
   create table profissionais(id uuid primary key,tenant_id uuid not null references tenants(id),usuario_id uuid not null,nome_criptografado bytea not null,registro_profissional varchar(80),especialidade varchar(120),arquivado_em timestamptz,criado_em timestamptz default now(),atualizado_em timestamptz default now(),unique(tenant_id,id));
   create table pacientes(id uuid primary key,tenant_id uuid not null,profissional_responsavel_id uuid not null,arquivado_em timestamptz,unique(tenant_id,id));
   create table user_action_logs(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,usuario_id uuid,acao varchar(120) not null,recurso_tipo varchar(120),recurso_id uuid,ip inet,user_agent text,metadados jsonb default '{}',criado_em timestamptz default now());`);
  await owner.query('insert into tenants values($1),($2)',[tenant,otherTenant]);
  await owner.query('insert into usuarios values($1,$2)',[usuarioId,tenant]);
  for(const id of [p,p2])await owner.query("insert into profissionais(id,tenant_id,usuario_id,nome_criptografado) values($1,$2,$3,decode('00','hex'))",[id,tenant,id===p?usuarioId:randomUUID()]);
  await owner.query('insert into pacientes values($1,$2,$3,null),($4,$2,$5,null)',[paciente,tenant,p,outroPaciente,p2]);
  const migrator=new DataSource({type:'postgres',...conn,username:'owner',password:'owner-test',entities:[],synchronize:false,logging:false});await migrator.initialize();const q=migrator.createQueryRunner();
  try{await new RegistrosAnalisesFactuais1720000001081().up(q);}finally{await q.release();await migrator.destroy();}
  await owner.query(`create role food06_runtime login password 'runtime-test' nosuperuser nocreatedb nocreaterole nobypassrls;
   grant connect on database food06_registry_test to food06_runtime;grant usage on schema public to food06_runtime;
   grant select,insert,update,delete on all tables in schema public to food06_runtime;`);
  ds=new DataSource({type:'postgres',...conn,username:'food06_runtime',password:'runtime-test',entities:[RegistroAnaliseFactualOrm,PacienteOrm,ProfissionalOrm,UserActionLogOrm],synchronize:false,logging:false,extra:{max:6}});await ds.initialize();
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
  try{await expect(s.registrar(tenant,paciente,u,comando(),carregar)).rejects.toMatchObject({status:404});await expect(s.listar(tenant,paciente,u)).rejects.toMatchObject({status:404});expect(carregar).not.toHaveBeenCalled();}
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
 it('índice paginado permite somente metadados, respeitando limites e não abre cipher',async()=>{
  const r=await s.listar(tenant,paciente,u,1,2);expect(r.itens).toHaveLength(2);expect(r.total).toBeGreaterThan(2);
  expect(r.itens.every(x=>Object.keys(x).sort().join(',')==='criadoEm,id')).toBe(true);
  expect((await s.listar(tenant,paciente,u,2,2)).itens.map(x=>x.id)).not.toEqual(r.itens.map(x=>x.id));
 });
});

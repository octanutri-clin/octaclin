// Prova exclusivamente sintética em container criado e removido por este script.
// Não comprova as extensões nem a cadeia integral: o gate oficial permanece no CI.
if (!process.argv.includes('--descartavel')) {
  console.error('Use --descartavel para criar a fixture local; nenhum alvo externo é aceito.');
  process.exit(1);
}
const b=require('node:path').resolve(__dirname,'..');
process.env.TS_NODE_PROJECT=b+'/tsconfig.json';
process.env.TS_NODE_COMPILER_OPTIONS=JSON.stringify({rootDir:b+'/src'});
require(b+'/node_modules/ts-node/register/transpile-only');
require(b+'/node_modules/reflect-metadata');
const {GenericContainer,Wait}=require(b+'/node_modules/testcontainers');
const {DataSource}=require(b+'/node_modules/typeorm');
const {spawn}=require('node:child_process');
(async()=>{
 let container,ds,runner;
 try{
  container=await new GenericContainer('postgres:15-alpine').withTmpFs({'/var/lib/postgresql/data':'rw,noexec,nosuid,size=256m'}).withEnvironment({POSTGRES_USER:'octaclin',POSTGRES_PASSWORD:'fixture-owner',POSTGRES_DB:'food04_clinica'}).withExposedPorts(5432).withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i,2)).start();
  const host=container.getHost(),port=container.getMappedPort(5432);
  delete process.env.DATABASE_URL;
  Object.assign(process.env,{NODE_ENV:'test',BANCO_HOST:host,BANCO_PORTA:String(port),BANCO_USUARIO:'octaclin',BANCO_SENHA:'fixture-owner',BANCO_NOME:'food04_clinica',BANCO_SSL:'false',BANCO_EXECUTAR_MIGRACOES:'false'});
  const {criarOpcoesTypeOrm}=require(b+'/src/infraestrutura/banco-dados/opcoes-typeorm');
  const opcoes=criarOpcoesTypeOrm();
  ds=new DataSource({...opcoes,logging:false,migrationsRun:false});await ds.initialize();
  runner=ds.createQueryRunner();await runner.connect();await runner.startTransaction();
  const proxy=new Proxy(runner,{get(target,k){if(k==='query')return async(sql,...args)=>{
    if(typeof sql==='string'&&(/^create extension if not exists (vector|timescaledb)$/i.test(sql.trim())||/select create_hypertable\(/i.test(sql)))return [];
    return target.query(typeof sql==='string'?sql.replace(/embedding vector\(1536\)/g,'embedding text'):sql,...args);
  };const v=target[k];return typeof v==='function'?v.bind(target):v;}});
  for(const M of opcoes.migrations)await new M().up(proxy);
  await runner.commitTransaction();await runner.release();
  await ds.query("create role octaclin_rls_prova login password 'fixture-runtime' nosuperuser nocreatedb nocreaterole nobypassrls;grant connect on database food04_clinica to octaclin_rls_prova;grant usage on schema public to octaclin_rls_prova;grant select,insert,update,delete on all tables in schema public to octaclin_rls_prova;grant usage,select on all sequences in schema public to octaclin_rls_prova;");
  console.log('Fixture descartável preparada. Extensões vector/Timescale e hypertable omitidas; não valida cadeia integral.');
  const env={...process.env,RLS_TESTCONTAINERS:'false',RLS_PROVA_BANCO_HOST:host,RLS_PROVA_BANCO_PORTA:String(port),RLS_PROVA_BANCO_USUARIO:'octaclin_rls_prova',RLS_PROVA_BANCO_SENHA:'fixture-runtime',RLS_PROVA_BANCO_NOME:'food04_clinica'};
  const code=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[b+'/node_modules/jest/bin/jest.js','--runInBand','src/infraestrutura/banco-dados/rls-isolamento-tenant.integracao.spec.ts','-t','FOOD04'],{cwd:b,env,stdio:'inherit'});p.once('error',reject);p.once('exit',resolve);});
  process.exitCode=code??1;
 }catch(e){console.error(e.message);process.exitCode=1;}
 finally{if(runner&&!runner.isReleased){if(runner.isTransactionActive)await runner.rollbackTransaction().catch(()=>{});await runner.release().catch(()=>{});}if(ds?.isInitialized)await ds.destroy();if(container)await container.stop();}
})();

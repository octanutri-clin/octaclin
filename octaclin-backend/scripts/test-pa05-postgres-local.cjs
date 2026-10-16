// Focused PA04/PA05/PA06 regression on disposable PostgreSQL when Docker VFS cannot fit Timescale HA.
// This fixture does NOT validate pgvector or Timescale/hypertables; CI keeps the full gate.
require('ts-node').register({ project: require('node:path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true, compilerOptions: { rootDir: require('node:path').resolve(__dirname, '..'), ignoreDeprecations: '6.0' } });
const { GenericContainer, Wait } = require('testcontainers');
const { DataSource } = require('typeorm');
const { spawn } = require('node:child_process');
const { criarOpcoesTypeOrm } = require('../src/infraestrutura/banco-dados/opcoes-typeorm');

(async () => {
  let container, admin;
  const fixturePassword = 'pa05_senha_sintetica_descartavel';
  try {
    container = await new GenericContainer('postgres@sha256:f7d23353e1b15400d22ebe31189f4d314b87a4c129cc400c8c2d8d4ca127bf81')
      .withEnvironment({ POSTGRES_USER: 'pa05_owner', POSTGRES_PASSWORD: fixturePassword, POSTGRES_DB: 'octaclin_pa05_descartavel' })
      .withExposedPorts(5432).withTmpFs({ '/var/lib/postgresql/data': 'rw' })
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2)).start();
    const { entities, migrations: todasMigrations } = criarOpcoesTypeOrm();
    const provarAtivacao = process.argv.includes('--ativacao');
    const migrations = provarAtivacao ? todasMigrations.filter(m => m.name !== 'AtivacaoPlanos1720000001074') : todasMigrations;
    admin = new DataSource({ type: 'postgres', host: container.getHost(), port: container.getMappedPort(5432), username: 'pa05_owner', password: fixturePassword, database: 'octaclin_pa05_descartavel', entities, migrations, ssl: false, synchronize: false, migrationsRun: false, logging: false });
    await admin.initialize();
    const omissions = { vector: 0, timescale: 0, hypertable: 0, embedding: 0 };
    const createRunner = admin.createQueryRunner.bind(admin);
    admin.createQueryRunner = (...args) => {
      const runner = createRunner(...args), query = runner.query.bind(runner);
      runner.query = async (sql, ...params) => {
        if (sql.trim() === 'create extension if not exists vector') { omissions.vector++; return []; }
        if (sql.trim() === 'create extension if not exists timescaledb') { omissions.timescale++; return []; }
        if (sql.trim() === "select create_hypertable('metricas_temporais', 'registrado_em', if_not_exists => true)") { omissions.hypertable++; return []; }
        if (sql.includes('embedding vector(1536)')) { omissions.embedding++; sql = sql.replace('embedding vector(1536)', 'embedding double precision[]'); }
        return query(sql, ...params);
      };
      return runner;
    };
    await admin.runMigrations({ transaction: 'all' });
    if (Object.values(omissions).some(count => count !== 1)) throw new Error('A fixture de extensões mudou; reconfira o escopo da prova local.');
    admin.createQueryRunner = createRunner;
    if (provarAtivacao) await require('./prova-backfill-pa06.cjs')(admin);
    await admin.query(`create role pa05_runtime with login password 'pa05_runtime_sintetico' nosuperuser nocreatedb nocreaterole nobypassrls;
      grant connect on database octaclin_pa05_descartavel to pa05_runtime;
      grant usage on schema public to pa05_runtime;
      grant select,insert,update,delete on all tables in schema public to pa05_runtime;
      grant usage,select on all sequences in schema public to pa05_runtime;`);
    const env = { ...process.env };
    for (const name of Object.keys(env)) if (name === 'DATABASE_URL' || name.startsWith('BANCO_') || name.startsWith('RLS_PROVA_BANCO_') || name === 'RLS_TESTCONTAINERS') delete env[name];
    Object.assign(env, { RLS_PROVA_BANCO_HOST: container.getHost(), RLS_PROVA_BANCO_PORTA: String(container.getMappedPort(5432)), RLS_PROVA_BANCO_USUARIO: 'pa05_runtime', RLS_PROVA_BANCO_SENHA: 'pa05_runtime_sintetico', RLS_PROVA_BANCO_NOME: 'octaclin_pa05_descartavel' });
    if (process.argv.includes('--taco-micros')) {
      const assert = require('node:assert/strict');
      const ambienteCarga = { ...env, NODE_ENV:'test', BANCO_HOST:container.getHost(), BANCO_PORTA:String(container.getMappedPort(5432)), BANCO_USUARIO:'pa05_owner', BANCO_SENHA:fixturePassword, BANCO_NOME:'octaclin_pa05_descartavel', BANCO_SSL:'false', BANCO_EXECUTAR_MIGRACOES:'false', TACO_CONFIRMAR_CARGA:'true', TACO_BANCO_ESPERADO:'octaclin_pa05_descartavel', TACO_RESPONSAVEL_APROVACAO:'Fixture sintética descartável', TACO_REFERENCIA_DIREITO_USO:'Teste local de preservação/idempotência; sem aprovação operacional' };
      const carregar = modo => new Promise((resolve,reject) => {
        const filho = spawn('corepack',['pnpm','exec','ts-node','scripts/carregar-catalogo-taco.ts'],{cwd:require('node:path').resolve(__dirname,'..'),env:{...ambienteCarga,TACO_MODO:modo},stdio:'inherit'});
        filho.once('error',reject); filho.once('exit',codigo=>codigo===0?resolve():reject(new Error('Carga TACO descartável falhou.')));
      });
      await carregar('v1');
      const v1 = await admin.query("select f.id,f.hash_conteudo,count(a.id)::integer as quantidade from fontes_composicao_alimentos f join alimentos_composicao a on a.fonte_id=f.id where f.codigo='taco_nepa_unicamp' group by f.id,f.hash_conteudo");
      await carregar('v2-micros1'); await carregar('v2-micros1');
      const fontes = await admin.query("select f.id,f.versao,f.hash_conteudo,f.esquema_versao,count(a.id)::integer as quantidade from fontes_composicao_alimentos f join alimentos_composicao a on a.fonte_id=f.id where f.codigo='taco_nepa_unicamp' group by f.id");
      assert.equal(fontes.length,2);
      assert.equal(fontes.find(f=>f.id===v1[0].id).hash_conteudo,v1[0].hash_conteudo);
      assert(fontes.every(f=>f.quantidade===583));
      assert.equal(fontes.find(f=>f.versao.endsWith('v2-micros1')).esquema_versao,'octaclin-composicao-v2-micros1');
      const valor = await admin.query("select a.micronutrientes from alimentos_composicao a join fontes_composicao_alimentos f on f.id=a.fonte_id where f.versao='taco-4a-cmvcol-taco3-v2-micros1' and a.codigo_origem='1'");
      assert.equal(valor[0].micronutrientes.nutrientes.cobreMg.estado,'conhecido');
      console.log('PASS TACO v1/v2: 583 registros por fonte, V1 preservada e segundo load V2 idempotente; somente banco descartável.');
    }
    console.log('PA04–PA06: PostgreSQL 15 descartável, schema/RLS de planos reais. Timescale/pgvector: SKIPPED nesta fixture; gate integral permanece no CI.');
    const code = await new Promise((resolve, reject) => {
      const child = spawn('corepack', ['pnpm', 'exec', 'jest', '--runInBand', 'src/infraestrutura/banco-dados/rls-isolamento-tenant.integracao.spec.ts', '-t', process.argv.includes('--inventario') ? 'PA04|PA05|PA06|inventaria toda|sem app.tenant_id' : 'PA04|PA05|PA06'], { cwd: require('node:path').resolve(__dirname, '..'), env, stdio: 'inherit' });
      child.once('error', reject); child.once('exit', resolve);
    });
    process.exitCode = code ?? 1;
  } finally {
    if (admin?.isInitialized) await admin.destroy();
    if (container) await container.stop();
  }
})().catch(error => { console.error('A prova de planos descartável falhou:', error.message); process.exitCode = 1; });

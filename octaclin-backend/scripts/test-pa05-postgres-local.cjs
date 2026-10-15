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
    const { entities, migrations } = criarOpcoesTypeOrm();
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
    await admin.query(`create role pa05_runtime with login password 'pa05_runtime_sintetico' nosuperuser nocreatedb nocreaterole nobypassrls;
      grant connect on database octaclin_pa05_descartavel to pa05_runtime;
      grant usage on schema public to pa05_runtime;
      grant select,insert,update,delete on all tables in schema public to pa05_runtime;
      grant usage,select on all sequences in schema public to pa05_runtime;`);
    const env = { ...process.env };
    for (const name of Object.keys(env)) if (name === 'DATABASE_URL' || name.startsWith('BANCO_') || name.startsWith('RLS_PROVA_BANCO_') || name === 'RLS_TESTCONTAINERS') delete env[name];
    Object.assign(env, { RLS_PROVA_BANCO_HOST: container.getHost(), RLS_PROVA_BANCO_PORTA: String(container.getMappedPort(5432)), RLS_PROVA_BANCO_USUARIO: 'pa05_runtime', RLS_PROVA_BANCO_SENHA: 'pa05_runtime_sintetico', RLS_PROVA_BANCO_NOME: 'octaclin_pa05_descartavel' });
    console.log('PA04–PA06: PostgreSQL 15 descartável, schema/RLS de planos reais. Timescale/pgvector: SKIPPED nesta fixture; gate integral permanece no CI.');
    const code = await new Promise((resolve, reject) => {
      const child = spawn('corepack', ['pnpm', 'exec', 'jest', '--runInBand', 'src/infraestrutura/banco-dados/rls-isolamento-tenant.integracao.spec.ts', '-t', 'PA04|PA05|PA06'], { cwd: require('node:path').resolve(__dirname, '..'), env, stdio: 'inherit' });
      child.once('error', reject); child.once('exit', resolve);
    });
    process.exitCode = code ?? 1;
  } finally {
    if (admin?.isInitialized) await admin.destroy();
    if (container) await container.stop();
  }
})().catch(error => { console.error('A prova de planos descartável falhou:', error.message); process.exitCode = 1; });

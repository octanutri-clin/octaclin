/**
 * Substituto LOCAL do `testcontainers` para rodar as suítes `*.integracao.spec.ts`
 * sem Docker, contra um PostgreSQL descartável já em execução (127.0.0.1:55432,
 * superusuário `postgres`, autenticação trust). Não é usado pelo CI, que roda o
 * Testcontainers real com PostgreSQL 15.
 *
 * Uso (ver tasks/PLANO_DESENVOLVIMENTO_SONNET_FOOD06.md, seção 4):
 *   FOOD06_REGISTRO_TESTCONTAINERS=true npx jest --runInBand \
 *     --moduleNameMapper='{"^testcontainers$":"<abs>/scripts/testcontainers-pg-local-shim.cjs"}' <spec>
 *
 * A cada start(): apaga bancos e roles não sistêmicos do cluster descartável e cria
 * a role/banco pedidos em POSTGRES_USER/POSTGRES_DB. Nunca aponte para um banco real.
 */
const { Client } = require('pg');
const PORTA = Number(process.env.PG_LOCAL_PORTA ?? 55432);
class GenericContainer {
  constructor() { this.env = {}; }
  withTmpFs() { return this; } withEnvironment(e) { this.env = { ...this.env, ...e }; return this; }
  withExposedPorts() { return this; } withWaitStrategy() { return this; } withCommand() { return this; }
  withLogConsumer() { return this; } withStartupTimeout() { return this; } withHealthCheck() { return this; } withReuse() { return this; }
  async start() {
    const c = new Client({ host: '127.0.0.1', port: PORTA, user: 'postgres', database: 'postgres' });
    await c.connect();
    const dbs = await c.query("select datname from pg_database where datname not in ('postgres','template0','template1')");
    for (const r of dbs.rows) await c.query(`drop database "${r.datname}" with (force)`);
    const rs = await c.query("select rolname from pg_roles where rolname not like 'pg\\_%' and rolname <> 'postgres'");
    for (const r of rs.rows) await c.query(`drop role "${r.rolname}"`);
    const u = this.env.POSTGRES_USER || 'postgres', d = this.env.POSTGRES_DB || u;
    if (u !== 'postgres') {
      await c.query(`create role "${u}" login superuser password '${String(this.env.POSTGRES_PASSWORD || '').replace(/'/g, "''")}'`);
      await c.query(`create database "${d}" owner "${u}"`);
    }
    await c.end();
    return { getHost: () => '127.0.0.1', getMappedPort: () => PORTA, getFirstMappedPort: () => PORTA, stop: async () => {}, exec: async () => ({ exitCode: 0, output: '' }) };
  }
}
const Wait = { forLogMessage: () => ({}), forListeningPorts: () => ({}), forHealthCheck: () => ({}) };
module.exports = { GenericContainer, Wait };

import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { DataSource, DataSourceOptions } from 'typeorm';
import { criarOpcoesTypeOrm } from './opcoes-typeorm';

/**
 * Prova de isolamento por tenant em Postgres real (PR 11 da governanca).
 *
 * Conecta como a role `octaclin_rls_prova`: sem BYPASSRLS, sem propriedade
 * das tabelas. E a unica forma de provar algo aqui -- a role dona das
 * tabelas (a mesma que roda as migrations) ignora RLS por padrao no
 * Postgres, entao o teste sempre passaria mesmo com a policy quebrada.
 *
 * No CI comum, usa as envs RLS_PROVA_BANCO_* e o service container do PR 11.
 * Com RLS_TESTCONTAINERS=true, sobe um Timescale/Postgres descartavel, aplica
 * as migrations reais e provisiona a role de prova. Sem nenhum dos dois modos,
 * o describe e pulado para nao tornar a suite local dependente de Docker.
 */
const usarTestcontainers = process.env.RLS_TESTCONTAINERS === 'true';
const configuracaoExterna = {
  host: process.env.RLS_PROVA_BANCO_HOST,
  porta: process.env.RLS_PROVA_BANCO_PORTA,
  usuario: process.env.RLS_PROVA_BANCO_USUARIO,
  senha: process.env.RLS_PROVA_BANCO_SENHA,
  banco: process.env.RLS_PROVA_BANCO_NOME
};

const podeRodarExterno = Boolean(
  configuracaoExterna.host &&
    configuracaoExterna.porta &&
    configuracaoExterna.usuario &&
    configuracaoExterna.senha &&
    configuracaoExterna.banco
);
const podeRodar = usarTestcontainers || podeRodarExterno;
const descrever = podeRodar ? describe : describe.skip;

type ConfiguracaoConexao = {
  host: string;
  porta: number;
  usuario: string;
  senha: string;
  banco: string;
};

const CHAVES_AMBIENTE_BANCO = [
  'DATABASE_URL',
  'BANCO_HOST',
  'BANCO_PORTA',
  'BANCO_USUARIO',
  'BANCO_SENHA',
  'BANCO_NOME',
  'BANCO_SSL',
  'BANCO_EXECUTAR_MIGRACOES'
] as const;

function exigirConfiguracaoExterna(): ConfiguracaoConexao {
  if (!podeRodarExterno) {
    throw new Error('Configuracao externa da prova RLS esta incompleta.');
  }

  return {
    host: configuracaoExterna.host!,
    porta: Number(configuracaoExterna.porta),
    usuario: configuracaoExterna.usuario!,
    senha: configuracaoExterna.senha!,
    banco: configuracaoExterna.banco!
  };
}

function restaurarAmbiente(snapshot: Map<string, string | undefined>) {
  for (const [nome, valor] of snapshot) {
    if (valor === undefined) delete process.env[nome];
    else process.env[nome] = valor;
  }
}

descrever('isolamento de tenant via RLS real (usuarios)', () => {
  let cliente: Client | undefined;
  let container: StartedTestContainer | undefined;
  let fonteDadosAdministrativa: DataSource | undefined;
  let snapshotAmbiente: Map<string, string | undefined> | undefined;
  let tenantA: string;
  let tenantB: string;
  let usuarioIdTenantB: string;

  async function comoTenant(tenantId: string | undefined) {
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');
    await cliente.query("select set_config('app.tenant_id', $1, false)", [tenantId ?? '']);
  }

  async function encerrarRecursos(suprimirErros = false) {
    const erros: unknown[] = [];

    if (cliente) {
      try {
        await cliente.end();
      } catch (erro) {
        erros.push(erro);
      } finally {
        cliente = undefined;
      }
    }

    if (fonteDadosAdministrativa?.isInitialized) {
      try {
        await fonteDadosAdministrativa.destroy();
      } catch (erro) {
        erros.push(erro);
      } finally {
        fonteDadosAdministrativa = undefined;
      }
    }

    if (container) {
      try {
        await container.stop();
      } catch (erro) {
        erros.push(erro);
      } finally {
        container = undefined;
      }
    }

    if (snapshotAmbiente) {
      restaurarAmbiente(snapshotAmbiente);
      snapshotAmbiente = undefined;
    }

    if (!suprimirErros && erros.length > 0) throw erros[0];
  }

  async function prepararTestcontainer(): Promise<ConfiguracaoConexao> {
    snapshotAmbiente = new Map(CHAVES_AMBIENTE_BANCO.map((nome) => [nome, process.env[nome]]));

    container = await new GenericContainer('timescale/timescaledb-ha:pg15')
      .withEnvironment({
        POSTGRES_USER: 'octaclin',
        POSTGRES_PASSWORD: 'octaclin_testcontainers',
        POSTGRES_DB: 'octaclin'
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i))
      .withStartupTimeout(120_000)
      .start();

    const configuracaoAdministrativa: ConfiguracaoConexao = {
      host: container.getHost(),
      porta: container.getMappedPort(5432),
      usuario: 'octaclin',
      senha: 'octaclin_testcontainers',
      banco: 'octaclin'
    };

    delete process.env.DATABASE_URL;
    process.env.BANCO_HOST = configuracaoAdministrativa.host;
    process.env.BANCO_PORTA = String(configuracaoAdministrativa.porta);
    process.env.BANCO_USUARIO = configuracaoAdministrativa.usuario;
    process.env.BANCO_SENHA = configuracaoAdministrativa.senha;
    process.env.BANCO_NOME = configuracaoAdministrativa.banco;
    process.env.BANCO_SSL = 'false';
    process.env.BANCO_EXECUTAR_MIGRACOES = 'false';

    const opcoes = criarOpcoesTypeOrm();
    fonteDadosAdministrativa = new DataSource({
      ...opcoes,
      logging: false,
      migrationsRun: false
    } as DataSourceOptions);
    await fonteDadosAdministrativa.initialize();
    await fonteDadosAdministrativa.runMigrations({ transaction: 'all' });
    await fonteDadosAdministrativa.query(`
      create role octaclin_rls_prova
        with login password 'octaclin_rls_prova_testcontainers'
        nosuperuser nocreatedb nocreaterole nobypassrls;
      grant connect on database octaclin to octaclin_rls_prova;
      grant usage on schema public to octaclin_rls_prova;
      grant select, insert, update, delete on all tables in schema public to octaclin_rls_prova;
    `);

    return {
      ...configuracaoAdministrativa,
      usuario: 'octaclin_rls_prova',
      senha: 'octaclin_rls_prova_testcontainers'
    };
  }

  beforeAll(async () => {
    try {
      const configuracao = usarTestcontainers ? await prepararTestcontainer() : exigirConfiguracaoExterna();
      cliente = new Client({
        host: configuracao.host,
        port: configuracao.porta,
        user: configuracao.usuario,
        password: configuracao.senha,
        database: configuracao.banco
      });
      await cliente.connect();

      tenantA = randomUUID();
      tenantB = randomUUID();
      await cliente.query('insert into tenants (id, nome, slug) values ($1, $2, $3), ($4, $5, $6)', [
        tenantA,
        'Prova RLS Tenant A',
        `prova-rls-a-${tenantA}`,
        tenantB,
        'Prova RLS Tenant B',
        `prova-rls-b-${tenantB}`
      ]);

      await comoTenant(tenantA);
      await cliente.query(
        `insert into usuarios (tenant_id, email_hash, email_criptografado, senha_hash, role)
         values ($1, 'prova-rls-hash-a', $2, 'prova-rls-senha-a', 'SuperAdmin')`,
        [tenantA, Buffer.from('a')]
      );

      await comoTenant(tenantB);
      const usuarioB = await cliente.query<{ id: string }>(
        `insert into usuarios (tenant_id, email_hash, email_criptografado, senha_hash, role)
         values ($1, 'prova-rls-hash-b', $2, 'prova-rls-senha-b', 'SuperAdmin')
         returning id`,
        [tenantB, Buffer.from('b')]
      );
      usuarioIdTenantB = usuarioB.rows[0].id;
    } catch (erro) {
      await encerrarRecursos(true);
      throw erro;
    }
  }, 180_000);

  afterAll(async () => {
    await encerrarRecursos();
  }, 30_000);

  it('tenant ve somente os proprios usuarios', async () => {
    await comoTenant(tenantA);
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');
    const resultado = await cliente.query('select tenant_id from usuarios');
    expect(resultado.rows).toHaveLength(1);
    expect(resultado.rows[0].tenant_id).toBe(tenantA);
  });

  it('tenant nao ve nem edita usuario de outro tenant, mesmo buscando por id direto', async () => {
    await comoTenant(tenantA);
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');

    const busca = await cliente.query('select id from usuarios where id = $1', [usuarioIdTenantB]);
    expect(busca.rows).toHaveLength(0);

    const atualizacao = await cliente.query('update usuarios set ativo = false where id = $1', [usuarioIdTenantB]);
    expect(atualizacao.rowCount).toBe(0);
  });

  it('sem app.tenant_id de sessao, RLS nega tudo (fail-closed)', async () => {
    await comoTenant(undefined);
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');
    const resultado = await cliente.query('select tenant_id from usuarios');
    expect(resultado.rows).toHaveLength(0);
  });
});

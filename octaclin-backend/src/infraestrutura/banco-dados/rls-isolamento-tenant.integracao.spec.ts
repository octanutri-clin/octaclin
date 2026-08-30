import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ExecutorTenant } from './executor-tenant';
import { criarOpcoesTypeOrm } from './opcoes-typeorm';

/**
 * Prova integral de isolamento por tenant em Postgres real (PR 43).
 *
 * O inventario nasce do catalogo do banco: toda tabela publica que possui
 * `tenant_id` entra automaticamente no gate. A conexao de prova usa o mesmo
 * perfil da role runtime (DML, sem ownership e sem BYPASSRLS); a role owner e
 * usada somente para migrations no banco descartavel.
 *
 * No CI comum, usa as envs RLS_PROVA_BANCO_* e o service container ja migrado.
 * Com RLS_TESTCONTAINERS=true, sobe Timescale/Postgres descartavel, aplica as
 * migrations reais e provisiona a role de prova. Sem nenhum dos dois modos,
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

type TabelaTenant = {
  tabela: string;
  relrowsecurity: boolean;
  relforcerowsecurity: boolean;
  dono: string;
};

type PoliticaRls = {
  tabela: string;
  nome: string;
  roles: string[];
  comando: string;
  usando: string | null;
  comVerificacao: string | null;
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

const TABELAS_REPRESENTATIVAS = [
  { tabela: 'user_action_logs', colunaId: 'id', fronteira: 'auditoria' },
  { tabela: 'outbox_eventos', colunaId: 'id', fronteira: 'job assincrono' },
  { tabela: 'arquivos_midia', colunaId: 'id', fronteira: 'storage metadata' },
  { tabela: 'google_canais_watch', colunaId: 'canal_watch_id', fronteira: 'integracao' }
] as const;

type TabelaRepresentativa = (typeof TABELAS_REPRESENTATIVAS)[number]['tabela'];
type IdentificadoresRepresentativos = Record<TabelaRepresentativa, string>;

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

function identificadorSql(valor: string): string {
  return `"${valor.replace(/"/g, '""')}"`;
}

function expressaoIsolaTenant(expressao: string | null): boolean {
  if (!expressao) return false;
  const normalizada = expressao.toLowerCase().replace(/\s+/g, ' ');
  return (
    normalizada.includes('tenant_id') &&
    normalizada.includes("current_setting('app.tenant_id") &&
    normalizada.includes('nullif') &&
    normalizada.includes('uuid')
  );
}

descrever('RLS e isolamento multi-tenant integral em Postgres real', () => {
  let cliente: Client | undefined;
  let container: StartedTestContainer | undefined;
  let fonteDadosAdministrativa: DataSource | undefined;
  let fonteDadosRuntime: DataSource | undefined;
  let executorTenant: ExecutorTenant | undefined;
  let snapshotAmbiente: Map<string, string | undefined> | undefined;
  let configuracaoRuntime: ConfiguracaoConexao | undefined;
  let tabelasTenant: TabelaTenant[] = [];
  let tenantA: string;
  let tenantB: string;
  let usuarioIdTenantB: string;
  let idsTenantA: IdentificadoresRepresentativos;
  let idsTenantB: IdentificadoresRepresentativos;

  async function comoTenant(tenantId: string | undefined) {
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');
    await cliente.query("select set_config('app.tenant_id', $1, false)", [tenantId ?? '']);
  }

  async function inventariarTabelasTenant(): Promise<TabelaTenant[]> {
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');
    const resultado = await cliente.query<TabelaTenant>(`
      select c.relname as tabela,
             c.relrowsecurity,
             c.relforcerowsecurity,
             pg_get_userbyid(c.relowner) as dono
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid
       where n.nspname = 'public'
         and c.relkind in ('r', 'p')
         and a.attname = 'tenant_id'
         and not a.attisdropped
       order by c.relname
    `);
    return resultado.rows;
  }

  async function criarFonteDadosRuntime(configuracao: ConfiguracaoConexao): Promise<DataSource> {
    const fonteDados = new DataSource({
      type: 'postgres',
      host: configuracao.host,
      port: configuracao.porta,
      username: configuracao.usuario,
      password: configuracao.senha,
      database: configuracao.banco,
      ssl: false,
      synchronize: false,
      logging: false,
      entities: [],
      extra: { max: 2 }
    });
    await fonteDados.initialize();
    return fonteDados;
  }

  async function encerrarRecursos(suprimirErros = false) {
    const erros: unknown[] = [];

    if (fonteDadosRuntime?.isInitialized) {
      try {
        await fonteDadosRuntime.destroy();
      } catch (erro) {
        erros.push(erro);
      } finally {
        fonteDadosRuntime = undefined;
        executorTenant = undefined;
      }
    }

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

    // A imagem HA registra readiness no initdb e novamente apos o reinicio definitivo.
    container = await new GenericContainer('timescale/timescaledb-ha:pg15')
      .withEnvironment({
        POSTGRES_USER: 'octaclin',
        POSTGRES_PASSWORD: 'octaclin_testcontainers',
        POSTGRES_DB: 'octaclin'
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i, 2))
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
      grant usage, select on all sequences in schema public to octaclin_rls_prova;
    `);

    return {
      ...configuracaoAdministrativa,
      usuario: 'octaclin_rls_prova',
      senha: 'octaclin_rls_prova_testcontainers'
    };
  }

  async function prepararDadosRepresentativos(
    tenantId: string,
    rotulo: string
  ): Promise<{ usuarioId: string; ids: IdentificadoresRepresentativos }> {
    await comoTenant(tenantId);
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');

    const usuario = await cliente.query<{ id: string }>(
      `insert into usuarios (tenant_id, email_hash, email_criptografado, senha_hash, role)
       values ($1, $2, $3, 'prova-rls-senha', 'Professional') returning id`,
      [tenantId, `prova-rls-hash-${rotulo}-${randomUUID()}`, Buffer.from(`usuario-${rotulo}`)]
    );
    const usuarioId = usuario.rows[0].id;

    const profissional = await cliente.query<{ id: string }>(
      `insert into profissionais (tenant_id, usuario_id, nome_criptografado)
       values ($1, $2, $3) returning id`,
      [tenantId, usuarioId, Buffer.from(`profissional-${rotulo}`)]
    );
    const profissionalId = profissional.rows[0].id;

    const paciente = await cliente.query<{ id: string }>(
      `insert into pacientes (tenant_id, profissional_responsavel_id, nome_criptografado)
       values ($1, $2, $3) returning id`,
      [tenantId, profissionalId, Buffer.from(`paciente-${rotulo}`)]
    );
    const pacienteId = paciente.rows[0].id;

    const auditoria = await cliente.query<{ id: string }>(
      `insert into user_action_logs (tenant_id, usuario_id, acao, metadados)
       values ($1, $2, 'prova.rls', '{"origem":"sintetica"}'::jsonb) returning id`,
      [tenantId, usuarioId]
    );
    const outbox = await cliente.query<{ id: string }>(
      `insert into outbox_eventos (tenant_id, tipo, payload)
       values ($1, 'prova.rls', '{"conteudo":"sintetico"}'::jsonb) returning id`,
      [tenantId]
    );
    const arquivo = await cliente.query<{ id: string }>(
      `insert into arquivos_midia
         (tenant_id, paciente_id, tipo, bucket, chave_objeto, mime_type, tamanho_bytes, metadados)
       values ($1, $2, 'imagem', 'bucket-sintetico', $3, 'image/png', 1, '{}'::jsonb)
       returning id`,
      [tenantId, pacienteId, `tenant/${tenantId}/prova-${rotulo}.png`]
    );
    const canalWatchId = `prova-rls-${rotulo}-${randomUUID()}`;
    await cliente.query(
      `insert into google_canais_watch (canal_watch_id, tenant_id, profissional_id, expira_em, token)
       values ($1, $2, $3, now() + interval '1 hour', $4)`,
      [canalWatchId, tenantId, profissionalId, `token-sintetico-${rotulo}`]
    );

    return {
      usuarioId,
      ids: {
        user_action_logs: auditoria.rows[0].id,
        outbox_eventos: outbox.rows[0].id,
        arquivos_midia: arquivo.rows[0].id,
        google_canais_watch: canalWatchId
      }
    };
  }

  beforeAll(async () => {
    try {
      configuracaoRuntime = usarTestcontainers ? await prepararTestcontainer() : exigirConfiguracaoExterna();
      cliente = new Client({
        host: configuracaoRuntime.host,
        port: configuracaoRuntime.porta,
        user: configuracaoRuntime.usuario,
        password: configuracaoRuntime.senha,
        database: configuracaoRuntime.banco
      });
      await cliente.connect();

      fonteDadosRuntime = await criarFonteDadosRuntime(configuracaoRuntime);
      executorTenant = new ExecutorTenant(fonteDadosRuntime);

      tabelasTenant = await inventariarTabelasTenant();
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

      const dadosA = await prepararDadosRepresentativos(tenantA, 'a');
      const dadosB = await prepararDadosRepresentativos(tenantB, 'b');
      idsTenantA = dadosA.ids;
      idsTenantB = dadosB.ids;
      usuarioIdTenantB = dadosB.usuarioId;
    } catch (erro) {
      await encerrarRecursos(true);
      throw erro;
    }
  }, 180_000);

  afterAll(async () => {
    await encerrarRecursos();
  }, 30_000);

  it('usa role runtime restrita, sem ownership, SUPERUSER ou BYPASSRLS', async () => {
    if (!cliente || !configuracaoRuntime) throw new Error('Cliente da prova RLS nao foi inicializado.');
    const papel = await cliente.query<{
      usuario: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
    }>(`
      select current_user as usuario, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
        from pg_roles
       where rolname = current_user
    `);

    expect(papel.rows).toEqual([
      {
        usuario: configuracaoRuntime.usuario,
        rolsuper: false,
        rolbypassrls: false,
        rolcreatedb: false,
        rolcreaterole: false
      }
    ]);
    expect(tabelasTenant).not.toHaveLength(0);
    expect(tabelasTenant.filter((tabela) => tabela.dono === configuracaoRuntime!.usuario)).toEqual([]);
  });

  it('inventaria toda tabela tenant-scoped com ENABLE, FORCE e policy completa', async () => {
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');
    const nomes = tabelasTenant.map((tabela) => tabela.tabela);
    for (const representativa of TABELAS_REPRESENTATIVAS) {
      expect(nomes).toContain(representativa.tabela);
    }
    expect(tabelasTenant.filter((tabela) => !tabela.relrowsecurity || !tabela.relforcerowsecurity)).toEqual([]);

    const resultadoPoliticas = await cliente.query<PoliticaRls>(`
      select tablename as tabela,
             policyname as nome,
             roles,
             cmd as comando,
             qual as usando,
             with_check as "comVerificacao"
        from pg_policies
       where schemaname = 'public'
       order by tablename, policyname
    `);

    for (const tabela of tabelasTenant) {
      const politicas = resultadoPoliticas.rows.filter((politica) => politica.tabela === tabela.tabela);
      const policyCompleta = politicas.some(
        (politica) =>
          politica.comando === 'ALL' &&
          politica.roles.includes('public') &&
          expressaoIsolaTenant(politica.usando) &&
          expressaoIsolaTenant(politica.comVerificacao)
      );
      expect({ tabela: tabela.tabela, policyCompleta, politicas }).toEqual(
        expect.objectContaining({ policyCompleta: true })
      );
    }
  });

  it('tenant ve os proprios registros em auditoria, jobs, storage e integracao', async () => {
    await comoTenant(tenantA);
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');

    for (const representativa of TABELAS_REPRESENTATIVAS) {
      const resultado = await cliente.query<{ tenant_id: string }>(
        `select tenant_id from ${identificadorSql(representativa.tabela)}
          where ${identificadorSql(representativa.colunaId)} = $1`,
        [idsTenantA[representativa.tabela]]
      );
      expect({ fronteira: representativa.fronteira, linhas: resultado.rows }).toEqual({
        fronteira: representativa.fronteira,
        linhas: [{ tenant_id: tenantA }]
      });
    }
  });

  it('tenant nao ve objetos de outro tenant nem os edita por id direto', async () => {
    await comoTenant(tenantA);
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');

    const buscaUsuario = await cliente.query('select id from usuarios where id = $1', [usuarioIdTenantB]);
    expect(buscaUsuario.rows).toHaveLength(0);
    const atualizacao = await cliente.query('update usuarios set ativo = false where id = $1', [usuarioIdTenantB]);
    expect(atualizacao.rowCount).toBe(0);

    for (const representativa of TABELAS_REPRESENTATIVAS) {
      const resultado = await cliente.query(
        `select ${identificadorSql(representativa.colunaId)}
           from ${identificadorSql(representativa.tabela)}
          where ${identificadorSql(representativa.colunaId)} = $1`,
        [idsTenantB[representativa.tabela]]
      );
      expect({ fronteira: representativa.fronteira, total: resultado.rowCount }).toEqual({
        fronteira: representativa.fronteira,
        total: 0
      });
    }
  });

  it('WITH CHECK rejeita escrita que declara tenant diferente do contexto', async () => {
    await comoTenant(tenantA);
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');
    await expect(
      cliente.query(
        `insert into outbox_eventos (tenant_id, tipo, payload)
         values ($1, 'prova.rls.invalida', '{"conteudo":"sintetico"}'::jsonb)`,
        [tenantB]
      )
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('sem app.tenant_id nenhuma tabela tenant-scoped fica visivel', async () => {
    await comoTenant(undefined);
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');

    for (const tabela of tabelasTenant) {
      const resultado = await cliente.query<{ total: number }>(
        `select count(*)::int as total from ${identificadorSql(tabela.tabela)}`
      );
      expect({ tabela: tabela.tabela, total: resultado.rows[0]?.total }).toEqual({
        tabela: tabela.tabela,
        total: 0
      });
    }
  });

  it('pool e jobs concorrentes nao vazam contexto entre tenants nem apos a transacao', async () => {
    if (!executorTenant || !fonteDadosRuntime) throw new Error('ExecutorTenant da prova RLS nao foi inicializado.');

    const execucoes = await Promise.all(
      Array.from({ length: 12 }, async (_, indice) => {
        const tenantId = indice % 2 === 0 ? tenantA : tenantB;
        const outboxId = indice % 2 === 0 ? idsTenantA.outbox_eventos : idsTenantB.outbox_eventos;
        return executorTenant!.executar(tenantId, async (gerenciador) => {
          const contexto = (await gerenciador.query(
            "select current_setting('app.tenant_id', true) as tenant_id"
          )) as Array<{ tenant_id: string }>;
          await gerenciador.query('select pg_sleep(0.01)');
          const eventos = (await gerenciador.query('select id, tenant_id from outbox_eventos where id = $1', [
            outboxId
          ])) as Array<{ id: string; tenant_id: string }>;
          return { tenantId, contexto: contexto[0]?.tenant_id, eventos };
        });
      })
    );

    for (const execucao of execucoes) {
      expect(execucao.contexto).toBe(execucao.tenantId);
      expect(execucao.eventos).toEqual([expect.objectContaining({ tenant_id: execucao.tenantId })]);
    }

    const queryRunners = [fonteDadosRuntime.createQueryRunner(), fonteDadosRuntime.createQueryRunner()];
    await Promise.all(queryRunners.map((queryRunner) => queryRunner.connect()));
    try {
      for (const queryRunner of queryRunners) {
        const contexto = (await queryRunner.query(
          "select nullif(current_setting('app.tenant_id', true), '') as tenant_id"
        )) as Array<{ tenant_id: string | null }>;
        const eventos = (await queryRunner.query('select count(*)::int as total from outbox_eventos')) as Array<{
          total: number;
        }>;
        expect(contexto[0]?.tenant_id ?? null).toBeNull();
        expect(eventos[0]?.total).toBe(0);
      }
    } finally {
      await Promise.all(queryRunners.map((queryRunner) => queryRunner.release()));
    }
  });
});

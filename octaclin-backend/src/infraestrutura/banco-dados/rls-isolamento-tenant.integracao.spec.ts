import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { DataSource, DataSourceOptions } from 'typeorm';
import { UserActionLogOrm } from '../auditoria/user-action-log.orm';
import { ExecutorTenant } from './executor-tenant';
import { ServicoPainelOperacao } from '../../modulos/clientes/aplicacao/servico-painel-operacao';
import { ServicoAuditoriaCliente } from '../../modulos/clientes/aplicacao/servico-auditoria-cliente';
import { ServicoLgpdCliente } from '../../modulos/clientes/aplicacao/servico-lgpd-cliente';
import { ServicoPermissoesIntegracao } from '../../modulos/integracoes/aplicacao/servico-permissoes-integracao';
import { PermissaoIntegracaoProfissionalOrm } from '../../modulos/integracoes/infraestrutura/permissao-integracao-profissional.orm';
import { ServicoOperacoes } from '../../modulos/operacoes/aplicacao/servico-operacoes';
import { ConsentimentoLgpdOrm } from '../lgpd/consentimento-lgpd.orm';
import { CriptografiaDadosSensiveis } from '../seguranca/criptografia-dados-sensiveis';
import { ProfissionalOrm } from '../../modulos/profissionais/infraestrutura/profissional.orm';
import { TenantConfiguracaoOrm } from '../../modulos/tenancy/infraestrutura/tenant-configuracao.orm';
import { UsuarioOrm } from '../../modulos/usuarios/infraestrutura/usuario.orm';
import { NotificacaoOrm } from '../../modulos/notificacoes/infraestrutura/notificacao.orm';
import { PreferenciaNotificacaoUsuarioOrm } from '../../modulos/notificacoes/infraestrutura/preferencia-notificacao-usuario.orm';
import { ResumoNotificacaoUsuarioOrm } from '../../modulos/notificacoes/infraestrutura/resumo-notificacao-usuario.orm';
import { ServicoNotificacoes } from '../../modulos/notificacoes/aplicacao/servico-notificacoes';
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
  { tabela: 'google_canais_watch', colunaId: 'canal_watch_id', fronteira: 'integracao' },
  { tabela: 'permissoes_integracao_profissional', colunaId: 'id', fronteira: 'autorizacao de integracao' }
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
  let usuarioIdTenantA: string;
  let usuarioIdTenantB: string;
  let pacienteIdTenantA: string;
  let pacienteIdTenantB: string;
  let profissionalIdTenantA: string;
  let profissionalIdTenantB: string;
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
      entities: [
        ProfissionalOrm,
        TenantConfiguracaoOrm,
        ConsentimentoLgpdOrm,
        UsuarioOrm,
        PermissaoIntegracaoProfissionalOrm,
        UserActionLogOrm,
        NotificacaoOrm,
        PreferenciaNotificacaoUsuarioOrm,
        ResumoNotificacaoUsuarioOrm
      ],
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
  ): Promise<{ usuarioId: string; pacienteId: string; profissionalId: string; ids: IdentificadoresRepresentativos }> {
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
    const permissao = await cliente.query<{ id: string }>(
      `insert into permissoes_integracao_profissional
         (tenant_id, usuario_id, tipo, escopos_api, eventos_webhook, concedida_por_usuario_id)
       values ($1, $2, 'api', array['pacientes:ler']::text[], array[]::text[], $2) returning id`,
      [tenantId, usuarioId]
    );

    return {
      usuarioId,
      pacienteId,
      profissionalId,
      ids: {
        user_action_logs: auditoria.rows[0].id,
        outbox_eventos: outbox.rows[0].id,
        arquivos_midia: arquivo.rows[0].id,
        google_canais_watch: canalWatchId,
        permissoes_integracao_profissional: permissao.rows[0].id
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
      usuarioIdTenantA = dadosA.usuarioId;
      pacienteIdTenantA = dadosA.pacienteId;
      profissionalIdTenantA = dadosA.profissionalId;
      idsTenantB = dadosB.ids;
      usuarioIdTenantB = dadosB.usuarioId;
      pacienteIdTenantB = dadosB.pacienteId;
      profissionalIdTenantB = dadosB.profissionalId;
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
    expect(nomes).toEqual(expect.arrayContaining(['politicas_followup_agenda', 'ocorrencias_followup_agenda']));
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

  it('PB-26 agrega somente pacientes e profissionais do tenant corrente', async () => {
    if (!executorTenant) throw new Error('Executor tenant da prova RLS nao foi inicializado.');
    const criptografiaSintetica = { descriptografar: (valor: Buffer) => valor.toString('utf8') };
    const painel = new ServicoPainelOperacao(executorTenant, criptografiaSintetica as never);
    const mes = new Date().toISOString().slice(0, 7);

    const resultadoA = await painel.obter(tenantA, mes);
    const resultadoB = await painel.obter(tenantB, mes);

    expect(resultadoA.pacientes.ativos).toBe(1);
    expect(resultadoB.pacientes.ativos).toBe(1);
    expect(resultadoA.profissionais).toHaveLength(1);
    expect(resultadoB.profissionais).toHaveLength(1);
    expect(resultadoA.profissionais[0].nome).toBe('profissional-a');
    expect(resultadoB.profissionais[0].nome).toBe('profissional-b');
  });

  it('Fase 306 agrega somente eventos do tenant em indicadores de retorno e formulários', async () => {
    if (!cliente || !executorTenant) throw new Error('Prova RLS nao foi inicializada.');

    const mesAnterior = await cliente.query<{ mes: string }>(`
      select to_char((now() at time zone 'America/Sao_Paulo') - interval '1 month', 'YYYY-MM') as mes
    `);
    const periodoLocal = `((date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 month')::date + interval '10 hours')`;

    const inserirEventos = async (tenantId: string, pacienteId: string, profissionalId: string, versao: 'a' | 'b') => {
      await comoTenant(tenantId);
      const base = periodoLocal;
      if (versao === 'a') {
        await cliente!.query(`
          insert into agenda_consultas (tenant_id, paciente_id, profissional_id, titulo, inicio_em, fim_em, status)
          values
            ($1, $2, $3, 'Consulta de prova RLS', (${base}) at time zone 'America/Sao_Paulo', (${base} + interval '30 minutes') at time zone 'America/Sao_Paulo', 'concluida'),
            ($1, $2, $3, 'Consulta de prova RLS', (${base} + interval '10 days') at time zone 'America/Sao_Paulo', (${base} + interval '10 days 30 minutes') at time zone 'America/Sao_Paulo', 'concluida'),
            ($1, $2, $3, 'Consulta de prova RLS', (${base} + interval '20 days') at time zone 'America/Sao_Paulo', (${base} + interval '20 days 30 minutes') at time zone 'America/Sao_Paulo', 'concluida'),
            ($1, $2, $3, 'Consulta de prova RLS', (${base} + interval '20 days 30 minutes') at time zone 'America/Sao_Paulo', (${base} + interval '20 days 60 minutes') at time zone 'America/Sao_Paulo', 'falta'),
            ($1, $2, $3, 'Consulta de prova RLS', (${base} + interval '20 days 60 minutes') at time zone 'America/Sao_Paulo', (${base} + interval '20 days 90 minutes') at time zone 'America/Sao_Paulo', 'falta'),
            ($1, $2, $3, 'Consulta de prova RLS', now() + interval '5 days', now() + interval '5 days 30 minutes', 'agendada')
        `, [tenantId, pacienteId, profissionalId]);
      } else {
        await cliente!.query(`
          insert into agenda_consultas (tenant_id, paciente_id, profissional_id, titulo, inicio_em, fim_em, status)
          values
            ($1, $2, $3, 'Consulta de prova RLS', (${base}) at time zone 'America/Sao_Paulo', (${base} + interval '30 minutes') at time zone 'America/Sao_Paulo', 'concluida'),
            ($1, $2, $3, 'Consulta de prova RLS', (${base} + interval '7 days') at time zone 'America/Sao_Paulo', (${base} + interval '7 days 30 minutes') at time zone 'America/Sao_Paulo', 'concluida'),
            ($1, $2, $3, 'Consulta de prova RLS', (${base} + interval '10 days 30 minutes') at time zone 'America/Sao_Paulo', (${base} + interval '10 days 60 minutes') at time zone 'America/Sao_Paulo', 'falta')
        `, [tenantId, pacienteId, profissionalId]);
      }

      const questionario = await cliente!.query<{ id: string }>(
        `insert into questionarios (tenant_id, profissional_id, titulo) values ($1, $2, 'Questionário de prova RLS') returning id`,
        [tenantId, profissionalId]
      );
      const envio = `((date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 month')::date + interval '20 days 08 hours')`;
      const duracao = versao === 'a' ? '2 hours' : '48 hours';
      await cliente!.query(`
        insert into envios_questionario (tenant_id, questionario_id, paciente_id, status, enviado_em, respondido_em)
        values ($1, $2, $3, 'respondido', (${envio}) at time zone 'America/Sao_Paulo', ((${envio}) + $4::interval) at time zone 'America/Sao_Paulo')
      `, [tenantId, questionario.rows[0].id, pacienteId, duracao]);
    };

    await inserirEventos(tenantA, pacienteIdTenantA, profissionalIdTenantA, 'a');
    await inserirEventos(tenantB, pacienteIdTenantB, profissionalIdTenantB, 'b');

    const painel = new ServicoPainelOperacao(executorTenant, { descriptografar: (valor: Buffer) => valor.toString('utf8') } as never);
    const resultadoA = await painel.obter(tenantA, mesAnterior.rows[0].mes);
    const resultadoB = await painel.obter(tenantB, mesAnterior.rows[0].mes);

    expect(resultadoA.retorno).toEqual(expect.objectContaining({
      pacientesElegiveis: 1,
      pacientesSemProximaConsulta: 0,
      percentualSemProximaConsulta: 0,
      pacientesComHistorico: 1,
      intervaloMedianoDias: 10
    }));
    expect(resultadoB.retorno).toEqual(expect.objectContaining({
      pacientesElegiveis: 1,
      pacientesSemProximaConsulta: 1,
      percentualSemProximaConsulta: 100,
      pacientesComHistorico: 1,
      intervaloMedianoDias: 7
    }));
    expect(resultadoA.faltasPorHorario).toEqual(expect.objectContaining({ desfechos: 5, faltas: 2, faixas: expect.any(Array) }));
    expect(resultadoA.faltasPorHorario.faixas).toHaveLength(1);
    expect(resultadoB.faltasPorHorario).toEqual(expect.objectContaining({ desfechos: 3, faltas: 1, faixas: [] }));
    expect(resultadoA.respostaFormularios).toEqual({ respostasValidas: 1, medianaSegundos: 7200 });
    expect(resultadoB.respostaFormularios).toEqual({ respostasValidas: 1, medianaSegundos: 172800 });
    expect(JSON.stringify(resultadoA)).not.toContain(pacienteIdTenantA);
    expect(JSON.stringify(resultadoA)).not.toContain(pacienteIdTenantB);
  });

  it('PB-27 projeta somente auditoria e identidades do tenant corrente', async () => {
    if (!executorTenant) throw new Error('Executor tenant da prova RLS nao foi inicializado.');
    const servico = new ServicoAuditoriaCliente(executorTenant);
    const resultadoA = await servico.listar(tenantA, { acao: 'prova.rls' });
    const resultadoB = await servico.listar(tenantB, { acao: 'prova.rls' });
    expect(resultadoA.itens).toHaveLength(1);
    expect(resultadoB.itens).toHaveLength(1);
    expect(resultadoA.itens[0].usuarioId).toBe(usuarioIdTenantA);
    expect(resultadoB.itens[0].usuarioId).toBe(usuarioIdTenantB);
    expect(Object.keys(resultadoA.itens[0]).sort()).toEqual(['acao', 'criadoEm', 'recursoTipo', 'usuarioId']);
    expect((await servico.listar(tenantA, { usuarioId: usuarioIdTenantB })).itens).toEqual([]);

    await comoTenant(tenantA);
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');
    await cliente.query(`INSERT INTO user_action_logs (tenant_id, usuario_id, acao)
      VALUES ($1, $2, 'prova.pb27.externo'), ($1, NULL, 'prova.pb27.sistema')`, [tenantA, usuarioIdTenantB]);
    expect((await servico.listar(tenantA, { acao: 'prova.pb27.externo' })).itens[0].usuarioId).toBeNull();
    expect((await servico.listar(tenantA, { acao: 'prova.pb27.sistema' })).itens[0].usuarioId).toBeNull();
    expect((await servico.listar(tenantB, { acao: 'prova.pb27.externo' })).itens).toEqual([]);
  });

  it('Fase 302 isola pedidos LGPD com RLS real e serializa triagem com decisao operacional', async () => {
    if (!executorTenant) throw new Error('Executor tenant da prova RLS nao foi inicializado.');
    const criptografia = new CriptografiaDadosSensiveis();
    const servico = new ServicoLgpdCliente(executorTenant, criptografia);
    const operacoes = new ServicoOperacoes(
      executorTenant, {} as never, {} as never, {} as never, {} as never, criptografia
    );
    const protocoloA = `LGPD-${randomUUID()}`;
    const protocoloB = `LGPD-${randomUUID()}`;
    for (const [tenantId, usuarioId, protocolo] of [
      [tenantA, usuarioIdTenantA, protocoloA], [tenantB, usuarioIdTenantB, protocoloB]
    ]) {
      await executorTenant.executar(tenantId, async (gerenciador) => {
        await gerenciador.query(`
          insert into consentimentos_lgpd
            (tenant_id, usuario_id, tipo, versao, aceito_em, metadados, detalhes_criptografados)
          values ($1, $2, 'solicitacao_lgpd_retificacao', 'prova-rls', '2025-01-01T10:00:00Z', $3::jsonb, $4)
        `, [tenantId, usuarioId, JSON.stringify({ protocolo, pacienteId: usuarioId, status: 'recebida' }),
          criptografia.criptografar('Descricao sintetica.')]);
      });
    }

    expect((await servico.listar(tenantA)).itens.map((item) => item.protocolo)).toContain(protocoloA);
    expect((await servico.listar(tenantA)).itens.map((item) => item.protocolo)).not.toContain(protocoloB);
    await expect(servico.obterDetalhe(tenantA, protocoloB)).rejects.toThrow('não encontrada');
    await expect(servico.prepararResposta(tenantA, protocoloB)).rejects.toThrow('não encontrada');
    await expect(servico.assumirTratativa(tenantA, usuarioIdTenantA, protocoloB)).rejects.toThrow('não encontrada');
    const linhasOutroTenant = await executorTenant.executar(tenantA, (gerenciador) =>
      gerenciador.query('select id from consentimentos_lgpd where tenant_id = $1 and metadados->>\'protocolo\' = $2',
        [tenantB, protocoloB]));
    expect(linhasOutroTenant).toEqual([]);

    const concorrentes = await Promise.allSettled([
      servico.assumirTratativa(tenantA, usuarioIdTenantA, protocoloA),
      operacoes.atualizarSolicitacaoLgpd(tenantA, usuarioIdTenantA, protocoloA,
        { status: 'concluida', detalhes: 'Validacao sintetica.' })
    ]);
    expect(concorrentes[1].status).toBe('fulfilled');
    expect((await servico.obterDetalhe(tenantA, protocoloA)).status).toBe('concluida');
    const totalDecisoes = await executorTenant.executar(tenantA, (gerenciador) =>
      gerenciador.query(`select count(*)::int as total from consentimentos_lgpd
        where tenant_id = $1 and metadados->>'protocolo' = $2 and tipo = 'tratativa_lgpd'
          and metadados->>'status' = 'concluida'`, [tenantA, protocoloA]));
    expect(totalDecisoes[0].total).toBe(1);
  });

  it('Fase 303 isola concessoes de integração e faz revogação prevalecer em operações seguintes', async () => {
    if (!cliente || !executorTenant) throw new Error('Clientes da prova RLS nao foram inicializados.');
    await comoTenant(tenantA);
    const gestor = await cliente.query<{ id: string }>(
      `insert into usuarios (tenant_id, email_hash, email_criptografado, senha_hash, role)
       values ($1, $2, $3, 'prova-rls-gestor', 'Client') returning id`,
      [tenantA, `prova-rls-gestor-${randomUUID()}`, Buffer.from('gestor-a')]
    );
    const profissionalTenantA = await cliente.query<{ id: string }>(
      `insert into usuarios (tenant_id, email_hash, email_criptografado, senha_hash, role)
       values ($1, $2, $3, 'prova-rls-profissional', 'Professional') returning id`,
      [tenantA, `prova-rls-profissional-a-${randomUUID()}`, Buffer.from('profissional-a')]
    );
    const usuarioProfissionalTenantAId = profissionalTenantA.rows[0].id;
    await comoTenant(tenantB);
    const profissionalSemConcessaoOutroTenant = await cliente.query<{ id: string }>(
      `insert into usuarios (tenant_id, email_hash, email_criptografado, senha_hash, role)
       values ($1, $2, $3, 'prova-rls-profissional', 'Professional') returning id`,
      [tenantB, `prova-rls-sem-concessao-${randomUUID()}`, Buffer.from('profissional-b')]
    );
    const usuarioSemConcessaoOutroTenantId = profissionalSemConcessaoOutroTenant.rows[0].id;
    await comoTenant(tenantA);
    const servico = new ServicoPermissoesIntegracao(executorTenant);

    await servico.atualizar(tenantA, gestor.rows[0].id, usuarioProfissionalTenantAId, {
      escoposApi: ['agenda:ler'], eventosWebhook: ['consulta.criada']
    });
    expect(await servico.obterAcessoAtual(tenantA, usuarioProfissionalTenantAId)).toEqual({
      escoposApi: ['agenda:ler'], eventosWebhook: ['consulta.criada']
    });
    expect(await servico.obterAcessoAtual(tenantB, usuarioSemConcessaoOutroTenantId)).toEqual({
      escoposApi: [], eventosWebhook: []
    });
    await expect(
      servico.exigirAcesso(tenantA, usuarioSemConcessaoOutroTenantId, 'api')
    ).rejects.toThrow('Profissional ativo deste tenant');

    await cliente.query(
      'insert into api_chaves (tenant_id, nome, prefixo, segredo_hash, escopos, criado_por_usuario_id, profissional_usuario_id) values ($1, $2, $3, $4, $5, $6, $6)',
      [tenantA, 'Prova vinculacao profissional', `rls-${randomUUID().slice(0, 12)}`, 'a'.repeat(64), ['agenda:ler'], usuarioProfissionalTenantAId]
    );
    await cliente.query(
      'insert into webhook_assinaturas (tenant_id, nome, url, eventos, segredo_criptografado, criado_por_usuario_id, profissional_usuario_id) values ($1, $2, $3, $4, $5, $6, $6)',
      [tenantA, 'Prova vinculacao profissional', 'https://example.invalid/hook', ['consulta.criada'], Buffer.from('sintetico'), usuarioProfissionalTenantAId]
    );
    await expect(cliente.query(
      'insert into api_chaves (tenant_id, nome, prefixo, segredo_hash, escopos, profissional_usuario_id) values ($1, $2, $3, $4, $5, $6)',
      [tenantA, 'Vinculo cruzado', `rls-${randomUUID().slice(0, 12)}`, 'b'.repeat(64), ['agenda:ler'], usuarioSemConcessaoOutroTenantId]
    )).rejects.toMatchObject({ code: '23503' });
    await expect(cliente.query(
      'insert into webhook_assinaturas (tenant_id, nome, url, eventos, segredo_criptografado, profissional_usuario_id) values ($1, $2, $3, $4, $5, $6)',
      [tenantA, 'Vinculo cruzado', 'https://example.invalid/hook', ['consulta.criada'], Buffer.from('sintetico'), usuarioSemConcessaoOutroTenantId]
    )).rejects.toMatchObject({ code: '23503' });

    const concorrentes = await Promise.allSettled([
      servico.exigirAcesso(tenantA, usuarioProfissionalTenantAId, 'api'),
      servico.atualizar(tenantA, gestor.rows[0].id, usuarioProfissionalTenantAId, {
        escoposApi: [], eventosWebhook: []
      })
    ]);
    expect(concorrentes[1].status).toBe('fulfilled');
    await expect(servico.exigirAcesso(tenantA, usuarioProfissionalTenantAId, 'api')).rejects.toThrow('ainda não concedeu');
    const historico = await executorTenant.executar(tenantA, (gerenciador) =>
      gerenciador.query(`select tipo, revogada_em from permissoes_integracao_profissional
        where tenant_id = $1 and usuario_id = $2 order by concedida_em`, [tenantA, usuarioProfissionalTenantAId]));
    expect(historico.map((item: { tipo: string }) => item.tipo).sort()).toEqual(['api', 'webhook']);
    expect(historico.every((item: { revogada_em: Date | null }) => item.revogada_em instanceof Date)).toBe(true);
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

  it('Fase 295: RLS isola conversas e mensagens clínicas do portal por tenant', async () => {
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');
    await comoTenant(tenantB);
    const pacienteB = await cliente.query<{ id: string }>(
      'select id from pacientes where tenant_id = $1 limit 1', [tenantB]
    );
    const profissionalB = await cliente.query<{ id: string }>(
      'select id from profissionais where tenant_id = $1 limit 1', [tenantB]
    );
    const usuarioB = await cliente.query<{ id: string }>(
      'select id from usuarios where tenant_id = $1 limit 1', [tenantB]
    );

    await comoTenant(tenantA);
    const paciente = await cliente.query<{ id: string }>(
      'select id from pacientes where tenant_id = $1 limit 1', [tenantA]
    );
    await expect(cliente.query(
      `insert into conversas_portal_paciente (tenant_id, paciente_id, status, ultima_mensagem_em)
       values ($1, $2, 'aguardando_clinica', now())`, [tenantA, pacienteB.rows[0].id]
    )).rejects.toMatchObject({ code: '23503' });
    await expect(cliente.query(
      `insert into conversas_portal_paciente (tenant_id, paciente_id, profissional_responsavel_id, status, ultima_mensagem_em)
       values ($1, $2, $3, 'aguardando_clinica', now())`, [tenantA, paciente.rows[0].id, profissionalB.rows[0].id]
    )).rejects.toMatchObject({ code: '23503' });
    const conversa = await cliente.query<{ id: string }>(
      `insert into conversas_portal_paciente (tenant_id, paciente_id, status, ultima_mensagem_em)
       values ($1, $2, 'aguardando_clinica', now()) returning id`,
      [tenantA, paciente.rows[0].id]
    );
    await expect(cliente.query(
      `insert into mensagens_portal_paciente (tenant_id, conversa_id, autor_usuario_id, autor_tipo, conteudo_criptografado)
       values ($1, $2, $3, 'paciente', $4)`,
      [tenantA, conversa.rows[0].id, usuarioB.rows[0].id, Buffer.from('conteudo-cifrado-sintetico')]
    )).rejects.toMatchObject({ code: '23503' });
    const mensagem = await cliente.query<{ id: string }>(
      `insert into mensagens_portal_paciente (tenant_id, conversa_id, autor_usuario_id, autor_tipo, conteudo_criptografado)
       values ($1, $2, $3, 'paciente', $4) returning id`,
      [tenantA, conversa.rows[0].id, usuarioIdTenantA, Buffer.from('conteudo-clinico-cifrado-sintetico')]
    );

    await comoTenant(tenantB);
    expect((await cliente.query('select id from conversas_portal_paciente where id = $1', [conversa.rows[0].id])).rows).toHaveLength(0);
    expect((await cliente.query('select id from mensagens_portal_paciente where id = $1', [mensagem.rows[0].id])).rows).toHaveLength(0);
    expect((await cliente.query('update mensagens_portal_paciente set autor_tipo = autor_tipo where id = $1', [mensagem.rows[0].id])).rowCount).toBe(0);
  });

  it('PB-17: RLS do catalogo oculta outro tenant e FK composta recusa vinculo cruzado', async () => {
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');
    await comoTenant(tenantB);
    const catalogoB = await cliente.query<{ id: string }>(
      `insert into catalogo_marcadores_exames (tenant_id, criado_por_usuario_id, definicao_criptografada)
       values ($1, $2, $3) returning id`,
      [tenantB, usuarioIdTenantB, Buffer.from('definicao-sintetica-b')]
    );

    await comoTenant(tenantA);
    const catalogoInvisivel = await cliente.query('select id from catalogo_marcadores_exames where id = $1', [catalogoB.rows[0].id]);
    expect(catalogoInvisivel.rows).toHaveLength(0);
    const usuarioA = await cliente.query<{ id: string }>('select id from usuarios where tenant_id = $1 limit 1', [tenantA]);
    const pacienteA = await cliente.query<{ id: string }>('select id from pacientes where tenant_id = $1 limit 1', [tenantA]);
    const coletaA = await cliente.query<{ id: string }>(
      `insert into coletas_exames_laboratoriais (tenant_id, paciente_id, autor_usuario_id, coletada_em)
       values ($1, $2, $3, current_date) returning id`,
      [tenantA, pacienteA.rows[0].id, usuarioA.rows[0].id]
    );
    const catalogoA = await cliente.query<{ id: string }>(
      `insert into catalogo_marcadores_exames (tenant_id, criado_por_usuario_id, definicao_criptografada)
       values ($1, $2, $3) returning id`,
      [tenantA, usuarioA.rows[0].id, Buffer.from('definicao-sintetica-a')]
    );
    const resultadoA = await cliente.query<{ id: string }>(
      `insert into marcadores_exames_laboratoriais (tenant_id, coleta_id, catalogo_marcador_id, resultado_criptografado)
       values ($1, $2, $3, $4) returning id`,
      [tenantA, coletaA.rows[0].id, catalogoA.rows[0].id, Buffer.from('resultado-sintetico')]
    );
    expect(resultadoA.rows).toHaveLength(1);
    await expect(cliente.query(
      `insert into marcadores_exames_laboratoriais (tenant_id, coleta_id, catalogo_marcador_id, resultado_criptografado)
       values ($1, $2, $3, $4)`,
      [tenantA, coletaA.rows[0].id, catalogoB.rows[0].id, Buffer.from('resultado-sintetico')]
    )).rejects.toMatchObject({ code: '23503' });
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

  it('Fase 309 isola preferencias/resumos e recusa escrita fora do tenant', async () => {
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');
    await comoTenant(tenantA);
    await cliente.query(
      `insert into preferencias_notificacao_usuario (tenant_id, usuario_id, modo_tarefa_concluida)
       values ($1, $2, 'diario')`, [tenantA, usuarioIdTenantA]
    );
    const resumo = await cliente.query<{ id: string }>(
      `insert into resumos_notificacao_usuario (tenant_id, usuario_id, periodo_inicio_em, periodo_fim_em, contagens)
       values ($1, $2, now() - interval '1 day', now(), '{"tarefa_concluida":1}'::jsonb) returning id`,
      [tenantA, usuarioIdTenantA]
    );
    expect(resumo.rows).toHaveLength(1);

    await comoTenant(tenantB);
    const preferenciasVisiveis = await cliente.query(
      'select 1 from preferencias_notificacao_usuario where tenant_id = $1 and usuario_id = $2',
      [tenantA, usuarioIdTenantA]
    );
    const resumosVisiveis = await cliente.query(
      'select 1 from resumos_notificacao_usuario where tenant_id = $1 and usuario_id = $2',
      [tenantA, usuarioIdTenantA]
    );
    expect(preferenciasVisiveis.rows).toHaveLength(0);
    expect(resumosVisiveis.rows).toHaveLength(0);
    await expect(cliente.query(
      `insert into preferencias_notificacao_usuario (tenant_id, usuario_id) values ($1, $2)`,
      [tenantA, usuarioIdTenantA]
    )).rejects.toMatchObject({ code: '42501' });
  });

  it('Fase 309 gera um unico resumo sob dois POST concorrentes no mesmo usuario', async () => {
    if (!cliente || !executorTenant || !fonteDadosRuntime) throw new Error('Prova Postgres da Fase 309 indisponivel.');
    await comoTenant(tenantA);
    const inicioLock = Date.now();
    await Promise.all(Array.from({ length: 2 }, () => executorTenant!.executar(tenantA, async (gerenciador) => {
      await gerenciador.query(
        "select pg_advisory_xact_lock(hashtextextended($1::text || ':' || $2::text, 0))",
        [tenantA, usuarioIdTenantA]
      );
      await gerenciador.query('select pg_sleep(0.5)');
    })));
    expect(Date.now() - inicioLock).toBeGreaterThanOrEqual(900);

    const notificacaoId = randomUUID();
    const recursoId = randomUUID();
    await cliente.query(
      `insert into notificacoes (id, tenant_id, usuario_id, tipo, recurso_tipo, recurso_id, modo_entrega,
        timezone_resumo, resumo_previsto_em, email_resumo, criado_em)
       values ($1, $2, $3, 'tarefa_concluida', 'tarefa', $4, 'diario', 'America/Sao_Paulo', now() - interval '1 hour', false, now() - interval '1 day')`,
      [notificacaoId, tenantA, usuarioIdTenantA, recursoId]
    );
    const servico = new ServicoNotificacoes(executorTenant, { descriptografar: () => '' } as never);
    const usuarioAutenticado = {
      tenantId: tenantA,
      usuarioId: usuarioIdTenantA,
      papel: 'Professional' as const,
      emailHash: 'hash-sintetico',
      permissoes: ['console.acessar' as const]
    };
    const resultados = await Promise.all([
      servico.gerarResumoPendente(usuarioAutenticado),
      servico.gerarResumoPendente(usuarioAutenticado)
    ]);
    expect(resultados.filter(({ gerado }) => gerado)).toHaveLength(1);
    const vinculacao = await executorTenant.executar(tenantA, (manager) => manager.query(
      `select n.resumo_id, r.contagens from notificacoes n join resumos_notificacao_usuario r
       on r.tenant_id = n.tenant_id and r.usuario_id = n.usuario_id and r.id = n.resumo_id
       where n.tenant_id = $1 and n.usuario_id = $2 and n.id = $3`,
      [tenantA, usuarioIdTenantA, notificacaoId]
    ));
    expect(vinculacao).toHaveLength(1);
    expect(vinculacao[0].contagens).toMatchObject({ tarefa_concluida: 1 });
    await cliente.query('delete from notificacoes where tenant_id = $1 and id = $2', [tenantA, notificacaoId]);
    await cliente.query('delete from resumos_notificacao_usuario where tenant_id = $1 and usuario_id = $2', [tenantA, usuarioIdTenantA]);
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

  /*
   * Prova de imutabilidade da trilha (EXC-AUD-003 do PR 52).
   *
   * Mora neste arquivo, e nao num harness proprio, por um motivo que vale mais
   * que a arrumacao: a role `octaclin_rls_prova` daqui recebe
   * `select, insert, update, delete` em todas as tabelas, ou seja, ela **tem**
   * privilegio de `UPDATE` sobre `user_action_logs`. E exatamente a condicao que
   * um `REVOKE` hardcoded nao cobriria e que o trigger precisa cobrir. Rodar a
   * prova aqui demonstra que quem barra a mutacao e o trigger, e nao o grant.
   */
  it('rejeita UPDATE na trilha mesmo para role que tem privilegio de UPDATE', async () => {
    await comoTenant(tenantA);
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');

    await expect(
      cliente.query(`update user_action_logs set acao = 'prova.adulterada' where id = $1`, [
        idsTenantA.user_action_logs
      ])
    ).rejects.toMatchObject({ code: '42501' });

    const conferencia = await cliente.query<{ acao: string }>(
      'select acao from user_action_logs where id = $1',
      [idsTenantA.user_action_logs]
    );
    expect(conferencia.rows).toEqual([{ acao: 'prova.rls' }]);
  });

  it('rejeita DELETE na trilha e preserva a linha', async () => {
    await comoTenant(tenantA);
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');

    await expect(
      cliente.query('delete from user_action_logs where id = $1', [idsTenantA.user_action_logs])
    ).rejects.toMatchObject({ code: '42501' });

    const conferencia = await cliente.query<{ total: number }>(
      'select count(*)::int as total from user_action_logs where id = $1',
      [idsTenantA.user_action_logs]
    );
    expect(conferencia.rows[0]?.total).toBe(1);
  });

  it('rejeita TRUNCATE da trilha inteira', async () => {
    await comoTenant(tenantA);
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');

    // Honestidade sobre o que esta linha prova: a role de prova tambem nao tem
    // privilegio de `TRUNCATE`, entao o `42501` poderia vir do privilegio em vez
    // do trigger. Quem prova a existencia do trigger de statement e a asercao de
    // catalogo do caso seguinte; esta aqui fecha o comportamento observavel.
    await expect(cliente.query('truncate table user_action_logs')).rejects.toMatchObject({ code: '42501' });
  });

  it('mantem os dois triggers da trilha em ENABLE ALWAYS, ativos ate em sessao de replicacao', async () => {
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');

    const resultado = await cliente.query<{ nome: string; habilitado: string }>(`
      select t.tgname as nome, t.tgenabled as habilitado
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
       where c.relname = 'user_action_logs'
         and not t.tgisinternal
       order by t.tgname
    `);

    expect(resultado.rows.map((linha) => ({ nome: linha.nome, habilitado: linha.habilitado }))).toEqual([
      { nome: 'trg_trilha_auditoria_append_only', habilitado: 'A' },
      { nome: 'trg_trilha_auditoria_sem_truncate', habilitado: 'A' }
    ]);
  });

  it('continua aceitando INSERT, que e o unico caminho de escrita legitimo da trilha', async () => {
    await comoTenant(tenantA);
    if (!cliente) throw new Error('Cliente da prova RLS nao foi inicializado.');

    const inserido = await cliente.query<{ id: string }>(
      `insert into user_action_logs (tenant_id, acao, metadados)
       values ($1, 'prova.append', '{"origem":"sintetica"}'::jsonb) returning id`,
      [tenantA]
    );
    expect(inserido.rows).toHaveLength(1);

    const conferencia = await cliente.query<{ acao: string }>(
      'select acao from user_action_logs where id = $1',
      [inserido.rows[0].id]
    );
    expect(conferencia.rows).toEqual([{ acao: 'prova.append' }]);
  });
});

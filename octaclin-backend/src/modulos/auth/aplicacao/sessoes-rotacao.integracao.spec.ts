import { randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Client } from 'pg';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { criarOpcoesTypeOrm } from '../../../infraestrutura/banco-dados/opcoes-typeorm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { GuardaJwt } from '../apresentacao/guarda-jwt';
import { RefreshTokenOrm } from '../infraestrutura/refresh-token.orm';
import { SessaoUsuarioOrm } from '../infraestrutura/sessao-usuario.orm';
import { ServicoAuth } from './servico-auth';
import { ServicoSessoes } from './servico-sessoes';

/**
 * Prova em Postgres real das propriedades que um mock nao demonstra: uso unico
 * do refresh token sob concorrencia, deteccao de reuso com revogacao de
 * familia, revogacao observada por outra instancia do processo e isolamento por
 * RLS da tabela de sessoes.
 *
 * No CI comum usa o Postgres de servico (variaveis `RLS_PROVA_BANCO_*` e o
 * banco ja migrado). Com `RLS_TESTCONTAINERS=true`, sobe um Postgres
 * descartavel e aplica as migrations reais. Sem nenhum dos dois modos o bloco e
 * pulado, para nao tornar a suite local dependente de Docker.
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
const descrever = usarTestcontainers || podeRodarExterno ? describe : describe.skip;

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

const CHAVES_AMBIENTE_JWT = ['APP_AMBIENTE', 'JWT_SEGREDO', 'JWT_REFRESH_SEGREDO'] as const;

type ConfiguracaoConexao = { host: string; porta: number; usuario: string; senha: string; banco: string };

interface Instancia {
  fonteDados: DataSource;
  executorTenant: ExecutorTenant;
  servicoAuth: ServicoAuth;
  servicoSessoes: ServicoSessoes;
  guarda: GuardaJwt;
}

function contextoRequisicao(accessToken: string) {
  const requisicao: Record<string, unknown> = { headers: { authorization: `Bearer ${accessToken}` } };
  return { requisicao, execucao: { switchToHttp: () => ({ getRequest: () => requisicao }) } as never };
}

descrever('sessoes e rotacao de refresh token em Postgres real', () => {
  let container: StartedTestContainer | undefined;
  let clienteRls: Client | undefined;
  let instanciaA: Instancia | undefined;
  let instanciaB: Instancia | undefined;
  const snapshotAmbiente = new Map<string, string | undefined>();

  let tenantA: string;
  let tenantB: string;
  let usuarioA: UsuarioOrm;
  let usuarioSegundoA: UsuarioOrm;

  function montarInstancia(fonteDados: DataSource): Instancia {
    const executorTenant = new ExecutorTenant(fonteDados);
    const servicoSessoes = new ServicoSessoes(executorTenant, new ServicoAuditoria(executorTenant));
    const jwt = new JwtService({});
    const servicoAuth = new ServicoAuth(
      fonteDados,
      executorTenant,
      jwt,
      { verificar: () => true } as never,
      { gerarHashBusca: (valor: string) => `hash:${valor}` } as never,
      {
        verificarDisponibilidade: async () => undefined,
        registrarFalha: async () => undefined,
        registrarSucesso: async () => undefined
      } as never,
      servicoSessoes,
      { iniciarLogin: async () => null } as never
    );

    return { fonteDados, executorTenant, servicoAuth, servicoSessoes, guarda: new GuardaJwt(jwt, servicoSessoes) };
  }

  async function criarFonteDados(migrar: boolean): Promise<DataSource> {
    const opcoes = criarOpcoesTypeOrm();
    const fonteDados = new DataSource({ ...opcoes, logging: false, migrationsRun: false } as DataSourceOptions);
    await fonteDados.initialize();
    if (migrar) await fonteDados.runMigrations({ transaction: 'all' });
    return fonteDados;
  }

  /**
   * Toda tabela tenant-scoped tem `force row level security`: mesmo a role dona
   * so enxerga a linha com `app.tenant_id` definido na transacao.
   */
  async function consultarComoTenant<T = Record<string, unknown>>(
    tenantId: string,
    sql: string,
    parametros: unknown[] = []
  ): Promise<T[]> {
    return instanciaA!.executorTenant.executar(tenantId, (gerenciador) => gerenciador.query(sql, parametros));
  }

  async function criarUsuario(tenantId: string): Promise<UsuarioOrm> {
    const linhas = await consultarComoTenant<UsuarioOrm>(
      tenantId,
      `insert into usuarios (tenant_id, email_hash, email_criptografado, senha_hash, role, ativo)
       values ($1, $2, $3, 'hash-sintetico', 'Professional', true)
       returning id, tenant_id as "tenantId", email_hash as "emailHash", role`,
      [tenantId, `hash-${randomUUID()}`, Buffer.from('sintetico')]
    );
    return linhas[0];
  }

  async function prepararTestcontainer(): Promise<ConfiguracaoConexao> {
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

    return {
      host: container.getHost(),
      porta: container.getMappedPort(5432),
      usuario: 'octaclin',
      senha: 'octaclin_testcontainers',
      banco: 'octaclin'
    };
  }

  beforeAll(async () => {
    for (const nome of [...CHAVES_AMBIENTE_BANCO, ...CHAVES_AMBIENTE_JWT]) {
      snapshotAmbiente.set(nome, process.env[nome]);
    }

    process.env.APP_AMBIENTE = 'test';
    process.env.JWT_SEGREDO = 'a'.repeat(48);
    process.env.JWT_REFRESH_SEGREDO = 'b'.repeat(48);

    const conexao: ConfiguracaoConexao = usarTestcontainers
      ? await prepararTestcontainer()
      : {
          host: configuracaoExterna.host!,
          porta: Number(configuracaoExterna.porta),
          usuario: 'octaclin',
          senha: process.env.BANCO_SENHA ?? 'octaclin_local',
          banco: configuracaoExterna.banco!
        };

    delete process.env.DATABASE_URL;
    process.env.BANCO_HOST = conexao.host;
    process.env.BANCO_PORTA = String(conexao.porta);
    process.env.BANCO_USUARIO = conexao.usuario;
    process.env.BANCO_SENHA = conexao.senha;
    process.env.BANCO_NOME = conexao.banco;
    process.env.BANCO_SSL = 'false';
    process.env.BANCO_EXECUTAR_MIGRACOES = 'false';

    // Duas fontes de dados independentes representam duas instancias do backend:
    // nada e compartilhado entre elas alem do Postgres.
    instanciaA = montarInstancia(await criarFonteDados(usarTestcontainers));
    instanciaB = montarInstancia(await criarFonteDados(false));

    tenantA = randomUUID();
    tenantB = randomUUID();
    await instanciaA.fonteDados.query(
      'insert into tenants (id, nome, slug) values ($1, $2, $3), ($4, $5, $6)',
      [tenantA, 'Sessoes A', `sessoes-a-${tenantA}`, tenantB, 'Sessoes B', `sessoes-b-${tenantB}`]
    );

    usuarioA = await criarUsuario(tenantA);
    usuarioSegundoA = await criarUsuario(tenantA);

    if (usarTestcontainers) {
      await instanciaA.fonteDados.query(`
        create role octaclin_rls_prova
          with login password 'octaclin_rls_prova_testcontainers'
          nosuperuser nocreatedb nocreaterole nobypassrls;
        grant connect on database octaclin to octaclin_rls_prova;
        grant usage on schema public to octaclin_rls_prova;
        grant select, insert, update, delete on all tables in schema public to octaclin_rls_prova;
      `);
    }

    clienteRls = new Client({
      host: conexao.host,
      port: conexao.porta,
      user: usarTestcontainers ? 'octaclin_rls_prova' : configuracaoExterna.usuario!,
      password: usarTestcontainers ? 'octaclin_rls_prova_testcontainers' : configuracaoExterna.senha!,
      database: conexao.banco
    });
    await clienteRls.connect();
  }, 240_000);

  afterAll(async () => {
    await clienteRls?.end().catch(() => undefined);
    await instanciaA?.fonteDados.destroy().catch(() => undefined);
    await instanciaB?.fonteDados.destroy().catch(() => undefined);
    await container?.stop().catch(() => undefined);

    for (const [nome, valor] of snapshotAmbiente) {
      if (valor === undefined) delete process.env[nome];
      else process.env[nome] = valor;
    }
  }, 60_000);

  async function abrirSessao(usuario = usuarioA) {
    return instanciaA!.servicoAuth.emitirSessaoUsuario(usuario, new Date());
  }

  async function estadoDaSessao(sessaoId: string) {
    const linhas = await consultarComoTenant<{ revogado_em: Date | null; motivo_revogacao: string | null }>(
      tenantA,
      'select revogado_em, motivo_revogacao from sessoes_usuario where id = $1',
      [sessaoId]
    );
    return linhas[0];
  }

  async function sessaoDoToken(refreshToken: string): Promise<string> {
    const partes = refreshToken.split('.');
    return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')).sid as string;
  }

  it('rotaciona o refresh token uma unica vez e emite descendente valido', async () => {
    const inicial = await abrirSessao();
    const rotacionado = await instanciaA!.servicoAuth.renovar({ refreshToken: inicial.refreshToken });

    expect(rotacionado.refreshToken).not.toBe(inicial.refreshToken);
    await expect(
      instanciaA!.servicoAuth.renovar({ refreshToken: rotacionado.refreshToken })
    ).resolves.toMatchObject({ tipoToken: 'Bearer' });
  });

  it('duas rotacoes concorrentes do mesmo token nao geram dois descendentes validos', async () => {
    const inicial = await abrirSessao();
    const sessaoId = await sessaoDoToken(inicial.refreshToken);

    const resultados = await Promise.allSettled([
      instanciaA!.servicoAuth.renovar({ refreshToken: inicial.refreshToken }),
      instanciaB!.servicoAuth.renovar({ refreshToken: inicial.refreshToken })
    ]);

    const aceitos = resultados.filter((resultado) => resultado.status === 'fulfilled');
    expect(aceitos).toHaveLength(1);

    const descendentesValidos = await consultarComoTenant<{ total: number }>(
      tenantA,
      'select count(*)::int as total from refresh_tokens where sessao_id = $1 and consumido_em is null and revogado_em is null',
      [sessaoId]
    );
    expect(descendentesValidos[0].total).toBe(0);

    const sessao = await estadoDaSessao(sessaoId);
    expect(sessao.revogado_em).not.toBeNull();
    expect(sessao.motivo_revogacao).toBe('reuso_detectado');
  });

  it('reuso de token ja consumido revoga a familia inteira e invalida o descendente', async () => {
    const inicial = await abrirSessao();
    const sessaoId = await sessaoDoToken(inicial.refreshToken);
    const descendente = await instanciaA!.servicoAuth.renovar({ refreshToken: inicial.refreshToken });

    await expect(
      instanciaA!.servicoAuth.renovar({ refreshToken: inicial.refreshToken })
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect((await estadoDaSessao(sessaoId)).motivo_revogacao).toBe('reuso_detectado');

    await expect(
      instanciaA!.servicoAuth.renovar({ refreshToken: descendente.refreshToken })
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const ativos = await consultarComoTenant<{ total: number }>(
      tenantA,
      'select count(*)::int as total from refresh_tokens where sessao_id = $1 and revogado_em is null',
      [sessaoId]
    );
    expect(ativos[0].total).toBe(0);
  });

  it('registra a deteccao de reuso em auditoria, sem token nem hash', async () => {
    const inicial = await abrirSessao();
    const sessaoId = await sessaoDoToken(inicial.refreshToken);
    await instanciaA!.servicoAuth.renovar({ refreshToken: inicial.refreshToken });
    await expect(
      instanciaA!.servicoAuth.renovar({ refreshToken: inicial.refreshToken })
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const registros = await consultarComoTenant<{ acao: string; metadados: unknown }>(
      tenantA,
      "select acao, metadados from user_action_logs where acao = 'auth.sessao.reuso_detectado' and recurso_id = $1",
      [sessaoId]
    );

    expect(registros).toHaveLength(1);
    expect(JSON.stringify(registros[0].metadados)).not.toMatch(/hash|eyJ/i);
  });

  it('access token continua aceito enquanto a sessao esta ativa', async () => {
    const sessao = await abrirSessao();
    const { execucao } = contextoRequisicao(sessao.accessToken);

    await expect(instanciaA!.guarda.canActivate(execucao)).resolves.toBe(true);
  });

  it('logout em uma instancia derruba o access token ainda valido lido por outra instancia', async () => {
    const sessao = await abrirSessao();
    const { execucao } = contextoRequisicao(sessao.accessToken);
    await expect(instanciaB!.guarda.canActivate(execucao)).resolves.toBe(true);

    await instanciaA!.servicoAuth.revogar(sessao.refreshToken);

    await expect(instanciaB!.guarda.canActivate(execucao)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logout revoga a sessao inteira, nao apenas o refresh apresentado', async () => {
    const sessao = await abrirSessao();
    const sessaoId = await sessaoDoToken(sessao.refreshToken);

    await instanciaA!.servicoAuth.revogar(sessao.refreshToken);

    expect((await estadoDaSessao(sessaoId)).motivo_revogacao).toBe('logout');
    await expect(
      instanciaA!.servicoAuth.renovar({ refreshToken: sessao.refreshToken })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('encerrar outras sessoes preserva a atual e derruba as demais', async () => {
    const primeira = await abrirSessao(usuarioSegundoA);
    const segunda = await abrirSessao(usuarioSegundoA);
    const terceira = await abrirSessao(usuarioSegundoA);
    const sessaoAtual = await sessaoDoToken(terceira.refreshToken);

    const usuarioAutenticado = {
      usuarioId: usuarioSegundoA.id,
      tenantId: tenantA,
      papel: 'Professional' as const,
      emailHash: usuarioSegundoA.emailHash,
      permissoes: [],
      sessaoId: sessaoAtual
    };

    const { encerradas } = await instanciaA!.servicoAuth.encerrarOutrasSessoes(usuarioAutenticado);
    expect(encerradas).toBeGreaterThanOrEqual(2);

    expect((await estadoDaSessao(await sessaoDoToken(primeira.refreshToken))).motivo_revogacao).toBe('encerrada_outras');
    expect((await estadoDaSessao(await sessaoDoToken(segunda.refreshToken))).motivo_revogacao).toBe('encerrada_outras');
    expect((await estadoDaSessao(sessaoAtual)).revogado_em).toBeNull();

    const { execucao } = contextoRequisicao(terceira.accessToken);
    await expect(instanciaB!.guarda.canActivate(execucao)).resolves.toBe(true);
  });

  it('usuario nao lista nem encerra sessao de outro usuario do mesmo tenant', async () => {
    const alheia = await abrirSessao(usuarioA);
    const sessaoAlheia = await sessaoDoToken(alheia.refreshToken);
    const propria = await abrirSessao(usuarioSegundoA);

    const lista = await instanciaA!.servicoSessoes.listar(
      tenantA,
      usuarioSegundoA.id,
      await sessaoDoToken(propria.refreshToken)
    );
    const referenciaAlheia = instanciaA!.servicoSessoes.referenciaPublica(sessaoAlheia);
    expect(lista.itens.map((item) => item.referencia)).not.toContain(referenciaAlheia);

    await expect(
      instanciaA!.servicoSessoes.encerrarPorReferencia(tenantA, usuarioSegundoA.id, referenciaAlheia)
    ).rejects.toMatchObject({ status: 404 });

    expect((await estadoDaSessao(sessaoAlheia)).revogado_em).toBeNull();
  });

  it('usuario de outro tenant nao alcanca a sessao mesmo com o identificador correto', async () => {
    const sessao = await abrirSessao(usuarioA);
    const sessaoId = await sessaoDoToken(sessao.refreshToken);

    const encerrou = await instanciaA!.servicoSessoes.revogar(
      tenantB,
      usuarioA.id,
      sessaoId,
      'encerrada_pelo_usuario'
    );

    expect(encerrou).toBe(false);
    expect((await estadoDaSessao(sessaoId)).revogado_em).toBeNull();
  });

  it('RLS isola sessoes_usuario por tenant e nega tudo sem contexto', async () => {
    const sessao = await abrirSessao(usuarioA);
    const sessaoId = await sessaoDoToken(sessao.refreshToken);

    await clienteRls!.query("select set_config('app.tenant_id', $1, false)", [tenantA]);
    const visivel = await clienteRls!.query('select id from sessoes_usuario where id = $1', [sessaoId]);
    expect(visivel.rows).toHaveLength(1);

    await clienteRls!.query("select set_config('app.tenant_id', $1, false)", [tenantB]);
    const invisivel = await clienteRls!.query('select id from sessoes_usuario where id = $1', [sessaoId]);
    expect(invisivel.rows).toHaveLength(0);
    const atualizacao = await clienteRls!.query('update sessoes_usuario set revogado_em = now() where id = $1', [sessaoId]);
    expect(atualizacao.rowCount).toBe(0);

    await clienteRls!.query("select set_config('app.tenant_id', $1, false)", ['']);
    const semContexto = await clienteRls!.query('select id from sessoes_usuario');
    expect(semContexto.rows).toHaveLength(0);
  });

  it('revogar todas encerra o parque do usuario sem tocar em outro usuario', async () => {
    const alvo = await abrirSessao(usuarioA);
    const outra = await abrirSessao(usuarioA);
    const preservada = await abrirSessao(usuarioSegundoA);

    const encerradas = await instanciaA!.servicoSessoes.revogarTodas(tenantA, usuarioA.id, 'senha_redefinida');
    expect(encerradas).toBeGreaterThanOrEqual(2);

    expect((await estadoDaSessao(await sessaoDoToken(alvo.refreshToken))).motivo_revogacao).toBe('senha_redefinida');
    expect((await estadoDaSessao(await sessaoDoToken(outra.refreshToken))).motivo_revogacao).toBe('senha_redefinida');
    expect((await estadoDaSessao(await sessaoDoToken(preservada.refreshToken))).revogado_em).toBeNull();

    const { execucao } = contextoRequisicao(alvo.accessToken);
    await expect(instanciaB!.guarda.canActivate(execucao)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('mantem RLS habilitada e forcada na tabela de sessoes', async () => {
    const linhas = await instanciaA!.fonteDados.query(
      "select relrowsecurity, relforcerowsecurity from pg_class where relname = 'sessoes_usuario'"
    );

    expect(linhas[0].relrowsecurity).toBe(true);
    expect(linhas[0].relforcerowsecurity).toBe(true);
  });

  it('nao grava o refresh token em claro em nenhuma coluna', async () => {
    const sessao = await abrirSessao();
    const linhas = await consultarComoTenant<{ token_hash: string }>(
      tenantA,
      'select token_hash from refresh_tokens where sessao_id = $1',
      [await sessaoDoToken(sessao.refreshToken)]
    );

    expect(linhas[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(linhas[0].token_hash).not.toContain(sessao.refreshToken.slice(0, 20));
  });

  it('preserva os refresh tokens legados gravados sem sessao', async () => {
    const [linha] = await consultarComoTenant<{ sessao_id: string | null; consumido_em: Date | null }>(
      tenantA,
      `insert into refresh_tokens (tenant_id, usuario_id, token_hash, familia_token, expira_em)
       values ($1, $2, $3, $4, now() + interval '30 days')
       returning id, sessao_id, consumido_em`,
      [tenantA, usuarioA.id, `legado-${randomUUID()}`, randomUUID()]
    );

    expect(linha.sessao_id).toBeNull();
    expect(linha.consumido_em).toBeNull();
  });

  it('mantem os indices de familia, sessao e tokens ativos', async () => {
    const indices = await instanciaA!.fonteDados.query<{ indexname: string }[]>(
      `select indexname from pg_indexes
       where tablename in ('sessoes_usuario', 'refresh_tokens')
         and indexname in ('idx_sessoes_usuario_ativas', 'idx_refresh_tokens_sessao', 'idx_refresh_tokens_ativos')`
    );

    expect(indices.map((linha) => linha.indexname).sort()).toEqual([
      'idx_refresh_tokens_ativos',
      'idx_refresh_tokens_sessao',
      'idx_sessoes_usuario_ativas'
    ]);
  });

  it('entidade de sessao permanece registrada no DataSource da aplicacao', () => {
    expect(instanciaA!.fonteDados.hasMetadata(SessaoUsuarioOrm)).toBe(true);
    expect(instanciaA!.fonteDados.hasMetadata(RefreshTokenOrm)).toBe(true);
  });
});

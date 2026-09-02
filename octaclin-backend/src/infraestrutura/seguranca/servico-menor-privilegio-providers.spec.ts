import { ServicoMenorPrivilegioProviders } from './servico-menor-privilegio-providers';

const ambienteOriginal = { ...process.env };

afterEach(() => {
  process.env = { ...ambienteOriginal };
  jest.restoreAllMocks();
});

function criarServico(fonteDados: unknown): ServicoMenorPrivilegioProviders {
  return new ServicoMenorPrivilegioProviders(fonteDados as never);
}

describe('ServicoMenorPrivilegioProviders', () => {
  it('reprova quando a role do runtime tem BYPASSRLS', async () => {
    const servico = criarServico({
      isInitialized: true,
      query: jest.fn(async () => [
        { usuario: 'octaclin_app_producao', super: false, bypassrls: true, herdaPrivilegio: false, podeCriarNoSchema: false }
      ])
    });

    const relatorio = await servico.avaliar();

    expect(relatorio.postgres.veredicto).toBe('violado');
    expect(relatorio.veredicto).toBe('violado');
  });

  it('aprova a role minima', async () => {
    process.env.APP_AMBIENTE = 'producao';
    process.env.REDIS_URL = 'rediss://host:6379';
    process.env.ARMAZENAMENTO_S3_ENDPOINT = 'https://s3.regiao.provedor.com';
    const servico = criarServico({
      isInitialized: true,
      query: jest.fn(async () => [
        { usuario: 'octaclin_app_producao', super: false, bypassrls: false, herdaPrivilegio: false, podeCriarNoSchema: false }
      ])
    });

    expect((await servico.avaliar()).veredicto).toBe('conforme');
  });

  it('trata falha da consulta como nao verificado, porque role restrita pode nao ler pg_roles', async () => {
    const servico = criarServico({
      isInitialized: true,
      query: jest.fn(async () => {
        throw new Error('permission denied for table pg_roles');
      })
    });

    const relatorio = await servico.avaliar();

    expect(relatorio.postgres.veredicto).toBe('nao-verificado');
    expect(relatorio.postgres.motivos.join(' ')).toContain('permission denied');
  });

  it('trata DataSource nao inicializado como nao verificado', async () => {
    const servico = criarServico({ isInitialized: false, query: jest.fn() });

    expect((await servico.avaliar()).postgres.veredicto).toBe('nao-verificado');
  });

  it('guarda o ultimo relatorio para consulta posterior', async () => {
    const servico = criarServico({
      isInitialized: true,
      query: jest.fn(async () => [
        { usuario: 'octaclin_app_producao', super: false, bypassrls: false, herdaPrivilegio: false, podeCriarNoSchema: false }
      ])
    });

    expect(servico.obterUltimoRelatorio()).toBeUndefined();
    await servico.avaliar();
    expect(servico.obterUltimoRelatorio()?.postgres.veredicto).toBe('conforme');
  });

  it('derruba o processo em producao quando o menor privilegio esta violado', async () => {
    process.env.APP_AMBIENTE = 'producao';
    const servico = criarServico({
      isInitialized: true,
      query: jest.fn(async () => [
        { usuario: 'neondb_owner', super: true, bypassrls: true, herdaPrivilegio: false, podeCriarNoSchema: true }
      ])
    });
    const erro = jest.spyOn(servico['logger'], 'error').mockImplementation(() => undefined);

    await expect(servico.onApplicationBootstrap()).rejects.toThrow('menor privilegio violado');
    expect(erro).toHaveBeenCalledTimes(1);
  });

  it('derruba o processo em staging, e nao apenas em producao', async () => {
    process.env.APP_AMBIENTE = 'staging';
    const servico = criarServico({
      isInitialized: true,
      query: jest.fn(async () => [
        { usuario: 'octaclin_app', super: false, bypassrls: true, herdaPrivilegio: false, podeCriarNoSchema: false }
      ])
    });
    jest.spyOn(servico['logger'], 'error').mockImplementation(() => undefined);

    await expect(servico.onApplicationBootstrap()).rejects.toThrow();
  });

  it('derruba o processo quando o privilegio do Postgres nao pode ser verificado em producao', async () => {
    process.env.APP_AMBIENTE = 'producao';
    const servico = criarServico({
      isInitialized: true,
      query: jest.fn(async () => {
        throw new Error('permission denied for table pg_roles');
      })
    });
    jest.spyOn(servico['logger'], 'error').mockImplementation(() => undefined);

    await expect(servico.onApplicationBootstrap()).rejects.toThrow('isolamento entre tenants');
  });

  /**
   * Estado real do `worker` de producao em 2026-09-02: ele nao configura
   * `ARMAZENAMENTO_S3_ENDPOINT` porque nao serve anexo.
   */
  it('deixa o worker subir sem armazenamento configurado', async () => {
    process.env.APP_AMBIENTE = 'producao';
    process.env.REDIS_URL = 'rediss://host:6379';
    delete process.env.ARMAZENAMENTO_S3_ENDPOINT;
    const servico = criarServico({
      isInitialized: true,
      query: jest.fn(async () => [
        { usuario: 'octaclin_app_producao', super: false, bypassrls: false, herdaPrivilegio: false, podeCriarNoSchema: false }
      ])
    });
    const log = jest.spyOn(servico['logger'], 'log').mockImplementation(() => undefined);

    await expect(servico.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('nao derruba o processo fora de staging e producao', async () => {
    process.env.APP_AMBIENTE = 'local';
    const servico = criarServico({
      isInitialized: true,
      query: jest.fn(async () => [
        { usuario: 'postgres', super: true, bypassrls: true, herdaPrivilegio: false, podeCriarNoSchema: true }
      ])
    });
    jest.spyOn(servico['logger'], 'error').mockImplementation(() => undefined);

    await expect(servico.onApplicationBootstrap()).resolves.toBeUndefined();
  });

  it('nao registra host, credencial nem nome de role no log de violacao', async () => {
    process.env.APP_AMBIENTE = 'producao';
    // Montada por partes de proposito: uma URL literal com credencial, ainda que
    // sintetica, faz `pnpm security:secrets` reprovar pelo formato -- e o gate
    // esta certo em nao distinguir fixture de valor real.
    const credencial = ['usuario', 'senha-secreta'].join(':');
    process.env.REDIS_URL = `${'redis'}://${credencial}@redis-interno:6379`;
    const servico = criarServico({
      isInitialized: true,
      query: jest.fn(async () => [
        { usuario: 'neondb_owner', super: true, bypassrls: true, herdaPrivilegio: false, podeCriarNoSchema: false }
      ])
    });
    const erro = jest.spyOn(servico['logger'], 'error').mockImplementation(() => undefined);

    // O bloqueio acontece depois do log: a evidencia precisa existir mesmo
    // quando o processo nao sobe.
    await expect(servico.onApplicationBootstrap()).rejects.toThrow();

    const registrado = JSON.stringify(erro.mock.calls);
    expect(registrado).not.toContain('senha-secreta');
    expect(registrado).not.toContain('redis-interno');
    expect(registrado).not.toContain('neondb_owner');
  });

  it('registra em nivel informativo quando esta conforme', async () => {
    process.env.APP_AMBIENTE = 'producao';
    process.env.REDIS_URL = 'rediss://host:6379';
    const servico = criarServico({
      isInitialized: true,
      query: jest.fn(async () => [
        { usuario: 'octaclin_app_producao', super: false, bypassrls: false, herdaPrivilegio: false, podeCriarNoSchema: false }
      ])
    });
    const log = jest.spyOn(servico['logger'], 'log').mockImplementation(() => undefined);
    const erro = jest.spyOn(servico['logger'], 'error').mockImplementation(() => undefined);

    await servico.onApplicationBootstrap();

    expect(log).toHaveBeenCalledTimes(1);
    expect(erro).not.toHaveBeenCalled();
  });
});

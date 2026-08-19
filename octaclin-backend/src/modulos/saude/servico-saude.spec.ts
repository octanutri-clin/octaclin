import { ServicoSaude } from './servico-saude';

describe('ServicoSaude', () => {
  const ambienteOriginal = process.env;

  beforeEach(() => {
    process.env = { ...ambienteOriginal };
    process.env.EMAIL_SMTP_USUARIO = 'octaclinsys@gmail.com';
    process.env.EMAIL_SMTP_SENHA = 'senha-app';
    process.env.META_WHATSAPP_TOKEN = 'token-meta';
    process.env.META_WHATSAPP_PHONE_NUMBER_ID = 'phone-number-id';
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = 'refresh-token';
    process.env.REDIS_URL = 'rediss://default:senha@redis.example.com:6379';
    delete process.env.BANCO_HEALTH_TIMEOUT_MS;
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  it('deve retornar health detalhado sem expor secrets quando dependencias criticas estiverem configuradas', async () => {
    const fonteDados = {
      isInitialized: true,
      query: jest.fn(async () => [{ ok: 1 }]),
      options: { extra: { max: 8 } },
      driver: {
        master: { totalCount: 5, idleCount: 3, waitingCount: 1 }
      },
      migrations: [{ name: "Migracao1" }],
      showMigrations: jest.fn(async () => false)
    };
    const servico = new ServicoSaude(fonteDados as never, { ping: jest.fn(async () => 'PONG') } as never);

    const resposta = await servico.verificarDetalhado();

    expect(resposta.status).toBe('ok');
    expect(resposta.checks.banco.status).toBe('ok');
    expect(resposta.checks.banco.detalhes).toEqual({
      latenciaMs: expect.any(Number),
      poolMax: 8,
      poolTotal: 5,
      poolOciosas: 3,
      poolAguardando: 1
    });
    expect(resposta.checks.redis.status).toBe('ok');
    expect(resposta.checks.email.status).toBe('ok');
    expect(resposta.checks.whatsapp.status).toBe('ok');
    expect(resposta.checks.googleCalendar.status).toBe('ok');
    expect(JSON.stringify(resposta)).not.toContain('senha');
    expect(JSON.stringify(resposta)).not.toContain('token-meta');
    expect(JSON.stringify(resposta)).not.toContain('refresh-token');
    expect(fonteDados.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('reporta o servico de IA como nao configurado sem degradar a saude geral', async () => {
    delete process.env.IA_SERVICE_URL;
    delete process.env.IA_SERVICE_TOKEN;
    const servico = new ServicoSaude(
      {
        isInitialized: true,
        query: jest.fn(async () => [{ ok: 1 }]),
        options: { extra: { max: 8 } },
        driver: { master: { totalCount: 1, idleCount: 1, waitingCount: 0 } },
        migrations: [{ name: 'Migracao1' }],
        showMigrations: jest.fn(async () => false)
      } as never,
      { ping: jest.fn(async () => 'PONG') } as never
    );

    const resposta = await servico.verificarDetalhado();

    expect(resposta.checks.ia).toEqual({ status: 'ok', detalhes: { configurado: false } });
    expect(resposta.status).toBe('ok');
  });

  it('reporta o servico de IA configurado sem expor o token nem o host completo', async () => {
    process.env.IA_SERVICE_URL = 'https://ia.interno.example/base';
    process.env.IA_SERVICE_TOKEN = 'segredo-ia-de-32-caracteres-no-minimo';
    const servico = new ServicoSaude(
      {
        isInitialized: true,
        query: jest.fn(async () => [{ ok: 1 }]),
        options: { extra: { max: 8 } },
        driver: { master: { totalCount: 1, idleCount: 1, waitingCount: 0 } },
        migrations: [{ name: 'Migracao1' }],
        showMigrations: jest.fn(async () => false)
      } as never,
      { ping: jest.fn(async () => 'PONG') } as never
    );

    const resposta = await servico.verificarDetalhado();

    expect(resposta.checks.ia).toEqual({ status: 'ok', detalhes: { configurado: true } });
    expect(JSON.stringify(resposta)).not.toContain('segredo-ia');
    expect(JSON.stringify(resposta)).not.toContain('ia.interno.example');
  });

  it('marca o servico de IA como degradado quando so metade da configuracao existe', async () => {
    process.env.IA_SERVICE_URL = 'https://ia.interno.example';
    delete process.env.IA_SERVICE_TOKEN;
    const servico = new ServicoSaude(
      {
        isInitialized: true,
        query: jest.fn(async () => [{ ok: 1 }]),
        options: { extra: { max: 8 } },
        driver: { master: { totalCount: 1, idleCount: 1, waitingCount: 0 } },
        migrations: [{ name: 'Migracao1' }],
        showMigrations: jest.fn(async () => false)
      } as never,
      { ping: jest.fn(async () => 'PONG') } as never
    );

    const resposta = await servico.verificarDetalhado();

    expect(resposta.checks.ia.status).toBe('degradado');
    expect(resposta.status).toBe('degradado');
  });

  it('deve marcar health como falha quando banco nao responder', async () => {
    const servico = new ServicoSaude({
      isInitialized: true,
      query: jest.fn(async () => {
        throw new Error('database unavailable');
      }),
      migrations: [{ name: 'Migracao1' }],
      showMigrations: jest.fn(async () => {
        throw new Error('database unavailable');
      })
    } as never);

    const resposta = await servico.verificarDetalhado();

    expect(resposta.status).toBe('falha');
    expect(resposta.checks.banco).toEqual(
      expect.objectContaining({
        status: 'falha',
        mensagem: 'database unavailable'
      })
    );
  });

  it('deve encerrar o check quando o pool nao entregar conexao dentro do prazo', async () => {
    process.env.BANCO_HEALTH_TIMEOUT_MS = '10';
    const servico = new ServicoSaude({
      isInitialized: true,
      query: jest.fn(() => new Promise(() => undefined)),
      migrations: [],
      showMigrations: jest.fn(async () => false)
    } as never);

    const resposta = await servico.verificarDetalhado();

    expect(resposta.checks.banco).toEqual({
      status: 'falha',
      mensagem: 'Tempo esgotado.'
    });
  });

  it('deve validar Redis por PING antes de marcar o check como saudavel', async () => {
    const redis = { ping: jest.fn(async () => 'PONG') };
    const servico = new ServicoSaude(
      {
        isInitialized: true,
        query: jest.fn(async () => [{ ok: 1 }]),
      migrations: [{ name: "Migracao1" }],
      showMigrations: jest.fn(async () => false)
      } as never,
      redis as never
    );

    const resposta = await servico.verificarDetalhado();

    expect(redis.ping).toHaveBeenCalledTimes(1);
    expect(resposta.checks.redis.status).toBe('ok');
  });

  it('deve aceitar OAuth por profissional sem refresh token global do Google Calendar', async () => {
    delete process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
    const servico = new ServicoSaude(
      {
        isInitialized: true,
        query: jest.fn(async () => [{ ok: 1 }]),
      migrations: [{ name: "Migracao1" }],
      showMigrations: jest.fn(async () => false)
      } as never,
      { ping: jest.fn(async () => 'PONG') } as never
    );

    const resposta = await servico.verificarDetalhado();

    expect(resposta.checks.googleCalendar).toEqual({
      status: 'ok',
      detalhes: {
        calendarIdConfigurado: false,
        modo: 'oauth_por_profissional'
      }
    });
  });

  it('deve marcar Redis configurado como falha quando PING rejeitar', async () => {
    const redis = { ping: jest.fn(async () => Promise.reject(new Error('redis connection refused'))) };
    const servico = new ServicoSaude(
      {
        isInitialized: true,
        query: jest.fn(async () => [{ ok: 1 }]),
      migrations: [{ name: "Migracao1" }],
      showMigrations: jest.fn(async () => false)
      } as never,
      redis as never
    );

    const resposta = await servico.verificarDetalhado();

    expect(resposta.status).toBe('falha');
    expect(resposta.checks.redis).toEqual({ status: 'falha', mensagem: 'Redis indisponivel.' });
  });

  it('deve sinalizar integracoes opcionais ausentes como degradadas', async () => {
    delete process.env.EMAIL_SMTP_USUARIO;
    delete process.env.EMAIL_SMTP_SENHA;
    delete process.env.GMAIL_CLIENT_ID;
    delete process.env.GMAIL_CLIENT_SECRET;
    delete process.env.GMAIL_REFRESH_TOKEN;
    delete process.env.META_WHATSAPP_TOKEN;
    delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    delete process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORTA;

    const servico = new ServicoSaude({
      isInitialized: true,
      query: jest.fn(async () => [{ ok: 1 }]),
      migrations: [{ name: "Migracao1" }],
      showMigrations: jest.fn(async () => false)
    } as never);

    const resposta = await servico.verificarDetalhado();

    expect(resposta.status).toBe('degradado');
    expect(resposta.checks.redis.status).toBe('degradado');
    expect(resposta.checks.email.status).toBe('degradado');
    expect(resposta.checks.whatsapp.status).toBe('degradado');
    expect(resposta.checks.googleCalendar.status).toBe('degradado');
  });

  // Em 2026-08-06 o banco de producao estava cinco migrations atras do codigo
  // (`1015` a `1019`), e `/health/detalhado` respondia 200 assim mesmo. As
  // features das Fases 206 a 209 nao tinham como funcionar e nada apontava para
  // isso. Estes testes existem para que a deriva volte a ser visivel.
  it('marca migrations pendentes como falha, porque o schema atras do codigo quebra feature em silencio', async () => {
    const servico = new ServicoSaude(
      {
        isInitialized: true,
        query: jest.fn(async () => [{ ok: 1 }]),
        migrations: [{ name: 'Migracao1' }, { name: 'Migracao2' }],
        showMigrations: jest.fn(async () => true)
      } as never,
      { ping: jest.fn(async () => 'PONG') } as never
    );

    const resposta = await servico.verificarDetalhado();

    expect(resposta.checks.migracoes.status).toBe('falha');
    expect(resposta.status).toBe('falha');
    // O operador precisa saber o que rodar, nao so que algo esta errado.
    expect(resposta.checks.migracoes.mensagem).toContain('migration:run');
  });

  it('marca migrations em dia como ok', async () => {
    const servico = new ServicoSaude(
      {
        isInitialized: true,
        query: jest.fn(async () => [{ ok: 1 }]),
        migrations: [{ name: 'Migracao1' }, { name: 'Migracao2' }],
        showMigrations: jest.fn(async () => false)
      } as never,
      { ping: jest.fn(async () => 'PONG') } as never
    );

    const resposta = await servico.verificarDetalhado();

    expect(resposta.checks.migracoes).toEqual({
      status: 'ok',
      detalhes: { registradas: 2 }
    });
    expect(resposta.status).toBe('ok');
  });

  it('nao derruba o health inteiro quando a checagem de migrations falha', async () => {
    const servico = new ServicoSaude(
      {
        isInitialized: true,
        query: jest.fn(async () => [{ ok: 1 }]),
        migrations: [{ name: 'Migracao1' }],
        showMigrations: jest.fn(async () => {
          throw new Error('permission denied for table migrations');
        })
      } as never,
      { ping: jest.fn(async () => 'PONG') } as never
    );

    const resposta = await servico.verificarDetalhado();

    expect(resposta.checks.migracoes.status).toBe('falha');
    expect(resposta.checks.migracoes.mensagem).toBe('permission denied for table migrations');
    // Os demais checks continuam sendo avaliados e reportados.
    expect(resposta.checks.banco.status).toBe('ok');
    expect(resposta.checks.redis.status).toBe('ok');
  });
});

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
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  it('deve retornar health detalhado sem expor secrets quando dependencias criticas estiverem configuradas', async () => {
    const fonteDados = {
      isInitialized: true,
      query: jest.fn(async () => [{ ok: 1 }])
    };
    const servico = new ServicoSaude(fonteDados as never, { ping: jest.fn(async () => 'PONG') } as never);

    const resposta = await servico.verificarDetalhado();

    expect(resposta.status).toBe('ok');
    expect(resposta.checks.banco.status).toBe('ok');
    expect(resposta.checks.redis.status).toBe('ok');
    expect(resposta.checks.email.status).toBe('ok');
    expect(resposta.checks.whatsapp.status).toBe('ok');
    expect(resposta.checks.googleCalendar.status).toBe('ok');
    expect(JSON.stringify(resposta)).not.toContain('senha');
    expect(JSON.stringify(resposta)).not.toContain('token-meta');
    expect(JSON.stringify(resposta)).not.toContain('refresh-token');
    expect(fonteDados.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('deve marcar health como falha quando banco nao responder', async () => {
    const servico = new ServicoSaude({
      isInitialized: true,
      query: jest.fn(async () => {
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

  it('deve validar Redis por PING antes de marcar o check como saudavel', async () => {
    const redis = { ping: jest.fn(async () => 'PONG') };
    const servico = new ServicoSaude(
      {
        isInitialized: true,
        query: jest.fn(async () => [{ ok: 1 }])
      } as never,
      redis as never
    );

    const resposta = await servico.verificarDetalhado();

    expect(redis.ping).toHaveBeenCalledTimes(1);
    expect(resposta.checks.redis.status).toBe('ok');
  });

  it('deve marcar Redis configurado como falha quando PING rejeitar', async () => {
    const redis = { ping: jest.fn(async () => Promise.reject(new Error('redis connection refused'))) };
    const servico = new ServicoSaude(
      {
        isInitialized: true,
        query: jest.fn(async () => [{ ok: 1 }])
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
      query: jest.fn(async () => [{ ok: 1 }])
    } as never);

    const resposta = await servico.verificarDetalhado();

    expect(resposta.status).toBe('degradado');
    expect(resposta.checks.redis.status).toBe('degradado');
    expect(resposta.checks.email.status).toBe('degradado');
    expect(resposta.checks.whatsapp.status).toBe('degradado');
    expect(resposta.checks.googleCalendar.status).toBe('degradado');
  });
});

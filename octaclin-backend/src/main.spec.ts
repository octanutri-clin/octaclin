const mockServidorHttp = {
  set: jest.fn()
};

const mockAplicacao = {
  get: jest.fn(() => ({})),
  getHttpAdapter: jest.fn(() => ({
    getInstance: jest.fn(() => mockServidorHttp)
  })),
  use: jest.fn(),
  useGlobalInterceptors: jest.fn(),
  enableShutdownHooks: jest.fn(),
  enableCors: jest.fn(),
  useGlobalPipes: jest.fn(),
  useBodyParser: jest.fn(),
  listen: jest.fn().mockResolvedValue(undefined)
};

const mockCriarAplicacao = jest.fn();

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: mockCriarAplicacao
  }
}));

jest.mock('./modulo-aplicacao', () => ({
  ModuloAplicacao: class ModuloAplicacao {}
}));

function carregarMain() {
  return jest.isolateModulesAsync(async () => {
    await import('./main');
  });
}

describe('inicializacao da aplicacao', () => {
  const ambienteOriginal = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...ambienteOriginal, NODE_ENV: 'production' };
    process.env.OCTACLIN_PROCESSO = 'web';
    process.env.FORMULARIO_PUBLICO_SEGREDO = 'segredo-formulario-publico-32-bytes';
    process.env.JWT_SEGREDO = 'segredo-access-sintetico-com-mais-de-32-bytes';
    process.env.JWT_REFRESH_SEGREDO = 'segredo-refresh-sintetico-com-mais-de-32-bytes';
    process.env.CRIPTOGRAFIA_CHAVE_AES_256 = 'chave-aes-sintetica-de-teste-com-32-bytes';
    delete process.env.META_WHATSAPP_TOKEN;
    delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    delete process.env.META_WHATSAPP_APP_SECRET;
    delete process.env.CORS_ORIGINS;
    delete process.env.APP_AMBIENTE;
    delete process.env.CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR;
    delete process.env.CRIPTOGRAFIA_CHAVE_INDICE_HMAC;
    mockCriarAplicacao.mockResolvedValue(mockAplicacao);
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  it('recusa iniciar em producao com segredo JWT curto', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    process.env.JWT_SEGREDO = 'curto';
    process.env.JWT_REFRESH_SEGREDO = 'segredo-refresh-sintetico-com-mais-de-32-bytes';

    await expect(carregarMain()).rejects.toThrow('32 bytes');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa iniciar em producao com access e refresh compartilhando o segredo', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    process.env.JWT_SEGREDO = 'segredo-compartilhado-sintetico-32-bytes';
    process.env.JWT_REFRESH_SEGREDO = 'segredo-compartilhado-sintetico-32-bytes';

    await expect(carregarMain()).rejects.toThrow('diferente');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa iniciar em staging sem segredo JWT, mesmo fora de NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'development';
    process.env.APP_AMBIENTE = 'staging';
    process.env.CORS_ORIGINS = 'https://staging.octaclin.test';
    delete process.env.JWT_SEGREDO;

    await expect(carregarMain()).rejects.toThrow('JWT_SEGREDO');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa iniciar em producao sem CORS_ORIGINS', async () => {
    await expect(carregarMain()).rejects.toThrow('CORS_ORIGINS');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa iniciar em producao com CORS_ORIGINS curinga', async () => {
    process.env.CORS_ORIGINS = '*';

    await expect(carregarMain()).rejects.toThrow('CORS_ORIGINS');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa iniciar em producao sem segredo JWT', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    delete process.env.JWT_SEGREDO;

    await expect(carregarMain()).rejects.toThrow('JWT_SEGREDO');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa iniciar em producao sem segredo de refresh JWT', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    process.env.JWT_SEGREDO = 'segredo-access-sintetico-com-mais-de-32-bytes';
    delete process.env.JWT_REFRESH_SEGREDO;

    await expect(carregarMain()).rejects.toThrow('JWT_REFRESH_SEGREDO');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa iniciar em producao sem chave de criptografia', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    process.env.JWT_SEGREDO = 'segredo-access-sintetico-com-mais-de-32-bytes';
    process.env.JWT_REFRESH_SEGREDO = 'segredo-refresh-sintetico-com-mais-de-32-bytes';
    delete process.env.CRIPTOGRAFIA_CHAVE_AES_256;

    await expect(carregarMain()).rejects.toThrow('CRIPTOGRAFIA_CHAVE_AES_256');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa chave de criptografia com material insuficiente em producao', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    process.env.JWT_SEGREDO = 'segredo-access-sintetico-com-mais-de-32-bytes';
    process.env.JWT_REFRESH_SEGREDO = 'segredo-refresh-sintetico-com-mais-de-32-bytes';
    process.env.CRIPTOGRAFIA_CHAVE_AES_256 = 'curta-demais';

    await expect(carregarMain()).rejects.toThrow('CRIPTOGRAFIA_CHAVE_AES_256 precisa ter pelo menos 32 bytes');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa chave anterior de rotacao igual a chave atual em producao', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    process.env.JWT_SEGREDO = 'segredo-access-sintetico-com-mais-de-32-bytes';
    process.env.JWT_REFRESH_SEGREDO = 'segredo-refresh-sintetico-com-mais-de-32-bytes';
    process.env.CRIPTOGRAFIA_CHAVE_AES_256 = 'chave-criptografia-sintetica-com-32-bytes-ou-mais';
    process.env.CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR = 'chave-criptografia-sintetica-com-32-bytes-ou-mais';

    await expect(carregarMain()).rejects.toThrow('CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR deve ser diferente');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa iniciar em producao sem segredo dedicado de formulario publico', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    process.env.JWT_SEGREDO = 'segredo-access-sintetico-com-mais-de-32-bytes';
    process.env.JWT_REFRESH_SEGREDO = 'segredo-refresh-sintetico-com-mais-de-32-bytes';
    process.env.CRIPTOGRAFIA_CHAVE_AES_256 = 'chave-criptografia-sintetica-com-32-bytes-ou-mais';
    delete process.env.FORMULARIO_PUBLICO_SEGREDO;

    await expect(carregarMain()).rejects.toThrow('FORMULARIO_PUBLICO_SEGREDO');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa OAuth Google parcialmente configurado sem segredo dedicado de state', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    process.env.JWT_SEGREDO = 'segredo-access-sintetico-com-mais-de-32-bytes';
    process.env.JWT_REFRESH_SEGREDO = 'segredo-refresh-sintetico-com-mais-de-32-bytes';
    process.env.CRIPTOGRAFIA_CHAVE_AES_256 = 'chave-criptografia-sintetica-com-32-bytes-ou-mais';
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
    delete process.env.GOOGLE_CALENDAR_OAUTH_STATE_SECRET;

    await expect(carregarMain()).rejects.toThrow('GOOGLE_CALENDAR_OAUTH_STATE_SECRET');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa integracao Meta em producao sem app secret do webhook', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    process.env.JWT_SEGREDO = 'segredo-access-sintetico-com-mais-de-32-bytes';
    process.env.JWT_REFRESH_SEGREDO = 'segredo-refresh-sintetico-com-mais-de-32-bytes';
    process.env.CRIPTOGRAFIA_CHAVE_AES_256 = 'chave-criptografia-sintetica-com-32-bytes-ou-mais';
    process.env.META_WHATSAPP_TOKEN = 'token-sintetico';
    process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-sintetico';

    await expect(carregarMain()).rejects.toThrow('META_WHATSAPP_APP_SECRET');
    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa app secret Meta curto em producao', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    process.env.JWT_SEGREDO = 'segredo-access-sintetico-com-mais-de-32-bytes';
    process.env.JWT_REFRESH_SEGREDO = 'segredo-refresh-sintetico-com-mais-de-32-bytes';
    process.env.CRIPTOGRAFIA_CHAVE_AES_256 = 'chave-criptografia-sintetica-com-32-bytes-ou-mais';
    process.env.META_WHATSAPP_TOKEN = 'token-sintetico';
    process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-sintetico';
    process.env.META_WHATSAPP_APP_SECRET = 'curto';

    await expect(carregarMain()).rejects.toThrow('pelo menos 32 bytes');
    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('confia em exatamente um proxy para resolver req.ip atras do proxy do Render', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    process.env.JWT_SEGREDO = 'segredo-access-sintetico-com-mais-de-32-bytes';
    process.env.JWT_REFRESH_SEGREDO = 'segredo-refresh-sintetico-com-mais-de-32-bytes';
    process.env.CRIPTOGRAFIA_CHAVE_AES_256 = 'chave-criptografia-sintetica-com-32-bytes-ou-mais';

    await carregarMain();

    expect(mockCriarAplicacao).toHaveBeenCalledWith(expect.any(Function), { rawBody: true });
    expect(mockAplicacao.useBodyParser).toHaveBeenCalledWith('json', { limit: '100kb' });
    expect(mockServidorHttp.set).toHaveBeenCalledWith('trust proxy', 1);
    expect(mockAplicacao.enableShutdownHooks).toHaveBeenCalledTimes(1);
  });
});

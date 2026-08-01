const mockServidorHttp = {
  set: jest.fn()
};

const mockAplicacao = {
  getHttpAdapter: jest.fn(() => ({
    getInstance: jest.fn(() => mockServidorHttp)
  })),
  use: jest.fn(),
  useGlobalInterceptors: jest.fn(),
  enableCors: jest.fn(),
  useGlobalPipes: jest.fn(),
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
    process.env.FORMULARIO_PUBLICO_SEGREDO = 'segredo-formulario-publico-32-bytes';
    delete process.env.CORS_ORIGINS;
    mockCriarAplicacao.mockResolvedValue(mockAplicacao);
  });

  afterAll(() => {
    process.env = ambienteOriginal;
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
    process.env.JWT_SEGREDO = 'segredo-access';
    delete process.env.JWT_REFRESH_SEGREDO;

    await expect(carregarMain()).rejects.toThrow('JWT_REFRESH_SEGREDO');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa iniciar em producao sem chave de criptografia', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    process.env.JWT_SEGREDO = 'segredo-access';
    process.env.JWT_REFRESH_SEGREDO = 'segredo-refresh';
    delete process.env.CRIPTOGRAFIA_CHAVE_AES_256;

    await expect(carregarMain()).rejects.toThrow('CRIPTOGRAFIA_CHAVE_AES_256');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa iniciar em producao sem segredo dedicado de formulario publico', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    process.env.JWT_SEGREDO = 'segredo-access';
    process.env.JWT_REFRESH_SEGREDO = 'segredo-refresh';
    process.env.CRIPTOGRAFIA_CHAVE_AES_256 = 'chave-criptografia-32-bytes';
    delete process.env.FORMULARIO_PUBLICO_SEGREDO;

    await expect(carregarMain()).rejects.toThrow('FORMULARIO_PUBLICO_SEGREDO');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa OAuth Google parcialmente configurado sem segredo dedicado de state', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    process.env.JWT_SEGREDO = 'segredo-access';
    process.env.JWT_REFRESH_SEGREDO = 'segredo-refresh';
    process.env.CRIPTOGRAFIA_CHAVE_AES_256 = 'chave-criptografia-32-bytes';
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
    delete process.env.GOOGLE_CALENDAR_OAUTH_STATE_SECRET;

    await expect(carregarMain()).rejects.toThrow('GOOGLE_CALENDAR_OAUTH_STATE_SECRET');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('confia em exatamente um proxy para resolver req.ip atras do proxy do Render', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    process.env.JWT_SEGREDO = 'segredo-access';
    process.env.JWT_REFRESH_SEGREDO = 'segredo-refresh';
    process.env.CRIPTOGRAFIA_CHAVE_AES_256 = 'chave-criptografia-32-bytes';

    await carregarMain();

    expect(mockCriarAplicacao).toHaveBeenCalled();
    expect(mockServidorHttp.set).toHaveBeenCalledWith('trust proxy', 1);
  });
});

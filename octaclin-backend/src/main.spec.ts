const mockAplicacao = {
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

describe('inicializacao da aplicacao', () => {
  const ambienteOriginal = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...ambienteOriginal, NODE_ENV: 'production' };
    delete process.env.CORS_ORIGINS;
    mockCriarAplicacao.mockResolvedValue(mockAplicacao);
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  it('recusa iniciar em producao sem CORS_ORIGINS', async () => {
    await expect(import('./main')).rejects.toThrow('CORS_ORIGINS');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa iniciar em producao com CORS_ORIGINS curinga', async () => {
    process.env.CORS_ORIGINS = '*';

    await expect(import('./main')).rejects.toThrow('CORS_ORIGINS');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa iniciar em producao sem segredo JWT', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    delete process.env.JWT_SEGREDO;

    await expect(import('./main')).rejects.toThrow('JWT_SEGREDO');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa iniciar em producao sem segredo de refresh JWT', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    process.env.JWT_SEGREDO = 'segredo-access';
    delete process.env.JWT_REFRESH_SEGREDO;

    await expect(import('./main')).rejects.toThrow('JWT_REFRESH_SEGREDO');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });

  it('recusa iniciar em producao sem chave de criptografia', async () => {
    process.env.CORS_ORIGINS = 'https://app.octaclin.test';
    process.env.JWT_SEGREDO = 'segredo-access';
    process.env.JWT_REFRESH_SEGREDO = 'segredo-refresh';
    delete process.env.CRIPTOGRAFIA_CHAVE_AES_256;

    await expect(import('./main')).rejects.toThrow('CRIPTOGRAFIA_CHAVE_AES_256');

    expect(mockCriarAplicacao).not.toHaveBeenCalled();
  });
});

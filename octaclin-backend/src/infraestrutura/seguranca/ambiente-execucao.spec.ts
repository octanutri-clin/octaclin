import { ambienteExigeFalhaFechada, obterAmbienteExecucao } from './ambiente-execucao';

const ambienteOriginal = process.env;

describe('ambiente-execucao', () => {
  beforeEach(() => {
    process.env = { ...ambienteOriginal };
    delete process.env.APP_AMBIENTE;
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  it.each([
    ['production', 'producao'],
    ['producao', 'producao'],
    ['staging', 'staging'],
    ['homologacao', 'staging'],
    ['development', 'local'],
    ['local', 'local'],
    ['test', 'test']
  ])('resolve APP_AMBIENTE=%s como %s', (valor, esperado) => {
    process.env.APP_AMBIENTE = valor;

    expect(obterAmbienteExecucao()).toBe(esperado);
  });

  it('usa NODE_ENV quando APP_AMBIENTE nao esta definido', () => {
    process.env.NODE_ENV = 'production';
    expect(obterAmbienteExecucao()).toBe('producao');

    process.env.NODE_ENV = 'test';
    expect(obterAmbienteExecucao()).toBe('test');

    process.env.NODE_ENV = 'development';
    expect(obterAmbienteExecucao()).toBe('local');
  });

  it('rejeita APP_AMBIENTE desconhecido em vez de assumir ambiente permissivo', () => {
    process.env.APP_AMBIENTE = 'prod-ish';

    expect(() => obterAmbienteExecucao()).toThrow('APP_AMBIENTE');
  });

  it('exige falha fechada em staging e producao, e nao exige em local/test', () => {
    process.env.APP_AMBIENTE = 'producao';
    expect(ambienteExigeFalhaFechada()).toBe(true);

    process.env.APP_AMBIENTE = 'staging';
    expect(ambienteExigeFalhaFechada()).toBe(true);

    process.env.APP_AMBIENTE = 'local';
    expect(ambienteExigeFalhaFechada()).toBe(false);

    process.env.APP_AMBIENTE = 'test';
    expect(ambienteExigeFalhaFechada()).toBe(false);
  });
});

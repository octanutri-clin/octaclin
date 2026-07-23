import { criarOpcoesTypeOrm } from './opcoes-typeorm';

const ambienteOriginal = process.env;

describe('criarOpcoesTypeOrm', () => {
  beforeEach(() => {
    process.env = { ...ambienteOriginal };
    delete process.env.DATABASE_URL;
    delete process.env.BANCO_SSL;
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  it('usa DATABASE_URL quando informada', () => {
    process.env.DATABASE_URL = 'postgresql://usuario%40app:senha@ep-demo.neon.tech/octaclin?sslmode=require';

    const opcoes = criarOpcoesTypeOrm() as unknown as Record<string, unknown>;

    expect(opcoes.host).toBe('ep-demo.neon.tech');
    expect(opcoes.port).toBe(5432);
    expect(opcoes.username).toBe('usuario@app');
    expect(opcoes.password).toBe('senha');
    expect(opcoes.database).toBe('octaclin');
    expect(opcoes.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('mantem fallback por BANCO_* quando DATABASE_URL nao existe', () => {
    process.env.BANCO_HOST = 'localhost';
    process.env.BANCO_PORTA = '5433';
    process.env.BANCO_USUARIO = 'octaclin';
    process.env.BANCO_SENHA = 'local';
    process.env.BANCO_NOME = 'octaclin_local';
    process.env.BANCO_SSL = 'false';

    const opcoes = criarOpcoesTypeOrm() as unknown as Record<string, unknown>;

    expect(opcoes.host).toBe('localhost');
    expect(opcoes.port).toBe(5433);
    expect(opcoes.username).toBe('octaclin');
    expect(opcoes.password).toBe('local');
    expect(opcoes.database).toBe('octaclin_local');
    expect(opcoes.ssl).toBe(false);
  });
});

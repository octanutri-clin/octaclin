import { criarFonteDadosPostgresIntegracao, obterUrlPostgresIntegracao } from './postgres-integracao';

describe('obterUrlPostgresIntegracao', () => {
  const ambienteOriginal = { ...process.env };

  afterEach(() => {
    process.env = { ...ambienteOriginal };
  });

  it('nao habilita banco destrutivo sem confirmacao explicita', () => {
    process.env.OCTACLIN_POSTGRES_INTEGRACAO_URL = 'postgres://usuario:senha@localhost:5432/octaclin_test_fase150b';
    delete process.env.OCTACLIN_POSTGRES_INTEGRACAO_CONFIRMAR;

    expect(obterUrlPostgresIntegracao()).toBeUndefined();
  });

  it('rejeita banco que nao possui nome reservado para integracao', () => {
    process.env.OCTACLIN_POSTGRES_INTEGRACAO_URL = 'postgres://usuario:senha@localhost:5432/octaclin_producao';
    process.env.OCTACLIN_POSTGRES_INTEGRACAO_CONFIRMAR = 'APAGAR';

    expect(() => obterUrlPostgresIntegracao()).toThrow('octaclin_test_');
  });

  it('aceita apenas banco de integracao explicitamente confirmado', () => {
    const url = 'postgres://usuario:senha@localhost:5432/octaclin_test_fase150b';
    process.env.OCTACLIN_POSTGRES_INTEGRACAO_URL = url;
    process.env.OCTACLIN_POSTGRES_INTEGRACAO_CONFIRMAR = 'APAGAR';

    expect(obterUrlPostgresIntegracao()).toBe(url);
  });

  it('protege a fabrica mesmo quando ela for chamada diretamente', () => {
    expect(() =>
      criarFonteDadosPostgresIntegracao('postgres://usuario:senha@localhost:5432/octaclin_producao')
    ).toThrow('octaclin_test_');
  });
});

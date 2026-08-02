import { extrairValoresContatoBusca, validarBancoBackfill } from './backfill-indices-busca-pacientes';

describe('backfill de indices de busca de pacientes', () => {
  it('exige confirmacao exata do banco', () => {
    expect(() => validarBancoBackfill('postgresql://user@host/octaclin_staging', undefined)).toThrow(
      'CONFIRMAR_BANCO_BACKFILL'
    );
    expect(() => validarBancoBackfill('postgresql://user@host/octaclin_staging', 'octaclin_producao')).toThrow(
      'Banco nao confirmado'
    );
    expect(validarBancoBackfill('postgresql://user@host/octaclin_staging', 'octaclin_staging')).toBe('octaclin_staging');
  });

  it('indexa somente valores de contato estruturado', () => {
    expect(extrairValoresContatoBusca('{"email":"ana@example.com","whatsapp":"5511999999999"}')).toEqual([
      'ana@example.com',
      '5511999999999'
    ]);
    expect(extrairValoresContatoBusca('ana@example.com')).toEqual(['ana@example.com']);
  });
});

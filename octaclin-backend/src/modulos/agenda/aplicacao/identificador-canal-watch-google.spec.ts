import { extrairTenantIdDoCanalWatchGoogle, gerarIdentificadorCanalWatchGoogle } from './identificador-canal-watch-google';

describe('identificador-canal-watch-google', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';

  it('gera identificador aceito pela Google Calendar API e preserva o tenant', () => {
    const identificador = gerarIdentificadorCanalWatchGoogle(tenantId);

    expect(identificador).toMatch(/^[A-Za-z0-9\-_+/=]+$/);
    expect(extrairTenantIdDoCanalWatchGoogle(identificador)).toBe(tenantId);
  });

  it('continua reconhecendo identificadores legados com dois pontos', () => {
    const legado = 'octaclin-gcal:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222';

    expect(extrairTenantIdDoCanalWatchGoogle(legado)).toBe(tenantId);
  });
});

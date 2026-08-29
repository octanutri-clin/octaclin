import { PAPEIS_USUARIO, TIPO_TOKEN_ACESSO, TIPO_TOKEN_RENOVACAO, validarClaimsToken } from './claims-token';

const BASE = {
  sub: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  sid: '33333333-3333-4333-8333-333333333333',
  jti: '44444444-4444-4444-8444-444444444444',
  papel: 'Professional',
  tipo: TIPO_TOKEN_ACESSO,
  emailHash: 'hash-sintetico',
  permissoes: ['pacientes.listar'],
  iat: 1_700_000_000,
  exp: 1_700_000_900
};

describe('validarClaimsToken', () => {
  it('aceita claims completas de access token', () => {
    const claims = validarClaimsToken(BASE, TIPO_TOKEN_ACESSO);

    expect(claims.sub).toBe(BASE.sub);
    expect(claims.sid).toBe(BASE.sid);
    expect(claims.papel).toBe('Professional');
    expect(claims.tipo).toBe(TIPO_TOKEN_ACESSO);
  });

  it('aceita claims minimas de refresh token sem papel nem permissoes', () => {
    const claims = validarClaimsToken(
      { sub: BASE.sub, tenantId: BASE.tenantId, sid: BASE.sid, jti: BASE.jti, tipo: TIPO_TOKEN_RENOVACAO, iat: BASE.iat, exp: BASE.exp },
      TIPO_TOKEN_RENOVACAO
    );

    expect(claims.tipo).toBe(TIPO_TOKEN_RENOVACAO);
    expect(claims.papel).toBeUndefined();
  });

  it('rejeita access token apresentado como refresh', () => {
    expect(() => validarClaimsToken(BASE, TIPO_TOKEN_RENOVACAO)).toThrow('tipo');
  });

  it('rejeita refresh token apresentado como access', () => {
    expect(() =>
      validarClaimsToken({ ...BASE, tipo: TIPO_TOKEN_RENOVACAO }, TIPO_TOKEN_ACESSO)
    ).toThrow('tipo');
  });

  it('rejeita token sem claim de tipo', () => {
    const { tipo, ...semTipo } = BASE;
    void tipo;
    expect(() => validarClaimsToken(semTipo, TIPO_TOKEN_ACESSO)).toThrow('tipo');
  });

  it.each(['sub', 'tenantId', 'sid', 'jti'])('rejeita token sem a claim %s', (claim) => {
    const payload: Record<string, unknown> = { ...BASE };
    delete payload[claim];
    expect(() => validarClaimsToken(payload, TIPO_TOKEN_ACESSO)).toThrow(claim);
  });

  it.each(['sub', 'tenantId', 'sid'])('rejeita claim %s vazia ou de tipo errado', (claim) => {
    expect(() => validarClaimsToken({ ...BASE, [claim]: '' }, TIPO_TOKEN_ACESSO)).toThrow(claim);
    expect(() => validarClaimsToken({ ...BASE, [claim]: 42 }, TIPO_TOKEN_ACESSO)).toThrow(claim);
  });

  it('rejeita papel fora do catalogo em access token', () => {
    expect(() => validarClaimsToken({ ...BASE, papel: 'RootDaClinica' }, TIPO_TOKEN_ACESSO)).toThrow('papel');
    expect(() => validarClaimsToken({ ...BASE, papel: undefined }, TIPO_TOKEN_ACESSO)).toThrow('papel');
  });

  it('aceita todos os papeis do catalogo', () => {
    for (const papel of PAPEIS_USUARIO) {
      expect(validarClaimsToken({ ...BASE, papel }, TIPO_TOKEN_ACESSO).papel).toBe(papel);
    }
  });

  it('rejeita permissoes que nao sejam lista de strings', () => {
    expect(() => validarClaimsToken({ ...BASE, permissoes: 'pacientes.listar' }, TIPO_TOKEN_ACESSO)).toThrow('permissoes');
    expect(() => validarClaimsToken({ ...BASE, permissoes: [1, 2] }, TIPO_TOKEN_ACESSO)).toThrow('permissoes');
  });

  it('rejeita token sem iat ou exp', () => {
    const semIat: Record<string, unknown> = { ...BASE };
    delete semIat.iat;
    expect(() => validarClaimsToken(semIat, TIPO_TOKEN_ACESSO)).toThrow('iat');

    const semExp: Record<string, unknown> = { ...BASE };
    delete semExp.exp;
    expect(() => validarClaimsToken(semExp, TIPO_TOKEN_ACESSO)).toThrow('exp');
  });

  it('rejeita payload que nao seja objeto', () => {
    expect(() => validarClaimsToken('token', TIPO_TOKEN_ACESSO)).toThrow();
    expect(() => validarClaimsToken(null, TIPO_TOKEN_ACESSO)).toThrow();
  });

  it('nao propaga claims desconhecidas para o contexto autenticado', () => {
    const claims = validarClaimsToken({ ...BASE, admin: true, tenantIdAlternativo: 'outro' }, TIPO_TOKEN_ACESSO);

    expect(claims).not.toHaveProperty('admin');
    expect(claims).not.toHaveProperty('tenantIdAlternativo');
  });
});

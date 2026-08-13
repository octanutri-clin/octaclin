import { validarAlvoStagingE2E, validarNomeRoleRuntime } from './alvo-staging-e2e';

describe('alvo staging E2E', () => {
  function urlBanco(banco: string, host = 'localhost') {
    const url = new URL(`postgresql://${host}/${banco}`);
    url.username = 'runtime';
    url.password = 'credencial-sintetica';
    return url.toString();
  }

  it('aceita banco de integracao explicitamente confirmado', () => {
    expect(
      validarAlvoStagingE2E(
        urlBanco('octaclin_test_fase150b', 'ep-example.neon.tech'),
        'octaclin_test_fase150b',
        true
      )
    ).toEqual({ banco: 'octaclin_test_fase150b', host: 'ep-example.neon.tech', remoto: true });
  });

  it.each([
    [undefined, 'octaclin_test_fase150b', true],
    [urlBanco('octaclin_test_fase150b'), 'outro', true],
    [urlBanco('octaclin_producao'), 'octaclin_producao', true],
    [urlBanco('octaclin_test_fase150b', 'ep-example.neon.tech'), 'octaclin_test_fase150b', false]
  ])('recusa alvo ambiguo ou de producao', (url, banco, remoto) => {
    expect(() => validarAlvoStagingE2E(url, banco, remoto)).toThrow();
  });

  it('aceita somente identificador PostgreSQL simples para a role runtime', () => {
    expect(validarNomeRoleRuntime('octaclin_runtime_integracao')).toBe('octaclin_runtime_integracao');
    expect(() => validarNomeRoleRuntime('runtime; drop schema public')).toThrow();
  });
});

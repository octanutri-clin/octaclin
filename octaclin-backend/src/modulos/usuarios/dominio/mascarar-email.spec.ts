import { mascararEmail } from './mascarar-email';

describe('mascararEmail (P3-0b)', () => {
  it.each([
    ['helena.souza@example.test', 'h***@e***.test'],
    ['  Ana@Sub.Example.COM ', 'a***@s***.com'],
    ['x@localhost', 'x***@l***'],
  ])('%s → %s', (entrada, esperado) => expect(mascararEmail(entrada)).toBe(esperado));
  it.each(['', 'sem-arroba', '@example.test', 'a@', 'a@b@c', 42 as never])('malformado (%p) nunca ecoa', entrada => {
    expect(mascararEmail(entrada)).toBe('***');
  });
});

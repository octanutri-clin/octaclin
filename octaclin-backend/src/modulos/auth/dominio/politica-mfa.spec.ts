import { exigeMfaPorPapel } from './politica-mfa';

describe('politica MFA', () => {
  it.each(['SuperAdmin', 'Professional', 'Client'] as const)(
    'exige MFA para o papel privilegiado %s',
    (papel) => expect(exigeMfaPorPapel(papel)).toBe(true)
  );

  it.each(['Collaborator', 'Patient'] as const)(
    'nao obriga MFA para o papel sem capacidade administrativa %s',
    (papel) => expect(exigeMfaPorPapel(papel)).toBe(false)
  );
});

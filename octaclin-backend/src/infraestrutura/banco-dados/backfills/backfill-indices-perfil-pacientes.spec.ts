import { CriptografiaDadosSensiveis } from '../../seguranca/criptografia-dados-sensiveis';
import { lerOperacaoPerfil } from './backfill-indices-perfil-pacientes';

describe('lerOperacaoPerfil', () => {
  const criptografia = { descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8')) } as unknown as CriptografiaDadosSensiveis;

  it('aceita bloco valido com outros campos operacionais', () => {
    expect(lerOperacaoPerfil(criptografia, Buffer.from(JSON.stringify({ categoria: 'Ativo', tags: ['Retorno'], proximaRevisaoEm: '2026-01-01' }))))
      .toEqual({ categoria: 'Ativo', tags: ['Retorno'], proximaRevisaoEm: '2026-01-01' });
  });

  it('falha fechado para estrutura invalida', () => {
    expect(() => lerOperacaoPerfil(criptografia, Buffer.from(JSON.stringify({ tags: [42] })))).toThrow('Tags invalidas.');
  });
});

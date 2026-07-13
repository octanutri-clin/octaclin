import { moderarConteudo } from './moderacao';

describe('moderarConteudo', () => {
  it('deve aprovar conteudo sem termos sensiveis', () => {
    expect(moderarConteudo('Hoje consegui beber mais agua e caminhar.')).toEqual({
      status: 'aprovado',
      pontuacaoRisco: 0,
      motivos: []
    });
  });

  it('deve enviar conteudo sensivel para moderacao', () => {
    const resultado = moderarConteudo('Senti vergonha de falhar no desafio.');

    expect(resultado.status).toBe('pendente');
    expect(resultado.pontuacaoRisco).toBeGreaterThan(0);
    expect(resultado.motivos).toContain('vergonha');
  });

  it('deve bloquear conteudo com multiplos termos ofensivos', () => {
    const resultado = moderarConteudo('Isso foi idiota e uma vergonha.');

    expect(resultado.status).toBe('bloqueado');
    expect(resultado.pontuacaoRisco).toBeGreaterThanOrEqual(70);
  });
});

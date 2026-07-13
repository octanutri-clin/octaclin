import { validarDuracaoMidia } from './validacao-midia';

describe('validarDuracaoMidia', () => {
  it('deve aceitar audio de ate 2 minutos', () => {
    expect(() => validarDuracaoMidia('audio', 120)).not.toThrow();
  });

  it('deve rejeitar audio acima de 2 minutos', () => {
    expect(() => validarDuracaoMidia('audio', 121)).toThrow('Audio excede o limite de 2 minutos.');
  });

  it('deve rejeitar video acima de 30 segundos', () => {
    expect(() => validarDuracaoMidia('video', 31)).toThrow('Video excede o limite de 30 segundos.');
  });
});

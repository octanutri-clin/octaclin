import { BadRequestException } from '@nestjs/common';
import { normalizarConfiguracaoPergunta } from './configuracao-pergunta';

describe('Configuracao por tipo de pergunta', () => {
  it('deve aplicar padroes especificos para cada tipo editavel', () => {
    expect(normalizarConfiguracaoPergunta('likert', {})).toEqual({
      escalaMin: 1,
      escalaMax: 5,
      rotuloMin: 'Discordo totalmente',
      rotuloMax: 'Concordo totalmente'
    });
    expect(normalizarConfiguracaoPergunta('multipla_escolha', { multipla: true })).toEqual({ multipla: true });
    expect(normalizarConfiguracaoPergunta('upload_midia', {})).toEqual({ tiposAceitos: ['image/*'], maxArquivos: 1 });
    expect(normalizarConfiguracaoPergunta('texto_longo', {})).toEqual({ limiteCaracteres: 1000, placeholder: '' });
  });

  it('deve validar faixas numericas de slider e metrica', () => {
    expect(normalizarConfiguracaoPergunta('linear', { minimo: 0, maximo: 10, passo: 0.5 })).toEqual({
      minimo: 0,
      maximo: 10,
      passo: 0.5,
      rotuloMin: '',
      rotuloMax: ''
    });
    expect(normalizarConfiguracaoPergunta('metrica', { unidade: 'kg', minimo: 30, maximo: 200, passo: 0.1 })).toEqual({
      unidade: 'kg',
      minimo: 30,
      maximo: 200,
      passo: 0.1
    });
    expect(() => normalizarConfiguracaoPergunta('linear', { minimo: 10, maximo: 5 })).toThrow(BadRequestException);
    expect(() => normalizarConfiguracaoPergunta('metrica', { minimo: 200, maximo: 30 })).toThrow(BadRequestException);
  });

  it('deve preservar a secao comum ao normalizar a configuracao do tipo', () => {
    expect(normalizarConfiguracaoPergunta('sim_nao', { secao: 'Atividade fisica', rotuloSim: 'Sim', rotuloNao: 'Nao' })).toEqual({
      secao: 'Atividade fisica',
      rotuloSim: 'Sim',
      rotuloNao: 'Nao'
    });
  });
});

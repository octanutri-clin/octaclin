import { TIPOS_PERGUNTA_SUPORTADOS, validarTipoPergunta } from './tipos-pergunta';

describe('tipos de pergunta', () => {
  it('deve aceitar exatamente os sete tipos obrigatorios do MVP', () => {
    expect(TIPOS_PERGUNTA_SUPORTADOS).toEqual([
      'likert',
      'multipla_escolha',
      'linear',
      'metrica',
      'upload_midia',
      'texto_longo',
      'sim_nao'
    ]);

    for (const tipo of TIPOS_PERGUNTA_SUPORTADOS) {
      expect(validarTipoPergunta(tipo)).toBe(true);
    }
  });

  it('deve rejeitar tipos fora do contrato do questionario', () => {
    expect(validarTipoPergunta('nota_nps')).toBe(false);
    expect(validarTipoPergunta('arquivo_generico')).toBe(false);
  });
});

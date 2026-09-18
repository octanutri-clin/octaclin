import 'reflect-metadata';
import { validate } from 'class-validator';
import { SolicitarOverridePrioridadeAcompanhamentoDto } from './dtos';

describe('SolicitarOverridePrioridadeAcompanhamentoDto', () => {
  it('aceita cada codigo do vocabulario fechado de motivo (Fase 265.5)', async () => {
    const codigosValidos = [
      'evento_recente_nao_capturado',
      'informacao_externa_relevante',
      'acompanhamento_intensificado',
      'acompanhamento_reduzido',
      'correcao_de_dado',
      'outro'
    ];

    for (const codigoMotivo of codigosValidos) {
      const dados = Object.assign(new SolicitarOverridePrioridadeAcompanhamentoDto(), {
        faixa: 'alta',
        codigoMotivo,
        justificativa: 'justificativa valida com mais de tres caracteres',
        expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      const erros = await validate(dados);
      expect(erros).toEqual([]);
    }
  });

  it('rejeita codigo de motivo fora do enum fechado, incluindo texto livre plausivel', async () => {
    const dados = Object.assign(new SolicitarOverridePrioridadeAcompanhamentoDto(), {
      faixa: 'alta',
      codigoMotivo: 'decisao_clinica',
      justificativa: 'justificativa valida com mais de tres caracteres',
      expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    const erros = await validate(dados);
    expect(erros.map((erro) => erro.property)).toContain('codigoMotivo');
  });

  it('rejeita codigo de motivo vazio', async () => {
    const dados = Object.assign(new SolicitarOverridePrioridadeAcompanhamentoDto(), {
      faixa: 'alta',
      codigoMotivo: '',
      justificativa: 'justificativa valida com mais de tres caracteres',
      expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    const erros = await validate(dados);
    expect(erros.map((erro) => erro.property)).toContain('codigoMotivo');
  });
});

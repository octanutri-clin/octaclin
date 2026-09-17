import {
  calcularPrioridadeAcompanhamento,
  VERSAO_FORMULA_PRIORIDADE_ACOMPANHAMENTO
} from './prioridade-acompanhamento';

const AGORA = new Date('2026-09-17T12:00:00.000Z');
const DIA_MS = 24 * 60 * 60 * 1000;

function diasAntes(dias: number): Date {
  return new Date(AGORA.getTime() - dias * DIA_MS);
}

describe('calcularPrioridadeAcompanhamento', () => {
  it('devolve prioridade baixa e explicacao vazia sem sinais', () => {
    expect(calcularPrioridadeAcompanhamento({ agora: AGORA })).toEqual({
      versaoFormula: VERSAO_FORMULA_PRIORIDADE_ACOMPANHAMENTO,
      score: 0,
      faixa: 'baixa',
      fatores: []
    });
  });

  it('conta faltas unicas na janela inclusiva de 90 dias e limita o fator a 60 pontos', () => {
    const resultado = calcularPrioridadeAcompanhamento({
      agora: AGORA,
      faltas: [
        { consultaId: 'consulta-1', ocorreuEm: diasAntes(90) },
        { consultaId: 'consulta-1', ocorreuEm: diasAntes(1) },
        { consultaId: 'consulta-2', ocorreuEm: diasAntes(30) },
        { consultaId: 'consulta-3', ocorreuEm: diasAntes(60) },
        { consultaId: 'consulta-antiga', ocorreuEm: new Date(AGORA.getTime() - 90 * DIA_MS - 1) },
        { consultaId: 'consulta-futura', ocorreuEm: new Date(AGORA.getTime() + 1) }
      ]
    });

    expect(resultado.score).toBe(60);
    expect(resultado.faixa).toBe('media');
    expect(resultado.fatores).toEqual([
      { codigo: 'faltas_recentes', pontos: 60, quantidade: 3 }
    ]);
  });

  it('pontua ausencia de retorno somente depois de 60 dias e sem consulta futura', () => {
    expect(calcularPrioridadeAcompanhamento({
      agora: AGORA,
      ultimaConsultaConcluidaEm: new Date(AGORA.getTime() - 60 * DIA_MS - 1)
    }).fatores).toContainEqual({ codigo: 'sem_retorno_programado', pontos: 25 });

    expect(calcularPrioridadeAcompanhamento({
      agora: AGORA,
      ultimaConsultaConcluidaEm: diasAntes(60)
    }).fatores).not.toContainEqual(expect.objectContaining({ codigo: 'sem_retorno_programado' }));

    expect(calcularPrioridadeAcompanhamento({
      agora: AGORA,
      ultimaConsultaConcluidaEm: diasAntes(61),
      proximaConsultaEm: new Date(AGORA.getTime() + 1)
    }).fatores).not.toContainEqual(expect.objectContaining({ codigo: 'sem_retorno_programado' }));
  });

  it('pontua uma vez quando existe formulario obrigatorio nao respondido vencido ha mais de sete dias', () => {
    const resultado = calcularPrioridadeAcompanhamento({
      agora: AGORA,
      formularios: [
        { envioId: 'envio-valido', obrigatorio: true, vencimentoEm: new Date(AGORA.getTime() - 7 * DIA_MS - 1) },
        { envioId: 'envio-limite', obrigatorio: true, vencimentoEm: diasAntes(7) },
        { envioId: 'envio-opcional', obrigatorio: false, vencimentoEm: diasAntes(20) },
        { envioId: 'envio-respondido', obrigatorio: true, vencimentoEm: diasAntes(20), respondidoEm: diasAntes(10) }
      ]
    });

    expect(resultado.fatores).toContainEqual({ codigo: 'formulario_vencido', pontos: 10, quantidade: 1 });
  });

  it('pontua adesao declarada abaixo de 50 por cento apenas em registro dos ultimos 30 dias', () => {
    expect(calcularPrioridadeAcompanhamento({
      agora: AGORA,
      ultimoRegistroHabitos: { registradoEm: diasAntes(30), adesaoPercentual: 49.9 }
    }).fatores).toContainEqual({ codigo: 'adesao_declarada_baixa', pontos: 15 });

    expect(calcularPrioridadeAcompanhamento({
      agora: AGORA,
      ultimoRegistroHabitos: { registradoEm: diasAntes(1), adesaoPercentual: 50 }
    }).fatores).not.toContainEqual(expect.objectContaining({ codigo: 'adesao_declarada_baixa' }));

    expect(calcularPrioridadeAcompanhamento({
      agora: AGORA,
      ultimoRegistroHabitos: {
        registradoEm: new Date(AGORA.getTime() - 30 * DIA_MS - 1),
        adesaoPercentual: 20
      }
    }).fatores).not.toContainEqual(expect.objectContaining({ codigo: 'adesao_declarada_baixa' }));
  });

  it('combina fatores em ordem estavel, limita o total a 100 e classifica as faixas existentes', () => {
    const alta = calcularPrioridadeAcompanhamento({
      agora: AGORA,
      faltas: [
        { consultaId: 'consulta-1', ocorreuEm: diasAntes(1) },
        { consultaId: 'consulta-2', ocorreuEm: diasAntes(2) }
      ],
      ultimaConsultaConcluidaEm: diasAntes(61),
      formularios: [
        { envioId: 'envio-1', obrigatorio: true, vencimentoEm: diasAntes(8) }
      ],
      ultimoRegistroHabitos: { registradoEm: diasAntes(1), adesaoPercentual: 20 }
    });

    expect(alta.score).toBe(100);
    expect(alta.faixa).toBe('alta');
    expect(alta.fatores.map((fator) => fator.codigo)).toEqual([
      'faltas_recentes',
      'sem_retorno_programado',
      'formulario_vencido',
      'adesao_declarada_baixa'
    ]);

    expect(calcularPrioridadeAcompanhamento({
      agora: AGORA,
      ultimaConsultaConcluidaEm: diasAntes(61),
      ultimoRegistroHabitos: { registradoEm: diasAntes(1), adesaoPercentual: 20 }
    }).faixa).toBe('media');

    expect(calcularPrioridadeAcompanhamento({
      agora: AGORA,
      faltas: [
        { consultaId: 'consulta-1', ocorreuEm: diasAntes(1) },
        { consultaId: 'consulta-2', ocorreuEm: diasAntes(2) }
      ],
      formularios: [
        { envioId: 'envio-1', obrigatorio: true, vencimentoEm: diasAntes(8) }
      ]
    })).toEqual(expect.objectContaining({ score: 70, faixa: 'alta' }));
  });

  it('rejeita datas invalidas e percentual fora do contrato', () => {
    expect(() => calcularPrioridadeAcompanhamento({ agora: new Date('invalida') }))
      .toThrow('Data agora invalida.');
    expect(() => calcularPrioridadeAcompanhamento({
      agora: AGORA,
      ultimoRegistroHabitos: { registradoEm: AGORA, adesaoPercentual: 101 }
    })).toThrow('Adesao percentual invalida.');
    expect(() => calcularPrioridadeAcompanhamento({
      agora: AGORA,
      faltas: [{ consultaId: ' ', ocorreuEm: AGORA }]
    })).toThrow('Falta invalida.');
    expect(() => calcularPrioridadeAcompanhamento({
      agora: AGORA,
      formularios: [{ envioId: '', obrigatorio: true, vencimentoEm: diasAntes(8) }]
    })).toThrow('Formulario invalido.');
  });
});

import {
  CODIGOS_MOTIVO_OVERRIDE_PRIORIDADE_ACOMPANHAMENTO,
  calcularPrioridadeAcompanhamento,
  entrouEmAltaPrioridade,
  VERSAO_FORMULA_PRIORIDADE_ACOMPANHAMENTO
} from './prioridade-acompanhamento';

const AGORA = new Date('2026-09-17T12:00:00.000Z');
const DIA_MS = 24 * 60 * 60 * 1000;

function diasAntes(dias: number): Date {
  return new Date(AGORA.getTime() - dias * DIA_MS);
}

describe('CODIGOS_MOTIVO_OVERRIDE_PRIORIDADE_ACOMPANHAMENTO', () => {
  it('e o vocabulario fechado aprovado, com "outro" como ultima categoria fechada', () => {
    expect(CODIGOS_MOTIVO_OVERRIDE_PRIORIDADE_ACOMPANHAMENTO).toEqual([
      'evento_recente_nao_capturado',
      'informacao_externa_relevante',
      'acompanhamento_intensificado',
      'acompanhamento_reduzido',
      'correcao_de_dado',
      'outro'
    ]);
  });
});

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
      ultimoRegistroHabitos: { registradoEm: diasAntes(1), adesaoPercentual: 20 }
    });

    expect(alta.score).toBe(100);
    expect(alta.faixa).toBe('alta');
    expect(alta.fatores.map((fator) => fator.codigo)).toEqual([
      'faltas_recentes',
      'sem_retorno_programado',
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
      ultimoRegistroHabitos: { registradoEm: diasAntes(1), adesaoPercentual: 20 }
    })).toEqual(expect.objectContaining({ score: 75, faixa: 'alta' }));
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
  });
});

describe('entrouEmAltaPrioridade', () => {
  it('dispara quando a faixa anterior era baixa ou media e a atual e alta', () => {
    expect(entrouEmAltaPrioridade('baixa', 'alta')).toBe(true);
    expect(entrouEmAltaPrioridade('media', 'alta')).toBe(true);
  });

  it('dispara no primeiro calculo do paciente quando ja nasce em alta (sem faixa anterior)', () => {
    expect(entrouEmAltaPrioridade(undefined, 'alta')).toBe(true);
  });

  it('nao dispara de novo quando a faixa anterior ja era alta', () => {
    expect(entrouEmAltaPrioridade('alta', 'alta')).toBe(false);
  });

  it('nao dispara quando a faixa atual nao e alta, mesmo vindo de alta (nao e regressao a tratar aqui)', () => {
    expect(entrouEmAltaPrioridade('alta', 'media')).toBe(false);
    expect(entrouEmAltaPrioridade('alta', 'baixa')).toBe(false);
  });

  it('nao dispara quando permanece em baixa ou media', () => {
    expect(entrouEmAltaPrioridade('baixa', 'baixa')).toBe(false);
    expect(entrouEmAltaPrioridade('baixa', 'media')).toBe(false);
    expect(entrouEmAltaPrioridade('media', 'media')).toBe(false);
    expect(entrouEmAltaPrioridade(undefined, 'baixa')).toBe(false);
    expect(entrouEmAltaPrioridade(undefined, 'media')).toBe(false);
  });
});

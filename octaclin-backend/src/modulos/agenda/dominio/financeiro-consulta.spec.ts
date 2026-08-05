import {
  calcularConsumoPacote,
  entraNoFaturamento,
  formatarValorBRL,
  normalizarValorCentavos,
  pacoteVencido,
  somarRecebimentos
} from './financeiro-consulta';

describe('financeiro da consulta', () => {
  it('deve manter consulta cancelada fora do faturamento', () => {
    expect(entraNoFaturamento('cancelada')).toBe(false);
    expect(entraNoFaturamento('concluida')).toBe(true);
    expect(entraNoFaturamento('falta')).toBe(true);
    expect(entraNoFaturamento('agendada')).toBe(true);
  });

  it('deve recusar valor fracionado, negativo ou acima do teto em vez de arredondar', () => {
    expect(normalizarValorCentavos(18000)).toBe(18000);
    expect(normalizarValorCentavos(0)).toBe(0);
    expect(normalizarValorCentavos(undefined)).toBeUndefined();
    expect(() => normalizarValorCentavos(180.5)).toThrow('valor_invalido');
    expect(() => normalizarValorCentavos(-1)).toThrow('valor_negativo');
    expect(() => normalizarValorCentavos(100_000_001)).toThrow('valor_acima_do_teto');
  });

  it('deve somar em centavos sem erro de ponto flutuante', () => {
    const totais = somarRecebimentos([
      { status: 'concluida', statusPagamento: 'pago', valorCentavos: 10 },
      { status: 'concluida', statusPagamento: 'pago', valorCentavos: 20 }
    ]);
    expect(totais.recebidoCentavos).toBe(30);
    expect(formatarValorBRL(totais.recebidoCentavos)).toContain('0,30');
  });

  it('deve ignorar consulta cancelada e nao cobrar consulta isenta', () => {
    const totais = somarRecebimentos([
      { status: 'concluida', statusPagamento: 'pago', valorCentavos: 18000 },
      { status: 'concluida', statusPagamento: 'pendente', valorCentavos: 15000 },
      { status: 'cancelada', statusPagamento: 'pendente', valorCentavos: 99900 },
      { status: 'falta', statusPagamento: 'isento', valorCentavos: 12000 }
    ]);

    expect(totais.recebidoCentavos).toBe(18000);
    expect(totais.pendenteCentavos).toBe(15000);
    expect(totais.isentas).toBe(1);
    expect(totais.consultas).toBe(3);
  });

  it('deve tratar falta como sessao consumida e cancelamento como vaga devolvida', () => {
    const consumo = calcularConsumoPacote(10, ['concluida', 'concluida', 'falta', 'cancelada', 'agendada']);
    expect(consumo.consumidas).toBe(3);
    expect(consumo.reservadas).toBe(1);
    expect(consumo.disponiveis).toBe(6);
    expect(consumo.esgotado).toBe(false);
  });

  it('deve marcar pacote esgotado quando consumidas mais reservadas fecham o contratado', () => {
    const consumo = calcularConsumoPacote(2, ['concluida', 'agendada']);
    expect(consumo.disponiveis).toBe(0);
    expect(consumo.esgotado).toBe(true);
  });

  it('deve considerar o pacote valido durante todo o dia da validade', () => {
    const validade = new Date('2026-12-31T00:00:00.000Z');
    expect(pacoteVencido(validade, new Date('2026-12-31T23:59:00.000Z'))).toBe(false);
    expect(pacoteVencido(validade, new Date('2027-01-01T00:01:00.000Z'))).toBe(true);
    expect(pacoteVencido(undefined, new Date('2030-01-01T00:00:00.000Z'))).toBe(false);
  });
});

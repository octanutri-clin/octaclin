import {
  ConfiguracaoCheckinAdesaoBaixa,
  checkinTemAdesaoBaixa,
  ehGatilhoCheckinAdesaoBaixa,
  normalizarConfiguracaoCheckinAdesaoBaixa
} from './checkin-adesao-baixa';

const configuracaoPadrao: ConfiguracaoCheckinAdesaoBaixa = { limiarAdesao: 50 };

describe('normalizarConfiguracaoCheckinAdesaoBaixa', () => {
  it('aplica o default de produto quando o gatilho nao informa o limiar', () => {
    expect(normalizarConfiguracaoCheckinAdesaoBaixa({ tipo: 'checkin.adesao_baixa' })).toEqual(configuracaoPadrao);
  });

  it('preserva um limiar explicito dentro da faixa', () => {
    expect(normalizarConfiguracaoCheckinAdesaoBaixa({ limiarAdesao: 30 })).toEqual({ limiarAdesao: 30 });
  });

  it('nunca lanca e sempre cai dentro da faixa, mesmo com entrada invalida', () => {
    expect(normalizarConfiguracaoCheckinAdesaoBaixa(undefined)).toEqual(configuracaoPadrao);
    expect(normalizarConfiguracaoCheckinAdesaoBaixa({ limiarAdesao: -10 })).toEqual({ limiarAdesao: 1 });
    expect(normalizarConfiguracaoCheckinAdesaoBaixa({ limiarAdesao: 9999 })).toEqual({ limiarAdesao: 100 });
  });
});

describe('ehGatilhoCheckinAdesaoBaixa', () => {
  it('identifica o tipo correto e rejeita os demais', () => {
    expect(ehGatilhoCheckinAdesaoBaixa({ tipo: 'checkin.adesao_baixa' })).toBe(true);
    expect(ehGatilhoCheckinAdesaoBaixa({ tipo: 'checkin.atrasado' })).toBe(false);
    expect(ehGatilhoCheckinAdesaoBaixa(undefined)).toBe(false);
  });
});

describe('checkinTemAdesaoBaixa', () => {
  it('considera baixa quando a adesao declarada fica estritamente abaixo do limiar', () => {
    expect(checkinTemAdesaoBaixa(49, configuracaoPadrao)).toBe(true);
    expect(checkinTemAdesaoBaixa(0, configuracaoPadrao)).toBe(true);
  });

  it('nao considera baixa quando a adesao declarada e igual ou maior que o limiar', () => {
    expect(checkinTemAdesaoBaixa(50, configuracaoPadrao)).toBe(false);
    expect(checkinTemAdesaoBaixa(100, configuracaoPadrao)).toBe(false);
  });

  it('respeita um limiar diferente do default', () => {
    expect(checkinTemAdesaoBaixa(25, { limiarAdesao: 30 })).toBe(true);
    expect(checkinTemAdesaoBaixa(30, { limiarAdesao: 30 })).toBe(false);
  });
});

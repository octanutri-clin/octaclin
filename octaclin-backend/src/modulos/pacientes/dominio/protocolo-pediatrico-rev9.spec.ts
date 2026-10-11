import { referenciaOmsRev9, normalizarMedidaOmsRev9 } from './protocolo-pediatrico-rev9';
describe('contratos ratificados REV9 isolados, sem ativação', () => {
  it('A02/A03 separa curva em dias e categoria civil aos cinco anos', () => {
    expect(referenciaOmsRev9('imc_idade',1856,'2019-01-01','2024-01-31')).toMatchObject({ familia: 'OMS2006', faixaSisvan: '5_a_19', parametro: 1856 });
    expect(referenciaOmsRev9('imc_idade',1857,'2019-01-01','2024-02-01')).toMatchObject({ familia: 'OMS2007', parametro: 1857/30.4375 });
  });
  it('A04 mantém domínios e não extrapola âncoras finais', () => {
    expect(referenciaOmsRev9('peso_idade',Math.ceil(121*30.4375),'2010-01-01','2020-02-01')).toBeUndefined();
    expect(referenciaOmsRev9('estatura_idade',Math.ceil(229*30.4375),'2000-01-01','2019-02-01')).toBeUndefined();
    expect(referenciaOmsRev9('peso_estatura',1826,'2019-01-01','2024-01-01')).toBeUndefined();
  });
  it('A05 adapta somente IMC a partir de19a1m até antes de20', () => {
    expect(referenciaOmsRev9('imc_idade',6970,'2000-01-01','2019-02-01')).toMatchObject({ parametro: 228, adaptacaoSisvan19: true });
    expect(referenciaOmsRev9('imc_idade',7305,'2000-01-01','2020-01-01')).toBeUndefined();
  });
  it('A06/A07 usa 730/731 dias efetivos, e mantém original', () => {
    expect(normalizarMedidaOmsRev9(80,'em_pe',730)).toEqual({ originalCm: 80, usadoCm: 80.7, ajusteCm: 0.7 });
    expect(normalizarMedidaOmsRev9(80,'em_pe',731)).toEqual({ originalCm: 80, usadoCm: 80, ajusteCm: 0 });
    expect(normalizarMedidaOmsRev9(80,'deitado',731)).toEqual({ originalCm: 80, usadoCm: 79.3, ajusteCm: -0.7 });
    expect(() => normalizarMedidaOmsRev9(60,'em_pe',273)).toThrow('tecnica_exige_reconferencia');
    expect(() => normalizarMedidaOmsRev9(60,'nao_informada',731)).toThrow();
  });
});

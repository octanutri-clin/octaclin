import { calcularAntropometria, ProtocoloComposicao } from './antropometria';

describe('interpretações adultas com elegibilidade etária', () => {
  it.each([0, 10, 17, 18, 19, undefined])('preserva medidas e RCQ factual sem interpretar idade %s', idadeAnos => {
    const r = calcularAntropometria({ protocolo: 'nenhum', idadeAnos, sexo: 'masculino', medidas: { circunferencias: { cintura: 95, quadril: 100 } } });
    expect(r.rcq).toBe(0.95);
    expect(r.circunferenciaCinturaCm).toBe(95);
    expect(r.classificacaoRcq).toBeUndefined();
    expect(r.classificacaoCircunferenciaCintura).toBeUndefined();
  });
  it.each(['pollock_3', 'pollock_7', 'faulkner', 'guedes'] as ProtocoloComposicao[])('não aplica %s abaixo de 18 ou enquanto CL08 18–19 pendente', protocolo => {
    for (const idadeAnos of [10, 17, 18, 19, undefined]) {
      const r = calcularAntropometria({ protocolo, idadeAnos, sexo: 'masculino', medidas: { dobras: { peitoral: 10, abdominal: 10, coxa: 10, triceps: 10, suprailiaca: 10, subescapular: 10, axilarMedia: 10 } } });
      expect(r.percentualGordura).toBeUndefined();
      expect(r.protocoloAplicado).toBe('nenhum');
    }
  });
  it('preserva adulto elegível e precedência gestacional', () => {
    const entrada = { protocolo: 'faulkner' as const, idadeAnos: 30, sexo: 'masculino' as const, medidas: { circunferencias: { cintura: 95, quadril: 100 }, dobras: { triceps: 10, abdominal: 10, subescapular: 10, suprailiaca: 10 } } };
    expect(calcularAntropometria(entrada).percentualGordura).toBeDefined();
    expect(calcularAntropometria(entrada).classificacaoRcq).toBe('elevado');
    expect(calcularAntropometria({ ...entrada, gestante: true }).percentualGordura).toBeUndefined();
  });
});

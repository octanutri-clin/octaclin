import { calcularAntropometria, ProtocoloComposicao } from './antropometria';

describe('interpretações adultas com elegibilidade etária', () => {
  it.each([0, 10, 17, undefined])('preserva medidas e RCQ factual sem interpretar idade %s', idadeAnos => {
    const r = calcularAntropometria({ protocolo: 'nenhum', idadeAnos, sexo: 'masculino', medidas: { circunferencias: { cintura: 95, quadril: 100 } } });
    expect(r.rcq).toBe(0.95);
    expect(r.circunferenciaCinturaCm).toBe(95);
    expect(r.classificacaoRcq).toBeUndefined();
    expect(r.classificacaoCircunferenciaCintura).toBeUndefined();
  });
  it.each(['pollock_3', 'pollock_7', 'faulkner', 'guedes'] as ProtocoloComposicao[])('não aplica %s abaixo de 18 ou sem idade confirmada', protocolo => {
    for (const idadeAnos of [10, 17, undefined]) {
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

it.each([18,19])('REV9 permite interpretação adulta aos%d sem antecipar IMC adulto e preserva gestação', idadeAnos => {
  for (const protocolo of ['pollock_3','pollock_7','faulkner','guedes'] as const) {
    const entrada={ protocolo,idadeAnos,sexo: 'masculino' as const,medidas: { pesoKg:70,alturaCm:175,circunferencias:{cintura:95,quadril:100},dobras: { peitoral:10,abdominal:10,coxa:10,triceps:10,suprailiaca:10,subescapular:10,axilarMedia:10 } } };
    const r=calcularAntropometria(entrada);
    expect(r.percentualGordura).toBeDefined();expect(r.classificacaoRcq).toBe('elevado');expect(r.classificacaoCircunferenciaCintura).toBeDefined();
    expect(r.classificacaoImc).toBeUndefined();
    const g=calcularAntropometria({...entrada,gestante:true});expect(g.percentualGordura).toBeUndefined();expect(g.classificacaoRcq).toBeUndefined();
  }
});


describe('REV14: métodos adultos independentes dos classificadores pediátricos', () => {
  const medidas = { pesoKg: 70, alturaCm: 175, circunferencias: { cintura: 95, quadril: 100 }, dobras: { peitoral: 10, abdominal: 10, coxa: 10, triceps: 10, suprailiaca: 10, subescapular: 10, axilarMedia: 10 } };
  it.each(['masculino', 'feminino'] as const)('%s preserva seis métodos, idade e gestação', sexo => {
    for (const idadeAnos of [17, 18, 19, 20, undefined]) {
      for (const protocolo of ['pollock_3', 'pollock_7', 'faulkner', 'guedes'] as const) {
        const entrada = { medidas, sexo, idadeAnos, protocolo };
        const r = calcularAntropometria(entrada);
        const elegivel = idadeAnos !== undefined && idadeAnos >= 18;
        expect(r.percentualGordura !== undefined).toBe(elegivel);
        expect(r.classificacaoRcq !== undefined).toBe(elegivel);
        expect(r.classificacaoCircunferenciaCintura !== undefined).toBe(elegivel);
        expect(r.classificacaoImc !== undefined).toBe(idadeAnos === 20);
        expect(r.rcq).toBe(0.95);
        expect(r.avisos).not.toContain('metodos_18_19_aguardam_ratificacao_individual');
        const g = calcularAntropometria({ ...entrada, gestante: true });
        expect(g.percentualGordura).toBeUndefined();
        expect(g.classificacaoRcq).toBeUndefined();
        expect(g.classificacaoCircunferenciaCintura).toBeUndefined();
      }
    }
  });
  it('não usa aviso de ratificação para idade fora do domínio', () => {
    const r = calcularAntropometria({ protocolo: 'nenhum', idadeAnos: 121, sexo: 'masculino', medidas });
    expect(r.classificacaoRcq).toBeUndefined();
    expect(r.avisos).toContain('interpretacao_adulta_idade_fora_do_dominio');
    expect(r.avisos).not.toContain('metodos_18_19_aguardam_ratificacao_individual');
  });
  it('mantém falta de sexo, medidas e avisos de população por fórmula', () => {
    expect(calcularAntropometria({ protocolo: 'pollock_3', idadeAnos: 18, medidas }).percentualGordura).toBeUndefined();
    expect(calcularAntropometria({ protocolo: 'pollock_3', idadeAnos: 18, sexo: 'feminino', medidas: {} }).percentualGordura).toBeUndefined();
    expect(calcularAntropometria({ protocolo: 'guedes', idadeAnos: 31, sexo: 'feminino', medidas }).avisos).toContain('idade_fora_da_faixa_de_validacao_da_equacao');
  });
});

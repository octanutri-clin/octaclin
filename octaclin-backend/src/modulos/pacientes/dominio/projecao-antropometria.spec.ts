import { projetarResultadoAntropometrico, projetarMedidasAntropometricas } from './projecao-antropometria';
describe('projeção real de JSON cifrado', () => {
  it('retém resultados legados sem retornar campos internos em qualquer nível', () => {
    const p = projetarResultadoAntropometrico({ protocoloAplicado: 'nenhum',avisos: [],imc: 99.9,segredo: 'interno',gestacional: { source_id: 'legado',motivos: [],segredo: 'interno',referencia: { pesoKg: 60,segredo: 'interno' },contexto: { semanas: 20,segredo: 'interno' },precisao: { peso: '60',segredo: 'interno' } } });
    expect(p.imc).toBe(99.9); expect(JSON.stringify(p)).not.toContain('segredo');
    expect(p.gestacional?.referencia?.pesoKg).toBe(60);
    expect(projetarMedidasAntropometricas({ pesoKg: 1,_fingerprint: 'interno',dobras: { triceps: 10,segredo: 'interno' } })).toEqual({ pesoKg: 1,alturaCm: undefined,circunferencias: undefined,dobras: { triceps: 10 } });
  });
  it.each([null,undefined,42,'invalido',[]])('JSON legível mas estrutura inválida %# não vira resultado normal', v => expect(projetarResultadoAntropometrico(v).avisos).toContain('registro_ilegivel'));
});

import { calcularAntropometriaGestacional as calcular } from './antropometria-gestacional';
import { faixaGestacional } from './referencia-gestacional-ms';
import { calcularAntropometria } from './antropometria';
const base = {
  condicao: 'gestante' as const, origemCondicao: 'confirmada' as const, idadeAnos: 18,pesoKg: 61.2,
  referencia: { pesoKg: 60,alturaCm: 160,origem: 'pre_gestacional_informado' as const },
  contexto: { gestacaoId: 'gestacao-sintetica',referenciaNumero: 1,semanas: 22,dias: 0,tipo: 'unica' as const,risco: 'habitual' as const,origemIdadeGestacional: 'pre_natal' as const }
};
describe('Fase 313 — ficha gestacional ratificada',() => {
  it.each([[61.19,'abaixo'],[61.2,'dentro'],[64.1,'dentro'],[64.11,'acima']] as const)('peso %s usa decimal e extremos inclusivos', (pesoKg,classe) => {
    const r = calcular({ ...base,pesoKg });expect(r.classificacao).toBe(classe);expect(r.faixa).toEqual({ minimo: 1.2,maximo: 4.1 });expect(r.imcReferencia).toBe(23.4375);
  });
  it.each([[9,3,undefined],[9,4,10],[12,3,12],[12,4,13],[40,3,40],[40,4,undefined]] as const)('bordas %ss%sd', (semanas,dias,semana) => {
    const r = calcular({ ...base,contexto: { ...base.contexto,semanas,dias } });
    expect(r.contexto?.semanas).toBe(semanas);expect(r.contexto?.dias).toBe(dias);
    if (semana === undefined) {expect(r.classificacao).toBeUndefined();expect(r.motivos).toContain('semana_fora_da_referencia');} else expect(r.semanaCurva).toBe(semana);
  });
  it.each([[18.4999,'baixo_peso'],[18.5,'eutrofia'],[24.9999,'eutrofia'],[25,'sobrepeso'],[29.9999,'sobrepeso'],[30,'obesidade']] as const)('IMC bruto %s', (imc,grupo) => {
    expect(calcular({ ...base,referencia: { ...base.referencia,alturaCm: 100,pesoKg: imc } }).grupo).toBe(grupo);
  });
  it('mantem divergencia documentada da semana 13 e admite ganho negativo',() => {
    const r = calcular({ ...base,pesoKg: 78.35,referencia: { ...base.referencia,pesoKg: 80 },contexto: { ...base.contexto,semanas: 13 } });
    expect(r.faixa).toEqual({ minimo: -1.7,maximo: -0.5 });expect(r.ganhoKg).toBe(-1.65);expect(r.classificacao).toBe('dentro');
    expect(faixaGestacional(13,'sobrepeso')).toEqual({ minimo: -1.6,maximo: -0.5 });
  });
  it.each([0,1])('fallback 8s%sd',dias => {
    const r = calcular({ ...base,referencia: { ...base.referencia,origem: 'inicio_gestacao_medido',semanasMedida: 8,diasMedida: dias } });
    expect(r.classificacao).toBe(dias === 0 ? 'dentro' : undefined);
  });
  it('peso habitual precisa origem propria e confirmacao',() => {
    const referencia = { ...base.referencia,origem: 'peso_habitual_informado' as const };
    expect(calcular({ ...base,referencia }).motivos).toContain('peso_habitual_anterior_nao_confirmado');
    const r = calcular({ ...base,referencia: { ...referencia,pesoHabitualAnteriorConfirmado: true } });
    expect(r.referencia?.origem).toBe('peso_habitual_informado');expect(r.classificacao).toBe('dentro');
  });
  it.each([
    { idadeAnos: 17 },{ idadeAnos: undefined },{ referencia: {} },{ pesoKg: undefined },
    { contexto: { ...base.contexto,tipo: 'multipla' as const } },
    { contexto: { ...base.contexto,risco: 'alto' as const } },
    { contexto: { ...base.contexto,risco: 'nao_informado' as const } },
    { contexto: { ...base.contexto,semanas: undefined } },
    { contexto: { ...base.contexto,origemIdadeGestacional: 'nao_informada' as const } },
    { contexto: { ...base.contexto,idadeGestacionalInconsistente: true } },
    { referencia: { pesoKg: 60,alturaCm: 160 } },
    { contexto: { ...base.contexto,dias: 7 } }
  ])('nao infere dados ou aplica referencia fora do escopo %#', entrada => {
    const r = calcular({ ...base,...entrada });expect(r.classificacao).toBeUndefined();expect(r.motivos.length).toBeGreaterThan(0);
  });
  it.each([[7.99,false],[8,true],[100,true],[100.01,false]])('plausibilidade tecnica %s', (pesoKg,plausivel) => {
    const r = calcular({ ...base,referencia: { ...base.referencia,alturaCm: 100,pesoKg } });
    expect(r.motivos.includes('referencia_fora_plausibilidade_tecnica')).toBe(!plausivel);
  });
  it('resultado explicita fonte, algoritmo, unidades e precisao sem modificar input',() => {
    const snapshot = JSON.stringify(base);const r = calcular(base);
    expect(r.source_id).toBe('ms_ufs_2022_semanal_v1');expect(r.algorithm_version).toBe('ganho_gestacional_v1');expect(r.precisao.peso).toBe('61.2');expect(r.unidades).toEqual({ peso: 'kg',altura: 'cm' });expect(JSON.stringify(base)).toBe(snapshot);
  });
  it('preserva medidas e RCQ factual mas bloqueia interpretacoes/composicao adultas',() => {
    const r = calcularAntropometria({ gestante: true,sexo: 'feminino',idadeAnos: 30,protocolo: 'faulkner',medidas: { pesoKg: 60,alturaCm: 160,circunferencias: { cintura: 90,quadril: 100 },dobras: { triceps: 20,subescapular: 20,suprailiaca: 20,abdominal: 20 } } });
    expect(r.rcq).toBe(0.9);expect(r.circunferenciaCinturaCm).toBe(90);
    for (const key of ['classificacaoImc','classificacaoRcq','classificacaoCircunferenciaCintura','percentualGordura','massaGordaKg','massaMagraKg','formulaAplicada'] as const) expect(r[key]).toBeUndefined();
  });
});

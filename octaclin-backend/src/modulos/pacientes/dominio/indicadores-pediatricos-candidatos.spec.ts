import { calcularIndicadoresCandidatos, normalizarMedidaCandidata, escoreComCaudas } from './indicadores-pediatricos-candidatos';
import { escoreLms } from './calculo-crescimento';

describe('candidato isolado: quatro indicadores com parâmetros exclusivamente sintéticos', () => {
  const contexto = { meses: 12, pesoKg: 10, alturaCm: 80, tecnica: 'deitado' as const, edema: 'nao' as const };
  const referencia = { id: 'SINTETICA-SEM-USO-CLINICO', l: 1, m: 10, s: 0.1, minimo: 0, maximo: 60, caudas: true };
  const referencias = { imc_idade: referencia, estatura_idade: { ...referencia,m: 80,caudas: false }, peso_idade: referencia, peso_estatura: { ...referencia,minimo: 45,maximo: 110 } };
  it('produz resultados parciais sem extrapolar limites', () => {
    const r = calcularIndicadoresCandidatos(contexto,referencias);
    expect(r.peso_idade.zBruto).toBe(0);
    expect(r.estatura_idade.zBruto).toBe(0);
    expect(r.peso_estatura.zBruto).toBe(0);
    expect(calcularIndicadoresCandidatos({ ...contexto,alturaCm: undefined },referencias).peso_idade.zBruto).toBe(0);
    expect(calcularIndicadoresCandidatos({ ...contexto,meses: 61 },referencias).peso_idade.motivo).toBe('fora_da_referencia');
    expect(calcularIndicadoresCandidatos(contexto,{}).peso_idade.motivo).toBe('referencia_ausente');
  });
  it('técnica 0.7 uma vez; em pé <9 meses não elimina peso por idade', () => {
    expect(normalizarMedidaCandidata(80,'em_pe',12)).toEqual({ originalCm: 80, usadoCm: 80.7, ajusteCm: 0.7 });
    expect(normalizarMedidaCandidata(80,'deitado',24)).toEqual({ originalCm: 80, usadoCm: 79.3, ajusteCm: -0.7 });
    const r = calcularIndicadoresCandidatos({ ...contexto,meses: 8,tecnica: 'em_pe' },referencias);
    expect(r.estatura_idade.motivo).toBe('tecnica_exige_reconferencia'); expect(r.peso_idade.zBruto).toBe(0);
  });
  it.each(['sim','desconhecido'] as const)('edema %s suprime peso, preserva estatura', edema => {
    const r = calcularIndicadoresCandidatos({ ...contexto,edema },referencias);
    expect(r.peso_idade.zBruto).toBeUndefined(); expect(r.estatura_idade.zBruto).toBe(0);
  });
  it('caudas usa distância entre SD2 e SD3, preservando igualdade e valor bruto', () => {
    const p = { l: -1,m: 10,s: 0.1 };
    expect(escoreComCaudas(10/(1-0.3),p,true)).toBeCloseTo(3,12);
    expect(escoreComCaudas(20,p,true)).not.toBeCloseTo(escoreLms(20,p),5);
    expect(escoreComCaudas(20,p,false)).toBe(escoreLms(20,p));
  });
  it('flags em z bruto não produzem diagnóstico ou rótulo', () => {
    const r = calcularIndicadoresCandidatos({ ...contexto,pesoKg: 16.000001 },referencias);
    expect(r.peso_idade.estado).toBe('reconferir'); expect(r.peso_idade.zBruto).toBeGreaterThan(5);
    expect(r.peso_idade).not.toHaveProperty('classificacao');
  });
});

import { classificacaoSisvanCandidata } from './indicadores-pediatricos-candidatos';
describe('intervalos SISVAN propostos REV5, não ratificados', () => {
  it('decide em z bruto e preserva igualdade dos cortes documentados', () => {
    expect(classificacaoSisvanCandidata('imc_idade',-3,'menor_de_5')).toBe('magreza');
    expect(classificacaoSisvanCandidata('imc_idade',-3.000001,'menor_de_5')).toBe('magreza_acentuada');
    expect(classificacaoSisvanCandidata('imc_idade',-2,'menor_de_5')).toBe('eutrofia');
    expect(classificacaoSisvanCandidata('imc_idade',1,'menor_de_5')).toBe('eutrofia');
    expect(classificacaoSisvanCandidata('imc_idade',1.000001,'menor_de_5')).toBe('risco_de_sobrepeso');
    expect(classificacaoSisvanCandidata('imc_idade',2,'5_a_19')).toBe('sobrepeso');
    expect(classificacaoSisvanCandidata('imc_idade',3,'5_a_19')).toBe('obesidade');
    expect(classificacaoSisvanCandidata('imc_idade',3.000001,'5_a_19')).toBe('obesidade_grave');
  });
  it('peso elevado não vira obesidade; estatura e indicadores fora da faixa', () => {
    expect(classificacaoSisvanCandidata('peso_idade',2.001,'menor_de_5')).toBe('peso_elevado_para_idade');
    expect(classificacaoSisvanCandidata('estatura_idade',-2,'menor_de_5')).toBe('estatura_adequada_para_idade');
    expect(classificacaoSisvanCandidata('peso_estatura',0,'5_a_19')).toBeUndefined();
    expect(classificacaoSisvanCandidata('imc_idade',NaN,'menor_de_5')).toBeUndefined();
  });
});

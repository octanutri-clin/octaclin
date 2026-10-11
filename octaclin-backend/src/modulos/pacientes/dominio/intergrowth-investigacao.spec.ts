/** Candidato de pesquisa, excluído do build. Não licencia dados/equações nem ativa protocolo. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { escoreLognormal, percentilNormal } from './calculo-crescimento';
interface Caso { sex: string; week: number; day: number; weight: number; length: number; comparison: Array<{ indicator: 'weight'|'length'; official_z: number; official_percentile: number }> }
const pasta = resolve(__dirname,'../../../../..','docs/history/phases/reviews/fase-314-rev3');
const ler = (nome: string) => JSON.parse(readFileSync(resolve(pasta,nome),'utf8'));
// Tolerâncias prospectivas do parecer REV4: jamais ampliadas para acomodar 55s.
const TOL_Z = 1e-8, TOL_PERCENTIL_PP = 1e-6;
function candidato(dias: number, masculino: boolean, indicador: 'weight'|'length') {
  if (!Number.isInteger(dias) || dias < 189 || dias > 448) throw new Error('fora_do_dominio_candidato');
  const w = dias / 7, s = masculino ? 1 : 0;
  return indicador === 'weight'
    ? { mu: 2.591277 - 0.01155 * Math.sqrt(w) - 2201.705 / w ** 2 + 0.0911639 * s, sigma: 0.1470258 + 505.92394 / w ** 2 - 140.0576 * Math.log(w) / w ** 2 }
    : { mu: 4.136244 - 547.0018 / w ** 2 + 0.0026066 * w + 0.0314961 * s, sigma: 0.050489 + 310.44761 / w ** 2 - 90.0742 * Math.log(w) / w ** 2 };
}
describe('INTERGROWTH candidato de pesquisa, oráculo oficial arquivado sintético', () => {
  const casos: Caso[] = [...ler('comparacao-sintetica.json').daily,ler('consulta-inicial-sintetica.json'),ler('quantil55-oraculo-sintetico.json')];
  it('reconcilia 14 casos e 28 resultados, não 26', () => {
    expect(casos).toHaveLength(14);
    expect(casos.reduce((n,c) => n+c.comparison.length,0)).toBe(28);
    expect(new Set(casos.map(c => JSON.stringify([c.sex,c.week,c.day,c.weight,c.length]))).size).toBe(14);
  });
  it.each(casos)('reproduz resultado oficial sintético %#', c => {
    for (const r of c.comparison) {
      const p = candidato(c.week*7+c.day,c.sex === 'Male',r.indicator);
      const z = escoreLognormal(c[r.indicator],p.mu,p.sigma);
      expect(Math.abs(z-r.official_z)).toBeLessThanOrEqual(TOL_Z);
      expect(Math.abs(percentilNormal(z).valor! - r.official_percentile)).toBeLessThanOrEqual(TOL_PERCENTIL_PP);
    }
  });
  it('mantém divergência 55s fora da tolerância semanal, sem falso PASS de concordância', () => {
    const p = candidato(385,true,'weight');
    const quantil = Math.exp(p.mu - 3*p.sigma);
    expect(quantil).toBeCloseTo(4.405026478034956,12);
    expect(Math.abs(quantil - 4.4)).toBeGreaterThan(0.005 + 1e-12);
  });
  it('varre dias/sexos/indicadores localmente sem consultar oráculo ou interpolar PDF', () => {
    for (let dia=189;dia<=448;dia++) for (const sexo of [false,true]) for (const indicador of ['weight','length'] as const) {
      const p = candidato(dia,sexo,indicador);
      expect(Number.isFinite(p.mu)).toBe(true); expect(p.sigma).toBeGreaterThan(0);
      const baixo = escoreLognormal(Math.exp(p.mu-3*p.sigma),p.mu,p.sigma);
      const alto = escoreLognormal(Math.exp(p.mu+3*p.sigma),p.mu,p.sigma);
      expect(baixo).toBeCloseTo(-3,10); expect(alto).toBeCloseTo(3,10);
    }
    expect(() => candidato(188,true,'weight')).toThrow();
    expect(() => candidato(449,true,'weight')).toThrow();
  });
});

describe('REV11 ampliação independente: oráculo Oxford sintético diário', () => {
  it('556 casos/1112 resultados cobrindo todos os dias/sexos/indicadores e caudas', () => {
    const d=JSON.parse(readFileSync(resolve(pasta,'../fase-314-rev11/execucao/oraculo-oxford-rev11.json'),'utf8'));
    expect(d.casos_sinteticos).toHaveLength(556);
    expect(d.casos_sinteticos.reduce((n: number,c: any) => n+c.resultados.length,0)).toBe(1112);
    for (const sexo of ['male','female']) expect(new Set(d.casos_sinteticos.filter((c: any) => c.sexo===sexo).map((c: any) => c.pma_dias)).size).toBe(260);
    for (const c of d.casos_sinteticos) for (const r of c.resultados) {
      const p=candidato(c.pma_dias,c.sexo==='male',r.indicador);
      const z=escoreLognormal(r.indicador==='weight' ? c.peso_kg : c.comprimento_cm,p.mu,p.sigma);
      expect(Math.abs(z-r.z_oficial)).toBeLessThanOrEqual(TOL_Z);
      expect(Math.abs(percentilNormal(z).valor!-r.percentil_oficial)).toBeLessThanOrEqual(TOL_PERCENTIL_PP);
    }
  });
});

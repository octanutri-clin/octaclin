/** Evidências de pesquisa; não importa motor Python nem adiciona dados científicos ao runtime. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { escoreLms, inversaLms, interpolarLms } from './calculo-crescimento';
import { escoreComCaudas } from './indicadores-pediatricos-candidatos';
import { normalizarMedidaOmsRev9 } from './protocolo-pediatrico-rev9';
const pasta = resolve(__dirname,'../../../../..','docs/history/phases/reviews/fase-314-rev11');
const arquivoGrade=process.env.G01_GRADE_OMS_LOCAL;
const fontes2007=process.env.G01_FONTES_OMS2007_LOCAL, oraculo2007=process.env.G01_ORACULO_OMS2007_LOCAL;
function csv(nome: string): Array<Record<string,string>> {
  const [cabecalho,...linhas] = readFileSync(resolve(pasta,nome),'utf8').trim().split(/\r?\n/);
  const campos = cabecalho.split(',');
  return linhas.map(l => Object.fromEntries(l.split(',').map((v,i) => [campos[i],v])));
}
const params = (r: Record<string,string>, prefixo='') => ({ l: Number(r[prefixo+'L']), m: Number(r[prefixo+'M']), s: Number(r[prefixo+'S']) });
describe('G01 REV11 no motor TS real, com oráculos OMS amostrais', () => {
  it('144 Z do Gold RCPCH/WHO dentro de5e-5, não fixtures invertidas pelo TS', () => {
    const linhas = csv('WHO2006_AMOSTRA_GOLD_RCPCH.csv');
    expect(linhas).toHaveLength(48);
    for (const r of linhas) for (const [z,col] of [[-2,'valor_z_menos2'],[0,'valor_z_zero'],[2,'valor_z_mais2']] as const) {
      expect(Math.abs(escoreLms(Number(r[col]),params(r))-z)).toBeLessThanOrEqual(5e-5);
    }
  });
  it('12 Z publicados pela OMS, tolerância0.005 por duas casas do oráculo', () => {
    for (const r of csv('WHO2006_EXEMPLOS_DOCUMENTADOS_ANTHRO.csv')) {
      const kg=Number(r.peso_kg), cm=Number(r.estatura_cm);
      for (const [valor,prefixo,col] of [[kg/(cm/100)**2,'bmi_','z_bmi_publ'],[cm,'hfa_','z_hfa_publ'],[kg,'wfa_','z_wfa_publ']] as const) {
        expect(Math.abs(escoreComCaudas(valor,params(r,prefixo),prefixo!=='hfa_')-Number(r[col]))).toBeLessThanOrEqual(.005);
      }
    }
  });
  it('4 saídas WFH independentes publicadas pela OMS incluindo caudas', () => {
    const rows=csv('WHO2006_WFH_WFL_AMOSTRA_OFICIAL.csv');
    for (const [sex,cm,kg,z] of [['m',120,18,-2.39],['f',80,15,4.13],['m',100,10,-5.19],['m',100,15,-.29]] as const) {
      const r=rows.find(r => r.tipo==='WFH' && r.sexo===sex && Number(r.cm)===cm)!;
      expect(Math.abs(escoreComCaudas(kg,params(r),true)-z)).toBeLessThanOrEqual(.005);
    }
  });
  it('OMS2007 exemplo132 meses e interpolação entre âncoras presentes', () => {
    const r=csv('WHO2007_AMOSTRA_LMS_RCPCH.csv').filter(r => r.sex==='m' && r.indicador==='bmi');
    const ancoras=r.filter(r => [61,62].includes(Number(r.mes))).map(r => ({ ...params(r),x:Number(r.mes) }));
    const p=interpolarLms(61.5,ancoras);
    expect(p.m).toBeCloseTo((15.2641+15.2616)/2,12);
    expect(escoreComCaudas(30,{ l:-1.7862,m:16.9392,s:.1107 },true)).toBeCloseTo(3.35390255606726,10);
  });
});

const oraculo2006 = process.env.G01_ORACULO_OMS2006_LOCAL;
(arquivoGrade && oraculo2006 ? describe : describe.skip)('OMS2006 WFL/WFH contra normalização e lookup R oficiais', () => {
  it('33.668 casos sintéticos: toda grade, meios, caudas, técnicas e bordas', () => {
    const grade = JSON.parse(readFileSync(arquivoGrade!, 'utf8')).grade as Array<{arquivo:number;x:number;l:number;m:number;s:number}>;
    const [, ...linhas] = readFileSync(oraculo2006!, 'utf8').trim().split(/\r?\n/);
    expect(linhas).toHaveLength(33668);
    const referencias = new Map<number,Array<{x:number;l:number;m:number;s:number}>>();
    for (const arquivo of [6,7,8,9]) referencias.set(arquivo, grade.filter(r => r.arquivo===arquivo));
    let maxErro=0, comparacoes=0, foraDominio=0;
    const falhas: unknown[]=[];
    for (const line of linhas) {
      const [sex, age, technique, original, weight, adjusted, official] = line.replace(/"/g,'').split(',');
      const dias=Number(age), cm=normalizarMedidaOmsRev9(Number(original), technique==='l'?'deitado':'em_pe',dias).usadoCm;
      expect(cm).toBeCloseTo(Number(adjusted),10);
      const minimo=dias<731?45:65, maximo=dias<731?110:120;
      if (cm<minimo||cm>maximo) {expect(official).toBe('NA');foraDominio++;continue;}
      const arquivo=(dias<731?6:8)+(Number(sex)===1?1:0);
      const p=interpolarLms(cm,referencias.get(arquivo)!);
      const z=escoreComCaudas(Number(weight),p,true), erro=Math.abs(z-Number(official));
      maxErro=Math.max(maxErro,erro);comparacoes++;
      if (!Number.isFinite(erro)||erro>.005+1e-10) falhas.push({sex,dias,cm,z,official,erro});
    }
    if (process.env.G01_RELATORIO_OMS2006_LOCAL) writeFileSync(process.env.G01_RELATORIO_OMS2006_LOCAL,JSON.stringify({comparacoes,foraDominio,maxErro,tolerancia:.005+1e-10,falhas,prova:'WHO anthro original: ajuste, lookup interpolado, caudas; saída oficial arredondada 2 casas, não prova direitos'},null,2)+'\n');
    expect(falhas).toEqual([]);
  });
});
(arquivoGrade ? describe : describe.skip)('grade OMS oficial integral disponível localmente, sem redistribuição', () => {
  it('quantis oficiais por cabeçalho, tolerância0.0005+1e-10 antes do teste', () => {
    const d=JSON.parse(readFileSync(arquivoGrade!,'utf8')) as { arquivos: unknown[]; grade: Array<{arquivo:number;sheet:string;x:number;l:number;m:number;s:number;caudas:boolean;escores?:number[];quantis:number[]}> };
    expect([10,16]).toContain(d.arquivos.length);
    expect(d.grade).toHaveLength(d.arquivos.length===16?14338:13546);
    let maxErro=0, comparacoes=0; const falhas: Array<unknown>=[];
    for (const r of d.grade) for (let i=0;i<r.quantis.length;i++) {
      const z=r.escores?.[i]??i-4, p={l:r.l,m:r.m,s:r.s};
      const medida = !r.caudas || Math.abs(z)<=3 ? inversaLms(z,p) : inversaLms(Math.sign(z)*3,p)+Math.sign(z)*(Math.abs(z)-3)*Math.abs(inversaLms(Math.sign(z)*3,p)-inversaLms(Math.sign(z)*2,p));
      const erro=Math.abs(medida-r.quantis[i]); maxErro=Math.max(maxErro,erro);comparacoes++;
      if (erro>.0005+1e-10) falhas.push({ arquivo:r.arquivo,x:r.x,z,erro });
    }
    if (process.env.G01_RELATORIO_OMS_LOCAL) writeFileSync(process.env.G01_RELATORIO_OMS_LOCAL,JSON.stringify({comparacoes,maxErro,tolerancia:.0005+1e-10,falhas,prova:'quantis publicados oficiais; inclui LMS/caudas; não valida interpolação entre grades ou política clínica'},null,2)+'\n');
    expect(falhas).toEqual([]);
  });
});

(arquivoGrade && fontes2007 ? describe : describe.skip)('OMS2007 XLSX contra TXT primários de ambos sexos',()=>{
  it('792 triplas coincidem; TXT fornece12 âncoras adicionais de borda',()=>{
    const d=JSON.parse(readFileSync(arquivoGrade!,'utf8')).grade as Array<{arquivo:number;x:number;l:number;m:number;s:number}>;
    const rows=d.filter(r=>r.arquivo>=10);
    if (!rows.length) throw new Error('Execute com a grade das16 planilhas autenticadas.');
    expect(rows).toHaveLength(792);
    const sources=new Map<string,number[][]>();
    for (const tipo of ['bfa','hfa','wfa']) sources.set(tipo,readFileSync(resolve(fontes2007!,`who2007-${tipo}.txt`),'utf8').trim().split(/\r?\n/).slice(1).map(l=>l.split('\t').map(Number)));
    for (const row of rows) {
      const tipo=row.arquivo<12?'bfa':row.arquivo<14?'hfa':'wfa', sexo=row.arquivo%2?1:2;
      const official=sources.get(tipo)!.find(r=>r[0]===sexo&&r[1]===row.x)!;
      expect(official.slice(2,5)).toEqual([row.l,row.m,row.s]);
    }
  });
});

(fontes2007 && oraculo2007 ? describe : describe.skip)('OMS2007 domínio integral contra funções originais R oficiais executadas em WASM',()=>{
  it('11.202 entradas sintéticas, tolerância Z1e-8 sem ajuste posterior',()=>{
    const [, ...linhas] = readFileSync(oraculo2007!,'utf8').trim().split(/\r?\n/);
    expect(linhas).toHaveLength(11202);
    let maxErro=0,comparacoes=0,foraDominio=0;const falhas: unknown[]=[];
    const referencias=new Map<string,Array<{x:number;l:number;m:number;s:number}>>();
    for (const tipo of ['bfa','hfa','wfa']) {
      const [, ...rows]=readFileSync(resolve(fontes2007!,`who2007-${tipo}.txt`),'utf8').trim().split(/\r?\n/);
      for (const sex of [1,2]) referencias.set(`${tipo}-${sex}`,rows.map(l=>l.split('\t').map(Number)).filter(r=>r[0]===sex).map(r=>({x:r[1],l:r[2],m:r[3],s:r[4]})));
    }
    for (const line of linhas) {
      const [tipo,sexo,age,val,official]=line.replace(/"/g,'').split(',');
      const meses=Number(age),limite=tipo==='wfa'?121:229;
      if (meses<60||meses>=limite) {expect(official).toBe('NA');foraDominio++;continue;}
      const p=interpolarLms(meses,referencias.get(`${tipo}-${sexo}`)!);
      const z=escoreComCaudas(Number(val),p,tipo!=='hfa'), erro=Math.abs(z-Number(official));
      maxErro=Math.max(maxErro,erro);comparacoes++;
      if (!Number.isFinite(erro)||erro>1e-8) falhas.push({tipo,sexo,meses,z,official,erro});
    }
    if (process.env.G01_RELATORIO_OMS2007_LOCAL) writeFileSync(process.env.G01_RELATORIO_OMS2007_LOCAL,JSON.stringify({comparacoes,foraDominio,maxErro,tolerancia:1e-8,falhas,prova:'implementação original R OMS, não valida direitos nem equivalência com todos os XLSX'},null,2)+'\n');
    expect(falhas).toEqual([]);
  });
});

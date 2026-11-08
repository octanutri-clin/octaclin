import { createHash } from 'crypto';
import { FatosComposicaoEquivalencia } from './equivalencia-nutriente';
import { formatarRazao, razaoDecimal } from './decimal-nutricional';
function canonico(v:unknown):unknown {if(Array.isArray(v))return v.map(canonico);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([,x])=>x!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonico(x)]));return v;}
export function fingerprintEquivalencia(v:unknown):string {return createHash('sha256').update(JSON.stringify(canonico(v))).digest('hex');}
const texto=(v:string|undefined)=>v?.trim().replace(/\s+/g,' ').toLowerCase();
export function fatosSemanticosEquivalencia(f:FatosComposicaoEquivalencia){
 return {identidade:f.identidade,...(f.identidade.startsWith('manual:')?{identificacaoManual:texto(f.descricao)}:{}),preparacao:texto(f.preparacao),baseGramas:formatarRazao(razaoDecimal(f.baseGramas),16),nutrientes:Object.fromEntries(Object.entries(f.nutrientes).filter(([,v])=>v!==undefined).map(([k,v])=>[k,formatarRazao(razaoDecimal(v),16)])),fonte:f.fonte};
}

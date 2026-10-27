import { decimalComoRazao } from './micronutrientes';
export interface RazaoNutricional { numerador: bigint; denominador: bigint }
export interface RazaoNutricionalSnapshot { numerador: string; denominador: string }
const abs = (n: bigint) => n < 0n ? -n : n;
function mdc(a: bigint,b: bigint): bigint { a=abs(a);b=abs(b);while(b){const resto=a%b;a=b;b=resto;}return a||1n; }
function razao(numerador: bigint,denominador: bigint): RazaoNutricional {
  if(!denominador || abs(numerador).toString().length>128 || abs(denominador).toString().length>128) throw new Error('Limite técnico de precisão excedido.');
  if(denominador<0n){numerador=-numerador;denominador=-denominador;}
  const fator=mdc(numerador,denominador);return {numerador:numerador/fator,denominador:denominador/fator};
}
/** Entrada decimal não negativa, limitada antes de BigInt; parser compartilhado. */
export function razaoDecimal(v: unknown): RazaoNutricional {
  if((typeof v!=='number'&&typeof v!=='string') || (typeof v==='number'&&(!Number.isFinite(v)||v<0)))throw new Error('Valor decimal inválido.');
  const texto=String(v);
  const m=texto.length<=64?/^(\d+)(?:\.(\d+))?(?:e([+-]?\d{1,2}))?$/i.exec(texto):null;
  if(!m || Math.abs(Number(m[3]??0))>16 || (m[2]?.length??0)-Number(m[3]??0)>16)throw new Error('Valor decimal inválido.');
  const r=decimalComoRazao(v);return razao(r.numerador,r.denominador);
}
export function lerRazaoSnapshot(v: unknown): RazaoNutricional {
  const r=v as Partial<RazaoNutricionalSnapshot>;
  if(!r||typeof r.numerador!=='string'||typeof r.denominador!=='string'||r.numerador.length>128||r.denominador.length>128||! /^-?\d+$/.test(r.numerador)||! /^\d+$/.test(r.denominador))throw new Error('Razão inválida.');
  return razao(BigInt(r.numerador),BigInt(r.denominador));
}
export function somarRazoes(a:RazaoNutricional,b:RazaoNutricional):RazaoNutricional{return razao(a.numerador*b.denominador+b.numerador*a.denominador,a.denominador*b.denominador);}
export function subtrairRazoes(a:RazaoNutricional,b:RazaoNutricional):RazaoNutricional{return somarRazoes(a,{...b,numerador:-b.numerador});}
export function multiplicarRazoes(a:RazaoNutricional,b:RazaoNutricional):RazaoNutricional{return razao(a.numerador*b.numerador,a.denominador*b.denominador);}
export function dividirRazoes(a:RazaoNutricional,b:RazaoNutricional):RazaoNutricional{return razao(a.numerador*b.denominador,a.denominador*b.numerador);}
export function compararRazoes(a:RazaoNutricional,b:RazaoNutricional):number {const n=a.numerador*b.denominador-b.numerador*a.denominador;return n<0n?-1:n>0n?1:0;}
export function valorAbsolutoRazao(a:RazaoNutricional):RazaoNutricional{return {...a,numerador:abs(a.numerador)};}
function inteiroHalfUp(a:RazaoNutricional):bigint {return (a.numerador<0n?-1n:1n)*(abs(a.numerador)*2n+a.denominador)/(2n*a.denominador);}
export function arredondarAoPasso(a:RazaoNutricional,passo:RazaoNutricional):RazaoNutricional {
  if(passo.numerador<=0n)throw new Error('Passo inválido.');
  return multiplicarRazoes({numerador:inteiroHalfUp(dividirRazoes(a,passo)),denominador:1n},passo);
}
export function serializarRazao(a:RazaoNutricional):RazaoNutricionalSnapshot {const r=razao(a.numerador,a.denominador);return {numerador:r.numerador.toString(),denominador:r.denominador.toString()};}
export function formatarRazao(a:RazaoNutricional,casas=8):string {
  if(!Number.isInteger(casas)||casas<0||casas>16)throw new Error('Precisão inválida.');
  const escala=10n**BigInt(casas),inteiro=inteiroHalfUp(multiplicarRazoes(a,{numerador:escala,denominador:1n}));
  const sinal=inteiro<0n?'-':'';const digitos=abs(inteiro).toString().padStart(casas+1,'0');
  if(!casas)return sinal+digitos;
  const fracao=digitos.slice(-casas).replace(/0+$/,'');return sinal+digitos.slice(0,-casas)+(fracao?'.'+fracao:'');
}

import { readFileSync } from 'fs';
import { join } from 'path';
import { razaoDecimal, multiplicarRazoes, dividirRazoes, subtrairRazoes, somarRazoes, arredondarAoPasso, serializarRazao, formatarRazao, compararRazoes } from './decimal-nutricional';
const r=razaoDecimal;
describe('FOOD05 aritmética racional exata',()=>{
 it('preserva decimais binariamente não representáveis e sinal de resíduos',()=>{expect(formatarRazao(somarRazoes(r('0.1'),r('0.2')),8)).toBe('0.3');expect(serializarRazao(subtrairRazoes(r('9.99'),r('10')))).toEqual({numerador:'-1',denominador:'100'});expect(formatarRazao(subtrairRazoes(r('0'),r('0.00005')),4)).toBe('-0.0001');});
 it.each([[undefined,'1'],['-1','1'],['1e999','1'],['x','1'],[NaN,'1'],[Infinity,'1'],['1','0']])('recusa origem inválida ou divisor zero %s/%s',(a,b)=>{expect(()=>dividirRazoes(r(a),r(b))).toThrow();});
 it('zero legítimo é distinto de ausência, e não permite precisão/tamanho abusivos',()=>{expect(formatarRazao(r('0'))).toBe('0');expect(()=>r(undefined)).toThrow();expect(()=>r('1'.repeat(65))).toThrow();expect(()=>formatarRazao(r('1'),1000)).toThrow();});
 it('half-up arredonda uma vez no passo selecionado',()=>{expect(formatarRazao(arredondarAoPasso(r('2.5'),r('1')))).toBe('3');expect(formatarRazao(arredondarAoPasso(dividirRazoes(r('1000'),r('3')),r('1')))).toBe('333');expect(compararRazoes(r('0.001'),r('0.001'))).toBe(0);});
 it('concorda exatamente com 4000 casos independentes Python Fraction',()=>{
  const fixture=JSON.parse(readFileSync(join(__dirname,'../../../../tests/fixtures/food05/oraculo-equivalencias.json'),'utf8'));
  expect(fixture.casos).toHaveLength(4000);
  for(const c of fixture.casos){
   const alvo=dividirRazoes(multiplicarRazoes(r(c.p),r(c.vp)),r(c.bp));
   const q=dividirRazoes(multiplicarRazoes(alvo,r(c.ba)),r(c.va));
   const sugerida=arredondarAoPasso(q,r(c.passo));
   const obtido=dividirRazoes(multiplicarRazoes(sugerida,r(c.va)),r(c.ba));
   const delta=subtrairRazoes(obtido,alvo);
   for(const [chave,valor]of Object.entries({alvo,q,sugerida,obtido,delta,percentual:dividirRazoes(multiplicarRazoes(delta,r('100')),alvo)})) expect(serializarRazao(valor)).toEqual(c[chave]);
  }
 });
});

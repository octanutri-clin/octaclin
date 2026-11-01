import { compararCenariosFactuais } from './previa-dietetica';
import { criarSnapshotMicronutrientes } from './micronutrientes';
import { analisarCoberturaDietetica } from './cobertura-dietetica';
import { calcularNutrientesCombinados, type EntradaPlanoCombinado } from './calculo-combinado';
const item=(ferro?:number,energia=100)=>({contextoClinico:'CANARIO_NAO_PROJETAR',nutrientesPorcao:{energiaKcal:energia,proteinasG:10,carboidratosG:20,gordurasG:2},micronutrientes:criarSnapshotMicronutrientes(ferro===undefined?{}:{ferroMg:{estado:'conhecido',valor:ferro}},100,100)});
const planos=(itens:unknown[]):EntradaPlanoCombinado[]=>[{planoId:'sintetico',ativo:true,selecionado:true,refeicoes:[{identidadeId:'refeicao',ativa:true,selecionada:true,itens}]}];
const delta=(antes:number,depois:number)=>compararCenariosFactuais(planos([item(antes)]),planos([item(depois)])).diferencas.ferroMg.delta;

describe('FOOD06 M04 núcleo factual antes/depois',()=>{
 it.each([[2,3,1,50],[3,2,-1,-33.33333333],[3,0,-3,-100],[0.1,0.3,0.2,200],[0.00000001,0.00000002,0.00000001,100]])('diferença sem arredondar tela: %p→%p',(a,b,d,p)=>{
  expect(delta(a,b)).toMatchObject({estado:'calculavel',diferenca:d,percentual:{estado:'calculavel',valor:p}});
 });
 it.each([[0,0,0],[0,2,2]])('preserva diferença com base zero, sem percentual artificial %p→%p',(a,b,d)=>{
  expect(delta(a,b)).toEqual({estado:'calculavel',diferenca:d,percentual:{estado:'indisponivel',motivo:'base_zero'}});
 });
 it('preserva delta quando só o percentual excede precisão técnica',()=>{
  expect(delta(0.00000001,1)).toMatchObject({estado:'calculavel',diferenca:0.99999999,percentual:{estado:'indisponivel',motivo:'limite_precisao'}});
 });
 it('usa os mesmos totais/cobertura PA06 e não projeta snapshots ou referência clínica',()=>{
  const a=planos([item(2)]),b=planos([item(3)]),r=compararCenariosFactuais(a,b);
  expect(r.antes).toEqual({calculo:calcularNutrientesCombinados(a),cobertura:analisarCoberturaDietetica(a)});
  expect(r.depois).toEqual({calculo:calcularNutrientesCombinados(b),cobertura:analisarCoberturaDietetica(b)});
  expect(r.referencias).toEqual({estado:'indisponivel',motivo:'referencias_nao_habilitadas'});
  expect(JSON.stringify(r)).not.toMatch(/CANARIO_NAO_PROJETAR|contextoClinico|nutrientesPorcao/);
 });
 it('composição parcial conserva subtotais e macros independentes, sem delta enganoso',()=>{
  const r=compararCenariosFactuais(planos([item(2),item(3)]),planos([item(4),item()]));
  expect(r.antes.cobertura.nutrientes.ferroMg.total).toBe(5);
  expect(r.depois.cobertura.nutrientes.ferroMg).toMatchObject({estado:'PARCIAL',quantidadeConhecida:4});
  expect(r.diferencas.ferroMg.delta).toEqual({estado:'indisponivel',motivo:'composicao_incompleta'});
  expect(r.diferencas.energiaKcal.delta).toMatchObject({estado:'calculavel',diferenca:0});
 });
 it('dados incompatíveis/não resolvidos e ausência de componentes não geram delta',()=>{
  const ruim=item(1);Object.assign(ruim.micronutrientes.nutrientes.ferroMg,{estado:'unidade_incompativel'});
  for(const b of [planos([ruim]),planos([null]),planos([])]){
   const r=compararCenariosFactuais(planos([item(2)]),b);
   expect(r.diferencas.ferroMg.delta).toEqual({estado:'indisponivel',motivo:'composicao_incompleta'});
  }
 });
 it('troca explícita retira principal, mantém outros e não soma alternativa disponível',()=>{
  const principal={...item(2,100),substituicoes:[item(900,9000)]},outro=item(1,50),alternativa=item(4,120);
  const r=compararCenariosFactuais(planos([principal,outro]),planos([alternativa,outro]));
  expect(r.antes.calculo.nutrientes.energiaKcal.total).toBe(150);
  expect(r.depois.calculo.nutrientes.energiaKcal.total).toBe(170);
  expect(r.diferencas.ferroMg.delta).toMatchObject({estado:'calculavel',diferenca:2});
  expect(r.depois.cobertura.nutrientes.ferroMg.contagens.incluidos).toBe(2);
 });
 it('OFF, seleção e posições vazias conservam semântica PA06',()=>{
  const b=planos([item(3)]);b[0].refeicoes[0].ativa=false;
  expect(compararCenariosFactuais(planos([item(2)]),b).depois.calculo.itensIncluidos).toBe(0);
  const esparso:unknown[]=[item(1)];esparso.length=2;
  expect(compararCenariosFactuais(planos([item(2)]),planos(esparso)).depois.cobertura.nutrientes.ferroMg.contagens.naoResolvidos).toBe(1);
 });
 it('nunca modifica os estados de entrada nem acumula arredondamento em nova prévia',()=>{
  const a=planos([item(0.1)]),b=planos([item(0.3)]),antes=JSON.stringify([a,b]);
  const r=compararCenariosFactuais(a,b);
  r.depois.cobertura.nutrientes.ferroMg.total=999;
  expect(JSON.stringify([a,b])).toBe(antes);
  expect(compararCenariosFactuais(a,b).depois.cobertura.nutrientes.ferroMg.total).toBe(0.3);
 });
 it('mantém erro explícito de limite técnico em vez de NaN/Infinity/zero fabricado',()=>{
  expect(()=>compararCenariosFactuais(planos([]),planos(Array(10001).fill(item(1))))).toThrow('Limite de itens');
  const ruim=item(1);ruim.micronutrientes.nutrientes.ferroMg.porcao=1e100;
  expect(()=>compararCenariosFactuais(planos([item(1)]),planos([ruim]))).toThrow('Limite técnico');
 });
});

it.each([NaN,Infinity,-1])('FOOD06 prévia não transforma composição inválida %p em zero',valor=>{
 const ruim=item(1);ruim.micronutrientes.nutrientes.ferroMg.porcao=valor;
 const r=compararCenariosFactuais(planos([item(2)]),planos([ruim]));
 expect(r.depois.calculo.nutrientes.ferroMg.total).toBeUndefined();
 expect(r.depois.cobertura.nutrientes.ferroMg.quantidadeConhecida).toBeUndefined();
 expect(r.diferencas.ferroMg.delta.estado).toBe('indisponivel');
});
it('FOOD06 prévia identifica quando o percentual é arredondado',()=>{
 expect(delta(3,2)).toMatchObject({percentual:{estado:'calculavel',arredondado:true}});
 expect(delta(2,3)).toMatchObject({percentual:{estado:'calculavel',arredondado:false}});
});

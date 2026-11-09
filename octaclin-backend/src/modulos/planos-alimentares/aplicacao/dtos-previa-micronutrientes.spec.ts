import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PreviaMicronutrientesDto,ConfirmarPreviaMicronutrientesDto,validarPreviaMicronutrientes } from './dtos-previa-micronutrientes';
const uuid='10000000-0000-4000-8000-000000000001';
export const comando=()=>({rascunhoIdEsperado:uuid,rascunhoRevisaoEsperada:1,ativacaoRevisaoEsperada:0,operacao:{tipo:'definir_porcao_manual',refeicaoChave:'refeicao',itemChave:'item',quantidade:1.5,unidade:'porção',porcaoGramas:187.5}});
describe('FOOD06 M04 contrato estrito da prévia',()=>{
 it('aceita somente intenções explícitas, sem composição calculada no browser',()=>{
  expect(validarPreviaMicronutrientes(comando())).toEqual(comando());
  const c=comando();Object.assign(c.operacao,{tipo:'substituir_catalogo',alimentoComposicaoId:uuid});
  expect(validarPreviaMicronutrientes(c)).toEqual(c);
 });
 it('aceita receita por identidade/versão e porções, sem ingredientes enviados pelo cliente',()=>{
  const c={...comando(),operacao:{tipo:'inserir_receita',refeicaoChave:'refeicao',receitaId:uuid,receitaVersaoEsperada:2,porcoesDesejadas:1.5}};
  expect(validarPreviaMicronutrientes(c)).toEqual(c);
  expect(validateSync(plainToInstance(PreviaMicronutrientesDto,c),{whitelist:true,forbidNonWhitelisted:true})).toHaveLength(0);
 });
 it.each([{itemChave:'item'},{quantidade:1},{porcaoGramas:100},{itens:[]},{receitaId:'invalido'},{receitaVersaoEsperada:0},{receitaVersaoEsperada:1.5},{porcoesDesejadas:0},{porcoesDesejadas:1000.001},{porcoesDesejadas:'1'},{porcoesDesejadas:1.0001}])('receita rejeita composição/parâmetros indevidos %#',extra=>{
  const c={...comando(),operacao:{tipo:'inserir_receita',refeicaoChave:'refeicao',receitaId:uuid,receitaVersaoEsperada:2,porcoesDesejadas:1.5,...extra}};
  expect(()=>validarPreviaMicronutrientes(c)).toThrow();
 });
 it.each([null,[],{},42,'prévia'])('recusa envelope %j',v=>expect(()=>validarPreviaMicronutrientes(v)).toThrow());
 it.each([{tenantId:uuid},{pacienteId:uuid},{totais:{}},{fingerprintEsperado:'a'.repeat(64)},{documento:{}},{__proto__:null,inventado:1}])('recusa campos adicionais %#',extra=>expect(()=>validarPreviaMicronutrientes({...comando(),...extra})).toThrow());
 it.each([0,-1,10000.001,Infinity,NaN,'1',null,0.0001,1.00001])('recusa quantidade/peso inválido %p',valor=>{
  for(const campo of ['quantidade','porcaoGramas']){const c=comando();Object.assign(c.operacao,{[campo]:valor});expect(()=>validarPreviaMicronutrientes(c)).toThrow();}
 });
 it.each([null,-1,1.5,'1',2147483647])('recusa revisão %p',valor=>{
  for(const campo of ['rascunhoRevisaoEsperada','ativacaoRevisaoEsperada'])expect(()=>validarPreviaMicronutrientes({...comando(),[campo]:valor})).toThrow();
 });
 it.each([{tipo:'receita'},{tipo:'substituir_catalogo'},{refeicaoChave:''},{itemChave:'x'.repeat(181)},{unidade:''},{unidade:'x'.repeat(41)},{micronutrientesPor100g:{ferroMg:999}},{alimentoPersonalizado:{id:uuid}},{alimentoComposicaoId:uuid},{itemId:uuid}])('recusa operação não suportada/manipulada %#',extra=>{
  const c=comando();Object.assign(c.operacao,extra);expect(()=>validarPreviaMicronutrientes(c)).toThrow();
 });
 it('confirmação exige fingerprint; ele não é aceito no comando de leitura',()=>{
  const c={...comando(),fingerprintEsperado:'a'.repeat(64)};expect(validarPreviaMicronutrientes(c,true)).toEqual(c);
  for(const valor of [undefined,null,'A'.repeat(64),'a'.repeat(63)])expect(()=>validarPreviaMicronutrientes({...c,fingerprintEsperado:valor},true)).toThrow();
 });
 it('pipe rejeita envelope/operação desconhecidos e herda precondições na confirmação',()=>{
  const pipe=(classe:typeof PreviaMicronutrientesDto,v:unknown)=>validateSync(plainToInstance(classe,v),{whitelist:true,forbidNonWhitelisted:true});
  expect(pipe(PreviaMicronutrientesDto,comando())).toHaveLength(0);
  expect(pipe(ConfirmarPreviaMicronutrientesDto,{...comando(),fingerprintEsperado:'a'.repeat(64)})).toHaveLength(0);
  expect(pipe(PreviaMicronutrientesDto,{...comando(),totais:{}}).length).toBeGreaterThan(0);
  expect(pipe(PreviaMicronutrientesDto,{...comando(),operacao:{...comando().operacao,micros:{}}}).length).toBeGreaterThan(0);
 });
 it('não executa getters ou interpreta propriedades especiais',()=>{
  const getter=jest.fn(()=>1),c=comando();Object.defineProperty(c.operacao,'quantidade',{get:getter,enumerable:true});
  expect(()=>validarPreviaMicronutrientes(c)).toThrow();expect(getter).not.toHaveBeenCalled();
  const normal=JSON.stringify(comando());expect(()=>validarPreviaMicronutrientes(JSON.parse(normal.slice(0,-1)+',"__proto__":{}}'))).toThrow();
 });
});

import { milesimosReceita } from '../dominio/conteudo-receita';
import { isUUID, IsInt, IsUUID, Max, Min, Matches, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
export interface OperacaoPreviaMicronutrientes {
 tipo:'definir_porcao_manual'|'substituir_catalogo';refeicaoChave:string;itemChave:string;
 quantidade:number;unidade:string;porcaoGramas:number;alimentoComposicaoId?:string;
}
export interface EntradaPreviaMicronutrientes {
 rascunhoIdEsperado:string;rascunhoRevisaoEsperada:number;ativacaoRevisaoEsperada:number;operacao:OperacaoPreviaMicronutrientes;
}
export interface EntradaConfirmacaoPrevia extends EntradaPreviaMicronutrientes {fingerprintEsperado:string}
function falhar():never {throw new Error('Prévia de micronutrientes inválida.');}
function objeto(v:unknown,campos:string[],protos:unknown[]=[Object.prototype,null]):Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v)||!protos.includes(Object.getPrototypeOf(v))||Object.getOwnPropertySymbols(v).length)return falhar();
 if(Object.entries(Object.getOwnPropertyDescriptors(v)).some(([k,d])=>!campos.includes(k)||!d.enumerable||!Object.hasOwn(d,'value')))return falhar();
 return v as Record<string,unknown>;
}
function texto(v:unknown,max:number):v is string {return typeof v==='string'&&v.trim().length>0&&v.length<=max;}
function revisao(v:unknown):v is number {return Number.isSafeInteger(v)&&(v as number)>=0&&(v as number)<=2147483646;}
export function validarOperacaoPrevia(valor:unknown):OperacaoPreviaMicronutrientes {
 const v=objeto(valor,['tipo','refeicaoChave','itemChave','quantidade','unidade','porcaoGramas','alimentoComposicaoId']);
 if((typeof v.tipo!=='string'||!['definir_porcao_manual','substituir_catalogo'].includes(v.tipo))||!texto(v.refeicaoChave,180)||!texto(v.itemChave,180)||!texto(v.unidade,40))return falhar();
 milesimosReceita(v.quantidade);milesimosReceita(v.porcaoGramas);
 if(v.tipo==='substituir_catalogo'?!isUUID(v.alimentoComposicaoId as string):Object.hasOwn(v,'alimentoComposicaoId'))return falhar();
 return {tipo:v.tipo as OperacaoPreviaMicronutrientes['tipo'],refeicaoChave:v.refeicaoChave,itemChave:v.itemChave,quantidade:v.quantidade as number,unidade:v.unidade,porcaoGramas:v.porcaoGramas as number,...(v.tipo==='substituir_catalogo'?{alimentoComposicaoId:v.alimentoComposicaoId as string}:{})};
}
export function validarPreviaMicronutrientes(valor:unknown,confirmar=false):EntradaPreviaMicronutrientes|EntradaConfirmacaoPrevia {
 const v=objeto(valor,['rascunhoIdEsperado','rascunhoRevisaoEsperada','ativacaoRevisaoEsperada','operacao',...(confirmar?['fingerprintEsperado']:[])],[Object.prototype,null,PreviaMicronutrientesDto.prototype,ConfirmarPreviaMicronutrientesDto.prototype]);
 if(!isUUID(v.rascunhoIdEsperado as string)||!revisao(v.rascunhoRevisaoEsperada)||!revisao(v.ativacaoRevisaoEsperada))return falhar();
 if(confirmar&&(typeof v.fingerprintEsperado!=='string'||! /^[a-f0-9]{64}$/.test(v.fingerprintEsperado)))return falhar();
 const operacao=validarOperacaoPrevia(v.operacao);
 return {rascunhoIdEsperado:v.rascunhoIdEsperado as string,rascunhoRevisaoEsperada:v.rascunhoRevisaoEsperada,ativacaoRevisaoEsperada:v.ativacaoRevisaoEsperada,operacao,...(confirmar?{fingerprintEsperado:v.fingerprintEsperado as string}:{})};
}
@ValidatorConstraint({name:'operacaoPreviaMicronutrientes',async:false})
export class ValidadorOperacaoPrevia implements ValidatorConstraintInterface {validate(v:unknown){try{validarOperacaoPrevia(v);return true;}catch{return false;}}}
export class PreviaMicronutrientesDto {
 @IsUUID() rascunhoIdEsperado:string;
 @IsInt() @Min(0) @Max(2147483646) rascunhoRevisaoEsperada:number;
 @IsInt() @Min(0) @Max(2147483646) ativacaoRevisaoEsperada:number;
 @Validate(ValidadorOperacaoPrevia) operacao:OperacaoPreviaMicronutrientes;
}
export class ConfirmarPreviaMicronutrientesDto extends PreviaMicronutrientesDto {
 @Matches(/^[a-f0-9]{64}$/) fingerprintEsperado:string;
}

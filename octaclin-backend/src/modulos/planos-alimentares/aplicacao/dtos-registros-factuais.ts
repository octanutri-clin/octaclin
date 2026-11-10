import { IsIn,IsBoolean,ValidateIf,IsInt,IsISO8601,IsOptional,IsUUID,Matches,Max,Min,Validate,ValidatorConstraint,type ValidationArguments,type ValidatorConstraintInterface } from 'class-validator';
import { validarRegistroDeVersaoFactual,type ComandoRegistroDeVersaoFactual } from './servico-registros-analise-factual';
@ValidatorConstraint({name:'fonteRegistroFactual',async:false})
class ValidadorFonteRegistro implements ValidatorConstraintInterface {
 validate(_valor:unknown,args:ValidationArguments){try{const d=args.object as ComandoRegistroDeVersaoFactual;validarRegistroDeVersaoFactual({registro:d.registro,selecao:d.selecao,...(d.confirmacoes===undefined?{}:{confirmacoes:d.confirmacoes})});return true;}catch{return false;}}
 defaultMessage(){return 'Fonte de registro inválida.';}
}
export class RegistrarVersaoFactualDto implements ComandoRegistroDeVersaoFactual {
 @Validate(ValidadorFonteRegistro) registro:ComandoRegistroDeVersaoFactual['registro'];
 @Validate(ValidadorFonteRegistro) selecao:ComandoRegistroDeVersaoFactual['selecao'];
 @Validate(ValidadorFonteRegistro) confirmacoes?:ComandoRegistroDeVersaoFactual['confirmacoes'];
}
export class ListarRegistrosFactuaisDto {
 @IsInt() @Min(1) @Max(10000) pagina:number;
 @IsInt() @Min(1) @Max(100) limite:number;
}
export class ConsultarRegistroFactualDto {
 @IsUUID() registroId:string;
 /** FOOD06 T3b: opt-in aditivo; compara com a versão DRI gravada no registro. No relatório, só no formato 2. */
 @ValidateIf((_o,v)=>v!==undefined) @IsBoolean() incluirReferencias?:boolean;
}
export class PrepararRelatorioFactualDto extends ConsultarRegistroFactualDto {
 @ValidateIf((_o,v)=>v!==undefined) @IsIn([2]) versaoRelatorio?:2;
 /** Opt-in aditivo: só o formato 2 aceita. Clientes anteriores nunca o enviam e recebem o formato de sempre. */
 @ValidateIf((_o,v)=>v!==undefined) @IsBoolean() incluirOrigem?:boolean;
}
export class CompararRegistrosFactuaisDto { @IsUUID() antesId:string; @IsUUID() depoisId:string; }

@ValidatorConstraint({name:'cursorHistoricoFactual',async:false})
class ValidadorCursorHistorico implements ValidatorConstraintInterface {
 validate(_valor:unknown,args:ValidationArguments){const d=args.object as HistoricoRegistrosFactuaisDto;return (d.cursorId===undefined)===(d.cursorCriadoEm===undefined);}
 defaultMessage(){return 'Cursor de histórico inválido.';}
}
/** Cursor keyset mantém as páginas estáveis quando análises novas são registradas. */
export class HistoricoRegistrosFactuaisDto {
 @ValidateIf((_o,v)=>v!==undefined) @IsBoolean() incluirContexto?:boolean;
 /** Opt-in aditivo, como `incluirContexto`: clientes anteriores recusam chaves novas no histórico. */
 @ValidateIf((_o,v)=>v!==undefined) @IsBoolean() incluirOrigem?:boolean;
 /** FOOD06 T3b: opt-in aditivo, mesma regra das demais flags do histórico. */
 @ValidateIf((_o,v)=>v!==undefined) @IsBoolean() incluirReferencias?:boolean;
 @IsInt() @Min(1) @Max(10) limite:number;
 @IsOptional() @Validate(ValidadorCursorHistorico) @IsUUID() cursorId?:string;
 @IsOptional() @Validate(ValidadorCursorHistorico) @IsISO8601({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/) cursorCriadoEm?:string;
}

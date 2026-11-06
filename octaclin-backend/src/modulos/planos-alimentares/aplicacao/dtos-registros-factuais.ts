import { IsInt,IsISO8601,IsOptional,IsUUID,Matches,Max,Min,Validate,ValidatorConstraint,type ValidationArguments,type ValidatorConstraintInterface } from 'class-validator';
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
export class ConsultarRegistroFactualDto { @IsUUID() registroId:string; }
export class CompararRegistrosFactuaisDto { @IsUUID() antesId:string; @IsUUID() depoisId:string; }

@ValidatorConstraint({name:'cursorHistoricoFactual',async:false})
class ValidadorCursorHistorico implements ValidatorConstraintInterface {
 validate(_valor:unknown,args:ValidationArguments){const d=args.object as HistoricoRegistrosFactuaisDto;return (d.cursorId===undefined)===(d.cursorCriadoEm===undefined);}
 defaultMessage(){return 'Cursor de histórico inválido.';}
}
/** Cursor keyset mantém as páginas estáveis quando análises novas são registradas. */
export class HistoricoRegistrosFactuaisDto {
 @IsInt() @Min(1) @Max(10) limite:number;
 @IsOptional() @Validate(ValidadorCursorHistorico) @IsUUID() cursorId?:string;
 @IsOptional() @Validate(ValidadorCursorHistorico) @IsISO8601({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/) cursorCriadoEm?:string;
}

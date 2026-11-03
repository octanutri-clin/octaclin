import { IsInt,IsUUID,Max,Min,Validate,ValidatorConstraint,type ValidationArguments,type ValidatorConstraintInterface } from 'class-validator';
import { validarRegistroDeVersaoFactual,type ComandoRegistroDeVersaoFactual } from './servico-registros-analise-factual';
@ValidatorConstraint({name:'fonteRegistroFactual',async:false})
class ValidadorFonteRegistro implements ValidatorConstraintInterface {
 validate(_valor:unknown,args:ValidationArguments){try{const d=args.object as ComandoRegistroDeVersaoFactual;validarRegistroDeVersaoFactual({registro:d.registro,selecao:d.selecao});return true;}catch{return false;}}
 defaultMessage(){return 'Fonte de registro inválida.';}
}
export class RegistrarVersaoFactualDto implements ComandoRegistroDeVersaoFactual {
 @Validate(ValidadorFonteRegistro) registro:ComandoRegistroDeVersaoFactual['registro'];
 @Validate(ValidadorFonteRegistro) selecao:ComandoRegistroDeVersaoFactual['selecao'];
}
export class ListarRegistrosFactuaisDto {
 @IsInt() @Min(1) @Max(10000) pagina:number;
 @IsInt() @Min(1) @Max(100) limite:number;
}
export class ConsultarRegistroFactualDto { @IsUUID() registroId:string; }
export class CompararRegistrosFactuaisDto { @IsUUID() antesId:string; @IsUUID() depoisId:string; }

import { Allow, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { PreferenciasEquivalencia, validarPedidoPreferenciasEquivalencia } from '../dominio/preferencias-equivalencia';
@ValidatorConstraint({name:'preferenciasEquivalenciaValidas',async:false})
class PreferenciasValidas implements ValidatorConstraintInterface {
  validate(_v:unknown,a:ValidationArguments){try{validarPedidoPreferenciasEquivalencia({...a.object});return true;}catch{return false;}}
  defaultMessage(){return 'Preferências inválidas.';}
}
export class SalvarPreferenciasEquivalenciaDto {
  @Validate(PreferenciasValidas) revisaoEsperada:number;
  @Allow() preferencias:PreferenciasEquivalencia;
}

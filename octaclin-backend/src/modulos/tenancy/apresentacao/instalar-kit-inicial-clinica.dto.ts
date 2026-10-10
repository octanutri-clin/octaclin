import { ArrayMaxSize, ArrayMinSize, ArrayUnique, Equals, IsArray, IsIn } from 'class-validator';
import { CHAVES_KIT_INICIAL_CLINICA, type ChaveKitInicialClinica } from '../kit-inicial-clinica';

export class InstalarKitInicialClinicaRequestDto {
  @Equals(true)
  confirmacao: true;

  @Equals(2)
  versao: 2;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CHAVES_KIT_INICIAL_CLINICA.length)
  @ArrayUnique()
  @IsIn(CHAVES_KIT_INICIAL_CLINICA, { each: true })
  itens: ChaveKitInicialClinica[];
}

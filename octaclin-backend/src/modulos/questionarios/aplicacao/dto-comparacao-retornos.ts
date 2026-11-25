import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';
export class CompararRetornosDto {
  @IsUUID()
  pacienteId:string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @ArrayUnique()
  @IsUUID('all',{each:true})
  respostaIds:string[];
}

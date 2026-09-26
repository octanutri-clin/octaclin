import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class SelecaoPacientesLoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  pacienteIds: string[];
}

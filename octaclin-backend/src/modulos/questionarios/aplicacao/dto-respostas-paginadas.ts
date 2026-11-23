import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
export class FiltrosExportacaoRespostasDto {
  @IsOptional() @IsUUID() pacienteId?: string;
  @IsOptional() @IsString() @MaxLength(10) inicio?: string;
  @IsOptional() @IsString() @MaxLength(10) fim?: string;
}
export class ConsultaPaginaRespostasDto extends FiltrosExportacaoRespostasDto {
  @IsOptional() @IsIn(['25','50','100']) tamanho?: string;
  @IsOptional() @IsString() @MaxLength(2048) cursor?: string;
}
export class ExportacaoRespostasPaginadasDto {
  @IsIn(['visiveis','consulta','questionario']) escopo: 'visiveis' | 'consulta' | 'questionario';
  @IsOptional() @ValidateNested() @Type(() => FiltrosExportacaoRespostasDto) filtros?: FiltrosExportacaoRespostasDto;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @ArrayUnique(v => typeof v === 'string' ? v.toLowerCase() : v) @IsUUID('all',{each:true}) respostaIds?: string[];
}

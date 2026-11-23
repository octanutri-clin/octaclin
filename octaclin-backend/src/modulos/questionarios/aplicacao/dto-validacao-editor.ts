import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsDefined, IsInt, IsObject, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { AtualizarPerguntaDto } from './dtos';

class EdicaoPerguntaEditorDto {
  @IsUUID()
  id: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => AtualizarPerguntaDto)
  dados: AtualizarPerguntaDto;
}
export class ValidarPreviaEditorDto {
  @IsInt()
  @Min(1)
  versaoEsperada: number;

  @IsString()
  @MaxLength(180)
  titulo: string;

  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayUnique((item: EdicaoPerguntaEditorDto) => item?.id)
  @ValidateNested({ each: true })
  @Type(() => EdicaoPerguntaEditorDto)
  perguntas: EdicaoPerguntaEditorDto[];
}
export interface ProblemaEditor {
  perguntaId?: string;
  campo: 'titulo' | 'enunciado' | 'peso' | 'categoriaId' | 'tipo' | 'configuracao' | 'opcoes' | 'dados';
  codigo: 'titulo_ausente' | 'enunciado_ausente' | 'dados_invalidos' | 'configuracao_invalida' | 'opcoes_insuficientes';
}

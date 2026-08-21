import { IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { CriteriosFiltroSalvo, OrigemFiltroSalvo } from '../dominio/filtros-salvos';

export class CriarFiltroSalvoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nome: string;

  @IsIn(['pessoal', 'clinica'])
  origem: OrigemFiltroSalvo;

  @IsObject()
  criterios: CriteriosFiltroSalvo;
}

export class ListarFiltrosSalvosDto {
  @IsOptional()
  @IsIn(['pessoal', 'clinica'])
  origem?: OrigemFiltroSalvo;
}

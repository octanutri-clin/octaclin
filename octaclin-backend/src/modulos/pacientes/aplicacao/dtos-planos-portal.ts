import 'reflect-metadata';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class ListarPlanosAtivosPortalDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000)
  pagina = 1;

  @Type(() => Number) @IsInt() @Min(1) @Max(20)
  limite = 10;
}

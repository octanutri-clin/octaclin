import { Type } from 'class-transformer';
import { Equals, IsBoolean, IsIn, IsInt, IsUUID, Max, Min } from 'class-validator';

export class ConfirmarConcessaoDto {
  @IsBoolean()
  @Equals(true)
  confirmacaoDoisPassos: boolean;
}
export class ConcederPermissaoDto extends ConfirmarConcessaoDto {
  @IsUUID() usuarioId: string;
  @IsIn(['restricoes.confirmar']) permissao: 'restricoes.confirmar';
  /** Código administrativo fechado: não aceitar anotação clínica em claro. */
  @IsIn(['habilitacao_administrativa']) motivo: 'habilitacao_administrativa';
}
export class ListarConcessoesDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) pagina: number = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) limite: number = 25;
}

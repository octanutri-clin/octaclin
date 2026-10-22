import { IsIn, IsUUID } from 'class-validator';
import { OrigemFavoritoAlimento } from '../dominio/favoritos-alimentos';

export class FavoritarAlimentoDto {
  @IsIn(['catalogo', 'custom']) origem: OrigemFavoritoAlimento;
  @IsUUID() alimentoId: string;
}

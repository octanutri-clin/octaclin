import { IsString, MaxLength, MinLength } from 'class-validator';

export class ComprovanteLeituraDto {
  @IsString()
  @MinLength(32)
  @MaxLength(2048)
  comprovanteLeitura: string;
}

import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export class AlterarAtivacaoPlanoDto {
  @IsBoolean()
  ativo: boolean;

  @IsInt() @Min(0) @Max(2147483646)
  ativacaoRevisaoEsperada: number;
}

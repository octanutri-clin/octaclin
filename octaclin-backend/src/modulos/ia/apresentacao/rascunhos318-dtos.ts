import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
export class Selecao318Dto {
  @IsIn(["preparacao", "evolucao", "medida"])
  tipo!: "preparacao" | "evolucao" | "medida";
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  id!: string;
}
export class CapturarFontes318Dto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) contextoSessao!: string;
}
export class GerarRascunho318Dto extends CapturarFontes318Dto {
  @IsUUID()
  chaveComando!: string;
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  modeloId!: string;
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => Selecao318Dto)
  selecoes!: Selecao318Dto[];
  @IsOptional()
  @IsString()
  @MaxLength(6000)
  textoProfissional?: string;
}
export class ConfirmarRascunho318Dto {
  @IsOptional() @IsString() @MaxLength(6000) textoProfissional?: string;
  @IsUUID()
  chaveComando!: string;
  @IsString()
  @MaxLength(30000)
  provaRevisao!: string;
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  titulo!: string;
  @IsString()
  @MinLength(3)
  @MaxLength(6000)
  conteudo!: string;
  @IsOptional()
  @IsIn(["consulta", "retorno", "observacao", "ajuste_plano"])
  tipo?: string;
  @IsOptional()
  @IsUUID()
  consultaId?: string;
  @Equals(true)
  confirmado!: boolean;
}
export class Versao318Dto {
  @IsInt()
  @Min(0)
  @Max(2147483646)
  versaoEsperada!: number;
}
export class MutarCredencial318Dto extends Versao318Dto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) contextoSessao!: string;
}
export class Credencial318Dto extends MutarCredencial318Dto {
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  chave!: string;
}
export class Configurar318Dto extends MutarCredencial318Dto {
  @IsBoolean()
  habilitada!: boolean;
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  maxChamadas15min?: number;
  @IsOptional()
  @IsInt()
  @Min(256)
  @Max(2048)
  maxTokensSaida?: number;
}

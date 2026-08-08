import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ESCOPOS_API_PUBLICA, EVENTOS_WEBHOOK, EscopoApiPublica, EventoWebhook } from '../dominio/contratos-integracao';
import { CriarConsultaAgendaDto } from '../../agenda/aplicacao/dtos';
import { CriarPacienteDto } from '../../pacientes/aplicacao/dtos';

export class CriarChaveApiDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(120)
  nome: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsIn(ESCOPOS_API_PUBLICA, { each: true })
  escopos: EscopoApiPublica[];

  @IsOptional()
  @IsDateString()
  expiraEm?: string;
}

export class CriarWebhookDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(120)
  nome: string;

  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  url: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsIn(EVENTOS_WEBHOOK, { each: true })
  eventos: EventoWebhook[];
}

export class ListarApiPublicaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite = 25;
}

export class ListarConsultasApiPublicaDto extends ListarApiPublicaDto {
  @IsOptional()
  @IsDateString()
  inicioEm?: string;

  @IsOptional()
  @IsDateString()
  fimEm?: string;
}

export class CriarPacienteApiPublicaDto extends CriarPacienteDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(180)
  declare referenciaExterna: string;
}

export class CriarConsultaApiPublicaDto extends CriarConsultaAgendaDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(180)
  declare referenciaExterna: string;
}

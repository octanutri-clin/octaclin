import {
  IsArray,
  IsIn,
  IsMimeType,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoMidiaMobile } from '../dominio/validacao-midia';

export class VinculoClinicoAnexoDto {
  @IsIn(['consulta', 'avaliacao_antropometrica', 'documento_emitido', 'evolucao_fotografica'])
  tipo: 'consulta' | 'avaliacao_antropometrica' | 'documento_emitido' | 'evolucao_fotografica';

  @IsUUID()
  recursoId: string;
}

export class RegistrarDiarioRapidoDto {
  @IsUUID()
  pacienteId: string;

  @IsIn(['refeicao', 'humor', 'agua', 'atividade'])
  tipo: 'refeicao' | 'humor' | 'agua' | 'atividade';

  @IsObject()
  valor: Record<string, unknown>;
}

export class SolicitarUploadMidiaDto {
  @IsUUID()
  pacienteId: string;

  @IsIn(['imagem', 'audio', 'video', 'documento'])
  tipo: TipoMidiaMobile;

  @IsMimeType()
  mimeType: string;

  @IsNumber()
  @Min(1)
  tamanhoBytes: number;

  @IsOptional()
  @IsIn(['exame', 'documento', 'foto', 'diario'])
  categoria?: 'exame' | 'documento' | 'foto' | 'diario';

  @IsOptional()
  @IsString()
  @MaxLength(180)
  nomeArquivo?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(600)
  duracaoSegundos?: number;

  @IsOptional()
  @IsString()
  hashConteudo?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => VinculoClinicoAnexoDto)
  vinculoClinico?: VinculoClinicoAnexoDto;
}

export class CriarAcompanhanteDto {
  @IsUUID()
  pacienteId: string;

  @IsString()
  nome: string;

  @IsOptional()
  @IsString()
  contato?: string;

  @IsString()
  pin: string;
}

export class ItemSincronizacaoMobileDto {
  @IsString()
  idLocal: string;

  @IsIn(['diario_rapido', 'midia_captura', 'midia_audio', 'acompanhante'])
  tipo: 'diario_rapido' | 'midia_captura' | 'midia_audio' | 'acompanhante';

  @IsObject()
  payload: Record<string, unknown>;
}

export class SincronizarLoteMobileDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemSincronizacaoMobileDto)
  itens: ItemSincronizacaoMobileDto[];
}

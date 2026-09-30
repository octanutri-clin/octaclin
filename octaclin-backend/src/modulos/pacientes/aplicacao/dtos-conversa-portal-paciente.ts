import { IsString, MaxLength } from 'class-validator';

export class EnviarMensagemPortalPacienteDto {
  @IsString()
  @MaxLength(5000)
  texto: string;
}

export class ResponderConversaPortalPacienteDto extends EnviarMensagemPortalPacienteDto {}

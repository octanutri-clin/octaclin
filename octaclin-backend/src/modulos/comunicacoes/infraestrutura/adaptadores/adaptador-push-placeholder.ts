import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ResultadoEnvioNotificacao } from '../../dominio/canal-notificacao';
import { AdaptadorNotificacao, ContextoEnvioNotificacao } from './adaptador-notificacao';

@Injectable()
export class AdaptadorPushPlaceholder implements AdaptadorNotificacao {
  async enviar(contexto: ContextoEnvioNotificacao): Promise<ResultadoEnvioNotificacao> {
    return {
      idExterno: `push-local-${randomUUID()}`,
      metadados: {
        destino: contexto.payload.destino,
        titulo: contexto.payload.titulo ?? contexto.template.conteudo.titulo
      }
    };
  }
}

import { ResultadoEnvioNotificacao } from '../../dominio/canal-notificacao';
import { CanalNotificacaoOrm } from '../canal-notificacao.orm';
import { TemplateMensagemOrm } from '../template-mensagem.orm';

export interface ContextoEnvioNotificacao {
  canal: CanalNotificacaoOrm;
  template: TemplateMensagemOrm;
  payload: Record<string, unknown>;
}

export interface AdaptadorNotificacao {
  enviar(contexto: ContextoEnvioNotificacao): Promise<ResultadoEnvioNotificacao>;
}

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ResultadoEnvioNotificacao } from '../../dominio/canal-notificacao';
import { AdaptadorNotificacao, ContextoEnvioNotificacao } from './adaptador-notificacao';

@Injectable()
export class AdaptadorWhatsAppMeta implements AdaptadorNotificacao {
  async enviar(contexto: ContextoEnvioNotificacao): Promise<ResultadoEnvioNotificacao> {
    const token = String(process.env.META_WHATSAPP_TOKEN ?? contexto.canal.configuracao.token ?? '');
    const phoneNumberId = String(
      contexto.canal.configuracao.phoneNumberId ?? process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? ''
    );
    const versao = String(contexto.canal.configuracao.apiVersion ?? process.env.META_WHATSAPP_API_VERSION ?? 'v21.0');
    const destino = String(contexto.payload.destino ?? '');
    const template = String(contexto.template.codigoExterno ?? contexto.template.nome);
    const idioma = String(contexto.payload.idioma ?? contexto.template.conteudo.idioma ?? 'pt_BR');

    if (!token || !phoneNumberId || !destino) {
      throw new InternalServerErrorException('Configuracao WhatsApp incompleta.');
    }

    const resposta = await fetch(`https://graph.facebook.com/${versao}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: destino,
        type: 'template',
        template: {
          name: template,
          language: { code: idioma },
          components: contexto.payload.components ?? contexto.template.conteudo.components ?? []
        }
      })
    });

    const corpo = (await resposta.json().catch(() => ({}))) as { messages?: Array<{ id?: string }>; error?: unknown };
    if (!resposta.ok) {
      throw new InternalServerErrorException(`Falha Meta Cloud API: ${JSON.stringify(corpo.error ?? corpo)}`);
    }

    return {
      idExterno: corpo.messages?.[0]?.id,
      metadados: corpo as Record<string, unknown>
    };
  }
}

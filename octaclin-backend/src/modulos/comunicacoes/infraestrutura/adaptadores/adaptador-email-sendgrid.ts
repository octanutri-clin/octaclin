import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ResultadoEnvioNotificacao } from '../../dominio/canal-notificacao';
import { AdaptadorNotificacao, ContextoEnvioNotificacao } from './adaptador-notificacao';

@Injectable()
export class AdaptadorEmailSendGrid implements AdaptadorNotificacao {
  async enviar(contexto: ContextoEnvioNotificacao): Promise<ResultadoEnvioNotificacao> {
    const apiKey = String(contexto.canal.configuracao.apiKey ?? process.env.SENDGRID_API_KEY ?? '');
    const remetente = String(
      contexto.payload.remetente ?? contexto.canal.configuracao.remetente ?? process.env.SENDGRID_REMETENTE ?? ''
    );
    const destino = String(contexto.payload.destino ?? '');
    const assunto = String(contexto.payload.assunto ?? contexto.template.conteudo.assunto ?? contexto.template.nome);
    const html = String(contexto.payload.html ?? contexto.template.conteudo.html ?? '');
    const texto = String(contexto.payload.texto ?? contexto.template.conteudo.texto ?? '');

    if (!apiKey || !remetente || !destino || (!html && !texto)) {
      throw new InternalServerErrorException('Configuracao SendGrid incompleta.');
    }

    const resposta = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: destino }] }],
        from: { email: remetente },
        subject: assunto,
        content: [
          ...(texto ? [{ type: 'text/plain', value: texto }] : []),
          ...(html ? [{ type: 'text/html', value: html }] : [])
        ]
      })
    });

    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => '');
      throw new InternalServerErrorException(`Falha SendGrid: ${corpo}`);
    }

    return {
      idExterno: resposta.headers.get('x-message-id') ?? undefined,
      metadados: { status: resposta.status }
    };
  }
}

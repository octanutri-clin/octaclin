import { Body, Controller, ForbiddenException, Get, Logger, Post, Query, ServiceUnavailableException } from '@nestjs/common';

interface MetaWebhookValor {
  messaging_product?: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  statuses?: Array<{
    id?: string;
    status?: string;
    timestamp?: string;
    recipient_id?: string;
    errors?: unknown[];
  }>;
  messages?: Array<{
    id?: string;
    from?: string;
    timestamp?: string;
    type?: string;
  }>;
}

interface MetaWebhookEntrada {
  id?: string;
  changes?: Array<{
    field?: string;
    value?: MetaWebhookValor;
  }>;
}

interface MetaWebhookPayload {
  object?: string;
  entry?: MetaWebhookEntrada[];
}

@Controller('comunicacoes/webhooks/whatsapp')
export class ControladorWebhookWhatsApp {
  private readonly logger = new Logger(ControladorWebhookWhatsApp.name);

  @Get()
  verificar(
    @Query('hub.mode') modo?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') desafio?: string
  ) {
    const tokenEsperado = process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    if (!tokenEsperado) {
      throw new ServiceUnavailableException('Webhook WhatsApp nao configurado.');
    }

    if (modo === 'subscribe' && token === tokenEsperado && desafio) {
      return desafio;
    }

    throw new ForbiddenException('Token de verificacao invalido.');
  }

  @Post()
  receber(@Body() payload: MetaWebhookPayload, @Query('token') tokenRecebimento?: string) {
    const tokenEsperado = process.env.META_WHATSAPP_WEBHOOK_RECEIVE_TOKEN;
    if (tokenEsperado && tokenRecebimento !== tokenEsperado) {
      throw new ForbiddenException('Token de recebimento invalido.');
    }

    const eventos = this.extrairEventos(payload);
    if (eventos.statuses > 0 || eventos.messages > 0) {
      this.logger.log(
        `Webhook WhatsApp recebido: statuses=${eventos.statuses}; messages=${eventos.messages}; phoneNumberIds=${eventos.phoneNumberIds.join(',')}`
      );
    }

    return { recebido: true, eventos };
  }

  private extrairEventos(payload: MetaWebhookPayload) {
    const phoneNumberIds = new Set<string>();
    let statuses = 0;
    let messages = 0;

    for (const entrada of payload.entry ?? []) {
      for (const change of entrada.changes ?? []) {
        const valor = change.value;
        if (!valor) continue;
        if (valor.metadata?.phone_number_id) phoneNumberIds.add(valor.metadata.phone_number_id);
        statuses += valor.statuses?.length ?? 0;
        messages += valor.messages?.length ?? 0;
      }
    }

    return {
      statuses,
      messages,
      phoneNumberIds: [...phoneNumberIds]
    };
  }
}

import { Body, Controller, ForbiddenException, Get, Logger, Post, Query, ServiceUnavailableException } from '@nestjs/common';
import {
  MensagemRecebidaWebhookWhatsapp,
  ServicoWebhookWhatsapp,
  StatusWebhookWhatsapp
} from '../aplicacao/servico-webhook-whatsapp';

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
    text?: {
      body?: string;
    };
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

  constructor(private readonly servicoWebhookWhatsapp: ServicoWebhookWhatsapp) {}

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
  async receber(@Body() payload: MetaWebhookPayload, @Query('token') tokenRecebimento?: string) {
    const tokenEsperado = process.env.META_WHATSAPP_WEBHOOK_RECEIVE_TOKEN;
    if (tokenEsperado && tokenRecebimento !== tokenEsperado) {
      throw new ForbiddenException('Token de recebimento invalido.');
    }

    const eventos = this.extrairEventos(payload);
    let persistencia = {
      statusesAtualizados: 0,
      statusesIgnorados: eventos.statuses,
      mensagensCriadas: 0,
      mensagensIgnoradas: eventos.messages
    };
    if (eventos.statuses > 0 || eventos.messages > 0) {
      this.logger.log(
        `Webhook WhatsApp recebido: statuses=${eventos.statuses}; messages=${eventos.messages}; phoneNumberIds=${eventos.phoneNumberIds.join(',')}`
      );
    }

    if (eventos.statusesDetalhados.length) {
      try {
        const resultado = await this.servicoWebhookWhatsapp.registrarStatus(eventos.statusesDetalhados);
        persistencia = {
          statusesAtualizados: resultado.atualizados,
          statusesIgnorados: resultado.ignorados,
          mensagensCriadas: persistencia.mensagensCriadas,
          mensagensIgnoradas: persistencia.mensagensIgnoradas
        };
      } catch (erro) {
        this.logger.warn(
          `Falha ao persistir status de webhook WhatsApp: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`
        );
      }
    }

    if (eventos.mensagensDetalhadas.length) {
      try {
        const resultado = await this.servicoWebhookWhatsapp.registrarMensagensRecebidas(eventos.mensagensDetalhadas);
        persistencia = {
          ...persistencia,
          mensagensCriadas: resultado.criadas,
          mensagensIgnoradas: resultado.ignoradas
        };
      } catch (erro) {
        this.logger.warn(
          `Falha ao persistir mensagens recebidas do WhatsApp: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`
        );
      }
    }

    return { recebido: true, eventos: this.omitirDetalhes(eventos), persistencia };
  }

  private extrairEventos(payload: MetaWebhookPayload) {
    const phoneNumberIds = new Set<string>();
    const statusesDetalhados: StatusWebhookWhatsapp[] = [];
    const mensagensDetalhadas: MensagemRecebidaWebhookWhatsapp[] = [];
    let statuses = 0;
    let messages = 0;

    for (const entrada of payload.entry ?? []) {
      for (const change of entrada.changes ?? []) {
        const valor = change.value;
        if (!valor) continue;
        if (valor.metadata?.phone_number_id) phoneNumberIds.add(valor.metadata.phone_number_id);
        statuses += valor.statuses?.length ?? 0;
        statusesDetalhados.push(...(valor.statuses ?? []));
        messages += valor.messages?.length ?? 0;
        mensagensDetalhadas.push(
          ...(valor.messages ?? []).map((mensagem) => ({
            phoneNumberId: valor.metadata?.phone_number_id,
            mensagem
          }))
        );
      }
    }

    return {
      statuses,
      messages,
      phoneNumberIds: [...phoneNumberIds],
      statusesDetalhados,
      mensagensDetalhadas
    };
  }

  private omitirDetalhes(eventos: ReturnType<ControladorWebhookWhatsApp['extrairEventos']>) {
    return {
      statuses: eventos.statuses,
      messages: eventos.messages,
      phoneNumberIds: eventos.phoneNumberIds
    };
  }
}

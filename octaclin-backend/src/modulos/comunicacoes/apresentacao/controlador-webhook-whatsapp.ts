import { createHash, createHmac, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  RawBodyRequest,
  Req,
  ServiceUnavailableException,
  UnsupportedMediaTypeException
} from '@nestjs/common';
import { Request } from 'express';
import { ServicoProtecaoAbuso } from '../../auth/aplicacao/servico-protecao-abuso';
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

const DURACAO_REPLAY_MS = 24 * 60 * 60 * 1000;
const ATRASO_MAXIMO_SEGUNDOS = 24 * 60 * 60;
const ADIANTAMENTO_MAXIMO_SEGUNDOS = 5 * 60;
const POLITICA_WEBHOOK_WHATSAPP = {
  maxTentativas: 600,
  janelaMs: 60 * 1000,
  bloqueioMs: 5 * 60 * 1000,
  mensagemBloqueio: 'Muitas notificacoes do webhook WhatsApp. Tente novamente em alguns minutos.'
};

@Controller('comunicacoes/webhooks/whatsapp')
export class ControladorWebhookWhatsApp {
  private readonly logger = new Logger(ControladorWebhookWhatsApp.name);

  constructor(
    private readonly servicoWebhookWhatsapp: ServicoWebhookWhatsapp,
    private readonly protecaoAbuso: ServicoProtecaoAbuso
  ) {}

  @Get()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  verificar(
    @Query('hub.mode') modo?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') desafio?: string
  ) {
    const tokenEsperado = process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    if (!tokenEsperado) {
      throw new ServiceUnavailableException('Webhook WhatsApp nao configurado.');
    }

    if (modo !== 'subscribe' || !token || !this.segredosIguais(token, tokenEsperado)) {
      throw new ForbiddenException('Token de verificacao invalido.');
    }

    if (!desafio || !/^\d{1,64}$/.test(desafio)) {
      throw new BadRequestException('Challenge de verificacao invalido.');
    }

    return desafio;
  }

  @Post()
  @HttpCode(200)
  async receber(
    @Body() payload: MetaWebhookPayload,
    @Req() requisicao: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') assinatura?: string,
    @Headers('content-type') contentType?: string,
    @Query('token') tokenRecebimento?: string
  ) {
    if (contentType?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
      throw new UnsupportedMediaTypeException('Webhook WhatsApp aceita apenas application/json.');
    }

    const appSecret = process.env.META_WHATSAPP_APP_SECRET?.trim();
    if (!appSecret) {
      throw new ServiceUnavailableException('Assinatura do webhook WhatsApp nao configurada.');
    }
    this.validarAssinatura(requisicao.rawBody, assinatura, appSecret);

    const tokenEsperado = process.env.META_WHATSAPP_WEBHOOK_RECEIVE_TOKEN;
    if (tokenEsperado && (!tokenRecebimento || !this.segredosIguais(tokenRecebimento, tokenEsperado))) {
      throw new ForbiddenException('Token de recebimento invalido.');
    }

    const eventos = this.extrairEventos(payload);
    this.validarFrescor(eventos);
    const phoneNumberId = this.normalizarComponenteChave(eventos.phoneNumberIds[0] ?? 'sem-phone');
    await this.protecaoAbuso.consumirTentativa(
      `webhook_whatsapp:${requisicao.ip || 'ip-desconhecido'}:${phoneNumberId}`,
      POLITICA_WEBHOOK_WHATSAPP
    );

    const rawBody = requisicao.rawBody!;
    const chaveReplay = `webhook_whatsapp:replay:${createHash('sha256').update(rawBody).digest('hex')}`;
    const reservado = await this.protecaoAbuso.reservarIdempotencia(chaveReplay, DURACAO_REPLAY_MS);
    if (!reservado) {
      const estado = await this.protecaoAbuso.obterEstadoIdempotencia(chaveReplay);
      if (estado === 'concluido') return { recebido: true, duplicado: true };
      throw new ServiceUnavailableException('Webhook WhatsApp ja esta em processamento.');
    }

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

    try {
      if (eventos.statusesDetalhados.length) {
        const resultado = await this.servicoWebhookWhatsapp.registrarStatus(eventos.statusesDetalhados);
        persistencia = {
          statusesAtualizados: resultado.atualizados,
          statusesIgnorados: resultado.ignorados,
          mensagensCriadas: persistencia.mensagensCriadas,
          mensagensIgnoradas: persistencia.mensagensIgnoradas
        };
      }

      if (eventos.mensagensDetalhadas.length) {
        const resultado = await this.servicoWebhookWhatsapp.registrarMensagensRecebidas(eventos.mensagensDetalhadas);
        persistencia = {
          ...persistencia,
          mensagensCriadas: resultado.criadas,
          mensagensIgnoradas: resultado.ignoradas
        };
      }
      await this.protecaoAbuso.concluirIdempotencia(chaveReplay, DURACAO_REPLAY_MS);
    } catch (erro) {
      await this.protecaoAbuso.liberarIdempotencia(chaveReplay);
      this.logger.error(
        `Falha ao persistir webhook WhatsApp: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`
      );
      throw new ServiceUnavailableException('Falha temporaria ao processar webhook WhatsApp.');
    }

    return { recebido: true, eventos: this.omitirDetalhes(eventos), persistencia };
  }

  private validarAssinatura(rawBody: Buffer | undefined, assinatura: string | undefined, appSecret: string): void {
    if (!rawBody) throw new BadRequestException('Corpo bruto do webhook indisponivel.');
    const correspondencia = /^sha256=([a-f0-9]{64})$/i.exec(assinatura ?? '');
    if (!correspondencia) throw new ForbiddenException('Assinatura do webhook WhatsApp invalida.');

    const esperada = createHmac('sha256', appSecret).update(rawBody).digest();
    const recebida = Buffer.from(correspondencia[1], 'hex');
    if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) {
      throw new ForbiddenException('Assinatura do webhook WhatsApp invalida.');
    }
  }

  private validarFrescor(eventos: ReturnType<ControladorWebhookWhatsApp['extrairEventos']>): void {
    const timestamps = [
      ...eventos.statusesDetalhados.map((status) => status.timestamp),
      ...eventos.mensagensDetalhadas.map(({ mensagem }) => mensagem.timestamp)
    ];
    if (!timestamps.length) return;

    const agora = Math.floor(Date.now() / 1000);
    for (const timestamp of timestamps) {
      if (!timestamp || !/^\d{1,16}$/.test(timestamp)) {
        throw new ForbiddenException('Timestamp do webhook WhatsApp invalido.');
      }
      const valor = Number(timestamp);
      if (valor < agora - ATRASO_MAXIMO_SEGUNDOS || valor > agora + ADIANTAMENTO_MAXIMO_SEGUNDOS) {
        throw new ForbiddenException('Evento do webhook WhatsApp fora da janela de validade.');
      }
    }
  }

  private segredosIguais(recebido: string, esperado: string): boolean {
    const bufferRecebido = Buffer.from(recebido);
    const bufferEsperado = Buffer.from(esperado);
    return bufferRecebido.length === bufferEsperado.length && timingSafeEqual(bufferRecebido, bufferEsperado);
  }

  private normalizarComponenteChave(valor: string): string {
    return valor.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'desconhecido';
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

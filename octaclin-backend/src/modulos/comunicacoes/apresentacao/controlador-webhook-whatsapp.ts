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
  OnModuleDestroy,
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

/**
 * Nome do evento de assinatura invalida, no mesmo dialeto
 * `dominio.recurso.verbo` das acoes de `user_action_logs`.
 *
 * Ele viaja no `Logger` e nao na trilha -- ver
 * {@link ControladorWebhookWhatsApp.registrarAssinaturaInvalida} --, mas usa a
 * taxonomia da trilha de proposito: quem investiga procura um nome so, e nao
 * precisa saber por qual dos dois canais o evento saiu.
 */
const EVENTO_ASSINATURA_INVALIDA = 'integracoes.webhook_whatsapp.assinatura_invalida';

/** Janela de agregacao dos logs de assinatura invalida. */
const JANELA_ASSINATURA_INVALIDA_MS = 60 * 1000;

/** Teto de linhas emitidas por janela; o excedente vira contagem. */
const MAXIMO_LOGS_ASSINATURA_INVALIDA_POR_JANELA = 5;

@Controller('comunicacoes/webhooks/whatsapp')
export class ControladorWebhookWhatsApp implements OnModuleDestroy {
  private readonly logger = new Logger(ControladorWebhookWhatsApp.name);

  /** Inicio da janela corrente de agregacao de assinaturas invalidas. */
  private janelaAssinaturaInvalidaIniciadaEm = 0;

  /** Linhas ja emitidas na janela corrente. */
  private logsAssinaturaInvalidaNaJanela = 0;

  /** Tentativas engolidas pelo teto na janela corrente; sai na proxima linha. */
  private assinaturasInvalidasSuprimidas = 0;

  constructor(
    private readonly servicoWebhookWhatsapp: ServicoWebhookWhatsapp,
    private readonly protecaoAbuso: ServicoProtecaoAbuso
  ) {}

  /**
   * Ultima chance de emitir o que a janela suprimiu.
   *
   * Sem isto, uma rajada que termina dentro da propria janela nunca produz a
   * linha final: o residual so sai junto da primeira linha da janela *seguinte*,
   * e a janela seguinte pode nao existir -- que e exatamente o formato de um
   * ataque curto. O total morreria com o processo, e o comentario de
   * {@link ControladorWebhookWhatsApp.registrarAssinaturaInvalida} promete o
   * contrario.
   *
   * `main.ts` chama `enableShutdownHooks()`, entao SIGTERM (deploy, reinicio,
   * escala para baixo) passa por aqui. `SIGKILL` e queda dura nao passam -- o
   * residual e evidencia de volume, nao o controle de seguranca, e perder a
   * contagem num crash e aceitavel; perde-la em todo encerramento normal nao
   * era.
   */
  onModuleDestroy(): void {
    this.emitirResidualAssinaturaInvalida();
  }

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
    this.validarAssinatura(requisicao, assinatura, appSecret);

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
      // Contagens, nunca identificadores. `phone_number_id` e o numero de
      // atendimento da clinica no WhatsApp: e dado de contato num log que sai
      // do sistema em dump de suporte e agregador externo. A quantidade de
      // numeros distintos ja responde a pergunta operacional ("chegou evento de
      // mais de uma linha?") sem publicar quais sao.
      this.logger.log({
        evento: 'integracoes.webhook_whatsapp.recebido',
        statuses: eventos.statuses,
        messages: eventos.messages,
        totalPhoneNumberIds: eventos.phoneNumberIds.length
      });
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
      // So o nome da classe do erro, na mesma disciplina de
      // `interceptor-log-requisicao.ts`. A mensagem crua aqui vem de erro de
      // banco ou do adaptador Meta, e carrega SQL com valor de parametro,
      // telefone do paciente ou trecho de URL assinada do provedor.
      this.logger.error({
        evento: 'integracoes.webhook_whatsapp.persistencia_falhou',
        erroNome: erro instanceof Error ? erro.name : 'ErroDesconhecido',
        statuses: eventos.statuses,
        messages: eventos.messages
      });
      throw new ServiceUnavailableException('Falha temporaria ao processar webhook WhatsApp.');
    }

    return { recebido: true, eventos: this.omitirDetalhes(eventos), persistencia };
  }

  private validarAssinatura(
    requisicao: RawBodyRequest<Request>,
    assinatura: string | undefined,
    appSecret: string
  ): void {
    const rawBody = requisicao.rawBody;
    if (!rawBody) {
      this.registrarAssinaturaInvalida('corpo_bruto_ausente', requisicao);
      throw new BadRequestException('Corpo bruto do webhook indisponivel.');
    }

    const correspondencia = /^sha256=([a-f0-9]{64})$/i.exec(assinatura ?? '');
    if (!correspondencia) {
      this.registrarAssinaturaInvalida(assinatura ? 'formato_invalido' : 'assinatura_ausente', requisicao);
      throw new ForbiddenException('Assinatura do webhook WhatsApp invalida.');
    }

    const esperada = createHmac('sha256', appSecret).update(rawBody).digest();
    const recebida = Buffer.from(correspondencia[1], 'hex');
    if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) {
      this.registrarAssinaturaInvalida('hmac_divergente', requisicao);
      throw new ForbiddenException('Assinatura do webhook WhatsApp invalida.');
    }
  }

  /**
   * Tentativa de forjar webhook -- ate esta fase, invisivel.
   *
   * Por que nao vai para `user_action_logs`: a trilha e escrita sob RLS e exige
   * `tenant_id`. Aqui nao existe tenant. O endpoint e publico e nao
   * autenticado, e a assinatura acabou justamente de falhar, entao tudo que o
   * corpo diz e afirmacao de quem esta atacando -- e `ServicoWebhookWhatsapp`
   * nem sequer mapeia `phone_number_id` para tenant: ele varre os tenants
   * ativos. Derivar tenant do payload nao autenticado daria ao atacante o poder
   * de escolher em qual trilha escrever, e uma trilha que o atacante escreve
   * nao e evidencia, e poluicao. Inventar um tenant tecnico exigiria escrita
   * fora de RLS, que e exatamente a excecao que o PR 51 fechou. O log
   * estruturado e o unico canal que registra o fato sem abrir nenhuma das duas
   * portas.
   *
   * Amplificacao: quem forja assinatura forja em rajada, e uma linha por
   * tentativa transforma o registro no vetor -- enche disco e afoga o resto do
   * log. A protecao de abuso nao ajuda: ela so e consultada *depois* da
   * assinatura, de proposito, para nao gastar Redis com trafego nao
   * autenticado. Entao a janela e resolvida aqui, em memoria do processo:
   * ate {@link MAXIMO_LOGS_ASSINATURA_INVALIDA_POR_JANELA} linhas por minuto, e
   * o excedente vira `suprimidos` na primeira linha da janela seguinte -- ou,
   * se a rajada acabar e nada mais chegar, na linha residual emitida por
   * {@link ControladorWebhookWhatsApp.onModuleDestroy}. Sob rajada de milhares
   * de requisicoes o operador ve poucas linhas por minuto e uma contagem fiel
   * do total -- o custo do log fica limitado sem que o volume do ataque se
   * perca. O estado e por processo e nao coordenado entre replicas: cada uma
   * emite sua propria cota, o que e aceitavel porque a contagem por linha
   * continua correta e o teto continua valendo por processo.
   *
   * Nada do payload entra na linha: nem corpo, nem `phone_number_id`, nem a
   * assinatura recebida. Registrar a assinatura recebida entregaria ao proximo
   * leitor do log o material de tentativa que o atacante produziu.
   */
  private registrarAssinaturaInvalida(motivo: string, requisicao: RawBodyRequest<Request>): void {
    const agora = Date.now();
    if (agora - this.janelaAssinaturaInvalidaIniciadaEm >= JANELA_ASSINATURA_INVALIDA_MS) {
      this.janelaAssinaturaInvalidaIniciadaEm = agora;
      this.logsAssinaturaInvalidaNaJanela = 0;
    }

    if (this.logsAssinaturaInvalidaNaJanela >= MAXIMO_LOGS_ASSINATURA_INVALIDA_POR_JANELA) {
      this.assinaturasInvalidasSuprimidas += 1;
      return;
    }

    this.logsAssinaturaInvalidaNaJanela += 1;
    const suprimidos = this.assinaturasInvalidasSuprimidas;
    this.assinaturasInvalidasSuprimidas = 0;
    this.logger.warn({
      evento: EVENTO_ASSINATURA_INVALIDA,
      motivo,
      ip: requisicao.ip,
      tamanhoCorpoBytes: requisicao.rawBody?.length ?? 0,
      suprimidosDesdeUltimaLinha: suprimidos
    });
  }

  /**
   * Emite a contagem pendente sem requisicao associada.
   *
   * Nao carrega `ip` nem `tamanhoCorpoBytes`: a linha nao descreve uma
   * tentativa especifica, e sim o que sobrou da janela. `motivo` diz de onde ela
   * veio para nao ser confundida com uma tentativa nova.
   */
  private emitirResidualAssinaturaInvalida(): void {
    if (!this.assinaturasInvalidasSuprimidas) return;

    const suprimidos = this.assinaturasInvalidasSuprimidas;
    this.assinaturasInvalidasSuprimidas = 0;
    this.logger.warn({
      evento: EVENTO_ASSINATURA_INVALIDA,
      motivo: 'residual_no_encerramento',
      suprimidosDesdeUltimaLinha: suprimidos
    });
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

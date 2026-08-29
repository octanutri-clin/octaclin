import { createHmac } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ServicoProtecaoAbuso } from '../../auth/aplicacao/servico-protecao-abuso';
import { ControladorWebhookWhatsApp } from './controlador-webhook-whatsapp';

describe('ControladorWebhookWhatsApp', () => {
  const ambienteOriginal = process.env;
  const agoraSegundos = 1_800_000_000;

  const criarServico = () => ({
    registrarStatus: jest.fn(async () => ({ atualizados: 1, ignorados: 0 })),
    registrarMensagensRecebidas: jest.fn(async () => ({ criadas: 1, ignoradas: 0 }))
  });

  const criarProtecao = () => ({
    consumirTentativa: jest.fn(async () => undefined),
    reservarIdempotencia: jest.fn(async () => true),
    obterEstadoIdempotencia: jest.fn(
      async (): Promise<'processando' | 'concluido' | null> => null
    ),
    concluirIdempotencia: jest.fn(async () => undefined),
    liberarIdempotencia: jest.fn(async () => undefined)
  });

  const criarPayload = (timestamp = String(agoraSegundos)) => ({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba-sintetica',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: 'phone-sintetico' },
              statuses: [{ id: 'wamid-status-sintetico', status: 'sent', timestamp }],
              messages: [
                {
                  id: 'wamid-entrada-sintetico',
                  from: '5511000000000',
                  timestamp,
                  type: 'text',
                  text: { body: 'Mensagem sintetica' }
                }
              ]
            }
          }
        ]
      }
    ]
  });

  const prepararRequisicao = (payload: object) => {
    const rawBody = Buffer.from(JSON.stringify(payload));
    const requisicao = { rawBody, ip: '203.0.113.10' } as RawBodyRequest<Request>;
    const assinatura = `sha256=${createHmac('sha256', process.env.META_WHATSAPP_APP_SECRET!).update(rawBody).digest('hex')}`;
    return { requisicao, assinatura };
  };

  const criarControlador = () => {
    const servico = criarServico();
    const protecao = criarProtecao();
    const controlador = new ControladorWebhookWhatsApp(
      servico as never,
      protecao as unknown as ServicoProtecaoAbuso
    );
    return { controlador, servico, protecao };
  };

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(agoraSegundos * 1000);
    process.env = {
      ...ambienteOriginal,
      META_WHATSAPP_APP_SECRET: 'app-secret-sintetico-com-32-bytes',
      META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verifica-staging',
      META_WHATSAPP_WEBHOOK_RECEIVE_TOKEN: 'recebe-staging'
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  it('retorna apenas challenge numerico quando o token de verificacao for valido', () => {
    const { controlador } = criarControlador();

    expect(controlador.verificar('subscribe', 'verifica-staging', '123456789')).toBe('123456789');
    expect(() => controlador.verificar('subscribe', 'verifica-staging', '<script>alert(1)</script>')).toThrow(
      BadRequestException
    );
  });

  it('bloqueia verificacao quando o webhook nao estiver configurado', () => {
    delete process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    const { controlador } = criarControlador();

    expect(() => controlador.verificar('subscribe', 'qualquer', '123')).toThrow(ServiceUnavailableException);
  });

  it('aceita assinatura Meta valida sobre o corpo bruto e resume os eventos', async () => {
    const payload = criarPayload();
    const { requisicao, assinatura } = prepararRequisicao(payload);
    const { controlador, servico, protecao } = criarControlador();

    const resposta = await controlador.receber(payload, requisicao, assinatura, 'application/json; charset=utf-8', 'recebe-staging');

    expect(resposta).toEqual({
      recebido: true,
      eventos: { statuses: 1, messages: 1, phoneNumberIds: ['phone-sintetico'] },
      persistencia: {
        statusesAtualizados: 1,
        statusesIgnorados: 0,
        mensagensCriadas: 1,
        mensagensIgnoradas: 0
      }
    });
    expect(servico.registrarStatus).toHaveBeenCalledTimes(1);
    expect(servico.registrarMensagensRecebidas).toHaveBeenCalledTimes(1);
    expect(protecao.consumirTentativa).toHaveBeenCalledWith(
      'webhook_whatsapp:203.0.113.10:phone-sintetico',
      expect.objectContaining({ maxTentativas: expect.any(Number) })
    );
    expect(protecao.reservarIdempotencia).toHaveBeenCalledWith(
      expect.stringMatching(/^webhook_whatsapp:replay:[a-f0-9]{64}$/),
      24 * 60 * 60 * 1000
    );
    expect(protecao.concluirIdempotencia).toHaveBeenCalledWith(
      expect.stringMatching(/^webhook_whatsapp:replay:[a-f0-9]{64}$/),
      24 * 60 * 60 * 1000
    );
  });

  it.each([
    ['ausente', undefined],
    ['malformada', 'sha256=curta'],
    ['adulterada', `sha256=${'0'.repeat(64)}`]
  ])('rejeita assinatura %s antes de persistir', async (_caso, assinatura) => {
    const payload = criarPayload();
    const { requisicao } = prepararRequisicao(payload);
    const { controlador, servico, protecao } = criarControlador();

    await expect(
      controlador.receber(payload, requisicao, assinatura, 'application/json', 'recebe-staging')
    ).rejects.toThrow(ForbiddenException);
    expect(servico.registrarStatus).not.toHaveBeenCalled();
    expect(protecao.consumirTentativa).not.toHaveBeenCalled();
  });

  it('falha fechado quando o app secret nao estiver configurado', async () => {
    const payload = criarPayload();
    const { requisicao, assinatura } = prepararRequisicao(payload);
    delete process.env.META_WHATSAPP_APP_SECRET;
    const { controlador } = criarControlador();

    await expect(
      controlador.receber(payload, requisicao, assinatura, 'application/json', 'recebe-staging')
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('rejeita content type diferente de JSON', async () => {
    const payload = criarPayload();
    const { requisicao, assinatura } = prepararRequisicao(payload);
    const { controlador } = criarControlador();

    await expect(
      controlador.receber(payload, requisicao, assinatura, 'text/plain', 'recebe-staging')
    ).rejects.toThrow(UnsupportedMediaTypeException);
  });

  it.each([
    ['expirado', agoraSegundos - 24 * 60 * 60 - 1],
    ['muito no futuro', agoraSegundos + 5 * 60 + 1]
  ])('rejeita evento com timestamp %s', async (_caso, timestamp) => {
    const payload = criarPayload(String(timestamp));
    const { requisicao, assinatura } = prepararRequisicao(payload);
    const { controlador, servico } = criarControlador();

    await expect(
      controlador.receber(payload, requisicao, assinatura, 'application/json', 'recebe-staging')
    ).rejects.toThrow(ForbiddenException);
    expect(servico.registrarStatus).not.toHaveBeenCalled();
  });

  it('reconhece replay atomico sem repetir efeitos colaterais', async () => {
    const payload = criarPayload();
    const { requisicao, assinatura } = prepararRequisicao(payload);
    const { controlador, servico, protecao } = criarControlador();
    protecao.reservarIdempotencia.mockResolvedValue(false);
    protecao.obterEstadoIdempotencia.mockResolvedValue('concluido');

    await expect(
      controlador.receber(payload, requisicao, assinatura, 'application/json', 'recebe-staging')
    ).resolves.toEqual({ recebido: true, duplicado: true });
    expect(servico.registrarStatus).not.toHaveBeenCalled();
    expect(servico.registrarMensagensRecebidas).not.toHaveBeenCalled();
  });

  it('rejeita temporariamente duplicata enquanto a primeira execucao esta pendente', async () => {
    const payload = criarPayload();
    const { requisicao, assinatura } = prepararRequisicao(payload);
    const { controlador, servico, protecao } = criarControlador();
    protecao.reservarIdempotencia.mockResolvedValue(false);
    protecao.obterEstadoIdempotencia.mockResolvedValue('processando');

    await expect(
      controlador.receber(payload, requisicao, assinatura, 'application/json', 'recebe-staging')
    ).rejects.toThrow(ServiceUnavailableException);
    expect(servico.registrarStatus).not.toHaveBeenCalled();
  });

  it('libera a reserva e retorna erro quando a persistencia falha', async () => {
    const payload = criarPayload();
    const { requisicao, assinatura } = prepararRequisicao(payload);
    const { controlador, servico, protecao } = criarControlador();
    servico.registrarStatus.mockRejectedValue(new Error('falha sintetica'));

    await expect(
      controlador.receber(payload, requisicao, assinatura, 'application/json', 'recebe-staging')
    ).rejects.toThrow(ServiceUnavailableException);
    expect(protecao.liberarIdempotencia).toHaveBeenCalledWith(
      expect.stringMatching(/^webhook_whatsapp:replay:[a-f0-9]{64}$/)
    );
  });
});

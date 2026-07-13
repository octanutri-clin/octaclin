import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ControladorWebhookWhatsApp } from './controlador-webhook-whatsapp';

describe('ControladorWebhookWhatsApp', () => {
  const ambienteOriginal = process.env;

  beforeEach(() => {
    process.env = { ...ambienteOriginal };
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  it('deve retornar o desafio quando o token de verificacao for valido', () => {
    process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verifica-staging';
    const controlador = new ControladorWebhookWhatsApp();

    expect(controlador.verificar('subscribe', 'verifica-staging', 'desafio-123')).toBe('desafio-123');
  });

  it('deve bloquear verificacao quando o webhook nao estiver configurado', () => {
    delete process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    const controlador = new ControladorWebhookWhatsApp();

    expect(() => controlador.verificar('subscribe', 'qualquer', 'desafio-123')).toThrow(ServiceUnavailableException);
  });

  it('deve bloquear recebimento quando o token de recebimento for invalido', () => {
    process.env.META_WHATSAPP_WEBHOOK_RECEIVE_TOKEN = 'recebe-staging';
    const controlador = new ControladorWebhookWhatsApp();

    expect(() => controlador.receber({ object: 'whatsapp_business_account', entry: [] }, 'errado')).toThrow(
      ForbiddenException
    );
  });

  it('deve resumir eventos de status e mensagens recebidas', () => {
    process.env.META_WHATSAPP_WEBHOOK_RECEIVE_TOKEN = 'recebe-staging';
    const controlador = new ControladorWebhookWhatsApp();

    const resposta = controlador.receber(
      {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba-1',
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: 'phone-1' },
                  statuses: [{ id: 'wamid-1', status: 'sent' }],
                  messages: [{ id: 'wamid-in-1', from: '5511999999999', type: 'text' }]
                }
              }
            ]
          }
        ]
      },
      'recebe-staging'
    );

    expect(resposta).toEqual({
      recebido: true,
      eventos: {
        statuses: 1,
        messages: 1,
        phoneNumberIds: ['phone-1']
      }
    });
  });
});

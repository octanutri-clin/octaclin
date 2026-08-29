import { createHmac } from 'crypto';
import type { AddressInfo } from 'net';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ServicoProtecaoAbuso } from '../../auth/aplicacao/servico-protecao-abuso';
import { ServicoWebhookWhatsapp } from '../aplicacao/servico-webhook-whatsapp';
import { ControladorWebhookWhatsApp } from './controlador-webhook-whatsapp';

describe('ControladorWebhookWhatsApp - contrato HTTP', () => {
  const ambienteOriginal = process.env;
  const appSecret = 'app-secret-http-sintetico-32-bytes';
  let aplicacao: NestExpressApplication;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.META_WHATSAPP_APP_SECRET = appSecret;
    process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-http-sintetico';

    const modulo = await Test.createTestingModule({
      controllers: [ControladorWebhookWhatsApp],
      providers: [
        {
          provide: ServicoWebhookWhatsapp,
          useValue: {
            registrarStatus: jest.fn(async () => ({ atualizados: 0, ignorados: 0 })),
            registrarMensagensRecebidas: jest.fn(async () => ({ criadas: 0, ignoradas: 0 }))
          }
        },
        {
          provide: ServicoProtecaoAbuso,
          useValue: {
            consumirTentativa: jest.fn(async () => undefined),
            reservarIdempotencia: jest.fn(async () => true),
            obterEstadoIdempotencia: jest.fn(async () => null),
            concluirIdempotencia: jest.fn(async () => undefined),
            liberarIdempotencia: jest.fn(async () => undefined)
          }
        }
      ]
    }).compile();

    aplicacao = modulo.createNestApplication<NestExpressApplication>({ rawBody: true });
    aplicacao.useLogger(false);
    aplicacao.useBodyParser('json', { limit: '100kb' });
    await aplicacao.listen(0, '127.0.0.1');
    const endereco = aplicacao.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${endereco.port}`;
  });

  afterAll(async () => {
    await aplicacao.close();
    process.env = ambienteOriginal;
  });

  it('responde challenge exato como texto simples', async () => {
    const resposta = await fetch(
      `${baseUrl}/comunicacoes/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-http-sintetico&hub.challenge=123456`
    );

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('content-type')).toMatch(/^text\/plain;\s*charset=utf-8/i);
    await expect(resposta.text()).resolves.toBe('123456');
  });

  it('aceita POST assinado sobre os bytes exatos e responde 200', async () => {
    const corpo = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const assinatura = `sha256=${createHmac('sha256', appSecret).update(corpo).digest('hex')}`;

    const resposta = await fetch(`${baseUrl}/comunicacoes/webhooks/whatsapp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': assinatura
      },
      body: corpo
    });

    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toEqual(
      expect.objectContaining({ recebido: true })
    );
  });

  it('rejeita corpo adulterado depois da assinatura', async () => {
    const corpoAssinado = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const corpoAdulterado = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: 'adulterado' }] });
    const assinatura = `sha256=${createHmac('sha256', appSecret).update(corpoAssinado).digest('hex')}`;

    const resposta = await fetch(`${baseUrl}/comunicacoes/webhooks/whatsapp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': assinatura
      },
      body: corpoAdulterado
    });

    expect(resposta.status).toBe(403);
  });

  it('rejeita JSON acima de 100 KB antes do controller', async () => {
    const corpo = JSON.stringify({ object: 'whatsapp_business_account', preenchimento: 'x'.repeat(110 * 1024) });

    const resposta = await fetch(`${baseUrl}/comunicacoes/webhooks/whatsapp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': `sha256=${'0'.repeat(64)}`
      },
      body: corpo
    });

    expect(resposta.status).toBe(413);
  });
});

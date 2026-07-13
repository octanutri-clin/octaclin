import { AdaptadorWhatsAppMeta } from './adaptador-whatsapp-meta';

describe('AdaptadorWhatsAppMeta', () => {
  const fetchOriginal = global.fetch;

  beforeEach(() => {
    delete process.env.META_WHATSAPP_TOKEN;
    delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.META_WHATSAPP_API_VERSION;
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
    delete process.env.META_WHATSAPP_TOKEN;
    delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.META_WHATSAPP_API_VERSION;
  });

  it('deve priorizar META_WHATSAPP_TOKEN quando o canal tambem possui token configurado', async () => {
    process.env.META_WHATSAPP_TOKEN = 'token-env';

    const chamadas: Array<{ url: string; init: RequestInit }> = [];
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      return {
        ok: true,
        json: jest.fn(async () => ({ messages: [{ id: 'wamid-env' }] }))
      } as unknown as Response;
    }) as jest.Mock;

    const resultado = await new AdaptadorWhatsAppMeta().enviar({
      canal: {
        configuracao: {
          token: 'token-canal',
          phoneNumberId: '1166704896532308',
          apiVersion: 'v25.0'
        }
      } as never,
      template: {
        codigoExterno: 'hello_world',
        nome: 'Hello World',
        conteudo: { idioma: 'en_US' }
      } as never,
      payload: { destino: '5511992362080' }
    });

    expect(resultado.idExterno).toBe('wamid-env');
    expect(chamadas[0].init.headers).toMatchObject({
      Authorization: 'Bearer token-env'
    });
  });

  it('deve usar token do canal como fallback quando a variavel de ambiente nao existir', async () => {
    const chamadas: Array<{ url: string; init: RequestInit }> = [];
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      return {
        ok: true,
        json: jest.fn(async () => ({ messages: [{ id: 'wamid-canal' }] }))
      } as unknown as Response;
    }) as jest.Mock;

    const resultado = await new AdaptadorWhatsAppMeta().enviar({
      canal: {
        configuracao: {
          token: 'token-canal',
          phoneNumberId: '1166704896532308',
          apiVersion: 'v25.0'
        }
      } as never,
      template: {
        codigoExterno: 'hello_world',
        nome: 'Hello World',
        conteudo: { idioma: 'en_US' }
      } as never,
      payload: { destino: '5511992362080' }
    });

    expect(resultado.idExterno).toBe('wamid-canal');
    expect(chamadas[0].init.headers).toMatchObject({
      Authorization: 'Bearer token-canal'
    });
  });
});

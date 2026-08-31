import { createTransport } from 'nodemailer';
import { AdaptadorEmailSmtp } from './adaptador-email-smtp';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn()
}));

describe('AdaptadorEmailSmtp', () => {
  const sendMail = jest.fn();
  const fetchOriginal = global.fetch;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as never;
    process.env.EMAIL_SMTP_USUARIO = 'octaclinsys@gmail.com';
    process.env.EMAIL_SMTP_SENHA = 'senha-app';
    process.env.EMAIL_REMETENTE = 'OctaClin <octaclinsys@gmail.com>';
    sendMail.mockResolvedValue({ messageId: 'smtp-id', accepted: ['paciente@example.com'], rejected: [] });
    (createTransport as jest.Mock).mockReturnValue({ sendMail });
  });

  afterEach(() => {
    delete process.env.EMAIL_SMTP_USUARIO;
    delete process.env.EMAIL_SMTP_SENHA;
    delete process.env.EMAIL_REMETENTE;
    delete process.env.EMAIL_PROVEDOR;
    delete process.env.GMAIL_CLIENT_ID;
    delete process.env.GMAIL_CLIENT_SECRET;
    delete process.env.GMAIL_REFRESH_TOKEN;
    delete process.env.GMAIL_USUARIO;
    delete process.env.GMAIL_TOKEN_URI;
    delete process.env.APP_AMBIENTE;
    delete process.env.EMAIL_SMTP_ALLOW_INTERNAL_NETWORK_INTERFACES;
    global.fetch = fetchOriginal;
  });

  it('deve enviar email via SMTP substituindo variaveis do template', async () => {
    const resultado = await new AdaptadorEmailSmtp().enviar({
      canal: {
        configuracao: {}
      },
      template: {
        nome: 'Check-in',
        conteudo: {
          assunto: 'Ola {{nome}}',
          corpo: 'Oi {{nome}}, seu check-in esta disponivel.'
        }
      },
      payload: {
        destino: 'paciente@example.com',
        nome: 'Ana'
      }
    } as never);

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      allowInternalNetworkInterfaces: false,
      family: 4,
      auth: { user: 'octaclinsys@gmail.com', pass: 'senha-app' }
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: 'OctaClin <octaclinsys@gmail.com>',
      to: 'paciente@example.com',
      subject: 'Ola Ana',
      text: 'Oi Ana, seu check-in esta disponivel.',
      html: undefined
    });
    expect(resultado).toEqual({
      idExterno: 'smtp-id',
      metadados: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        family: 4,
        allowInternalNetworkInterfaces: false,
        acceptedCount: 1,
        rejectedCount: 0
      }
    });
  });

  it('rejeita token endpoint Gmail privado em producao sem fazer chamada externa', async () => {
    process.env.EMAIL_PROVEDOR = 'gmail_api';
    process.env.GMAIL_CLIENT_ID = 'client-id';
    process.env.GMAIL_CLIENT_SECRET = 'client-secret';
    process.env.GMAIL_REFRESH_TOKEN = 'refresh-token';
    process.env.GMAIL_TOKEN_URI = 'http://169.254.169.254/latest/meta-data';
    process.env.APP_AMBIENTE = 'producao';

    await expect(
      new AdaptadorEmailSmtp().enviar({
        canal: { configuracao: {} },
        template: { nome: 'Aviso', conteudo: { corpo: 'Mensagem sintetica' } },
        payload: { destino: 'paciente@example.com' }
      } as never)
    ).rejects.toThrow('endpoint OAuth Google');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deve enviar email via Gmail API quando configurado', async () => {
    process.env.EMAIL_PROVEDOR = 'gmail_api';
    process.env.GMAIL_CLIENT_ID = 'client-id';
    process.env.GMAIL_CLIENT_SECRET = 'client-secret';
    process.env.GMAIL_REFRESH_TOKEN = 'refresh-token';
    process.env.GMAIL_USUARIO = 'octaclinsys@gmail.com';
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn(async () => ({ access_token: 'access-token' }))
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn(async () => ({ id: 'gmail-id', threadId: 'thread-id' }))
      });

    const resultado = await new AdaptadorEmailSmtp().enviar({
      canal: {
        configuracao: {}
      },
      template: {
        nome: 'Check-in',
        conteudo: {
          assunto: 'Ola {{nome}}',
          corpo: 'Oi {{nome}}, seu check-in esta disponivel.'
        }
      },
      payload: {
        destino: 'paciente@example.com',
        nome: 'Ana'
      }
    } as never);

    expect(createTransport).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://gmail.googleapis.com/gmail/v1/users/octaclinsys%40gmail.com/messages/send',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
        method: 'POST'
      })
    );
    expect(resultado).toEqual({
      idExterno: 'gmail-id',
      metadados: {
        provedor: 'gmail_api',
        threadId: 'thread-id',
        usuario: 'octaclinsys@gmail.com'
      }
    });
  });

  it('nao propaga detalhes externos quando a renovacao Gmail falha', async () => {
    process.env.EMAIL_PROVEDOR = 'gmail_api';
    process.env.GMAIL_CLIENT_ID = 'client-id';
    process.env.GMAIL_CLIENT_SECRET = 'client-secret';
    process.env.GMAIL_REFRESH_TOKEN = 'refresh-token';
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn(async () => ({
        error: 'invalid_grant',
        error_description: 'segredo-sintetico-do-provider'
      }))
    });

    const operacao = new AdaptadorEmailSmtp().enviar({
      canal: { configuracao: {} },
      template: { nome: 'Aviso', conteudo: { corpo: 'Mensagem sintetica' } },
      payload: { destino: 'paciente@example.com' }
    } as never);

    await expect(operacao).rejects.toThrow('HTTP 401');
    await expect(operacao).rejects.not.toThrow('segredo-sintetico-do-provider');
  });

  /*
   * Corpo vindo do payload ja foi renderizado por quem disparou. Segunda passada
   * aqui trocaria `{{destino}}` dentro do nome do paciente pelo e-mail dele.
   */
  it('nao reexpande variaveis em conteudo que ja veio pronto no payload', async () => {
    await new AdaptadorEmailSmtp().enviar({
      canal: { configuracao: {} },
      template: { nome: 'Documento', conteudo: {} },
      payload: {
        destino: 'paciente@example.com',
        assunto: 'Declaracao de comparecimento',
        texto: 'Declaro que {{destino}} Silva compareceu.'
      }
    } as never);

    const [[argumentos]] = sendMail.mock.calls;
    expect(argumentos.text).toBe('Declaro que {{destino}} Silva compareceu.');
    expect(argumentos.text).not.toContain('paciente@example.com');
  });

  it('escapa o valor da variavel ao montar o corpo HTML do template', async () => {
    await new AdaptadorEmailSmtp().enviar({
      canal: { configuracao: {} },
      template: { nome: 'Aviso', conteudo: { html: '<p>Ola {{nome}}</p>' } },
      payload: {
        destino: 'paciente@example.com',
        assunto: 'Aviso',
        nome: '<script>alert(1)</script>'
      }
    } as never);

    const [[argumentos]] = sendMail.mock.calls;
    expect(argumentos.html).toBe('<p>Ola &lt;script&gt;alert(1)&lt;/script&gt;</p>');
  });
});

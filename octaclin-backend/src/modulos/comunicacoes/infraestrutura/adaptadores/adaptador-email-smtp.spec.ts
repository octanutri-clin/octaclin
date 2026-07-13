import { createTransport } from 'nodemailer';
import { AdaptadorEmailSmtp } from './adaptador-email-smtp';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn()
}));

describe('AdaptadorEmailSmtp', () => {
  const sendMail = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
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
        acceptedCount: 1,
        rejectedCount: 0
      }
    });
  });
});

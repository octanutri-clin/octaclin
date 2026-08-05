import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import SMTPTransport = require('nodemailer/lib/smtp-transport');
import { ResultadoEnvioNotificacao } from '../../dominio/canal-notificacao';
import { AdaptadorNotificacao, ContextoEnvioNotificacao } from './adaptador-notificacao';

type OpcoesSmtpOctaClin = SMTPTransport.Options & {
  allowInternalNetworkInterfaces?: boolean;
  family?: 4 | 6;
};

interface ConteudoEmail {
  assunto: string;
  destino: string;
  html?: string;
  remetente: string;
  texto?: string;
}

interface RespostaTokenGoogle {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface RespostaEnvioGmail {
  id?: string;
  threadId?: string;
}

function textoConfiguracao(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim().length > 0 ? valor.trim() : undefined;
}

function numeroConfiguracao(valor: unknown, padrao: number): number {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : padrao;
}

function booleanoConfiguracao(valor: unknown, padrao: boolean): boolean {
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'string') return valor.toLowerCase() === 'true';
  return padrao;
}

function familiaIpConfiguracao(valor: unknown): 4 | 6 {
  return Number(valor) === 6 ? 6 : 4;
}

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Substitui `{{variavel}}` pelo valor do payload.
 *
 * `escapar` liga no ramo HTML: o template e do tenant e pode conter marcacao de
 * proposito, mas o **valor** vem de cadastro (nome de paciente, texto de
 * documento) e nunca deve virar marcacao no e-mail que sai.
 */
function substituirVariaveis(
  texto: string,
  payload: Record<string, unknown>,
  escapar = false
): string {
  return texto.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, chave: string) => {
    const valor = payload[chave];
    if (valor === undefined || valor === null) return '';
    return escapar ? escaparHtml(String(valor)) : String(valor);
  });
}

function cabecalhoMime(nome: string, valor: string): string {
  return `${nome}: ${valor.replace(/\r?\n/g, ' ')}`;
}

function textoCodificadoMime(valor: string): string {
  return `=?UTF-8?B?${Buffer.from(valor, 'utf8').toString('base64')}?=`;
}

function base64Url(valor: string): string {
  return Buffer.from(valor, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function montarMensagemMime(email: ConteudoEmail): string {
  const assunto = textoCodificadoMime(email.assunto);
  const cabecalhos = [
    cabecalhoMime('From', email.remetente),
    cabecalhoMime('To', email.destino),
    cabecalhoMime('Subject', assunto),
    'MIME-Version: 1.0'
  ];

  if (email.html && email.texto) {
    const boundary = `octaclin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return [
      ...cabecalhos,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      email.texto,
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      email.html,
      `--${boundary}--`,
      ''
    ].join('\r\n');
  }

  if (email.html) {
    return [
      ...cabecalhos,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      email.html
    ].join('\r\n');
  }

  return [
    ...cabecalhos,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    email.texto ?? ''
  ].join('\r\n');
}

@Injectable()
export class AdaptadorEmailSmtp implements AdaptadorNotificacao {
  async enviar(contexto: ContextoEnvioNotificacao): Promise<ResultadoEnvioNotificacao> {
    const conteudo = this.montarConteudoEmail(contexto);
    const provedor =
      textoConfiguracao(process.env.EMAIL_PROVEDOR) ??
      textoConfiguracao(contexto.canal.configuracao.provedor) ??
      'smtp';

    if (provedor === 'gmail_api') return this.enviarViaGmailApi(conteudo);
    return this.enviarViaSmtp(contexto, conteudo);
  }

  private montarConteudoEmail(contexto: ContextoEnvioNotificacao): ConteudoEmail {
    const user =
      textoConfiguracao(contexto.canal.configuracao.smtpUsuario) ??
      textoConfiguracao(process.env.EMAIL_SMTP_USUARIO) ??
      textoConfiguracao(process.env.GMAIL_USUARIO);
    const remetente =
      textoConfiguracao(contexto.payload.remetente) ??
      textoConfiguracao(contexto.canal.configuracao.remetente) ??
      textoConfiguracao(process.env.EMAIL_REMETENTE) ??
      user;
    const destino = textoConfiguracao(contexto.payload.destino);
    // Conteudo vindo do payload ja foi montado por quem disparou: e texto final.
    const assuntoDoPayload = textoConfiguracao(contexto.payload.assunto);
    const htmlDoPayload = textoConfiguracao(contexto.payload.html);
    const textoDoPayload = textoConfiguracao(contexto.payload.texto);

    const assuntoBase =
      assuntoDoPayload ?? textoConfiguracao(contexto.template.conteudo.assunto) ?? contexto.template.nome;
    const htmlBase = htmlDoPayload ?? textoConfiguracao(contexto.template.conteudo.html);
    const textoBase =
      textoDoPayload ??
      textoConfiguracao(contexto.template.conteudo.texto) ??
      textoConfiguracao(contexto.template.conteudo.corpo);

    if (!destino) throw new BadRequestException('Destino de email nao informado.');
    if (!remetente) throw new InternalServerErrorException('Remetente de email nao configurado.');
    if (!htmlBase && !textoBase) throw new InternalServerErrorException('Template de email sem conteudo.');

    /*
     * So o texto do template passa pela substituicao. Rodar de novo sobre o
     * conteudo do payload faria segunda passada em texto ja renderizado: um nome
     * de paciente contendo `{{destino}}` seria trocado pelo e-mail dele na
     * mensagem que sai. Passada unica no dominio nao vale nada se a infra
     * expande de novo.
     */
    return {
      destino,
      remetente,
      assunto: assuntoDoPayload ? assuntoBase : substituirVariaveis(assuntoBase, contexto.payload),
      texto: !textoBase ? undefined : textoDoPayload ? textoBase : substituirVariaveis(textoBase, contexto.payload),
      html: !htmlBase ? undefined : htmlDoPayload ? htmlBase : substituirVariaveis(htmlBase, contexto.payload, true)
    };
  }

  private async enviarViaSmtp(
    contexto: ContextoEnvioNotificacao,
    conteudo: ConteudoEmail
  ): Promise<ResultadoEnvioNotificacao> {
    const host =
      textoConfiguracao(contexto.canal.configuracao.smtpHost) ??
      textoConfiguracao(process.env.EMAIL_SMTP_HOST) ??
      'smtp.gmail.com';
    const port = numeroConfiguracao(contexto.canal.configuracao.smtpPort ?? process.env.EMAIL_SMTP_PORT, 587);
    const secure = booleanoConfiguracao(contexto.canal.configuracao.smtpSecure ?? process.env.EMAIL_SMTP_SECURE, port === 465);
    const connectionTimeout = numeroConfiguracao(process.env.EMAIL_SMTP_CONNECTION_TIMEOUT_MS, 15000);
    const greetingTimeout = numeroConfiguracao(process.env.EMAIL_SMTP_GREETING_TIMEOUT_MS, 10000);
    const socketTimeout = numeroConfiguracao(process.env.EMAIL_SMTP_SOCKET_TIMEOUT_MS, 20000);
    const family = familiaIpConfiguracao(process.env.EMAIL_SMTP_FAMILY);
    const allowInternalNetworkInterfaces = booleanoConfiguracao(
      process.env.EMAIL_SMTP_ALLOW_INTERNAL_NETWORK_INTERFACES,
      true
    );
    const user =
      textoConfiguracao(contexto.canal.configuracao.smtpUsuario) ?? textoConfiguracao(process.env.EMAIL_SMTP_USUARIO);
    const pass = textoConfiguracao(contexto.canal.configuracao.smtpSenha) ?? textoConfiguracao(process.env.EMAIL_SMTP_SENHA);

    if (!user || !pass) throw new InternalServerErrorException('Configuracao SMTP incompleta.');

    const opcoesTransporte: OpcoesSmtpOctaClin = {
      host,
      port,
      secure,
      connectionTimeout,
      greetingTimeout,
      socketTimeout,
      allowInternalNetworkInterfaces,
      family,
      auth: { user, pass }
    };

    const transportador = createTransport(opcoesTransporte);

    const resultado = await transportador.sendMail({
      from: conteudo.remetente,
      to: conteudo.destino,
      subject: conteudo.assunto,
      text: conteudo.texto,
      html: conteudo.html
    });

    return {
      idExterno: resultado.messageId,
      metadados: {
        host,
        port,
        secure,
        family,
        allowInternalNetworkInterfaces,
        acceptedCount: resultado.accepted.length,
        rejectedCount: resultado.rejected.length
      }
    };
  }

  private async obterAccessTokenGmail(): Promise<string> {
    const clientId = textoConfiguracao(process.env.GMAIL_CLIENT_ID);
    const clientSecret = textoConfiguracao(process.env.GMAIL_CLIENT_SECRET);
    const refreshToken = textoConfiguracao(process.env.GMAIL_REFRESH_TOKEN);
    const tokenUri = textoConfiguracao(process.env.GMAIL_TOKEN_URI) ?? 'https://oauth2.googleapis.com/token';

    if (!clientId || !clientSecret || !refreshToken) {
      throw new InternalServerErrorException('Configuracao Gmail API incompleta.');
    }

    const resposta = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });
    const corpo = (await resposta.json()) as RespostaTokenGoogle;

    if (!resposta.ok || !corpo.access_token) {
      const erro = corpo.error_description ?? corpo.error ?? `HTTP ${resposta.status}`;
      throw new InternalServerErrorException(`Falha ao renovar token Gmail API: ${erro}`);
    }

    return corpo.access_token;
  }

  private async enviarViaGmailApi(conteudo: ConteudoEmail): Promise<ResultadoEnvioNotificacao> {
    const usuario = textoConfiguracao(process.env.GMAIL_USUARIO) ?? 'me';
    const accessToken = await this.obterAccessTokenGmail();
    const resposta = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(usuario)}/messages/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: base64Url(montarMensagemMime(conteudo)) })
      }
    );
    const corpo = (await resposta.json()) as RespostaEnvioGmail;

    if (!resposta.ok || !corpo.id) {
      throw new InternalServerErrorException(`Falha ao enviar email via Gmail API: HTTP ${resposta.status}`);
    }

    return {
      idExterno: corpo.id,
      metadados: {
        provedor: 'gmail_api',
        threadId: corpo.threadId,
        usuario
      }
    };
  }
}

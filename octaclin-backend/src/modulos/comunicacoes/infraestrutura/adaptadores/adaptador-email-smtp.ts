import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import SMTPTransport = require('nodemailer/lib/smtp-transport');
import { ResultadoEnvioNotificacao } from '../../dominio/canal-notificacao';
import { AdaptadorNotificacao, ContextoEnvioNotificacao } from './adaptador-notificacao';

type OpcoesSmtpOctaClin = SMTPTransport.Options & {
  allowInternalNetworkInterfaces?: boolean;
  family?: 4 | 6;
};

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

function substituirVariaveis(texto: string, payload: Record<string, unknown>): string {
  return texto.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, chave: string) => {
    const valor = payload[chave];
    if (valor === undefined || valor === null) return '';
    return String(valor);
  });
}

@Injectable()
export class AdaptadorEmailSmtp implements AdaptadorNotificacao {
  async enviar(contexto: ContextoEnvioNotificacao): Promise<ResultadoEnvioNotificacao> {
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
    const remetente =
      textoConfiguracao(contexto.payload.remetente) ??
      textoConfiguracao(contexto.canal.configuracao.remetente) ??
      textoConfiguracao(process.env.EMAIL_REMETENTE) ??
      user;
    const destino = textoConfiguracao(contexto.payload.destino);
    const assuntoBase =
      textoConfiguracao(contexto.payload.assunto) ??
      textoConfiguracao(contexto.template.conteudo.assunto) ??
      contexto.template.nome;
    const htmlBase = textoConfiguracao(contexto.payload.html) ?? textoConfiguracao(contexto.template.conteudo.html);
    const textoBase =
      textoConfiguracao(contexto.payload.texto) ??
      textoConfiguracao(contexto.template.conteudo.texto) ??
      textoConfiguracao(contexto.template.conteudo.corpo);

    if (!destino) throw new BadRequestException('Destino de email nao informado.');
    if (!user || !pass || !remetente) throw new InternalServerErrorException('Configuracao SMTP incompleta.');
    if (!htmlBase && !textoBase) throw new InternalServerErrorException('Template de email sem conteudo.');

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
      from: remetente,
      to: destino,
      subject: substituirVariaveis(assuntoBase, contexto.payload),
      text: textoBase ? substituirVariaveis(textoBase, contexto.payload) : undefined,
      html: htmlBase ? substituirVariaveis(htmlBase, contexto.payload) : undefined
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
}

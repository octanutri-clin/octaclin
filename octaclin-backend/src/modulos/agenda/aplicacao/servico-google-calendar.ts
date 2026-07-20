import { Injectable, InternalServerErrorException } from '@nestjs/common';

interface CriarEventoGoogleEntrada {
  resumo: string;
  descricao: string;
  inicioEm: Date;
  fimEm: Date;
  timezone: string;
}

export type ResultadoGoogleCalendar =
  | {
      sincronizado: true;
      calendarId: string;
      eventId: string;
      htmlLink?: string;
    }
  | {
      sincronizado: false;
      motivo: string;
      erro?: string;
    };

interface RespostaTokenGoogle {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface RespostaEventoGoogle {
  id?: string;
  htmlLink?: string;
  error?: { message?: string };
}

function textoEnv(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
}

@Injectable()
export class ServicoGoogleCalendar {
  async criarEvento(entrada: CriarEventoGoogleEntrada): Promise<ResultadoGoogleCalendar> {
    const clientId = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_ID);
    const clientSecret = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
    const refreshToken = textoEnv(process.env.GOOGLE_CALENDAR_REFRESH_TOKEN);
    const calendarId = textoEnv(process.env.GOOGLE_CALENDAR_ID) ?? 'primary';

    if (!clientId || !clientSecret || !refreshToken) {
      return { sincronizado: false, motivo: 'configuracao_ausente' };
    }

    try {
      const accessToken = await this.obterAccessToken(clientId, clientSecret, refreshToken);
      const resposta = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            summary: entrada.resumo,
            description: entrada.descricao,
            start: { dateTime: entrada.inicioEm.toISOString(), timeZone: entrada.timezone },
            end: { dateTime: entrada.fimEm.toISOString(), timeZone: entrada.timezone }
          })
        }
      );
      const corpo = (await resposta.json()) as RespostaEventoGoogle;

      if (!resposta.ok || !corpo.id) {
        const mensagem = corpo.error?.message ?? `HTTP ${resposta.status}`;
        throw new InternalServerErrorException(`Falha ao criar evento Google Calendar: ${mensagem}`);
      }

      return {
        sincronizado: true,
        calendarId,
        eventId: corpo.id,
        htmlLink: corpo.htmlLink
      };
    } catch (erro) {
      return {
        sincronizado: false,
        motivo: 'falha_google_calendar',
        erro: erro instanceof Error ? erro.message : 'Falha desconhecida ao sincronizar Google Calendar.'
      };
    }
  }

  private async obterAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
    const tokenUri = textoEnv(process.env.GOOGLE_CALENDAR_TOKEN_URI) ?? 'https://oauth2.googleapis.com/token';
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
      const detalhe = corpo.error_description ?? corpo.error ?? `HTTP ${resposta.status}`;
      throw new InternalServerErrorException(`Falha ao renovar token Google Calendar: ${detalhe}`);
    }

    return corpo.access_token;
  }
}

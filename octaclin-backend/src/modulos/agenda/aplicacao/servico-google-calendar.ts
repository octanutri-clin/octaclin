import { Injectable, InternalServerErrorException } from '@nestjs/common';

interface CriarEventoGoogleEntrada {
  resumo: string;
  descricao: string;
  inicioEm: Date;
  fimEm: Date;
  timezone: string;
  local?: string;
}

interface AtualizarEventoGoogleEntrada extends CriarEventoGoogleEntrada {
  calendarId: string;
  eventId: string;
}

interface CancelarEventoGoogleEntrada {
  calendarId: string;
  eventId: string;
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
    const configuracao = this.obterConfiguracao();
    if (!configuracao) return { sincronizado: false, motivo: 'configuracao_ausente' };

    try {
      const accessToken = await this.obterAccessToken(configuracao.clientId, configuracao.clientSecret, configuracao.refreshToken);
      const resposta = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(configuracao.calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(this.montarCorpoEvento(entrada))
        }
      );
      return await this.lerRespostaEvento(resposta, configuracao.calendarId, 'criar evento');
    } catch (erro) {
      return {
        sincronizado: false,
        motivo: 'falha_google_calendar',
        erro: erro instanceof Error ? erro.message : 'Falha desconhecida ao sincronizar Google Calendar.'
      };
    }
  }

  async atualizarEvento(entrada: AtualizarEventoGoogleEntrada): Promise<ResultadoGoogleCalendar> {
    const configuracao = this.obterConfiguracao(entrada.calendarId);
    if (!configuracao) return { sincronizado: false, motivo: 'configuracao_ausente' };

    try {
      const accessToken = await this.obterAccessToken(configuracao.clientId, configuracao.clientSecret, configuracao.refreshToken);
      const resposta = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(entrada.calendarId)}/events/${encodeURIComponent(entrada.eventId)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(this.montarCorpoEvento(entrada))
        }
      );
      return await this.lerRespostaEvento(resposta, entrada.calendarId, 'atualizar evento');
    } catch (erro) {
      return {
        sincronizado: false,
        motivo: 'falha_google_calendar',
        erro: erro instanceof Error ? erro.message : 'Falha desconhecida ao atualizar Google Calendar.'
      };
    }
  }

  async cancelarEvento(entrada: CancelarEventoGoogleEntrada): Promise<ResultadoGoogleCalendar> {
    const configuracao = this.obterConfiguracao(entrada.calendarId);
    if (!configuracao) return { sincronizado: false, motivo: 'configuracao_ausente' };

    try {
      const accessToken = await this.obterAccessToken(configuracao.clientId, configuracao.clientSecret, configuracao.refreshToken);
      const resposta = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(entrada.calendarId)}/events/${encodeURIComponent(entrada.eventId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
      if (!resposta.ok && resposta.status !== 410) {
        const corpo = (await resposta.json().catch(() => ({}))) as RespostaEventoGoogle;
        const mensagem = corpo.error?.message ?? `HTTP ${resposta.status}`;
        throw new InternalServerErrorException(`Falha ao cancelar evento Google Calendar: ${mensagem}`);
      }
      return { sincronizado: true, calendarId: entrada.calendarId, eventId: entrada.eventId };
    } catch (erro) {
      return {
        sincronizado: false,
        motivo: 'falha_google_calendar',
        erro: erro instanceof Error ? erro.message : 'Falha desconhecida ao cancelar Google Calendar.'
      };
    }
  }

  private obterConfiguracao(calendarIdPreferencial?: string) {
    const clientId = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_ID);
    const clientSecret = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
    const refreshToken = textoEnv(process.env.GOOGLE_CALENDAR_REFRESH_TOKEN);
    const calendarId = calendarIdPreferencial ?? textoEnv(process.env.GOOGLE_CALENDAR_ID) ?? 'primary';

    if (!clientId || !clientSecret || !refreshToken) {
      return undefined;
    }

    return { clientId, clientSecret, refreshToken, calendarId };
  }

  private montarCorpoEvento(entrada: CriarEventoGoogleEntrada) {
    return {
      summary: entrada.resumo,
      description: entrada.descricao,
      location: entrada.local,
      start: { dateTime: entrada.inicioEm.toISOString(), timeZone: entrada.timezone },
      end: { dateTime: entrada.fimEm.toISOString(), timeZone: entrada.timezone }
    };
  }

  private async lerRespostaEvento(resposta: Response, calendarId: string, acao: string): Promise<ResultadoGoogleCalendar> {
    const corpo = (await resposta.json()) as RespostaEventoGoogle;

    if (!resposta.ok || !corpo.id) {
      const mensagem = corpo.error?.message ?? `HTTP ${resposta.status}`;
      throw new InternalServerErrorException(`Falha ao ${acao} Google Calendar: ${mensagem}`);
    }

    return {
      sincronizado: true,
      calendarId,
      eventId: corpo.id,
      htmlLink: corpo.htmlLink
    };
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

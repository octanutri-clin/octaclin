import { Injectable, InternalServerErrorException } from '@nestjs/common';

export interface CredenciaisGoogleCalendar {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId: string;
}

interface CriarEventoGoogleEntrada {
  resumo: string;
  descricao: string;
  inicioEm: Date;
  fimEm: Date;
  timezone: string;
  local?: string;
  emailConvidado?: string;
  consultaId: string;
  credenciais?: CredenciaisGoogleCalendar;
}

interface AtualizarEventoGoogleEntrada extends CriarEventoGoogleEntrada {
  calendarId: string;
  eventId: string;
}

interface CancelarEventoGoogleEntrada {
  calendarId: string;
  eventId: string;
  credenciais?: CredenciaisGoogleCalendar;
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

export interface EventoGoogleAlterado {
  id: string;
  status: string;
  octaclinConsultaId?: string;
  inicioEm?: Date;
  fimEm?: Date;
}

const JANELA_INICIAL_SINCRONIZACAO_DIAS = 30;
const HORIZONTE_INICIAL_SINCRONIZACAO_DIAS = 400;

export interface JanelaSincronizacaoGoogleCalendar {
  inicioEm: Date;
  fimEm: Date;
}

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

interface EventoGoogleBruto {
  id: string;
  status: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  extendedProperties?: { private?: { octaclinConsultaId?: string } };
}

interface RespostaListaEventosGoogle {
  items?: EventoGoogleBruto[];
  nextSyncToken?: string;
  nextPageToken?: string;
  error?: { message?: string };
}

export class SyncTokenExpiradoError extends Error {
  constructor() {
    super('Sync token do Google Calendar expirou (410); e necessario resincronizar do zero.');
    this.name = 'SyncTokenExpiradoError';
  }
}

export class TokenRevogadoError extends Error {
  constructor() {
    super('Refresh token do Google Calendar foi revogado pelo usuario.');
    this.name = 'TokenRevogadoError';
  }
}

function textoEnv(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
}

@Injectable()
export class ServicoGoogleCalendar {
  async criarEvento(entrada: CriarEventoGoogleEntrada): Promise<ResultadoGoogleCalendar> {
    const configuracao = this.obterConfiguracao(entrada.credenciais);
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
    const configuracao = this.obterConfiguracao(entrada.credenciais, entrada.calendarId);
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
    const configuracao = this.obterConfiguracao(entrada.credenciais, entrada.calendarId);
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

  async listarEventosAlterados(
    credenciais: CredenciaisGoogleCalendar,
    syncToken?: string
  ): Promise<{
    eventos: EventoGoogleAlterado[];
    proximoSyncToken?: string;
    janelaInicial?: JanelaSincronizacaoGoogleCalendar;
  }> {
    const accessToken = await this.obterAccessToken(credenciais.clientId, credenciais.clientSecret, credenciais.refreshToken);
    const eventos: EventoGoogleAlterado[] = [];
    let proximoSyncToken: string | undefined;
    let pageToken: string | undefined;
    const agora = new Date();
    const janelaInicial = syncToken
      ? undefined
      : {
          inicioEm: new Date(agora.getTime() - JANELA_INICIAL_SINCRONIZACAO_DIAS * 24 * 60 * 60 * 1000),
          fimEm: new Date(agora.getTime() + HORIZONTE_INICIAL_SINCRONIZACAO_DIAS * 24 * 60 * 60 * 1000)
        };

    do {
      const parametros = new URLSearchParams({ showDeleted: 'true', singleEvents: 'true' });
      if (syncToken) {
        parametros.set('syncToken', syncToken);
      } else if (janelaInicial) {
        parametros.set('timeMin', janelaInicial.inicioEm.toISOString());
        parametros.set('timeMax', janelaInicial.fimEm.toISOString());
      }
      if (pageToken) parametros.set('pageToken', pageToken);

      const resposta = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(credenciais.calendarId)}/events?${parametros.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const corpo = (await resposta.json()) as RespostaListaEventosGoogle;

      if (!resposta.ok) {
        if (resposta.status === 410) throw new SyncTokenExpiradoError();
        throw new InternalServerErrorException(`Falha ao listar eventos alterados: ${corpo.error?.message ?? `HTTP ${resposta.status}`}`);
      }

      for (const evento of corpo.items ?? []) {
        eventos.push({
          id: evento.id,
          status: evento.status,
          octaclinConsultaId: evento.extendedProperties?.private?.octaclinConsultaId,
          inicioEm: evento.start?.dateTime ? new Date(evento.start.dateTime) : undefined,
          fimEm: evento.end?.dateTime ? new Date(evento.end.dateTime) : undefined
        });
      }

      proximoSyncToken = corpo.nextSyncToken ?? proximoSyncToken;
      pageToken = corpo.nextPageToken;
    } while (pageToken);

    return { eventos, proximoSyncToken, janelaInicial };
  }

  async criarCanalWatch(
    credenciais: CredenciaisGoogleCalendar,
    canalId: string,
    urlWebhook: string,
    token: string
  ): Promise<{ recursoId: string; expiraEm: Date }> {
    const accessToken = await this.obterAccessToken(credenciais.clientId, credenciais.clientSecret, credenciais.refreshToken);
    const resposta = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(credenciais.calendarId)}/events/watch`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: canalId, type: 'web_hook', address: urlWebhook, token })
      }
    );
    const corpo = (await resposta.json()) as { resourceId?: string; expiration?: string; error?: { message?: string } };
    if (!resposta.ok || !corpo.resourceId) {
      throw new InternalServerErrorException(`Falha ao criar canal de watch: ${corpo.error?.message ?? `HTTP ${resposta.status}`}`);
    }
    return { recursoId: corpo.resourceId, expiraEm: new Date(Number(corpo.expiration ?? Date.now())) };
  }

  async pararCanalWatch(credenciais: CredenciaisGoogleCalendar, canalId: string, recursoId: string): Promise<void> {
    const accessToken = await this.obterAccessToken(credenciais.clientId, credenciais.clientSecret, credenciais.refreshToken);
    await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: canalId, resourceId: recursoId })
    });
  }

  private obterConfiguracao(credenciais?: CredenciaisGoogleCalendar, calendarIdPreferencial?: string) {
    if (credenciais) return credenciais;

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
    const emailConvidado = entrada.emailConvidado?.trim();
    return {
      summary: entrada.resumo,
      description: entrada.descricao,
      location: entrada.local,
      ...(emailConvidado ? { attendees: [{ email: emailConvidado }] } : {}),
      start: { dateTime: entrada.inicioEm.toISOString(), timeZone: entrada.timezone },
      end: { dateTime: entrada.fimEm.toISOString(), timeZone: entrada.timezone },
      extendedProperties: { private: { octaclinConsultaId: entrada.consultaId } }
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
      if (corpo.error === 'invalid_grant') throw new TokenRevogadoError();
      const detalhe = corpo.error_description ?? corpo.error ?? `HTTP ${resposta.status}`;
      throw new InternalServerErrorException(`Falha ao renovar token Google Calendar: ${detalhe}`);
    }

    return corpo.access_token;
  }
}

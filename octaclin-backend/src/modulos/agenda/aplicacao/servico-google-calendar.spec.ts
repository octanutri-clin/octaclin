import { createHash } from 'crypto';
import { ServicoGoogleCalendar, SyncTokenExpiradoError } from './servico-google-calendar';

describe('ServicoGoogleCalendar', () => {
  const ambienteOriginal = process.env;

  beforeEach(() => {
    process.env = { ...ambienteOriginal };
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    delete process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
    delete process.env.GOOGLE_CALENDAR_ID;
    delete process.env.GOOGLE_CALENDAR_TOKEN_URI;
    global.fetch = jest.fn() as never;
  });

  afterAll(() => {
    process.env = ambienteOriginal;
    jest.restoreAllMocks();
  });

  it('deve sinalizar configuracao ausente sem chamar a API Google', async () => {
    const servico = new ServicoGoogleCalendar();

    const resultado = await servico.criarEvento({
      resumo: 'Consulta OctaClin - Ana',
      descricao: 'Consulta agendada pelo OctaClin.',
      inicioEm: new Date('2026-07-22T12:00:00.000Z'),
      fimEm: new Date('2026-07-22T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      local: 'Consultorio central',
      emailConvidado: 'ana@example.com',
      consultaId: 'consulta-1'
    });

    expect(resultado).toEqual({ sincronizado: false, motivo: 'configuracao_ausente' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('deve renovar o token e criar evento no calendario configurado', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = 'refresh-token';
    process.env.GOOGLE_CALENDAR_ID = 'octaclinsys@gmail.com';
    process.env.GOOGLE_CALENDAR_TOKEN_URI = 'https://oauth2.test/token';

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn(async () => ({ access_token: 'access-token' }))
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn(async () => ({ id: 'google-event-1', htmlLink: 'https://calendar.google/event' }))
      });

    const servico = new ServicoGoogleCalendar();
    const resultado = await servico.criarEvento({
      resumo: 'Consulta OctaClin - Ana',
      descricao: 'Consulta agendada pelo OctaClin.',
      inicioEm: new Date('2026-07-22T12:00:00.000Z'),
      fimEm: new Date('2026-07-22T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      local: 'Consultorio central',
      emailConvidado: 'ana@example.com',
      consultaId: 'consulta-1'
    });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://oauth2.test/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(URLSearchParams)
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://www.googleapis.com/calendar/v3/calendars/octaclinsys%40gmail.com/events?sendUpdates=all',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
        body: JSON.stringify({
          id: `octaclin${createHash('sha256').update('consulta-1').digest('hex')}`,
          summary: 'Consulta OctaClin - Ana',
          description: 'Consulta agendada pelo OctaClin.',
          location: 'Consultorio central',
          attendees: [{ email: 'ana@example.com' }],
          start: { dateTime: '2026-07-22T12:00:00.000Z', timeZone: 'America/Sao_Paulo' },
          end: { dateTime: '2026-07-22T13:00:00.000Z', timeZone: 'America/Sao_Paulo' },
          extendedProperties: { private: { octaclinConsultaId: 'consulta-1' } }
        })
      })
    );
    expect(resultado).toEqual({
      sincronizado: true,
      calendarId: 'octaclinsys@gmail.com',
      eventId: 'google-event-1',
      htmlLink: 'https://calendar.google/event'
    });
  });

  it('recupera o mesmo evento quando a criacao idempotente recebe HTTP 409', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = 'refresh-token';
    process.env.GOOGLE_CALENDAR_TOKEN_URI = 'https://oauth2.test/token';
    const eventId = `octaclin${createHash('sha256').update('consulta-1').digest('hex')}`;

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn(async () => ({ access_token: 'access-token' }))
      })
      .mockResolvedValueOnce({ ok: false, status: 409 })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn(async () => ({
          id: eventId,
          htmlLink: 'https://calendar.google/evento-idempotente',
          extendedProperties: { private: { octaclinConsultaId: 'consulta-1' } }
        }))
      });

    const resultado = await new ServicoGoogleCalendar().criarEvento({
      resumo: 'Consulta OctaClin - Ana',
      descricao: 'Consulta agendada pelo OctaClin.',
      inicioEm: new Date('2026-07-22T12:00:00.000Z'),
      fimEm: new Date('2026-07-22T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      consultaId: 'consulta-1'
    });

    expect(fetch).toHaveBeenNthCalledWith(
      3,
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      { headers: { Authorization: 'Bearer access-token' } }
    );
    expect(resultado).toEqual({
      sincronizado: true,
      calendarId: 'primary',
      eventId,
      htmlLink: 'https://calendar.google/evento-idempotente'
    });
  });

  it('nao vincula um evento 409 que pertence a outra consulta', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = 'refresh-token';
    process.env.GOOGLE_CALENDAR_TOKEN_URI = 'https://oauth2.test/token';
    const eventId = `octaclin${createHash('sha256').update('consulta-1').digest('hex')}`;

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn(async () => ({ access_token: 'access-token' }))
      })
      .mockResolvedValueOnce({ ok: false, status: 409 })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn(async () => ({
          id: eventId,
          extendedProperties: { private: { octaclinConsultaId: 'consulta-de-outro-fluxo' } }
        }))
      });

    const resultado = await new ServicoGoogleCalendar().criarEvento({
      resumo: 'Consulta OctaClin - Ana',
      descricao: 'Consulta agendada pelo OctaClin.',
      inicioEm: new Date('2026-07-22T12:00:00.000Z'),
      fimEm: new Date('2026-07-22T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      consultaId: 'consulta-1'
    });

    expect(resultado).toEqual(
      expect.objectContaining({
        sincronizado: false,
        motivo: 'falha_google_calendar',
        erro: expect.stringContaining('evento existente nao pertence a consulta')
      })
    );
  });

  it('deve atualizar evento existente no Google Calendar', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = 'refresh-token';
    process.env.GOOGLE_CALENDAR_TOKEN_URI = 'https://oauth2.test/token';

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn(async () => ({ access_token: 'access-token' }))
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn(async () => ({ id: 'google-event-1', htmlLink: 'https://calendar.google/event-editado' }))
      });

    const servico = new ServicoGoogleCalendar();
    const resultado = await servico.atualizarEvento({
      calendarId: 'octaclinsys@gmail.com',
      eventId: 'google-event-1',
      resumo: 'Consulta OctaClin - Ana',
      descricao: 'Consulta remarcada pelo OctaClin.',
      inicioEm: new Date('2026-07-23T14:00:00.000Z'),
      fimEm: new Date('2026-07-23T14:45:00.000Z'),
      timezone: 'America/Sao_Paulo',
      local: 'Sala 2',
      emailConvidado: 'ana@example.com',
      consultaId: 'consulta-1'
    });

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://www.googleapis.com/calendar/v3/calendars/octaclinsys%40gmail.com/events/google-event-1?sendUpdates=all',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
        body: JSON.stringify({
          summary: 'Consulta OctaClin - Ana',
          description: 'Consulta remarcada pelo OctaClin.',
          location: 'Sala 2',
          attendees: [{ email: 'ana@example.com' }],
          start: { dateTime: '2026-07-23T14:00:00.000Z', timeZone: 'America/Sao_Paulo' },
          end: { dateTime: '2026-07-23T14:45:00.000Z', timeZone: 'America/Sao_Paulo' },
          extendedProperties: { private: { octaclinConsultaId: 'consulta-1' } }
        })
      })
    );
    expect(resultado).toEqual({
      sincronizado: true,
      calendarId: 'octaclinsys@gmail.com',
      eventId: 'google-event-1',
      htmlLink: 'https://calendar.google/event-editado'
    });
  });

  it('deve cancelar evento existente no Google Calendar', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = 'refresh-token';
    process.env.GOOGLE_CALENDAR_TOKEN_URI = 'https://oauth2.test/token';

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn(async () => ({ access_token: 'access-token' }))
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204
      });

    const servico = new ServicoGoogleCalendar();
    const resultado = await servico.cancelarEvento({
      calendarId: 'octaclinsys@gmail.com',
      eventId: 'google-event-1'
    });

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://www.googleapis.com/calendar/v3/calendars/octaclinsys%40gmail.com/events/google-event-1?sendUpdates=all',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' })
      })
    );
    expect(resultado).toEqual({
      sincronizado: true,
      calendarId: 'octaclinsys@gmail.com',
      eventId: 'google-event-1'
    });
  });

  it('inclui extendedProperties.private.octaclinConsultaId ao criar evento', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = 'refresh-token';

    const chamadas: Array<{ url: string; body?: string }> = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      chamadas.push({ url: String(url), body: init?.body as string | undefined });
      if (String(url).includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'token-1' }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: 'evento-1', htmlLink: 'https://calendar.google.com/evento-1' }), { status: 200 });
    }) as unknown as typeof fetch;

    const servico = new ServicoGoogleCalendar();
    await servico.criarEvento({
      resumo: 'Consulta',
      descricao: 'desc',
      inicioEm: new Date('2026-08-01T10:00:00Z'),
      fimEm: new Date('2026-08-01T10:50:00Z'),
      timezone: 'America/Sao_Paulo',
      consultaId: 'consulta-123'
    });

    const chamadaEvento = chamadas.find((chamada) => !chamada.url.includes('/token'));
    const corpo = JSON.parse(chamadaEvento?.body ?? '{}');
    expect(corpo.extendedProperties.private.octaclinConsultaId).toBe('consulta-123');
  });

  it('usa credenciais por profissional quando fornecidas, ignorando as variaveis de ambiente', async () => {
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    delete process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

    const chamadas: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      chamadas.push(String(url));
      if (String(url).includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'token-2' }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: 'evento-2' }), { status: 200 });
    }) as unknown as typeof fetch;

    const servico = new ServicoGoogleCalendar();
    const resultado = await servico.criarEvento({
      resumo: 'Consulta',
      descricao: 'desc',
      inicioEm: new Date('2026-08-01T10:00:00Z'),
      fimEm: new Date('2026-08-01T10:50:00Z'),
      timezone: 'America/Sao_Paulo',
      consultaId: 'consulta-456',
      credenciais: {
        clientId: 'prof-client',
        clientSecret: 'prof-secret',
        refreshToken: 'prof-refresh',
        calendarId: 'profissional-calendar-id'
      }
    });

    expect(resultado).toEqual({ sincronizado: true, calendarId: 'profissional-calendar-id', eventId: 'evento-2', htmlLink: undefined });
    expect(chamadas.some((url) => url.includes('profissional-calendar-id'))).toBe(true);
  });

  it('listarEventosAlterados retorna eventos e o proximo syncToken', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'token-3' }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          items: [
            {
              id: 'evento-a',
              status: 'confirmed',
              start: { dateTime: '2026-08-01T10:00:00Z' },
              end: { dateTime: '2026-08-01T10:50:00Z' },
              extendedProperties: { private: { octaclinConsultaId: 'consulta-abc' } }
            },
            { id: 'evento-b', status: 'cancelled' }
          ],
          nextSyncToken: 'sync-token-novo'
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const servico = new ServicoGoogleCalendar();
    const resultado = await servico.listarEventosAlterados({
      clientId: 'c',
      clientSecret: 's',
      refreshToken: 'r',
      calendarId: 'cal-1'
    });

    expect(resultado.proximoSyncToken).toBe('sync-token-novo');
    expect(resultado.eventos).toEqual([
      {
        id: 'evento-a',
        status: 'confirmed',
        octaclinConsultaId: 'consulta-abc',
        inicioEm: new Date('2026-08-01T10:00:00Z'),
        fimEm: new Date('2026-08-01T10:50:00Z')
      },
      { id: 'evento-b', status: 'cancelled', octaclinConsultaId: undefined, inicioEm: undefined, fimEm: undefined }
    ]);
  });

  it('limita apenas a sincronizacao inicial e nao combina timeMin com syncToken', async () => {
    const urlsEventos: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'token-janela' }), { status: 200 });
      }
      urlsEventos.push(String(url));
      return new Response(JSON.stringify({ items: [], nextSyncToken: 'sync-novo' }), { status: 200 });
    }) as unknown as typeof fetch;

    const servico = new ServicoGoogleCalendar();
    const credenciais = { clientId: 'c', clientSecret: 's', refreshToken: 'r', calendarId: 'cal-1' };
    await servico.listarEventosAlterados(credenciais);
    await servico.listarEventosAlterados(credenciais, 'sync-existente');

    const urlInicial = new URL(urlsEventos[0]);
    const urlIncremental = new URL(urlsEventos[1]);
    expect(urlInicial.searchParams.get('timeMin')).toBeTruthy();
    expect(urlInicial.searchParams.get('timeMax')).toBeTruthy();
    expect(urlInicial.searchParams.has('syncToken')).toBe(false);
    expect(urlIncremental.searchParams.get('syncToken')).toBe('sync-existente');
    expect(urlIncremental.searchParams.has('timeMin')).toBe(false);
    expect(urlIncremental.searchParams.has('timeMax')).toBe(false);
  });

  it('listarEventosAlterados percorre todas as paginas via nextPageToken e so usa o nextSyncToken da ultima pagina', async () => {
    let chamada = 0;
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'token-4' }), { status: 200 });
      }
      chamada += 1;
      if (chamada === 1) {
        expect(String(url)).not.toContain('pageToken');
        return new Response(
          JSON.stringify({ items: [{ id: 'evento-pagina-1', status: 'confirmed' }], nextPageToken: 'pagina-2' }),
          { status: 200 }
        );
      }
      expect(String(url)).toContain('pageToken=pagina-2');
      return new Response(
        JSON.stringify({ items: [{ id: 'evento-pagina-2', status: 'confirmed' }], nextSyncToken: 'sync-final' }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const servico = new ServicoGoogleCalendar();
    const resultado = await servico.listarEventosAlterados({ clientId: 'c', clientSecret: 's', refreshToken: 'r', calendarId: 'cal-1' });

    expect(resultado.eventos.map((evento) => evento.id)).toEqual(['evento-pagina-1', 'evento-pagina-2']);
    expect(resultado.proximoSyncToken).toBe('sync-final');
  });

  it('listarEventosAlterados lanca SyncTokenExpiradoError quando o Google responde 410', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'token-5' }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: { message: 'Sync token is no longer valid' } }), { status: 410 });
    }) as unknown as typeof fetch;

    const servico = new ServicoGoogleCalendar();
    await expect(
      servico.listarEventosAlterados({ clientId: 'c', clientSecret: 's', refreshToken: 'r', calendarId: 'cal-1' }, 'token-antigo')
    ).rejects.toThrow(SyncTokenExpiradoError);
  });

  it('obterAccessToken (via criarEvento) lanca TokenRevogadoError quando o Google responde invalid_grant', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = 'refresh-token-revogado';

    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }), { status: 400 })
    ) as unknown as typeof fetch;

    const servico = new ServicoGoogleCalendar();
    const resultado = await servico.criarEvento({
      resumo: 'Consulta',
      descricao: 'desc',
      inicioEm: new Date('2026-08-01T10:00:00Z'),
      fimEm: new Date('2026-08-01T10:50:00Z'),
      timezone: 'America/Sao_Paulo',
      consultaId: 'consulta-1'
    });

    expect(resultado).toEqual({ sincronizado: false, motivo: 'falha_google_calendar', erro: expect.stringContaining('revogado') });
  });
});

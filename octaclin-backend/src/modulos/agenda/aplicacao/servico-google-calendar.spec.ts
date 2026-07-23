import { ServicoGoogleCalendar } from './servico-google-calendar';

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
      timezone: 'America/Sao_Paulo'
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
      timezone: 'America/Sao_Paulo'
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
      'https://www.googleapis.com/calendar/v3/calendars/octaclinsys%40gmail.com/events',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
        body: JSON.stringify({
          summary: 'Consulta OctaClin - Ana',
          description: 'Consulta agendada pelo OctaClin.',
          start: { dateTime: '2026-07-22T12:00:00.000Z', timeZone: 'America/Sao_Paulo' },
          end: { dateTime: '2026-07-22T13:00:00.000Z', timeZone: 'America/Sao_Paulo' }
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
      local: 'Sala 2'
    });

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://www.googleapis.com/calendar/v3/calendars/octaclinsys%40gmail.com/events/google-event-1',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
        body: JSON.stringify({
          summary: 'Consulta OctaClin - Ana',
          description: 'Consulta remarcada pelo OctaClin.',
          location: 'Sala 2',
          start: { dateTime: '2026-07-23T14:00:00.000Z', timeZone: 'America/Sao_Paulo' },
          end: { dateTime: '2026-07-23T14:45:00.000Z', timeZone: 'America/Sao_Paulo' }
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
      'https://www.googleapis.com/calendar/v3/calendars/octaclinsys%40gmail.com/events/google-event-1',
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
});

import { urlCallbackGoogleAgenda, urlInicioGoogleAgenda, urlRetornoWebGoogleAgenda, urlWebhookGoogleAgenda } from './urls-google-agenda';

describe('URLs da Google Agenda', () => {
  const ambienteOriginal = process.env;

  beforeEach(() => {
    process.env = { ...ambienteOriginal };
    delete process.env.OCTACLIN_BACKEND_URL;
    delete process.env.RENDER_EXTERNAL_URL;
    delete process.env.OCTACLIN_WEB_URL;
    delete process.env.APP_AMBIENTE;
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  it('usa a URL publica do Render quando a URL explicita do backend nao foi configurada', () => {
    process.env.RENDER_EXTERNAL_URL = 'https://octaclin-backend-producao.onrender.com/';

    expect(urlCallbackGoogleAgenda()).toBe('https://octaclin-backend-producao.onrender.com/agenda/google/callback');
    expect(urlWebhookGoogleAgenda()).toBe('https://octaclin-backend-producao.onrender.com/agenda/google/notificacoes');
  });

  it('prioriza a URL explicita do backend e preserva o fallback local', () => {
    process.env.OCTACLIN_BACKEND_URL = 'https://api.octaclin.com/';

    expect(urlCallbackGoogleAgenda()).toBe('https://api.octaclin.com/agenda/google/callback');

    delete process.env.OCTACLIN_BACKEND_URL;
    expect(urlWebhookGoogleAgenda()).toBe('http://localhost:3000/agenda/google/notificacoes');
  });

  it('gera inicio e retorno somente sobre origens publicas autorizadas', () => {
    process.env.OCTACLIN_BACKEND_URL = 'https://api.octaclin.com';
    process.env.OCTACLIN_WEB_URL = 'https://app.octaclin.com';
    process.env.APP_AMBIENTE = 'producao';

    expect(urlInicioGoogleAgenda('ticket-sintetico')).toBe(
      'https://api.octaclin.com/agenda/google/iniciar?ticket=ticket-sintetico'
    );
    expect(urlRetornoWebGoogleAgenda()).toBe('https://app.octaclin.com/agenda?google=conectado');
  });

  it.each([
    ['http publico', 'http://api.example.com'],
    ['loopback com HTTPS', 'https://127.0.0.1'],
    ['subdominio localhost', 'https://oauth.localhost'],
    ['credenciais embutidas', 'https://usuario:senha@api.example.com'],
    ['path inesperado', 'https://api.example.com/proxy'],
    ['fragmento', 'https://api.example.com/#interno']
  ])('rejeita base externa insegura em producao: %s', (_caso, url) => {
    process.env.APP_AMBIENTE = 'producao';
    process.env.OCTACLIN_BACKEND_URL = url;

    expect(() => urlCallbackGoogleAgenda()).toThrow('URL publica');
  });

  it('rejeita redirect web externo inseguro em producao', () => {
    process.env.APP_AMBIENTE = 'producao';
    process.env.OCTACLIN_WEB_URL = 'https://usuario:senha@site-malicioso.example';

    expect(() => urlRetornoWebGoogleAgenda()).toThrow('URL publica');
  });
});

import { urlCallbackGoogleAgenda, urlWebhookGoogleAgenda } from './urls-google-agenda';

describe('URLs da Google Agenda', () => {
  const ambienteOriginal = process.env;

  beforeEach(() => {
    process.env = { ...ambienteOriginal };
    delete process.env.OCTACLIN_BACKEND_URL;
    delete process.env.RENDER_EXTERNAL_URL;
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
});

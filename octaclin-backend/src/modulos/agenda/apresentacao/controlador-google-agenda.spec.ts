import { ControladorGoogleAgenda } from './controlador-google-agenda';
import { GoogleCanalWatchOrm } from '../infraestrutura/google-canal-watch.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { ProfissionalGoogleConexaoOrm } from '../infraestrutura/profissional-google-conexao.orm';
import { BadRequestException } from '@nestjs/common';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const CANAL_WATCH_ID = `octaclin-gcal:${TENANT_ID}:22222222-2222-4222-8222-222222222222`;

describe('ControladorGoogleAgenda', () => {
  afterEach(() => {
    delete process.env.APP_AMBIENTE;
    delete process.env.OCTACLIN_BACKEND_URL;
    delete process.env.OCTACLIN_WEB_URL;
  });

  function construirControlador() {
    const repositorioCanal = {
      findOne: jest.fn(async () => ({
        canalWatchId: CANAL_WATCH_ID,
        tenantId: TENANT_ID,
        profissionalId: '33333333-3333-4333-8333-333333333333',
        token: 'token-do-canal',
        expiraEm: new Date(Date.now() + 60_000)
      })),
      create: jest.fn((dados: unknown) => dados),
      save: jest.fn(async (dados: unknown) => dados)
    };
    const repositorioConexao = {
      findOne: jest.fn(async () => ({
        tenantId: TENANT_ID,
        profissionalId: '33333333-3333-4333-8333-333333333333',
        canalWatchId: CANAL_WATCH_ID,
        canalRecursoId: 'recurso-google-1',
        canalExpiraEm: new Date(Date.now() + 60_000)
      })),
      create: jest.fn((dados: unknown) => dados),
      save: jest.fn(async (dados: unknown) => dados)
    };
    const repositorioProfissional = {
      findOne: jest.fn(async () => ({ id: '33333333-3333-4333-8333-333333333333' }))
    };
    const executorTenant = {
      executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => unknown) =>
        operacao({
          getRepository: jest.fn((entidade: unknown) =>
            entidade === ProfissionalOrm
              ? repositorioProfissional
              : entidade === ProfissionalGoogleConexaoOrm
                ? repositorioConexao
                : repositorioCanal
          )
        })
      )
    };
    const filaSincronizacao = { add: jest.fn(async () => undefined) };
    const servicoSincronizacao = { reconciliar: jest.fn(async () => undefined) };
    const servicoConexao = {
      obterConexaoAtiva: jest.fn(async () => ({ refreshToken: 'segredo' })),
      gerarTicketInicioOAuth: jest.fn(() => 'ticket-sintetico'),
      iniciarAutorizacao: jest.fn(async () => ({
        url: 'https://accounts.google.com/o/oauth2/v2/auth?state=state-sintetico',
        vinculoBrowser: 'vinculo-sintetico'
      })),
      validarEDecodificarState: jest.fn(async (_state: string, vinculo?: string) => {
        if (!vinculo) throw new BadRequestException('State OAuth nao pertence a este navegador.');
        return {
          tenantId: TENANT_ID,
          profissionalId: '33333333-3333-4333-8333-333333333333',
          codeVerifier: 'verificador-pkce-sintetico'
        };
      }),
      trocarCodigoPorConexao: jest.fn(async () => undefined)
    };
    const googleCalendar = {
      criarCanalWatch: jest.fn(async () => ({ recursoId: 'recurso-google-1', expiraEm: new Date(Date.now() + 60_000) }))
    };
    const fonteDados = {
      getRepository: jest.fn(() => {
        throw new Error('google_canais_watch deve ser lida no contexto RLS do tenant');
      })
    };
    const controlador = new ControladorGoogleAgenda(
      servicoConexao as never,
      googleCalendar as never,
      executorTenant as never,
      servicoSincronizacao as never,
      filaSincronizacao as never
    );

    return {
      controlador,
      executorTenant,
      filaSincronizacao,
      repositorioCanal,
      repositorioProfissional,
      repositorioConexao,
      fonteDados,
      servicoConexao,
      googleCalendar,
      servicoSincronizacao
    };
  }

  it('emite cookie HttpOnly, SameSite Lax e Secure ao iniciar OAuth em producao', async () => {
    process.env.APP_AMBIENTE = 'producao';
    process.env.OCTACLIN_BACKEND_URL = 'https://api.octaclin.example';
    const deps = construirControlador();
    const resposta = { cookie: jest.fn() };

    await expect(deps.controlador.iniciar('ticket-sintetico', resposta as never)).resolves.toEqual({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?state=state-sintetico',
      statusCode: 302
    });

    expect(resposta.cookie).toHaveBeenCalledWith('octaclin_google_oauth_binding', 'vinculo-sintetico', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/agenda/google/callback',
      maxAge: 600_000
    });
  });

  it('rejeita callback em outro navegador e nao troca token nem persiste conexao', async () => {
    const deps = construirControlador();
    const resposta = { clearCookie: jest.fn() };

    await expect(
      deps.controlador.callback(
        'codigo-sintetico',
        'state-sintetico',
        undefined,
        { headers: {} } as never,
        resposta as never
      )
    ).rejects.toThrow('navegador');

    expect(deps.servicoConexao.trocarCodigoPorConexao).not.toHaveBeenCalled();
    expect(deps.googleCalendar.criarCanalWatch).not.toHaveBeenCalled();
    expect(deps.servicoSincronizacao.reconciliar).not.toHaveBeenCalled();
    expect(resposta.clearCookie).toHaveBeenCalled();
  });

  it('conclui callback sintetico no mesmo navegador e redireciona somente para a web configurada', async () => {
    process.env.OCTACLIN_BACKEND_URL = 'http://localhost:3000';
    process.env.OCTACLIN_WEB_URL = 'http://localhost:3001';
    const deps = construirControlador();
    const resposta = { clearCookie: jest.fn() };

    await expect(
      deps.controlador.callback(
        'codigo-sintetico',
        'state-sintetico',
        undefined,
        { headers: { cookie: 'octaclin_google_oauth_binding=vinculo-sintetico' } } as never,
        resposta as never
      )
    ).resolves.toEqual({ url: 'http://localhost:3001/agenda?google=conectado', statusCode: 302 });

    expect(deps.servicoConexao.trocarCodigoPorConexao).toHaveBeenCalledWith(
      TENANT_ID,
      '33333333-3333-4333-8333-333333333333',
      'codigo-sintetico',
      'http://localhost:3000/agenda/google/callback',
      'verificador-pkce-sintetico'
    );
    expect(deps.servicoSincronizacao.reconciliar).toHaveBeenCalledWith(
      TENANT_ID,
      '33333333-3333-4333-8333-333333333333'
    );
    expect(resposta.clearCookie).toHaveBeenCalled();
  });

  it('resolve o tenant pelo identificador do canal e valida o token dentro do contexto RLS antes de enfileirar', async () => {
    const deps = construirControlador();

    await deps.controlador.receberNotificacao(
      CANAL_WATCH_ID,
      'token-do-canal',
      '9',
      'recurso-google-1',
      'exists'
    );

    expect(deps.executorTenant.executar).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
    expect(deps.repositorioCanal.findOne).toHaveBeenCalledWith({ where: { canalWatchId: CANAL_WATCH_ID, tenantId: TENANT_ID } });
    expect(deps.filaSincronizacao.add).toHaveBeenCalledWith(
      'notificacao',
      { canalWatchId: CANAL_WATCH_ID, tenantId: TENANT_ID },
      expect.objectContaining({ jobId: `${CANAL_WATCH_ID}-9` })
    );
    expect(deps.fonteDados.getRepository).not.toHaveBeenCalledWith(GoogleCanalWatchOrm);
  });

  it('rejeita notificacao assinada quando o resource id pertence a outro canal', async () => {
    const deps = construirControlador();

    await deps.controlador.receberNotificacao(
      CANAL_WATCH_ID,
      'token-do-canal',
      '10',
      'recurso-google-de-outro-canal',
      'exists'
    );

    expect(deps.filaSincronizacao.add).not.toHaveBeenCalled();
  });

  it('rejeita notificacao de canal expirado mesmo com token e resource id validos', async () => {
    const deps = construirControlador();
    deps.repositorioCanal.findOne.mockResolvedValueOnce({
      canalWatchId: CANAL_WATCH_ID,
      tenantId: TENANT_ID,
      profissionalId: '33333333-3333-4333-8333-333333333333',
      token: 'token-do-canal',
      expiraEm: new Date(Date.now() - 1)
    });

    await deps.controlador.receberNotificacao(
      CANAL_WATCH_ID,
      'token-do-canal',
      '11',
      'recurso-google-1',
      'exists'
    );

    expect(deps.filaSincronizacao.add).not.toHaveBeenCalled();
  });

  it('ignora um identificador legado ou malformado antes de tentar uma leitura global', async () => {
    const deps = construirControlador();

    await deps.controlador.receberNotificacao('canal-legado', 'token-do-canal');

    expect(deps.executorTenant.executar).not.toHaveBeenCalled();
    expect(deps.filaSincronizacao.add).not.toHaveBeenCalled();
  });

  it('representa Google individual como indisponivel para SuperAdmin sem resolver perfil profissional', async () => {
    const deps = construirControlador();

    await expect(
      deps.controlador.status({
        usuarioId: '44444444-4444-4444-8444-444444444444',
        tenantId: TENANT_ID,
        papel: 'SuperAdmin',
        emailHash: 'hash-superadmin',
        permissoes: ['agenda.consultas.ler']
      })
    ).resolves.toEqual({ conectado: false, podeGerenciar: false, falhasConsecutivas: 0 });

    expect(deps.executorTenant.executar).not.toHaveBeenCalled();
  });

  it('permite que o profissional conectado force uma reconciliacao de recuperacao', async () => {
    const deps = construirControlador();

    await expect(
      deps.controlador.sincronizar({
        usuarioId: '55555555-5555-4555-8555-555555555555',
        tenantId: TENANT_ID,
        papel: 'Professional',
        emailHash: 'hash-profissional',
        permissoes: ['agenda.consultas.ler']
      })
    ).resolves.toEqual({ sincronizado: true });

    expect(deps.servicoConexao.obterConexaoAtiva).toHaveBeenCalledWith(
      TENANT_ID,
      '33333333-3333-4333-8333-333333333333'
    );
    expect(deps.servicoSincronizacao.reconciliar).toHaveBeenCalledWith(
      TENANT_ID,
      '33333333-3333-4333-8333-333333333333'
    );
  });
});

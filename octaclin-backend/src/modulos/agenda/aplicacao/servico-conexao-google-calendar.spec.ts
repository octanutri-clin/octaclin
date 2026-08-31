import { DataSource } from 'typeorm';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ServicoConexaoGoogleCalendar } from './servico-conexao-google-calendar';

describe('ServicoConexaoGoogleCalendar', () => {
  const criptografia = new CriptografiaDadosSensiveis();
  const segredoState = 'state-google-calendar-teste-com-entropia-suficiente-123456';

  beforeEach(() => {
    process.env.GOOGLE_CALENDAR_OAUTH_STATE_SECRET = segredoState;
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
  });

  afterEach(() => {
    delete (global as any).fetch;
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
    delete process.env.GOOGLE_CALENDAR_TOKEN_URI;
    delete process.env.GOOGLE_CALENDAR_OAUTH_STATE_SECRET;
    delete process.env.APP_AMBIENTE;
  });

  function construirServico() {
    const gerenciadorFalso = criarGerenciadorFalso();
    const executorTenant = { executar: jest.fn((_tenantId: string, callback: (gerenciador: any) => any) => callback(gerenciadorFalso)) } as unknown as ExecutorTenant;
    const repositorioCanaisWatch = { delete: jest.fn(async () => undefined) };
    const fonteDados = { getRepository: jest.fn(() => repositorioCanaisWatch) } as unknown as DataSource;
    const redis = criarRedisFalso();
    const googleCalendar = { pararCanalWatch: jest.fn(async () => undefined) };
    const servico = new ServicoConexaoGoogleCalendar(executorTenant, criptografia, redis as any, googleCalendar as any, fonteDados);
    return { servico, gerenciadorFalso, executorTenant, redis, googleCalendar, repositorioCanaisWatch };
  }

  function criarRedisFalso() {
    const valores = new Map<string, string>();
    return {
      set: jest.fn(async (chave: string, valor: string) => {
        if (valores.has(chave)) return null;
        valores.set(chave, valor);
        return 'OK' as const;
      }),
      get: jest.fn(async (chave: string) => valores.get(chave) ?? null),
      del: jest.fn(async (chave: string) => (valores.delete(chave) ? 1 : 0)),
      valores
    };
  }

  function criarGerenciadorFalso() {
    const registros = new Map<string, any>();
    const repositorio = {
      findOne: jest.fn(async ({ where }: any) => registros.get(`${where.tenantId}:${where.profissionalId}`) ?? null),
      create: jest.fn((dados: any) => dados),
      save: jest.fn(async (dados: any) => {
        const chave = `${dados.tenantId}:${dados.profissionalId}`;
        const salvo = { id: 'conexao-1', ...registros.get(chave), ...dados };
        registros.set(chave, salvo);
        return salvo;
      }),
      delete: jest.fn(async () => undefined)
    };
    return {
      getRepository: () => repositorio,
      registros,
      repositorio
    };
  }

  it('gera ticket de inicio consumivel e vincula state + PKCE ao navegador que iniciou o OAuth', async () => {
    const { servico } = construirServico();

    const ticket = servico.gerarTicketInicioOAuth('tenant-1', 'profissional-1');
    const inicio = await servico.iniciarAutorizacao(ticket, 'https://backend/agenda/google/callback');

    const parametros = new URL(inicio.url).searchParams;
    expect(inicio.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(parametros.get('client_id')).toBe('client-id');
    expect(parametros.get('code_challenge_method')).toBe('S256');
    expect(parametros.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);

    await expect(
      servico.validarEDecodificarState(parametros.get('state') ?? '', 'vinculo-de-outro-navegador')
    ).rejects.toThrow('navegador');

    await expect(servico.validarEDecodificarState(parametros.get('state') ?? '', inicio.vinculoBrowser)).resolves.toEqual({
      tenantId: 'tenant-1',
      profissionalId: 'profissional-1',
      codeVerifier: expect.stringMatching(/^[A-Za-z0-9_-]{43,128}$/)
    });
  });

  it('recusa iniciar OAuth sem segredo dedicado para o state', () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    delete process.env.GOOGLE_CALENDAR_OAUTH_STATE_SECRET;
    const { servico } = construirServico();

    expect(() => servico.gerarTicketInicioOAuth('tenant-1', 'profissional-1')).toThrow(
      'GOOGLE_CALENDAR_OAUTH_STATE_SECRET'
    );
  });

  it('rejeita um state adulterado', async () => {
    const { servico } = construirServico();
    await expect(servico.validarEDecodificarState('valor-invalido', undefined)).rejects.toThrow();
  });

  it('rejeita um state bem formado mas com assinatura adulterada', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    const { servico } = construirServico();

    const ticket = servico.gerarTicketInicioOAuth('tenant-1', 'profissional-1');
    const inicio = await servico.iniciarAutorizacao(ticket, 'https://backend/agenda/google/callback');
    const stateOriginal = new URL(inicio.url).searchParams.get('state') ?? '';

    const decodificado = Buffer.from(stateOriginal, 'base64url').toString('utf8');
    const [payloadBase64, assinaturaBase64] = decodificado.split('.');
    const bufferAssinatura = Buffer.from(assinaturaBase64, 'base64url');
    bufferAssinatura[0] = bufferAssinatura[0] ^ 0xff;
    const assinaturaAdulterada = bufferAssinatura.toString('base64url');
    // A assinatura HMAC-SHA256 tem tamanho fixo (32 bytes); adulterar um byte preserva o
    // comprimento da string base64url, garantindo que o teste exercite a comparacao
    // constant-time (timingSafeEqual) e nao apenas o atalho de tamanhos diferentes.
    expect(assinaturaAdulterada).toHaveLength(assinaturaBase64.length);
    expect(assinaturaAdulterada).not.toBe(assinaturaBase64);

    const stateAdulterado = Buffer.from(`${payloadBase64}.${assinaturaAdulterada}`).toString('base64url');

    await expect(servico.validarEDecodificarState(stateAdulterado, inicio.vinculoBrowser)).rejects.toThrow('State OAuth invalido.');
  });

  it('rejeita um state expirado', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    const { servico } = construirServico();

    const payloadBase64 = Buffer.from(
      JSON.stringify({
        tipo: 'state',
        tenantId: 'tenant-1',
        profissionalId: 'profissional-1',
        nonce: 'a'.repeat(32),
        vinculoHash: 'a'.repeat(64),
        exp: Date.now() - 1000
      })
    ).toString('base64url');
    const chaveAssinatura = segredoState;
    const { createHmac } = await import('crypto');
    const assinatura = createHmac('sha256', chaveAssinatura).update(payloadBase64).digest('base64url');
    const stateExpirado = Buffer.from(`${payloadBase64}.${assinatura}`).toString('base64url');

    await expect(servico.validarEDecodificarState(stateExpirado, 'vinculo-sintetico')).rejects.toThrow('State OAuth expirado.');
  });

  it('rejeita um state reutilizado (replay) mesmo dentro do prazo de validade', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    const { servico } = construirServico();

    const ticket = servico.gerarTicketInicioOAuth('tenant-1', 'profissional-1');
    const inicio = await servico.iniciarAutorizacao(ticket, 'https://backend/agenda/google/callback');
    const state = new URL(inicio.url).searchParams.get('state') ?? '';

    await expect(servico.validarEDecodificarState(state, inicio.vinculoBrowser)).resolves.toEqual(
      expect.objectContaining({ tenantId: 'tenant-1', profissionalId: 'profissional-1' })
    );
    await expect(servico.validarEDecodificarState(state, inicio.vinculoBrowser)).rejects.toThrow('State OAuth ja utilizado.');
  });

  it('rejeita reutilizar o ticket de inicio em outro navegador antes de emitir novo state', async () => {
    const { servico } = construirServico();
    const ticket = servico.gerarTicketInicioOAuth('tenant-1', 'profissional-1');

    await expect(servico.iniciarAutorizacao(ticket, 'https://backend/agenda/google/callback')).resolves.toBeDefined();
    await expect(servico.iniciarAutorizacao(ticket, 'https://backend/agenda/google/callback')).rejects.toThrow('ja utilizado');
  });

  describe('trocarCodigoPorConexao', () => {
    it('troca o codigo de autorizacao por uma conexao, armazenando o refresh token criptografado (nao em texto puro)', async () => {
      process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
      const { servico, gerenciadorFalso } = construirServico();
      const repositorio = gerenciadorFalso.getRepository();

      const refreshTokenOriginal = 'refresh-token-de-teste';
      const fetchMock = jest.fn(async (_url: string, _init: RequestInit) => ({
        ok: true,
        json: async () => ({ refresh_token: refreshTokenOriginal, scope: 'https://www.googleapis.com/auth/calendar' })
      }));
      (global as any).fetch = fetchMock;

      await servico.trocarCodigoPorConexao(
        'tenant-1',
        'profissional-1',
        'codigo-autorizacao',
        'https://backend/agenda/google/callback',
        'verificador-pkce-sintetico-com-comprimento-suficiente-123456'
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) })
      );
      const primeiraChamada = fetchMock.mock.calls[0];
      expect((primeiraChamada?.[1]?.body as URLSearchParams).get('code_verifier')).toContain('verificador-pkce');
      const chamadasSave = (repositorio.save as jest.Mock).mock.calls;
      const dadosSalvos = chamadasSave[chamadasSave.length - 1][0];
      expect(dadosSalvos.refreshTokenCriptografado).toBeInstanceOf(Buffer);
      expect(dadosSalvos.refreshTokenCriptografado.toString('utf8')).not.toContain(refreshTokenOriginal);
      expect(criptografia.descriptografar(dadosSalvos.refreshTokenCriptografado)).toBe(refreshTokenOriginal);
    });

    it('reativa uma conexao previamente desconectada', async () => {
      process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
      const { servico, gerenciadorFalso } = construirServico();
      const repositorio = gerenciadorFalso.getRepository();
      await repositorio.save({
        tenantId: 'tenant-1',
        profissionalId: 'profissional-1',
        refreshTokenCriptografado: criptografia.criptografar('token-antigo'),
        calendarId: 'primary',
        conectadoEm: new Date('2026-01-01T00:00:00.000Z'),
        desconectadoEm: new Date('2026-01-02T00:00:00.000Z')
      });
      (global as any).fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({ refresh_token: 'token-novo', scope: 'https://www.googleapis.com/auth/calendar' })
      }));

      await servico.trocarCodigoPorConexao(
        'tenant-1',
        'profissional-1',
        'codigo-novo',
        'https://backend/agenda/google/callback',
        'verificador-pkce-sintetico-com-comprimento-suficiente-123456'
      );

      const credenciais = await servico.obterConexaoAtiva('tenant-1', 'profissional-1');
      expect(credenciais?.refreshToken).toBe('token-novo');
      expect(gerenciadorFalso.registros.get('tenant-1:profissional-1').desconectadoEm).toBeNull();
    });

    it('rejeita endpoint OAuth externo configuravel em producao antes de qualquer chamada de rede', async () => {
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
      process.env.GOOGLE_CALENDAR_TOKEN_URI = 'http://127.0.0.1:8080/token';
      process.env.APP_AMBIENTE = 'producao';
      const { servico } = construirServico();
      const fetchMock = jest.fn();
      (global as any).fetch = fetchMock;

      await expect(
        servico.trocarCodigoPorConexao(
          'tenant-1',
          'profissional-1',
          'codigo',
          'https://backend/agenda/google/callback',
          'verificador-pkce-sintetico-com-comprimento-suficiente-123456'
        )
      ).rejects.toThrow('endpoint OAuth Google');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('nao propaga detalhes externos quando a troca do codigo falha', async () => {
      process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
      const { servico } = construirServico();
      (global as any).fetch = jest.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_request', error_description: 'segredo-sintetico-do-provider' })
      }));

      const operacao = servico.trocarCodigoPorConexao(
        'tenant-1',
        'profissional-1',
        'codigo',
        'https://backend/agenda/google/callback',
        'verificador-pkce-sintetico-com-comprimento-suficiente-123456'
      );

      await expect(operacao).rejects.toThrow('HTTP 400');
      await expect(operacao).rejects.not.toThrow('segredo-sintetico-do-provider');
    });
  });

  describe('obterConexaoAtiva', () => {
    it('retorna as credenciais decodificadas quando a conexao existe e esta ativa', async () => {
      process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
      const { servico, gerenciadorFalso } = construirServico();
      const repositorio = gerenciadorFalso.getRepository();
      const refreshTokenOriginal = 'refresh-token-ativo';
      await repositorio.save({
        tenantId: 'tenant-1',
        profissionalId: 'profissional-1',
        refreshTokenCriptografado: criptografia.criptografar(refreshTokenOriginal),
        calendarId: 'calendario-x',
        conectadoEm: new Date(),
        desconectadoEm: undefined
      });

      const credenciais = await servico.obterConexaoAtiva('tenant-1', 'profissional-1');

      expect(credenciais).toEqual({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        refreshToken: refreshTokenOriginal,
        calendarId: 'calendario-x'
      });
    });

    it('retorna undefined quando a conexao existe mas foi desconectada', async () => {
      process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
      const { servico, gerenciadorFalso } = construirServico();
      const repositorio = gerenciadorFalso.getRepository();
      await repositorio.save({
        tenantId: 'tenant-1',
        profissionalId: 'profissional-1',
        refreshTokenCriptografado: criptografia.criptografar('refresh-token-desconectado'),
        calendarId: 'primary',
        conectadoEm: new Date(),
        desconectadoEm: new Date()
      });

      const credenciais = await servico.obterConexaoAtiva('tenant-1', 'profissional-1');

      expect(credenciais).toBeUndefined();
    });
  });

  describe('desconectar', () => {
    it('marca a conexao como desconectada e limpa os campos do canal de watch', async () => {
      const { servico, gerenciadorFalso } = construirServico();
      const repositorio = gerenciadorFalso.getRepository();
      await repositorio.save({
        tenantId: 'tenant-1',
        profissionalId: 'profissional-1',
        refreshTokenCriptografado: criptografia.criptografar('refresh-token-x'),
        calendarId: 'primary',
        conectadoEm: new Date(),
        canalWatchId: 'watch-1',
        canalRecursoId: 'recurso-1',
        canalExpiraEm: new Date()
      });

      await servico.desconectar('tenant-1', 'profissional-1');

      const chamadasSave = (repositorio.save as jest.Mock).mock.calls;
      const ultimaChamada = chamadasSave[chamadasSave.length - 1][0];
      expect(ultimaChamada.desconectadoEm).toBeInstanceOf(Date);
      expect(ultimaChamada.canalWatchId).toBeUndefined();
      expect(ultimaChamada.canalRecursoId).toBeUndefined();
      expect(ultimaChamada.canalExpiraEm).toBeUndefined();
    });

    it('para o canal de watch no Google e remove o registro local quando havia canal ativo', async () => {
      process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
      const { servico, gerenciadorFalso, googleCalendar, repositorioCanaisWatch } = construirServico();
      const repositorio = gerenciadorFalso.getRepository();
      const refreshTokenOriginal = 'refresh-token-x';
      await repositorio.save({
        tenantId: 'tenant-1',
        profissionalId: 'profissional-1',
        refreshTokenCriptografado: criptografia.criptografar(refreshTokenOriginal),
        calendarId: 'calendario-x',
        conectadoEm: new Date(),
        canalWatchId: 'watch-1',
        canalRecursoId: 'recurso-1',
        canalExpiraEm: new Date()
      });

      await servico.desconectar('tenant-1', 'profissional-1');

      expect(googleCalendar.pararCanalWatch).toHaveBeenCalledWith(
        { clientId: 'client-id', clientSecret: 'client-secret', refreshToken: refreshTokenOriginal, calendarId: 'calendario-x' },
        'watch-1',
        'recurso-1'
      );
      expect(gerenciadorFalso.repositorio.delete).toHaveBeenCalledWith({ canalWatchId: 'watch-1' });
    });

    it('nao chama o Google e conclui a desconexao quando nao havia canal de watch ativo', async () => {
      const { servico, gerenciadorFalso, googleCalendar, repositorioCanaisWatch } = construirServico();
      const repositorio = gerenciadorFalso.getRepository();
      await repositorio.save({
        tenantId: 'tenant-1',
        profissionalId: 'profissional-1',
        refreshTokenCriptografado: criptografia.criptografar('refresh-token-x'),
        calendarId: 'primary',
        conectadoEm: new Date()
      });

      await servico.desconectar('tenant-1', 'profissional-1');

      expect(googleCalendar.pararCanalWatch).not.toHaveBeenCalled();
      expect(repositorioCanaisWatch.delete).not.toHaveBeenCalled();
    });

    it('conclui a desconexao local mesmo quando parar o canal no Google falha', async () => {
      process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
      const { servico, gerenciadorFalso, googleCalendar } = construirServico();
      googleCalendar.pararCanalWatch.mockRejectedValueOnce(new Error('canal ja expirado'));
      const repositorio = gerenciadorFalso.getRepository();
      await repositorio.save({
        tenantId: 'tenant-1',
        profissionalId: 'profissional-1',
        refreshTokenCriptografado: criptografia.criptografar('refresh-token-x'),
        calendarId: 'primary',
        conectadoEm: new Date(),
        canalWatchId: 'watch-1',
        canalRecursoId: 'recurso-1',
        canalExpiraEm: new Date()
      });

      await expect(servico.desconectar('tenant-1', 'profissional-1')).resolves.toBeUndefined();

      const chamadasSave = (repositorio.save as jest.Mock).mock.calls;
      const ultimaChamada = chamadasSave[chamadasSave.length - 1][0];
      expect(ultimaChamada.desconectadoEm).toBeInstanceOf(Date);
    });
  });
});

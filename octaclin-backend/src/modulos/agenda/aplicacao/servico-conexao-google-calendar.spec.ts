import { DataSource } from 'typeorm';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ServicoConexaoGoogleCalendar } from './servico-conexao-google-calendar';

describe('ServicoConexaoGoogleCalendar', () => {
  const criptografia = new CriptografiaDadosSensiveis();

  afterEach(() => {
    delete (global as any).fetch;
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
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
    const chavesConsumidas = new Set<string>();
    return {
      set: jest.fn(async (chave: string) => {
        if (chavesConsumidas.has(chave)) return null;
        chavesConsumidas.add(chave);
        return 'OK' as const;
      })
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
      })
    };
    return {
      getRepository: () => repositorio,
      registros
    };
  }

  it('gera uma URL de autorizacao com state assinado contendo tenantId e profissionalId', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    const { servico } = construirServico();

    const url = servico.gerarUrlAutorizacao('tenant-1', 'profissional-1', 'https://backend/agenda/google/callback');

    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=client-id');
    const parametros = new URL(url).searchParams;
    const decodificado = await servico.validarEDecodificarState(parametros.get('state') ?? '');
    expect(decodificado).toEqual({ tenantId: 'tenant-1', profissionalId: 'profissional-1' });
  });

  it('rejeita um state adulterado', async () => {
    const { servico } = construirServico();
    await expect(servico.validarEDecodificarState('valor-invalido')).rejects.toThrow();
  });

  it('rejeita um state bem formado mas com assinatura adulterada', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    const { servico } = construirServico();

    const url = servico.gerarUrlAutorizacao('tenant-1', 'profissional-1', 'https://backend/agenda/google/callback');
    const stateOriginal = new URL(url).searchParams.get('state') ?? '';

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

    await expect(servico.validarEDecodificarState(stateAdulterado)).rejects.toThrow('State OAuth invalido.');
  });

  it('rejeita um state expirado', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    const { servico } = construirServico();

    const payloadBase64 = Buffer.from(
      JSON.stringify({ tenantId: 'tenant-1', profissionalId: 'profissional-1', nonce: 'nonce-expirado', exp: Date.now() - 1000 })
    ).toString('base64url');
    const chaveAssinatura = process.env.CRIPTOGRAFIA_CHAVE_AES_256 ?? 'octaclin-chave-local-desenvolvimento';
    const { createHmac } = await import('crypto');
    const assinatura = createHmac('sha256', chaveAssinatura).update(payloadBase64).digest('base64url');
    const stateExpirado = Buffer.from(`${payloadBase64}.${assinatura}`).toString('base64url');

    await expect(servico.validarEDecodificarState(stateExpirado)).rejects.toThrow('State OAuth expirado.');
  });

  it('rejeita um state reutilizado (replay) mesmo dentro do prazo de validade', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    const { servico } = construirServico();

    const url = servico.gerarUrlAutorizacao('tenant-1', 'profissional-1', 'https://backend/agenda/google/callback');
    const state = new URL(url).searchParams.get('state') ?? '';

    await expect(servico.validarEDecodificarState(state)).resolves.toEqual({ tenantId: 'tenant-1', profissionalId: 'profissional-1' });
    await expect(servico.validarEDecodificarState(state)).rejects.toThrow('State OAuth ja utilizado.');
  });

  describe('trocarCodigoPorConexao', () => {
    it('troca o codigo de autorizacao por uma conexao, armazenando o refresh token criptografado (nao em texto puro)', async () => {
      process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
      const { servico, gerenciadorFalso } = construirServico();
      const repositorio = gerenciadorFalso.getRepository();

      const refreshTokenOriginal = 'refresh-token-de-teste';
      const fetchMock = jest.fn(async () => ({
        ok: true,
        json: async () => ({ refresh_token: refreshTokenOriginal, scope: 'https://www.googleapis.com/auth/calendar' })
      }));
      (global as any).fetch = fetchMock;

      await servico.trocarCodigoPorConexao('tenant-1', 'profissional-1', 'codigo-autorizacao', 'https://backend/agenda/google/callback');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const chamadasSave = (repositorio.save as jest.Mock).mock.calls;
      const dadosSalvos = chamadasSave[chamadasSave.length - 1][0];
      expect(dadosSalvos.refreshTokenCriptografado).toBeInstanceOf(Buffer);
      expect(dadosSalvos.refreshTokenCriptografado.toString('utf8')).not.toContain(refreshTokenOriginal);
      expect(criptografia.descriptografar(dadosSalvos.refreshTokenCriptografado)).toBe(refreshTokenOriginal);
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
      expect(repositorioCanaisWatch.delete).toHaveBeenCalledWith({ canalWatchId: 'watch-1' });
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

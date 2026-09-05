import { HttpException, HttpStatus, Logger, UnauthorizedException } from '@nestjs/common';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { TIPO_TOKEN_ACESSO, TIPO_TOKEN_RENOVACAO } from '../dominio/claims-token';
import { RefreshTokenOrm } from '../infraestrutura/refresh-token.orm';
import { SessaoUsuarioOrm } from '../infraestrutura/sessao-usuario.orm';
import { ServicoAuth, reiniciarJanelaLoginSucesso } from './servico-auth';

const TENANT = 'tenant-1';
const USUARIO = 'usuario-1';
const SESSAO = 'sessao-1';

interface DadosCenario {
  tenant?: Record<string, unknown>;
  usuario?: Record<string, unknown>;
  senhaValida?: boolean;
  protecaoAbuso?: Record<string, unknown>;
  sessao?: Partial<SessaoUsuarioOrm> | null;
  tokenPersistido?: Partial<RefreshTokenOrm> | null;
  consumoAfetado?: number;
  claimsRenovacao?: Record<string, unknown>;
  verifyLanca?: boolean;
  mfaDesafio?: Record<string, unknown> | null;
  auditoriaLanca?: boolean;
  /**
   * Reproduz o comportamento real de `ServicoAuditoria.registrar`: a falha e
   * engolida, `registrar` volta normalmente e so o contador monotonico de
   * falhas muda. E o caminho que `auditoriaLanca` nao cobre, e e justamente o
   * que a janela de `auth.login.sucesso` precisa enxergar para nao confirmar
   * supressao em cima de uma linha que nunca existiu.
   */
  auditoriaFalhaSilenciosa?: boolean;
  /**
   * Faz `obterTotalFalhas` lancar na leitura **posterior** a escrita.
   *
   * A contabilidade do teto le o contador duas vezes por login: antes, para
   * marcar o ponto de partida, e depois, para decidir se a linha existiu.
   * Lancar so na segunda leitura poe a excecao no instante de custo maximo --
   * a chave ja esta reservada e a linha ja foi gravada --, que e o caso que a
   * segunda barreira de `emitirSessaoUsuario` precisa absorver.
   */
  contadorFalhasLancaAposEscrita?: boolean;
}

function criarServico(dados: DadosCenario = {}) {
  const tokensSalvos: Record<string, unknown>[] = [];
  const sessoesCriadas: Record<string, unknown>[] = [];

  const repositorioTenant = {
    findOne: jest.fn(async () => dados.tenant ?? null)
  };
  const repositorioUsuario = {
    findOne: jest.fn(async () => dados.usuario ?? null)
  };
  const executaConsumo = jest.fn(async () => ({ affected: dados.consumoAfetado ?? 1 }));
  const construtorConsulta: Record<string, jest.Mock> = {
    update: jest.fn(() => construtorConsulta),
    set: jest.fn(() => construtorConsulta),
    where: jest.fn((_condicao: string, _parametros?: unknown) => construtorConsulta),
    andWhere: jest.fn((_condicao: string, _parametros?: unknown) => construtorConsulta),
    execute: executaConsumo
  };
  const repositorioTokens = {
    createQueryBuilder: jest.fn(() => construtorConsulta),
    findOne: jest.fn(async () => dados.tokenPersistido ?? null),
    create: jest.fn((entrada: Record<string, unknown>) => entrada),
    save: jest.fn(async (entrada: Record<string, unknown>) => {
      tokensSalvos.push(entrada);
      return entrada;
    })
  };
  const repositorioSessoes = {
    findOne: jest.fn(async () => dados.sessao ?? null),
    save: jest.fn(async (entrada: unknown) => entrada)
  };

  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === UsuarioOrm) return repositorioUsuario;
      if (entidade === RefreshTokenOrm) return repositorioTokens;
      if (entidade === SessaoUsuarioOrm) return repositorioSessoes;
      throw new Error(`Repositorio tenant nao mapeado: ${entidade.name}`);
    })
  };
  const fonteDados = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === TenantOrm) return repositorioTenant;
      throw new Error(`Repositorio global nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };
  const jwt = {
    signAsync: jest.fn(async (payload: Record<string, unknown>, _opcoes: Record<string, unknown>) => `jwt:${String(payload.tipo)}`),
    verifyAsync: jest.fn(async () => {
      if (dados.verifyLanca) throw new Error('assinatura invalida');
      return (
        dados.claimsRenovacao ?? {
          sub: USUARIO,
          tenantId: TENANT,
          sid: SESSAO,
          jti: 'jti-1',
          tipo: TIPO_TOKEN_RENOVACAO,
          iat: 1,
          exp: 2
        }
      );
    })
  };
  const senhas = { verificar: jest.fn(() => dados.senhaValida ?? false) };
  const criptografia = {
    gerarHashBusca: jest.fn((valor: string) => `hash:${valor.trim().toLowerCase()}`)
  };
  const protecaoAbuso = dados.protecaoAbuso ?? {
    verificarDisponibilidade: jest.fn(),
    registrarFalha: jest.fn(),
    registrarSucesso: jest.fn()
  };
  const sessoes = {
    criar: jest.fn(async (_gerenciador: unknown, entrada: Record<string, unknown>) => {
      const criada = { id: SESSAO, ...entrada };
      sessoesCriadas.push(criada);
      return criada;
    }),
    revogar: jest.fn(async () => true),
    revogarPorReuso: jest.fn(async () => undefined),
    listar: jest.fn(async () => ({ itens: [], pagina: 1, limite: 5, total: 0, totalPaginas: 1 })),
    encerrarPorReferencia: jest.fn(async () => undefined),
    encerrarOutras: jest.fn(async () => 2),
    revogarTodas: jest.fn(async () => 3),
    limparHistorico: jest.fn(async () => 4)
  };
  const mfa = {
    iniciarLogin: jest.fn(async () => dados.mfaDesafio ?? null),
    concluirLogin: jest.fn(async () => ({
      usuario: USUARIO_ATIVO as UsuarioOrm,
      codigosRecuperacao: ['AAAA-BBBB-CCCC'],
      mfaVerificadoEm: new Date('2026-08-29T12:00:00.000Z')
    }))
  };

  let totalFalhasAuditoria = 0;
  let leiturasDoContador = 0;
  const auditoria = {
    registrar: jest.fn(async () => {
      if (dados.auditoriaFalhaSilenciosa) {
        totalFalhasAuditoria += 1;
        return;
      }
      if (dados.auditoriaLanca) throw new Error('trilha indisponivel');
    }),
    obterTotalFalhas: jest.fn(() => {
      leiturasDoContador += 1;
      // Par ordenado por login: impar e a leitura anterior a escrita, par e a
      // posterior. Ver `contadorFalhasLancaAposEscrita`.
      if (dados.contadorFalhasLancaAposEscrita && leiturasDoContador % 2 === 0) {
        throw new Error('contador de falhas indisponivel');
      }
      return totalFalhasAuditoria;
    })
  };

  return {
    servico: new ServicoAuth(
      fonteDados as never,
      executorTenant as never,
      jwt as never,
      senhas as never,
      criptografia as never,
      protecaoAbuso as never,
      sessoes as never,
      mfa as never,
      auditoria as never
    ),
    auditoria,
    jwt,
    sessoes,
    protecaoAbuso,
    repositorioTenant,
    repositorioTokens,
    repositorioSessoes,
    construtorConsulta,
    tokensSalvos,
    sessoesCriadas,
    mfa
  };
}

const USUARIO_ATIVO = {
  id: USUARIO,
  tenantId: TENANT,
  emailHash: 'hash:ana@example.com',
  senhaHash: 'hash-senha',
  ativo: true,
  role: 'Professional'
};

const USUARIO_NAO_PRIVILEGIADO = { ...USUARIO_ATIVO, role: 'Patient' };

const CREDENCIAIS = { tenantSlug: 'clinica-carla', email: 'ana@example.com', senha: 'SenhaValida123' };

function sessaoAtiva(extra: Partial<SessaoUsuarioOrm> = {}): Partial<SessaoUsuarioOrm> {
  return {
    id: SESSAO,
    tenantId: TENANT,
    usuarioId: USUARIO,
    criadoEm: new Date('2026-08-01T10:00:00.000Z'),
    ultimaAtividadeEm: new Date('2026-08-01T10:00:00.000Z'),
    expiraEm: new Date('2126-08-01T10:00:00.000Z'),
    revogadoEm: null,
    mfaVerificadoEm: new Date('2026-08-01T10:00:00.000Z'),
    ...extra
  };
}

function cenarioLoginValido(extra: DadosCenario = {}) {
  return criarServico({
    tenant: { id: TENANT, slug: 'clinica-carla', status: 'ativo' },
    usuario: USUARIO_NAO_PRIVILEGIADO,
    senhaValida: true,
    ...extra
  });
}

interface EntradaTrilhaObservada {
  acao?: string;
  metadados?: Record<string, unknown>;
}

/**
 * As entradas de `auth.login.sucesso` que chegaram a trilha.
 *
 * O duble e `jest.fn(async () => ...)` sem parametros declarados, entao
 * `mock.calls` tem tipo de tupla vazia e nao aceita indexacao direta -- o cast
 * e sobre a forma que o call site de fato passa, e nao um atalho para `any`.
 */
function escritasDeLoginSucesso(auditoria: { registrar: jest.Mock }): EntradaTrilhaObservada[] {
  const chamadas = auditoria.registrar.mock.calls as unknown as EntradaTrilhaObservada[][];
  return chamadas
    .map((argumentos) => argumentos[0] ?? {})
    .filter((entrada) => entrada.acao === 'auth.login.sucesso');
}

const CHAVES_AMBIENTE = ['JWT_EXPIRA_EM', 'JWT_REFRESH_EXPIRA_EM'] as const;

describe('ServicoAuth', () => {
  let snapshot: Map<string, string | undefined>;

  beforeEach(() => {
    snapshot = new Map(CHAVES_AMBIENTE.map((nome) => [nome, process.env[nome]]));
    for (const nome of CHAVES_AMBIENTE) delete process.env[nome];
    // A janela de `auth.login.sucesso` e estado de modulo, e nao de instancia
    // (ver o bloco em `servico-auth.ts`): sem este reinicio o primeiro teste que
    // faz login suprimiria o login de todos os seguintes.
    reiniciarJanelaLoginSucesso();
  });

  afterEach(() => {
    for (const [nome, valor] of snapshot) {
      if (valor === undefined) delete process.env[nome];
      else process.env[nome] = valor;
    }
  });

  describe('login', () => {
    it('nao emite sessao para acesso privilegiado enquanto o MFA estiver pendente', async () => {
      const desafio = { mfaObrigatorio: true, modo: 'verificar', desafioMfa: 'desafio' };
      const { servico, sessoes, mfa } = cenarioLoginValido({ usuario: USUARIO_ATIVO, mfaDesafio: desafio });

      await expect(servico.login(CREDENCIAIS)).resolves.toEqual(desafio);
      expect(mfa.iniciarLogin).toHaveBeenCalledWith(USUARIO_ATIVO);
      expect(sessoes.criar).not.toHaveBeenCalled();
    });

    it('recusa emissao interna de sessao privilegiada sem comprovacao MFA', async () => {
      const { servico, sessoes } = criarServico();

      await expect(servico.emitirSessaoUsuario(USUARIO_ATIVO as UsuarioOrm)).rejects.toBeInstanceOf(
        UnauthorizedException
      );
      expect(sessoes.criar).not.toHaveBeenCalled();
    });

    it('emite sessao com comprovacao MFA somente depois de concluir o desafio', async () => {
      const { servico, sessoes } = cenarioLoginValido();

      const resposta = await servico.concluirLoginMfa({ desafioMfa: 'desafio', codigo: '123456' });

      expect(resposta.codigosRecuperacao).toEqual(['AAAA-BBBB-CCCC']);
      expect(sessoes.criar).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ mfaVerificadoEm: new Date('2026-08-29T12:00:00.000Z') })
      );
    });
    it('bloqueia login abusivo antes de consultar tenant e credenciais', async () => {
      const protecaoAbuso = {
        verificarDisponibilidade: jest.fn(() => {
          throw new HttpException('Muitas tentativas de login.', HttpStatus.TOO_MANY_REQUESTS);
        }),
        registrarFalha: jest.fn(),
        registrarSucesso: jest.fn()
      };
      const { servico, repositorioTenant } = criarServico({ protecaoAbuso });

      await expect(servico.login(CREDENCIAIS)).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
      expect(repositorioTenant.findOne).not.toHaveBeenCalled();
    });

    it('registra falha quando a senha e invalida', async () => {
      const { servico, protecaoAbuso } = criarServico({
        tenant: { id: TENANT, slug: 'clinica-carla', status: 'ativo' },
        usuario: USUARIO_ATIVO
      });

      await expect(servico.login(CREDENCIAIS)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(protecaoAbuso.registrarFalha).toHaveBeenCalled();
      expect(protecaoAbuso.registrarSucesso).not.toHaveBeenCalled();
    });

    it('cria uma sessao independente a cada login', async () => {
      const { servico, sessoes } = cenarioLoginValido();

      await servico.login(CREDENCIAIS);
      await servico.login(CREDENCIAIS);

      expect(sessoes.criar).toHaveBeenCalledTimes(2);
      expect(sessoes.criar).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ tenantId: TENANT, usuarioId: USUARIO })
      );
    });

    it('assina access e refresh com tipo, sessao, emissor e audiencia distintos', async () => {
      const { servico, jwt } = cenarioLoginValido();

      await servico.login(CREDENCIAIS);

      const [payloadAcesso, opcoesAcesso] = jwt.signAsync.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>];
      const [payloadRenovacao, opcoesRenovacao] = jwt.signAsync.mock.calls[1] as [Record<string, unknown>, Record<string, unknown>];

      expect(payloadAcesso).toMatchObject({ tipo: TIPO_TOKEN_ACESSO, sid: SESSAO, sub: USUARIO, tenantId: TENANT });
      expect(payloadRenovacao).toMatchObject({ tipo: TIPO_TOKEN_RENOVACAO, sid: SESSAO });
      expect(opcoesAcesso).toMatchObject({ algorithm: 'HS256', issuer: 'octaclin', audience: 'octaclin-api' });
      expect(opcoesRenovacao).toMatchObject({ algorithm: 'HS256' });
      expect(opcoesAcesso.secret).not.toBe(opcoesRenovacao.secret);
      expect(opcoesAcesso.jwtid).not.toBe(opcoesRenovacao.jwtid);
    });

    it('propaga no access token a garantia MFA persistida na sessao', async () => {
      const { servico, jwt } = criarServico({
        sessao: sessaoAtiva({ mfaVerificadoEm: new Date('2026-08-29T12:00:00.000Z') }),
        usuario: USUARIO_ATIVO
      });

      await servico.renovar({ refreshToken: 'refresh' });

      expect(jwt.signAsync.mock.calls[0][0]).toMatchObject({ mfa: true });
      expect(jwt.signAsync.mock.calls[1][0]).not.toHaveProperty('mfa');
    });

    it('nao coloca papel, permissoes nem emailHash dentro do refresh token', async () => {
      const { servico, jwt } = cenarioLoginValido();

      await servico.login(CREDENCIAIS);

      const payloadRenovacao = jwt.signAsync.mock.calls[1][0] as Record<string, unknown>;
      expect(payloadRenovacao).not.toHaveProperty('papel');
      expect(payloadRenovacao).not.toHaveProperty('permissoes');
      expect(payloadRenovacao).not.toHaveProperty('emailHash');
    });

    it('persiste apenas o hash do refresh token, vinculado a sessao', async () => {
      const { servico, tokensSalvos } = cenarioLoginValido();

      const resposta = await servico.login(CREDENCIAIS);
      if (!('refreshToken' in resposta)) throw new Error('Cenario deveria emitir tokens.');

      expect(tokensSalvos).toHaveLength(1);
      expect(tokensSalvos[0]).toMatchObject({ sessaoId: SESSAO, familiaToken: SESSAO, usuarioId: USUARIO });
      expect(tokensSalvos[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(tokensSalvos[0].tokenHash).not.toBe(resposta.refreshToken);
      expect(JSON.stringify(tokensSalvos[0])).not.toContain(resposta.refreshToken);
    });

    it('devolve as duracoes reais de access e renovacao em vez de valores fixos', async () => {
      process.env.JWT_EXPIRA_EM = '7m';
      process.env.JWT_REFRESH_EXPIRA_EM = '3d';
      const { servico } = cenarioLoginValido();

      await expect(servico.login(CREDENCIAIS)).resolves.toMatchObject({
        expiraEmSegundos: 420,
        renovacaoExpiraEmSegundos: 259200
      });
    });

    it('rejeita duracao JWT invalida vinda do ambiente', async () => {
      process.env.JWT_EXPIRA_EM = 'duracao-invalida';
      const { servico } = cenarioLoginValido();

      await expect(servico.login(CREDENCIAIS)).rejects.toThrow('duracao de expiracao JWT');
    });
  });

  describe('renovacao', () => {
    it('recusa e revoga sessao privilegiada criada sem MFA', async () => {
      const { servico, sessoes, tokensSalvos } = criarServico({
        sessao: sessaoAtiva({ mfaVerificadoEm: null }),
        usuario: USUARIO_ATIVO
      });

      await expect(servico.renovar({ refreshToken: 'refresh' })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessoes.revogar).toHaveBeenCalledWith(TENANT, USUARIO, SESSAO, 'mfa_obrigatorio');
      expect(tokensSalvos).toHaveLength(0);
    });

    it('permite renovar sessao sem MFA para perfil nao privilegiado', async () => {
      const { servico } = criarServico({
        sessao: sessaoAtiva({ mfaVerificadoEm: null }),
        usuario: { ...USUARIO_ATIVO, role: 'Patient' }
      });

      await expect(servico.renovar({ refreshToken: 'refresh' })).resolves.toHaveProperty('accessToken');
    });
    it('verifica o refresh token com o tipo e a lista de algoritmos corretos', async () => {
      const { servico, jwt } = criarServico({
        sessao: sessaoAtiva(),
        usuario: USUARIO_ATIVO
      });

      await servico.renovar({ refreshToken: 'refresh' });

      expect(jwt.verifyAsync).toHaveBeenCalledWith(
        'refresh',
        expect.objectContaining({ algorithms: ['HS256'], issuer: 'octaclin', audience: 'octaclin-api' })
      );
    });

    it('recusa access token apresentado como refresh', async () => {
      const { servico, sessoes } = criarServico({
        claimsRenovacao: {
          sub: USUARIO,
          tenantId: TENANT,
          sid: SESSAO,
          jti: 'jti-1',
          tipo: TIPO_TOKEN_ACESSO,
          iat: 1,
          exp: 2,
          papel: 'Professional',
          emailHash: 'hash'
        }
      });

      await expect(servico.renovar({ refreshToken: 'access' })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessoes.revogarPorReuso).not.toHaveBeenCalled();
    });

    it('recusa token com assinatura, emissor ou audiencia invalidos', async () => {
      const { servico } = criarServico({ verifyLanca: true });

      await expect(servico.renovar({ refreshToken: 'adulterado' })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('consome o token de forma condicional e atomica antes de emitir o descendente', async () => {
      const { servico, construtorConsulta } = criarServico({ sessao: sessaoAtiva(), usuario: USUARIO_ATIVO });

      await servico.renovar({ refreshToken: 'refresh' });

      const condicoes = construtorConsulta.andWhere.mock.calls.map((chamada: unknown[]) => String(chamada[0]));
      expect(condicoes).toEqual(expect.arrayContaining(['consumido_em is null', 'revogado_em is null']));
      expect(construtorConsulta.execute).toHaveBeenCalledTimes(1);
    });

    it('emite um unico descendente por rotacao', async () => {
      const { servico, tokensSalvos } = criarServico({ sessao: sessaoAtiva(), usuario: USUARIO_ATIVO });

      await servico.renovar({ refreshToken: 'refresh' });

      expect(tokensSalvos).toHaveLength(1);
    });

    it('revoga a familia inteira quando o token ja havia sido consumido', async () => {
      const { servico, sessoes } = criarServico({
        consumoAfetado: 0,
        tokenPersistido: { consumidoEm: new Date('2026-08-01T10:00:00.000Z') }
      });

      await expect(servico.renovar({ refreshToken: 'refresh' })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessoes.revogarPorReuso).toHaveBeenCalledWith(TENANT, USUARIO, SESSAO);
    });

    it('revoga a familia inteira quando o token ja havia sido revogado', async () => {
      const { servico, sessoes } = criarServico({
        consumoAfetado: 0,
        tokenPersistido: { revogadoEm: new Date('2026-08-01T10:00:00.000Z') }
      });

      await expect(servico.renovar({ refreshToken: 'refresh' })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessoes.revogarPorReuso).toHaveBeenCalled();
    });

    it('nao revoga a familia quando o token apenas expirou sem ter sido usado', async () => {
      const { servico, sessoes } = criarServico({
        consumoAfetado: 0,
        tokenPersistido: { consumidoEm: null, revogadoEm: null } as Partial<RefreshTokenOrm>
      });

      await expect(servico.renovar({ refreshToken: 'refresh' })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessoes.revogarPorReuso).not.toHaveBeenCalled();
    });

    it('nao revoga a familia quando o token nunca existiu no banco', async () => {
      const { servico, sessoes } = criarServico({ consumoAfetado: 0, tokenPersistido: null });

      await expect(servico.renovar({ refreshToken: 'refresh' })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessoes.revogarPorReuso).not.toHaveBeenCalled();
    });

    it('recusa rotacao quando a sessao esta revogada', async () => {
      const { servico, tokensSalvos } = criarServico({
        sessao: sessaoAtiva({ revogadoEm: new Date('2026-08-01T10:00:00.000Z') }),
        usuario: USUARIO_ATIVO
      });

      await expect(servico.renovar({ refreshToken: 'refresh' })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokensSalvos).toHaveLength(0);
    });

    it('recusa rotacao quando o usuario foi desativado', async () => {
      const { servico } = criarServico({ sessao: sessaoAtiva(), usuario: undefined });

      await expect(servico.renovar({ refreshToken: 'refresh' })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('escopa a busca do token ao tenant e ao usuario das claims', async () => {
      const { servico, repositorioTokens } = criarServico({ consumoAfetado: 0, tokenPersistido: null });

      await expect(servico.renovar({ refreshToken: 'refresh' })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repositorioTokens.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT, usuarioId: USUARIO }) })
      );
    });
  });

  describe('logout e sessoes', () => {
    it('logout encerra a sessao inteira, nao apenas o refresh apresentado', async () => {
      const { servico, sessoes } = criarServico();

      await servico.revogar('refresh');

      expect(sessoes.revogar).toHaveBeenCalledWith(TENANT, USUARIO, SESSAO, 'logout');
    });

    it('logout recusa token que nao seja de renovacao', async () => {
      const { servico, sessoes } = criarServico({
        claimsRenovacao: {
          sub: USUARIO,
          tenantId: TENANT,
          sid: SESSAO,
          jti: 'jti',
          tipo: TIPO_TOKEN_ACESSO,
          iat: 1,
          exp: 2,
          papel: 'Professional',
          emailHash: 'hash'
        }
      });

      await expect(servico.revogar('access')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessoes.revogar).not.toHaveBeenCalled();
    });

    it('lista e encerra sempre no escopo do usuario autenticado', async () => {
      const { servico, sessoes } = criarServico();
      const usuario = {
        usuarioId: USUARIO,
        tenantId: TENANT,
        papel: 'Professional' as const,
        emailHash: 'hash',
        permissoes: [],
        sessaoId: SESSAO
      };

      await servico.listarSessoes(usuario, 2);
      await servico.encerrarSessao(usuario, 'a'.repeat(32));
      await servico.encerrarOutrasSessoes(usuario);
      await servico.encerrarTodasSessoes(usuario);
      await servico.limparHistoricoSessoes(usuario);

      expect(sessoes.listar).toHaveBeenCalledWith(TENANT, USUARIO, SESSAO, 2);
      expect(sessoes.encerrarPorReferencia).toHaveBeenCalledWith(TENANT, USUARIO, 'a'.repeat(32));
      expect(sessoes.encerrarOutras).toHaveBeenCalledWith(TENANT, USUARIO, SESSAO);
      expect(sessoes.revogarTodas).toHaveBeenCalledWith(TENANT, USUARIO, 'encerrada_pelo_usuario');
      expect(sessoes.limparHistorico).toHaveBeenCalledWith(TENANT, USUARIO);
    });

    it('recusa operacao de sessao quando o contexto nao identifica a sessao atual', async () => {
      const { servico } = criarServico();
      const usuario = {
        usuarioId: USUARIO,
        tenantId: TENANT,
        papel: 'Professional' as const,
        emailHash: 'hash',
        permissoes: []
      };

      expect(() => servico.listarSessoes(usuario)).toThrow(UnauthorizedException);
      await expect(servico.encerrarOutrasSessoes(usuario)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(servico.encerrarTodasSessoes(usuario)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(servico.limparHistoricoSessoes(usuario)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('trilha de auditoria', () => {
    let avisos: jest.SpyInstance;

    beforeEach(() => {
      avisos = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      avisos.mockRestore();
    });

    it('registra auth.login.sucesso com o tenant, o usuario e a sessao emitida', async () => {
      const { servico, auditoria } = cenarioLoginValido();

      await servico.login(CREDENCIAIS);

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'auth.login.sucesso',
          tenantId: TENANT,
          usuarioId: USUARIO,
          recursoTipo: 'sessao_usuario',
          recursoId: SESSAO
        })
      );
    });

    it('registra auth.login.falha na trilha quando o usuario existe e a senha nao confere', async () => {
      const { servico, auditoria } = criarServico({
        tenant: { id: TENANT, slug: 'clinica-carla', status: 'ativo' },
        usuario: USUARIO_ATIVO
      });

      await expect(servico.login(CREDENCIAIS)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: 'auth.login.falha', tenantId: TENANT, usuarioId: USUARIO })
      );
    });

    it('registra auth.sessao.encerrada com a sessao encerrada', async () => {
      const { servico, auditoria } = criarServico();

      await servico.revogar('refresh');

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: 'auth.sessao.encerrada', tenantId: TENANT, usuarioId: USUARIO, recursoId: SESSAO })
      );
    });

    it('registra auth.token.renovado a cada rotacao bem sucedida', async () => {
      const { servico, auditoria } = criarServico({ sessao: sessaoAtiva(), usuario: USUARIO_ATIVO });

      await servico.renovar({ refreshToken: 'refresh' });

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: 'auth.token.renovado', tenantId: TENANT, usuarioId: USUARIO, recursoId: SESSAO })
      );
    });

    it('nao escreve na trilha quando o tenant do login nao existe', async () => {
      const { servico, auditoria } = criarServico();

      await expect(servico.login(CREDENCIAIS)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(auditoria.registrar).not.toHaveBeenCalled();
      expect(avisos).toHaveBeenCalledWith(
        expect.objectContaining({ evento: 'auth.login.falha', motivo: 'tenant_inexistente' })
      );
    });

    it('nao escreve na trilha quando o e-mail nao corresponde a nenhum usuario do tenant', async () => {
      const { servico, auditoria } = criarServico({
        tenant: { id: TENANT, slug: 'clinica-carla', status: 'ativo' },
        usuario: undefined
      });

      await expect(servico.login(CREDENCIAIS)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(auditoria.registrar).not.toHaveBeenCalled();
      expect(avisos).toHaveBeenCalledWith(
        expect.objectContaining({ evento: 'auth.login.falha', motivo: 'usuario_inexistente', tenantId: TENANT })
      );
    });

    it('nao deixa senha, e-mail nem slug do tenant vazarem na falha de login com usuario conhecido', async () => {
      const { servico, auditoria } = criarServico({
        tenant: { id: TENANT, slug: 'clinica-carla', status: 'ativo' },
        usuario: USUARIO_ATIVO
      });

      await expect(servico.login(CREDENCIAIS)).rejects.toBeInstanceOf(UnauthorizedException);

      const trilha = JSON.stringify(auditoria.registrar.mock.calls);
      expect(trilha).not.toContain(CREDENCIAIS.senha);
      expect(trilha).not.toContain(CREDENCIAIS.email);
      expect(trilha).not.toContain(USUARIO_ATIVO.senhaHash);
      expect(trilha).not.toContain(USUARIO_ATIVO.emailHash);
    });

    it('nao deixa senha, e-mail nem slug do tenant vazarem no log da falha anonima', async () => {
      const { servico } = criarServico({
        tenant: { id: TENANT, slug: 'clinica-carla', status: 'ativo' },
        usuario: undefined
      });

      await expect(servico.login(CREDENCIAIS)).rejects.toBeInstanceOf(UnauthorizedException);

      const registrado = JSON.stringify(avisos.mock.calls);
      expect(registrado).not.toContain(CREDENCIAIS.senha);
      expect(registrado).not.toContain(CREDENCIAIS.email);
      expect(registrado).not.toContain(CREDENCIAIS.tenantSlug);
    });

    it('nao deixa o refresh token entrar na trilha de rotacao nem de logout', async () => {
      const { servico, auditoria } = criarServico({ sessao: sessaoAtiva(), usuario: USUARIO_ATIVO });

      await servico.renovar({ refreshToken: 'refresh-secreto-do-teste' });
      await servico.revogar('refresh-secreto-do-teste');

      expect(JSON.stringify(auditoria.registrar.mock.calls)).not.toContain('refresh-secreto-do-teste');
    });

    it('mantem o 401 da falha de login quando a trilha esta indisponivel', async () => {
      const { servico, auditoria } = criarServico({
        tenant: { id: TENANT, slug: 'clinica-carla', status: 'ativo' },
        usuario: USUARIO_ATIVO,
        auditoriaLanca: true
      });

      await expect(servico.login(CREDENCIAIS)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(auditoria.registrar).toHaveBeenCalled();
    });

    it('conclui o login legitimo mesmo quando a trilha esta indisponivel', async () => {
      const { servico, auditoria } = cenarioLoginValido({ auditoriaLanca: true });

      await expect(servico.login(CREDENCIAIS)).resolves.toHaveProperty('accessToken');
      expect(auditoria.registrar).toHaveBeenCalled();
    });

    it('conclui logout e rotacao mesmo quando a trilha esta indisponivel', async () => {
      const { servico } = criarServico({
        sessao: sessaoAtiva(),
        usuario: USUARIO_ATIVO,
        auditoriaLanca: true
      });

      await expect(servico.renovar({ refreshToken: 'refresh' })).resolves.toHaveProperty('accessToken');
      await expect(servico.revogar('refresh')).resolves.toBeUndefined();
    });

    /**
     * EXC-AUD-002: antes da fase 2, `auth.login.sucesso` era o unico evento de
     * auth sem teto. O `ProtecaoAbuso` contem o atacante, nao o cliente
     * legitimo em laco -- e cada linha em `user_action_logs` e custo
     * permanente, porque a tabela e append-only e entra em backup.
     *
     * Os testes abaixo cercam a assimetria que o teto nao pode quebrar: pode
     * gravar de novo, nunca pode deixar de gravar um login distinto.
     */
    describe('teto de escrita de auth.login.sucesso', () => {
      const INSTANTE = Date.parse('2026-09-03T10:00:00.000Z');
      const JANELA_MS = 60_000;
      let relogio: jest.SpyInstance<number, []>;

      beforeEach(() => {
        // `emitirSessaoUsuario` le o relogio por dentro; congelar `Date.now` e o
        // que permite provar expiracao de janela sem esperar um minuto real.
        relogio = jest.spyOn(Date, 'now').mockReturnValue(INSTANTE);
      });

      afterEach(() => {
        relogio.mockRestore();
      });

      it('colapsa o laco de login do mesmo usuario em uma unica escrita por janela', async () => {
        const { servico, auditoria } = cenarioLoginValido();

        await servico.login(CREDENCIAIS);
        await servico.login(CREDENCIAIS);
        await servico.login(CREDENCIAIS);

        expect(escritasDeLoginSucesso(auditoria)).toHaveLength(1);
      });

      it('continua abrindo sessao propria no login que a trilha suprimiu', async () => {
        const { servico, sessoes, auditoria } = cenarioLoginValido();

        await servico.login(CREDENCIAIS);
        await servico.login(CREDENCIAIS);

        // A supressao e da linha de trilha, e nao do fato: cada login continua
        // com linha propria em `sessoes_usuario`. Isso e compensacao parcial e
        // nao evidencia equivalente -- `sessoes_usuario` aceita UPDATE, nao
        // recebeu o gatilho de imutabilidade da migration `1720000001038` e nao
        // guarda IP nem user agent (ver o bloco em `servico-auth.ts`).
        expect(sessoes.criar).toHaveBeenCalledTimes(2);
        expect(escritasDeLoginSucesso(auditoria)).toHaveLength(1);
      });

      /**
       * A prova de que a janela e estado de **modulo**, e nao de instancia.
       *
       * Os demais testes deste bloco passariam iguais se `janelaLoginSucesso`
       * virasse campo de `ServicoAuth`: o de colapso usa uma instancia so, e os
       * de nao-supressao afirmam que a segunda instancia grava -- o que uma
       * janela por instancia tambem faria. Aqui as duas instancias veem o mesmo
       * tenant, o mesmo usuario e o mesmo estado de MFA, entao a segunda so
       * pode ficar em silencio se o estado for compartilhado. Com janela por
       * instancia o teto passaria a valer por instancia, que e o mesmo defeito
       * que a fase 1 encontrou no contador de falhas lido por instancia.
       */
      it('mantem a janela por modulo: outra instancia nao regrava o mesmo login', async () => {
        const primeira = cenarioLoginValido();
        await primeira.servico.login(CREDENCIAIS);

        const segunda = cenarioLoginValido();
        await segunda.servico.login(CREDENCIAIS);

        expect(escritasDeLoginSucesso(segunda.auditoria)).toHaveLength(0);
        // A instancia nova continua abrindo a sessao: o que a janela cala e a
        // linha de trilha, e nunca o login.
        expect(segunda.sessoes.criar).toHaveBeenCalledTimes(1);
      });

      it('nao suprime o login de outro usuario dentro da mesma janela', async () => {
        const primeiro = cenarioLoginValido();
        await primeiro.servico.login(CREDENCIAIS);

        const segundo = cenarioLoginValido({
          usuario: { ...USUARIO_NAO_PRIVILEGIADO, id: 'usuario-2' }
        });
        await segundo.servico.login(CREDENCIAIS);

        expect(escritasDeLoginSucesso(segundo.auditoria)).toHaveLength(1);
      });

      it('nao suprime o login do mesmo usuario em outro tenant dentro da mesma janela', async () => {
        const primeiro = cenarioLoginValido();
        await primeiro.servico.login(CREDENCIAIS);

        const segundo = cenarioLoginValido({
          usuario: { ...USUARIO_NAO_PRIVILEGIADO, tenantId: 'tenant-2' }
        });
        await segundo.servico.login(CREDENCIAIS);

        expect(escritasDeLoginSucesso(segundo.auditoria)).toHaveLength(1);
      });

      it('nao suprime o primeiro login com MFA verificado logo depois de um login sem MFA', async () => {
        const { servico, auditoria } = cenarioLoginValido();

        await servico.login(CREDENCIAIS);
        await servico.emitirSessaoUsuario(
          USUARIO_NAO_PRIVILEGIADO as UsuarioOrm,
          new Date('2026-09-03T10:00:00.000Z')
        );

        const escritas = escritasDeLoginSucesso(auditoria);
        expect(escritas).toHaveLength(2);
        expect(escritas[1].metadados).toMatchObject({ mfaVerificado: true });
      });

      it('volta a gravar quando a janela expira e reporta o residual suprimido', async () => {
        const { servico, auditoria } = cenarioLoginValido();

        await servico.login(CREDENCIAIS);
        await servico.login(CREDENCIAIS);
        await servico.login(CREDENCIAIS);

        relogio.mockReturnValue(INSTANTE + JANELA_MS);
        await servico.login(CREDENCIAIS);

        const escritas = escritasDeLoginSucesso(auditoria);
        expect(escritas).toHaveLength(2);
        expect(escritas[1].metadados).toEqual({ mfaVerificado: false, loginsSuprimidos: 2 });
      });

      it('nao grava loginsSuprimidos quando nada foi suprimido', async () => {
        const { servico, auditoria } = cenarioLoginValido();

        await servico.login(CREDENCIAIS);

        // Campo constante nao carrega informacao: o formato normal do evento
        // continua sendo o de antes do teto.
        expect(escritasDeLoginSucesso(auditoria)[0].metadados).toEqual({ mfaVerificado: false });
      });

      it('volta a gravar quando a trilha engoliu a falha da escrita anterior', async () => {
        const { servico, auditoria } = cenarioLoginValido({ auditoriaFalhaSilenciosa: true });

        await servico.login(CREDENCIAIS);
        await servico.login(CREDENCIAIS);

        // Nenhuma das duas chegou ao banco. Confirmar a janela em cima de uma
        // linha que nao existe transformaria o teto em perda de evidencia.
        expect(escritasDeLoginSucesso(auditoria)).toHaveLength(2);
      });

      it('volta a gravar quando a escrita anterior rejeitou', async () => {
        const { servico, auditoria } = cenarioLoginValido({ auditoriaLanca: true });

        await servico.login(CREDENCIAIS);
        await servico.login(CREDENCIAIS);

        expect(escritasDeLoginSucesso(auditoria)).toHaveLength(2);
      });

      it('nao deixa o teto alterar o desfecho do login', async () => {
        const { servico } = cenarioLoginValido();

        await servico.login(CREDENCIAIS);

        await expect(servico.login(CREDENCIAIS)).resolves.toHaveProperty('accessToken');
      });

      it('nao transforma excecao da contabilidade do teto em falha do login', async () => {
        const { servico } = cenarioLoginValido({ contadorFalhasLancaAposEscrita: true });

        // A sessao ja foi criada e os tokens ja foram assinados quando a
        // contabilidade roda. Deixar a excecao subir daqui recusaria acesso
        // legitimo por causa de contagem de volume da trilha -- o mesmo
        // desfecho que a barreira do caminho de 403 ja impede.
        await expect(servico.login(CREDENCIAIS)).resolves.toHaveProperty('accessToken');
      });

      it('devolve a chave a janela quando a contabilidade do teto lanca', async () => {
        const { servico, auditoria } = cenarioLoginValido({ contadorFalhasLancaAposEscrita: true });

        await servico.login(CREDENCIAIS);
        await servico.login(CREDENCIAIS);

        // Sem a liberacao no `catch` a reserva do primeiro login sobreviveria e
        // calaria o segundo pelos 60 s da janela: absorver a excecao nao pode
        // custar evidencia.
        expect(escritasDeLoginSucesso(auditoria)).toHaveLength(2);
      });
    });
  });
});

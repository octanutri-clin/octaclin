import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { TIPO_TOKEN_ACESSO, TIPO_TOKEN_RENOVACAO } from '../dominio/claims-token';
import { RefreshTokenOrm } from '../infraestrutura/refresh-token.orm';
import { SessaoUsuarioOrm } from '../infraestrutura/sessao-usuario.orm';
import { ServicoAuth } from './servico-auth';

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

  return {
    servico: new ServicoAuth(
      fonteDados as never,
      executorTenant as never,
      jwt as never,
      senhas as never,
      criptografia as never,
      protecaoAbuso as never,
      sessoes as never,
      mfa as never
    ),
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

const CHAVES_AMBIENTE = ['JWT_EXPIRA_EM', 'JWT_REFRESH_EXPIRA_EM'] as const;

describe('ServicoAuth', () => {
  let snapshot: Map<string, string | undefined>;

  beforeEach(() => {
    snapshot = new Map(CHAVES_AMBIENTE.map((nome) => [nome, process.env[nome]]));
    for (const nome of CHAVES_AMBIENTE) delete process.env[nome];
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
});

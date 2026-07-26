import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { RefreshTokenOrm } from '../infraestrutura/refresh-token.orm';
import { ServicoAuth } from './servico-auth';

function criarRepositorioFake(nome: string, dados: Record<string, any>) {
  const itens: Record<string, any>[] = dados[`${nome}s`] ?? [];
  return {
    create: jest.fn((entrada: Record<string, unknown>) => entrada),
    save: jest.fn(async (entrada: Record<string, any>) => {
      itens.push(entrada);
      return entrada;
    }),
    findOne: jest.fn(async () => {
      if (nome === 'tenant') return dados.tenant ?? null;
      if (nome === 'usuario') return dados.usuario ?? null;
      return null;
    })
  };
}

function criarServico(dados: Record<string, any> = {}) {
  const repositorios = {
    tenant: criarRepositorioFake('tenant', dados),
    usuario: criarRepositorioFake('usuario', dados),
    refreshToken: criarRepositorioFake('refreshToken', dados)
  };
  const fonteDados = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === TenantOrm) return repositorios.tenant;
      throw new Error(`Repositorio global nao mapeado: ${entidade.name}`);
    })
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === UsuarioOrm) return repositorios.usuario;
      if (entidade === RefreshTokenOrm) return repositorios.refreshToken;
      throw new Error(`Repositorio tenant nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };
  const jwt = {
    signAsync: jest.fn(async () => 'jwt-token'),
    verifyAsync: jest.fn()
  };
  const senhas = {
    verificar: jest.fn(() => dados.senhaValida ?? false)
  };
  const criptografia = {
    gerarHashBusca: jest.fn((valor: string) => `hash:${valor.trim().toLowerCase()}`)
  };
  const protecaoAbuso = dados.protecaoAbuso ?? {
    verificarDisponibilidade: jest.fn(),
    registrarFalha: jest.fn(),
    registrarSucesso: jest.fn()
  };

  return {
    servico: new ServicoAuth(
      fonteDados as never,
      executorTenant as never,
      jwt as never,
      senhas as never,
      criptografia as never,
      protecaoAbuso as never
    ),
    repositorios,
    jwt,
    senhas,
    protecaoAbuso
  };
}

describe('ServicoAuth', () => {
  it('deve bloquear login abusivo antes de consultar tenant e credenciais', async () => {
    const protecaoAbuso = {
      verificarDisponibilidade: jest.fn(() => {
        throw new HttpException('Muitas tentativas de login. Tente novamente em alguns minutos.', HttpStatus.TOO_MANY_REQUESTS);
      }),
      registrarFalha: jest.fn(),
      registrarSucesso: jest.fn()
    };
    const { servico, repositorios } = criarServico({ protecaoAbuso });

    await expect(
      servico.login({
        tenantSlug: 'clinica-carla',
        email: 'ana@example.com',
        senha: 'SenhaInvalida123'
      })
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });

    expect(protecaoAbuso.verificarDisponibilidade).toHaveBeenCalledWith(
      'login:clinica-carla:ana@example.com',
      expect.objectContaining({ maxTentativas: 5 })
    );
    expect(repositorios.tenant.findOne).not.toHaveBeenCalled();
  });

  it('deve registrar falha quando senha for invalida', async () => {
    const { servico, protecaoAbuso } = criarServico({
      tenant: { id: 'tenant-1', slug: 'clinica-carla', status: 'ativo' },
      usuario: { id: 'usuario-1', tenantId: 'tenant-1', emailHash: 'hash:ana@example.com', senhaHash: 'hash-senha', ativo: true }
    });

    await expect(
      servico.login({
        tenantSlug: 'clinica-carla',
        email: 'ana@example.com',
        senha: 'SenhaInvalida123'
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(protecaoAbuso.registrarFalha).toHaveBeenCalledWith(
      'login:clinica-carla:ana@example.com',
      expect.objectContaining({ maxTentativas: 5 })
    );
    expect(protecaoAbuso.registrarSucesso).not.toHaveBeenCalled();
  });

  it('deve assinar os tokens com as expiracoes padrao validas', async () => {
    const { servico, jwt } = criarServico({
      tenant: { id: 'tenant-1', slug: 'clinica-carla', status: 'ativo' },
      usuario: {
        id: 'usuario-1',
        tenantId: 'tenant-1',
        emailHash: 'hash:ana@example.com',
        senhaHash: 'hash-senha',
        ativo: true,
        role: 'Professional'
      },
      senhaValida: true
    });
    const senhaAnterior = process.env.JWT_EXPIRA_EM;
    const refreshAnterior = process.env.JWT_REFRESH_EXPIRA_EM;
    delete process.env.JWT_EXPIRA_EM;
    delete process.env.JWT_REFRESH_EXPIRA_EM;

    try {
      await servico.login({
        tenantSlug: 'clinica-carla',
        email: 'ana@example.com',
        senha: 'SenhaValida123'
      });
    } finally {
      if (senhaAnterior === undefined) delete process.env.JWT_EXPIRA_EM;
      else process.env.JWT_EXPIRA_EM = senhaAnterior;
      if (refreshAnterior === undefined) delete process.env.JWT_REFRESH_EXPIRA_EM;
      else process.env.JWT_REFRESH_EXPIRA_EM = refreshAnterior;
    }

    expect(jwt.signAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sub: 'usuario-1' }),
      expect.objectContaining({ expiresIn: '15m' })
    );
    expect(jwt.signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sub: 'usuario-1' }),
      expect.objectContaining({ expiresIn: '30d' })
    );
  });

  it('deve rejeitar duracao JWT invalida vinda do ambiente', async () => {
    const { servico } = criarServico({
      tenant: { id: 'tenant-1', slug: 'clinica-carla', status: 'ativo' },
      usuario: {
        id: 'usuario-1',
        tenantId: 'tenant-1',
        emailHash: 'hash:ana@example.com',
        senhaHash: 'hash-senha',
        ativo: true,
        role: 'Professional'
      },
      senhaValida: true
    });
    const expiracaoAnterior = process.env.JWT_EXPIRA_EM;
    process.env.JWT_EXPIRA_EM = 'duracao-invalida';

    try {
      await expect(
        servico.login({
          tenantSlug: 'clinica-carla',
          email: 'ana@example.com',
          senha: 'SenhaValida123'
        })
      ).rejects.toThrow('duracao de expiracao JWT');
    } finally {
      if (expiracaoAnterior === undefined) delete process.env.JWT_EXPIRA_EM;
      else process.env.JWT_EXPIRA_EM = expiracaoAnterior;
    }
  });
});

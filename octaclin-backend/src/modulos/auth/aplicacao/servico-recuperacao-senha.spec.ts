import { GoneException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ServicoSenhas } from '../../../infraestrutura/seguranca/servico-senhas';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { TokenRedefinicaoSenhaOrm } from '../infraestrutura/token-redefinicao-senha.orm';
import { ServicoRecuperacaoSenha } from './servico-recuperacao-senha';

function criarRepositorioFake(nome: string, dados: Record<string, any>) {
  const itens: Record<string, any>[] = dados[`${nome}s`] ?? [];
  return {
    create: jest.fn((entrada: Record<string, unknown>) => entrada),
    save: jest.fn(async (entrada: Record<string, any>) => {
      const salvo = { id: entrada.id ?? `${nome}-${itens.length + 1}`, criadoEm: new Date(), ...entrada };
      const indice = itens.findIndex((item) => item.id === salvo.id);
      if (indice >= 0) itens[indice] = salvo;
      else itens.push(salvo);
      return salvo;
    }),
    update: jest.fn(async (where: Record<string, unknown>, patch: Record<string, unknown>) => {
      const item = itens.find((atual) => Object.entries(where).every(([chave, valor]) => atual[chave] === valor));
      if (item) Object.assign(item, patch);
      return { affected: item ? 1 : 0 };
    }),
    findOne: jest.fn(async (consulta: { where: Record<string, unknown> }) => {
      if (nome === 'tenant') return dados.tenant ?? null;
      if (nome === 'usuario') return dados.usuario ?? null;
      return itens.find((item) => Object.entries(consulta.where).every(([chave, valor]) => item[chave] === valor)) ?? null;
    })
  };
}

function criarServico(dados: Record<string, any> = {}) {
  const repositorios = {
    tenant: criarRepositorioFake('tenant', dados),
    usuario: criarRepositorioFake('usuario', dados),
    token: criarRepositorioFake('token', dados)
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
      if (entidade === TokenRedefinicaoSenhaOrm) return repositorios.token;
      throw new Error(`Repositorio tenant nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };
  const criptografia = {
    gerarHashBusca: jest.fn((valor: string) => `hash:${valor.trim().toLowerCase()}`),
    criptografar: jest.fn((valor: string) => Buffer.from(`cripto:${valor}`)),
    descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8').replace('cripto:', ''))
  };
  const senhas = {
    gerarHash: jest.fn((senha: string) => `senha:${senha}`)
  } as unknown as ServicoSenhas;
  const email = { enviar: jest.fn(async () => ({ idExterno: 'email-1' })) };
  const protecaoAbuso = dados.protecaoAbuso ?? {
    consumirTentativa: jest.fn()
  };

  return {
    servico: new ServicoRecuperacaoSenha(
      fonteDados as never,
      executorTenant as never,
      criptografia as never,
      senhas,
      email as never,
      protecaoAbuso as never
    ),
    repositorios,
    dados,
    email,
    protecaoAbuso
  };
}

describe('ServicoRecuperacaoSenha', () => {
  beforeEach(() => {
    process.env.OCTACLIN_WEB_URL = 'https://app.octaclin.test';
    process.env.NODE_ENV = 'development';
  });

  it('deve responder genericamente quando tenant ou usuario nao existir', async () => {
    const { servico, repositorios, email } = criarServico({});

    const resposta = await servico.solicitarRecuperacao({
      tenantSlug: 'clinica-carla',
      email: 'naoexiste@example.com'
    });

    expect(resposta.mensagem).toBe('Se os dados estiverem corretos, enviaremos um link de redefinicao de senha.');
    expect(resposta.linkRecuperacao).toBeUndefined();
    expect(repositorios.token.save).not.toHaveBeenCalled();
    expect(email.enviar).not.toHaveBeenCalled();
  });

  it('deve limitar abuso de recuperacao antes de consultar dados do tenant', async () => {
    const protecaoAbuso = {
      consumirTentativa: jest.fn(() => {
        throw new HttpException('Muitas solicitacoes. Tente novamente em alguns minutos.', HttpStatus.TOO_MANY_REQUESTS);
      })
    };
    const { servico, repositorios, email } = criarServico({ protecaoAbuso });

    await expect(
      servico.solicitarRecuperacao({
        tenantSlug: 'clinica-carla',
        email: 'ana@example.com'
      })
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });

    expect(protecaoAbuso.consumirTentativa).toHaveBeenCalledWith(
      'recuperacao-senha:clinica-carla:ana@example.com',
      expect.objectContaining({ maxTentativas: 3 })
    );
    expect(repositorios.tenant.findOne).not.toHaveBeenCalled();
    expect(email.enviar).not.toHaveBeenCalled();
  });

  it('deve criar token com hash, expirar em uma hora e enviar email quando usuario existir', async () => {
    const { servico, repositorios, email } = criarServico({
      tenant: { id: 'tenant-1', slug: 'clinica-carla', status: 'ativo' },
      usuario: {
        id: 'usuario-1',
        tenantId: 'tenant-1',
        emailHash: 'hash:ana@example.com',
        emailCriptografado: Buffer.from('cripto:ana@example.com'),
        ativo: true
      },
      tokens: []
    });

    const resposta = await servico.solicitarRecuperacao({
      tenantSlug: 'clinica-carla',
      email: 'ana@example.com'
    });

    expect(resposta.linkRecuperacao).toMatch(/^https:\/\/app\.octaclin\.test\/recuperar-senha\?token=/);
    expect(repositorios.token.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-1',
        emailHash: 'hash:ana@example.com',
        tokenHash: expect.any(String)
      })
    );
    expect(repositorios.token.save.mock.calls[0][0].tokenHash).not.toContain('tenant-1.');
    expect(email.enviar).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          destino: 'ana@example.com',
          linkRecuperacao: resposta.linkRecuperacao
        })
      })
    );
  });

  it('deve validar token pendente sem expor hash', async () => {
    const { servico } = criarServico({
      tokens: [
        {
          id: 'token-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-1',
          emailHash: 'hash:ana@example.com',
          tokenHash: 'hash-token',
          status: 'pendente',
          expiraEm: new Date(Date.now() + 60_000)
        }
      ],
      usuario: { id: 'usuario-1', tenantId: 'tenant-1', emailCriptografado: Buffer.from('cripto:ana@example.com') }
    });
    jest.spyOn(ServicoRecuperacaoSenha, 'hashToken').mockReturnValueOnce('hash-token');

    await expect(servico.validarToken('tenant-1.qualquer')).resolves.toEqual({
      email: 'ana@example.com',
      expiraEm: expect.any(Date)
    });
  });

  it('deve redefinir senha e consumir token', async () => {
    const dados: Record<string, any> = {
      tokens: [
        {
          id: 'token-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-1',
          emailHash: 'hash:ana@example.com',
          tokenHash: 'hash-token',
          status: 'pendente',
          expiraEm: new Date(Date.now() + 60_000)
        }
      ],
      usuario: { id: 'usuario-1', tenantId: 'tenant-1', senhaHash: 'senha-antiga', ativo: true }
    };
    const { servico, repositorios } = criarServico(dados);
    jest.spyOn(ServicoRecuperacaoSenha, 'hashToken').mockReturnValueOnce('hash-token');

    await servico.redefinirSenha({ token: 'tenant-1.qualquer', senha: 'NovaSenha@123' });

    expect(repositorios.usuario.save).toHaveBeenCalledWith(expect.objectContaining({ senhaHash: 'senha:NovaSenha@123' }));
    expect(dados.tokens[0].status).toBe('usado');
    expect(dados.tokens[0].usadoEm).toBeInstanceOf(Date);
  });

  it('deve rejeitar token expirado ou ja utilizado', async () => {
    const { servico } = criarServico({
      tokens: [
        {
          id: 'token-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-1',
          tokenHash: 'hash-token',
          status: 'usado',
          usadoEm: new Date(),
          expiraEm: new Date(Date.now() + 60_000)
        }
      ]
    });
    jest.spyOn(ServicoRecuperacaoSenha, 'hashToken').mockReturnValueOnce('hash-token');

    await expect(servico.validarToken('tenant-1.qualquer')).rejects.toBeInstanceOf(GoneException);
  });

  it('deve rejeitar token malformado', async () => {
    const { servico } = criarServico();

    await expect(servico.validarToken('semtenant')).rejects.toBeInstanceOf(NotFoundException);
  });
});

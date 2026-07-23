import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConsentimentoLgpdOrm } from '../../../infraestrutura/lgpd/consentimento-lgpd.orm';
import { ServicoSenhas } from '../../../infraestrutura/seguranca/servico-senhas';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { ConvitePacienteOrm } from '../infraestrutura/convite-paciente.orm';
import { ServicoConvitesPaciente } from './servico-convites-paciente';

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
    findOne: jest.fn(async (consulta: { where: Record<string, unknown> }) => {
      if (nome === 'paciente') return dados.paciente ?? null;
      return itens.find((item) => Object.entries(consulta.where).every(([chave, valor]) => item[chave] === valor)) ?? null;
    })
  };
}

function criarServico(dados: Record<string, any> = {}) {
  const repositorios = {
    convite: criarRepositorioFake('convite', dados),
    paciente: criarRepositorioFake('paciente', dados),
    usuario: criarRepositorioFake('usuario', dados),
    consentimento: criarRepositorioFake('consentimento', dados)
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === ConvitePacienteOrm) return repositorios.convite;
      if (entidade === PacienteOrm) return repositorios.paciente;
      if (entidade === UsuarioOrm) return repositorios.usuario;
      if (entidade === ConsentimentoLgpdOrm) return repositorios.consentimento;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };
  const criptografia = {
    criptografar: jest.fn((valor: string) => Buffer.from(`cripto:${valor}`)),
    descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8').replace('cripto:', '')),
    gerarHashBusca: jest.fn((valor: string) => `hash:${valor.trim().toLowerCase()}`)
  };
  const senhas = {
    gerarHash: jest.fn((senha: string) => `senha:${senha}`)
  } as unknown as ServicoSenhas;
  const servicoAuth = {
    emitirSessaoUsuario: jest.fn(async () => ({
      accessToken: 'access-token-paciente',
      refreshToken: 'refresh-token-paciente',
      tipoToken: 'Bearer',
      expiraEmSegundos: 15 * 60,
      papel: 'Patient',
      permissoes: ['portal.paciente.acessar'],
      escopoDados: 'paciente',
      destinoInicial: '/portal'
    }))
  };

  return {
    servico: new ServicoConvitesPaciente(executorTenant as never, criptografia as never, senhas, servicoAuth as never),
    repositorios,
    servicoAuth,
    dados
  };
}

describe('ServicoConvitesPaciente', () => {
  beforeEach(() => {
    process.env.OCTACLIN_WEB_URL = 'https://app.octaclin.test';
  });

  it('deve criar convite de primeiro acesso sem armazenar token em claro', async () => {
    const { servico, repositorios } = criarServico({
      paciente: {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        usuarioId: null,
        nomeCriptografado: Buffer.from('cripto:Ana Paula')
      },
      convites: []
    });

    const convite = await servico.criarConvite('tenant-1', 'usuario-profissional-1', 'paciente-1', {
      email: 'Ana@example.com'
    });

    expect(convite.linkAtivacao).toMatch(/^https:\/\/app\.octaclin\.test\/primeiro-acesso\?token=/);
    expect(convite.token).toBeDefined();
    expect(repositorios.convite.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        pacienteId: 'paciente-1',
        criadoPorUsuarioId: 'usuario-profissional-1',
        emailHash: 'hash:ana@example.com',
        emailCriptografado: Buffer.from('cripto:ana@example.com'),
        status: 'pendente',
        tokenHash: expect.any(String)
      })
    );
    expect(repositorios.convite.save.mock.calls[0][0].tokenHash).not.toBe(convite.token);
  });

  it('deve ativar convite criando usuario paciente, vinculando paciente e registrando aceites legais versionados', async () => {
    const dados: Record<string, any> = {
      paciente: {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        usuarioId: null,
        nomeCriptografado: Buffer.from('cripto:Ana Paula')
      },
      convites: []
    };
    const { servico, repositorios, servicoAuth } = criarServico(dados);
    const convite = await servico.criarConvite('tenant-1', 'usuario-profissional-1', 'paciente-1', {
      email: 'ana@example.com'
    });

    const ativacao = await servico.ativarConvite({
      token: convite.token,
      senha: 'SenhaPaciente@123',
      aceiteLgpd: true,
      aceiteTermosUso: true,
      aceitePoliticaPrivacidade: true,
      versaoLgpd: '2026-07',
      versaoTermosUso: '2026-07',
      versaoPoliticaPrivacidade: '2026-07'
    });

    expect(repositorios.usuario.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        emailHash: 'hash:ana@example.com',
        senhaHash: 'senha:SenhaPaciente@123',
        role: 'Patient',
        ativo: true
      })
    );
    expect(repositorios.paciente.save).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: 'usuario-1' }));
    expect(repositorios.consentimento.save).toHaveBeenCalledTimes(3);
    expect(repositorios.consentimento.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-1',
        tipo: 'termos_uso',
        versao: '2026-07',
        metadados: expect.objectContaining({
          pacienteId: 'paciente-1',
          conviteId: convite.id,
          origem: 'primeiro_acesso',
          perfil: 'paciente',
          documentoLegal: 'termos_uso'
        })
      })
    );
    expect(repositorios.consentimento.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-1',
        tipo: 'politica_privacidade',
        versao: '2026-07',
        metadados: expect.objectContaining({
          pacienteId: 'paciente-1',
          conviteId: convite.id,
          origem: 'primeiro_acesso',
          perfil: 'paciente',
          documentoLegal: 'politica_privacidade'
        })
      })
    );
    expect(repositorios.consentimento.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-1',
        tipo: 'consentimento_lgpd',
        versao: '2026-07',
        metadados: expect.objectContaining({
          pacienteId: 'paciente-1',
          conviteId: convite.id,
          origem: 'primeiro_acesso',
          perfil: 'paciente',
          documentoLegal: 'consentimento_lgpd'
        })
      })
    );
    expect(servicoAuth.emitirSessaoUsuario).toHaveBeenCalledWith(expect.objectContaining({ id: 'usuario-1', role: 'Patient' }));
    expect(ativacao).toEqual({
      pacienteId: 'paciente-1',
      usuarioId: 'usuario-1',
      tenantId: 'tenant-1',
      email: 'ana@example.com',
      accessToken: 'access-token-paciente',
      refreshToken: 'refresh-token-paciente',
      tipoToken: 'Bearer',
      expiraEmSegundos: 15 * 60,
      papel: 'Patient',
      permissoes: ['portal.paciente.acessar'],
      escopoDados: 'paciente',
      destinoInicial: '/portal'
    });
    expect(dados.convites[0].status).toBe('aceito');
    expect(dados.convites[0].aceitoEm).toBeInstanceOf(Date);
  });

  it('deve rejeitar ativacao sem todos os aceites legais obrigatorios', async () => {
    const { servico } = criarServico();

    await expect(
      servico.ativarConvite({
        token: 'qualquer-token',
        senha: 'SenhaPaciente@123',
        aceiteLgpd: true,
        aceiteTermosUso: false,
        aceitePoliticaPrivacidade: true
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deve impedir convite para paciente que ja possui usuario', async () => {
    const { servico } = criarServico({
      paciente: { id: 'paciente-1', tenantId: 'tenant-1', usuarioId: 'usuario-paciente-1' }
    });

    await expect(
      servico.criarConvite('tenant-1', 'usuario-profissional-1', 'paciente-1', { email: 'ana@example.com' })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

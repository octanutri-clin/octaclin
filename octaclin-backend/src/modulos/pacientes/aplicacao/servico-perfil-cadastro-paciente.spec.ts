import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { PerfilCadastroPacienteOrm } from '../infraestrutura/perfil-cadastro-paciente.orm';
import { ConvitePacienteOrm } from '../infraestrutura/convite-paciente.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { ConsentimentoLgpdOrm } from '../../../infraestrutura/lgpd/consentimento-lgpd.orm';
import { ServicoPerfilCadastroPaciente } from './servico-perfil-cadastro-paciente';
import { ServicoDuplicidadePacientes } from './servico-duplicidade-pacientes';

const usuario: UsuarioAutenticado = {
  usuarioId: 'usuario-1',
  tenantId: '11111111-1111-1111-1111-111111111111',
  papel: 'Professional',
  emailHash: 'hash',
  permissoes: ['pacientes.ler', 'pacientes.gerenciar']
};

describe('ServicoPerfilCadastroPaciente', () => {
  function criarCenario(opcoes: { paciente?: Partial<PacienteOrm> | null; perfil?: Partial<PerfilCadastroPacienteOrm> } = {}) {
    const salvar = jest.fn(async (valor) => ({ ...valor, atualizadoEm: new Date() }));
    const perfil = {
      findOne: jest.fn().mockResolvedValue(opcoes.perfil ?? null),
      create: jest.fn((valor) => valor),
      save: salvar
    };
    const paciente = {
      findOne: jest.fn().mockResolvedValue(opcoes.paciente === undefined ? {
        id: 'paciente-1',
        tenantId: usuario.tenantId,
        profissionalResponsavelId: 'profissional-1'
      } : opcoes.paciente)
    };
    const profissional = { findOne: jest.fn().mockResolvedValue({ id: 'profissional-1' }) };
    const gerenciador = {
      getRepository: (entidade: unknown) => {
        if (entidade === PacienteOrm) return paciente;
        if (entidade === ProfissionalOrm) return profissional;
        return perfil;
      }
    } as unknown as EntityManager;
    const executorTenant = { executar: jest.fn(async (_tenantId, executar) => executar(gerenciador)) };
    const criptografia = {
      criptografar: jest.fn((valor: string) => Buffer.from(valor, 'utf8')),
      descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8')),
      gerarHashesBuscaPii: jest.fn(() => ['hash-fallback'])
    };
    const duplicidade = new ServicoDuplicidadePacientes(
      executorTenant as never,
      criptografia as never,
      { registrar: jest.fn() } as never
    );

    return {
      servico: new ServicoPerfilCadastroPaciente(executorTenant as never, criptografia as never, duplicidade),
      perfil,
      paciente,
      criptografia
    };
  }

  it('cria apenas o bloco de contato estruturado e o cifra', async () => {
    const { servico, perfil, criptografia } = criarCenario();

    const resposta = await servico.atualizarContato(usuario.tenantId, 'paciente-1', {
      email: 'ana@example.com',
      telefone: '+5511999999999',
      canalPreferido: 'whatsapp'
    }, usuario);

    expect(perfil.create).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: usuario.tenantId,
      pacienteId: 'paciente-1'
    }));
    expect(criptografia.criptografar).toHaveBeenCalledWith(expect.stringContaining('ana@example.com'));
    expect(resposta).toEqual({
      email: 'ana@example.com',
      telefone: '+5511999999999',
      canalPreferido: 'whatsapp'
    });
  });

  it('nao entrega bloco fiscal em leitura sem permissao financeira', async () => {
    const { servico } = criarCenario({
      perfil: {
        pacienteId: 'paciente-1',
        tenantId: usuario.tenantId,
        fiscalCriptografado: Buffer.from(JSON.stringify({ documentoPagador: '12345678901' }))
      }
    });

    const resposta = await servico.obter(usuario.tenantId, 'paciente-1', usuario);

    expect(resposta).not.toHaveProperty('fiscal');
  });

  it('nao entrega identificacao clinica complementar ao colaborador', async () => {
    const { servico } = criarCenario({
      perfil: {
        pacienteId: 'paciente-1',
        tenantId: usuario.tenantId,
        identificacaoCriptografada: Buffer.from(JSON.stringify({ sexo: 'feminino', condicaoBiologica: 'gestante' }))
      }
    });
    const colaborador: UsuarioAutenticado = { ...usuario, papel: 'Collaborator', permissoes: ['pacientes.ler'] };

    const resposta = await servico.obter(usuario.tenantId, 'paciente-1', colaborador);

    expect(resposta.identificacao).toBeUndefined();
  });

  it('recusa fiscal sem permissao financeira e paciente fora do escopo', async () => {
    const { servico } = criarCenario({ paciente: null });

    await expect(servico.obterFiscal(usuario.tenantId, 'paciente-1', usuario)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(servico.obter(usuario.tenantId, 'paciente-1', usuario)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('recusa condicao biologica quando o sexo informado nao e feminino', async () => {
    const { servico } = criarCenario();

    await expect(servico.atualizarIdentificacao(usuario.tenantId, 'paciente-1', {
      sexo: 'masculino',
      condicaoBiologica: 'gestante'
    }, usuario)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('projeta campos faltantes, duplicidade na carteira e acesso sem expor token', async () => {
    const pacienteAtual = {
      id: 'paciente-1', tenantId: usuario.tenantId, profissionalResponsavelId: 'profissional-1',
      nomeCriptografado: Buffer.from('Ana Silva'), contatoCriptografado: Buffer.from('ana@example.com'), dataNascimento: '1990-01-02'
    } as PacienteOrm;
    const candidato = {
      id: 'paciente-2', tenantId: usuario.tenantId, profissionalResponsavelId: 'profissional-1',
      nomeCriptografado: Buffer.from('Ana Silva'), contatoCriptografado: Buffer.from('outro@example.com'), dataNascimento: '1990-01-02'
    } as PacienteOrm;
    const perfil = {
      pacienteId: pacienteAtual.id,
      tenantId: usuario.tenantId,
      identificacaoCriptografada: Buffer.from(JSON.stringify({ sexo: 'feminino' })),
      contatoCriptografado: Buffer.from(JSON.stringify({ email: 'ana@example.com', canalPreferido: 'email' })),
      operacaoCriptografada: Buffer.from(JSON.stringify({ categoria: 'Acompanhamento' }))
    } as PerfilCadastroPacienteOrm;
    const gerenciador = {
      getRepository: jest.fn((entidade: unknown) => {
        if (entidade === PacienteOrm) return {
          findOne: jest.fn(async () => pacienteAtual),
          find: jest.fn(async () => [pacienteAtual, candidato])
        };
        if (entidade === ProfissionalOrm) return { findOne: jest.fn(async () => ({ id: 'profissional-1' })) };
        if (entidade === PerfilCadastroPacienteOrm) return { findOne: jest.fn(async () => perfil) };
        if (entidade === ConvitePacienteOrm) return { findOne: jest.fn(async () => ({
          id: 'convite-1', status: 'aceito', criadoEm: new Date('2026-08-01T10:00:00Z'),
          expiraEm: new Date('2026-08-08T10:00:00Z'), aceitoEm: new Date('2026-08-02T10:00:00Z'),
          emailCriptografado: Buffer.from('ana@example.com'), tokenHash: 'nao-deve-aparecer'
        })) };
        if (entidade === UsuarioOrm) return { findOne: jest.fn(async () => ({ id: 'usuario-paciente', ativo: true, ultimoLoginEm: new Date('2026-08-10T10:00:00Z') })) };
        if (entidade === ConsentimentoLgpdOrm) return { find: jest.fn(async () => [{ tipo: 'termos_uso', versao: '2026-07', aceitoEm: new Date('2026-08-02T10:00:00Z') }]) };
        throw new Error('Repositorio inesperado');
      })
    } as unknown as EntityManager;
    pacienteAtual.usuarioId = 'usuario-paciente';
    const executorTenant = { executar: jest.fn(async (_tenantId, executar) => executar(gerenciador)) };
    const criptografia = {
      criptografar: jest.fn(),
      descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8')),
      gerarHashesBuscaPii: jest.fn(() => ['hash-fallback'])
    };
    const duplicidade = new ServicoDuplicidadePacientes(
      executorTenant as never,
      criptografia as never,
      { registrar: jest.fn() } as never
    );
    const servico = new ServicoPerfilCadastroPaciente(executorTenant as never, criptografia as never, duplicidade);

    const resposta = await servico.obterQualidadeEAcesso(usuario.tenantId, pacienteAtual.id, usuario);

    expect(resposta.percentualPreenchido).toBeLessThan(100);
    expect(resposta.secoes.find((secao) => secao.secao === 'contato')?.camposFaltantes).toContain('Celular com DDD');
    expect(resposta.possiveisDuplicidades).toEqual([{ pacienteId: 'paciente-2', nome: 'Ana Silva', motivos: ['nome_e_nascimento'] }]);
    expect(resposta.acessoPortal).toEqual(expect.objectContaining({ status: 'acesso_ativo', ultimoAcessoEm: expect.any(Date), canalPreferido: 'email' }));
    expect(resposta.acessoPortal).not.toHaveProperty('token');
    expect(resposta.acessoPortal.aceites).toEqual([{ tipo: 'termos_uso', versao: '2026-07', aceitoEm: expect.any(Date) }]);
  });
});

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { PerfilCadastroPacienteOrm } from '../infraestrutura/perfil-cadastro-paciente.orm';
import { ServicoPerfilCadastroPaciente } from './servico-perfil-cadastro-paciente';

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
      descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8'))
    };

    return {
      servico: new ServicoPerfilCadastroPaciente(executorTenant as never, criptografia as never),
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
});

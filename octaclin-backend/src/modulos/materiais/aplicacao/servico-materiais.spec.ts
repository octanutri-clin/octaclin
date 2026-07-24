import { NotFoundException } from '@nestjs/common';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { EnvioMaterialPacienteOrm } from '../infraestrutura/envio-material-paciente.orm';
import { MaterialEducativoOrm } from '../infraestrutura/material-educativo.orm';
import { ServicoMateriais } from './servico-materiais';

const usuarioColaborador: UsuarioAutenticado = {
  usuarioId: 'usuario-colaborador-1',
  tenantId: 'tenant-1',
  papel: 'Collaborator',
  emailHash: 'hash-colaborador',
  permissoes: []
};

describe('ServicoMateriais', () => {
  it('deve criar material reutilizavel e enviar ao paciente no contexto do tenant', async () => {
    const materiaisSalvos: Record<string, unknown>[] = [];
    const enviosSalvos: Record<string, unknown>[] = [];
    const paciente = { id: 'paciente-1', tenantId: 'tenant-1' };
    const repositorios = new Map<unknown, Record<string, unknown>>([
      [PacienteOrm, { findOne: jest.fn(async () => paciente) }],
      [
        MaterialEducativoOrm,
        {
          create: jest.fn((dados: Record<string, unknown>) => dados),
          save: jest.fn(async (dados: Record<string, unknown>) => {
            const salvo = { id: 'material-1', criadoEm: new Date('2026-07-22T18:00:00.000Z'), atualizadoEm: new Date('2026-07-22T18:00:00.000Z'), ...dados };
            materiaisSalvos.push(salvo);
            return salvo;
          }),
          find: jest.fn(async () => materiaisSalvos),
          findOne: jest.fn(async () => materiaisSalvos[0] ?? null)
        }
      ],
      [
        EnvioMaterialPacienteOrm,
        {
          create: jest.fn((dados: Record<string, unknown>) => dados),
          save: jest.fn(async (dados: Record<string, unknown>) => {
            const salvo = { id: 'envio-material-1', criadoEm: new Date('2026-07-22T19:00:00.000Z'), atualizadoEm: new Date('2026-07-22T19:00:00.000Z'), ...dados };
            enviosSalvos.push(salvo);
            return salvo;
          }),
          find: jest.fn(async () => enviosSalvos)
        }
      ]
    ]);
    const servico = new ServicoMateriais(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao({ getRepository: jest.fn((entidade) => repositorios.get(entidade)) })
        )
      } as never,
      {
        criptografar: jest.fn((valor: string) => Buffer.from(`cripto:${valor}`)),
        descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', ''))
      } as never
    );

    const material = await servico.criarMaterial('tenant-1', 'usuario-profissional-1', {
      titulo: 'Guia de hidratacao',
      tipo: 'link',
      categoria: 'Habitos',
      url: 'https://example.com/hidratacao',
      resumo: 'Orientacao simples para rotina diaria.'
    });
    const envio = await servico.enviarMaterialParaPaciente(
      'tenant-1',
      'paciente-1',
      'usuario-profissional-1',
      {
        materialId: material.id,
        observacao: 'Ler antes do retorno.'
      },
      usuarioColaborador
    );
    const envios = await servico.listarMateriaisPaciente('tenant-1', 'paciente-1', usuarioColaborador);

    expect(material).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        criadoPorUsuarioId: 'usuario-profissional-1',
        titulo: 'Guia de hidratacao',
        tipo: 'link',
        categoria: 'Habitos',
        url: 'https://example.com/hidratacao',
        ativo: true
      })
    );
    expect(envio).toEqual(
      expect.objectContaining({
        pacienteId: 'paciente-1',
        materialId: 'material-1',
        titulo: 'Guia de hidratacao',
        observacao: 'Ler antes do retorno.',
        status: 'enviado'
      })
    );
    expect(envios[0]).toEqual(expect.objectContaining({ titulo: 'Guia de hidratacao', observacao: 'Ler antes do retorno.' }));
    expect(enviosSalvos[0]).toEqual(expect.objectContaining({ observacaoCriptografada: Buffer.from('cripto:Ler antes do retorno.') }));
  });

  it('deve rejeitar envio de material inexistente', async () => {
    const servico = new ServicoMateriais(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao({
            getRepository: jest.fn((entidade) => {
              if (entidade === PacienteOrm) return { findOne: jest.fn(async () => ({ id: 'paciente-1', tenantId: 'tenant-1' })) };
              if (entidade === MaterialEducativoOrm) return { findOne: jest.fn(async () => null) };
              return {};
            })
          })
        )
      } as never,
      { criptografar: jest.fn(), descriptografar: jest.fn() } as never
    );

    await expect(
      servico.enviarMaterialParaPaciente(
        'tenant-1',
        'paciente-1',
        'usuario-profissional-1',
        { materialId: 'material-inexistente' },
        usuarioColaborador
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deve tratar paciente de outro profissional como nao encontrado ao enviar material como Professional', async () => {
    const usuarioProfissional: UsuarioAutenticado = {
      usuarioId: 'usuario-profissional-1',
      tenantId: 'tenant-1',
      papel: 'Professional',
      emailHash: 'hash-profissional',
      permissoes: []
    };
    const repositorioPacientes = {
      findOne: jest.fn(async (consulta: { where: Record<string, unknown> }) =>
        consulta.where.profissionalResponsavelId && consulta.where.profissionalResponsavelId !== 'profissional-outro-2'
          ? null
          : { id: 'paciente-1', tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-outro-2' }
      )
    };
    const repositorioProfissionais = {
      findOne: jest.fn(async () => ({ id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' }))
    };
    const servico = new ServicoMateriais(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao({
            getRepository: jest.fn((entidade: { name: string }) => {
              if (entidade === PacienteOrm) return repositorioPacientes;
              if (entidade.name === 'ProfissionalOrm') return repositorioProfissionais;
              return {};
            })
          })
        )
      } as never,
      { criptografar: jest.fn(), descriptografar: jest.fn() } as never
    );

    await expect(
      servico.enviarMaterialParaPaciente(
        'tenant-1',
        'paciente-1',
        'usuario-profissional-1',
        { materialId: 'material-1' },
        usuarioProfissional
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

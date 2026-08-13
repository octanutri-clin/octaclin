import { ForbiddenException } from '@nestjs/common';
import { CondutaTerapeuticaOrm } from '../infraestrutura/conduta-terapeutica.orm';
import { CondutaTerapeuticaVersaoOrm } from '../infraestrutura/conduta-terapeutica-versao.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { ServicoCondutasTerapeuticas } from './servico-condutas-terapeuticas';

describe('ServicoCondutasTerapeuticas', () => {
  const usuario = { tenantId: 'tenant-1', usuarioId: 'usuario-1', papel: 'SuperAdmin', permissoes: ['pacientes.gerenciar'] } as never;

  function criarServico() {
    const condutas: Record<string, unknown>[] = [];
    const versoes: Record<string, unknown>[] = [];
    const repositorioCondutas = { create: jest.fn((dados: Record<string, unknown>) => ({ id: 'conduta-1', criadoEm: new Date(), ...dados })), save: jest.fn(async (dados: Record<string, unknown>) => { condutas.push(dados); return dados; }) };
    const repositorioVersoes = { create: jest.fn((dados: Record<string, unknown>) => ({ id: 'versao-1', criadoEm: new Date(), ...dados })), save: jest.fn(async (dados: Record<string, unknown>) => { versoes.push(dados); return dados; }) };
    const gerenciador = { getRepository: jest.fn((entidade: unknown) => {
      if (entidade === PacienteOrm) return { findOne: jest.fn(async () => ({ id: 'paciente-1', profissionalResponsavelId: 'profissional-1' })) };
      if (entidade === CondutaTerapeuticaOrm) return repositorioCondutas;
      if (entidade === CondutaTerapeuticaVersaoOrm) return repositorioVersoes;
      throw new Error('Repositorio nao mapeado');
    }) };
    const servico = new ServicoCondutasTerapeuticas({ executar: async (_: string, fn: (gerenciador: unknown) => unknown) => fn(gerenciador) } as never, { criptografar: jest.fn((valor: string) => Buffer.from(`cifrado:${valor}`)), descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cifrado:', '')) } as never);
    return { servico, condutas, versoes };
  }

  it('cria a primeira versao como rascunho cifrado', async () => {
    const { servico, condutas, versoes } = criarServico();
    const resultado = await servico.criar('tenant-1', 'paciente-1', usuario, { tipo: 'orientacao', titulo: 'Rotina', conteudo: 'Priorizar o cafe da manha.', validadeInicio: '2026-08-13' });
    expect(resultado.versoes[0]).toMatchObject({ numero: 1, titulo: 'Rotina', estado: 'rascunho' });
    expect(condutas[0]).toMatchObject({ tipo: 'orientacao', profissionalId: 'profissional-1' });
    expect(versoes[0]).toMatchObject({ tituloCriptografado: expect.any(Buffer), conteudoCriptografado: expect.any(Buffer) });
  });

  it('recusa papel sem escopo profissional', async () => {
    const { servico } = criarServico();
    const colaborador = { tenantId: 'tenant-1', usuarioId: 'usuario-2', papel: 'Collaborator', permissoes: [] } as never;
    await expect(servico.criar('tenant-1', 'paciente-1', colaborador, { tipo: 'meta', titulo: 'Meta', conteudo: 'Conteudo valido.' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});

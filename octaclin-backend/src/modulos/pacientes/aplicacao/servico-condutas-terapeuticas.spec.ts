import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { CondutaTerapeuticaOrm } from '../infraestrutura/conduta-terapeutica.orm';
import { CondutaTerapeuticaVersaoOrm } from '../infraestrutura/conduta-terapeutica-versao.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { ServicoCondutasTerapeuticas } from './servico-condutas-terapeuticas';

describe('ServicoCondutasTerapeuticas', () => {
  const usuario = { tenantId: 'tenant-1', usuarioId: 'usuario-1', papel: 'SuperAdmin', permissoes: ['pacientes.gerenciar'] } as never;

  function criarServico(agenda: Record<string, unknown>[] = []) {
    const condutas: Record<string, unknown>[] = [];
    const versoes: Record<string, unknown>[] = [];
    const repositorioCondutas = { create: jest.fn((dados: Record<string, unknown>) => ({ id: 'conduta-1', criadoEm: new Date(), ...dados })), save: jest.fn(async (dados: Record<string, unknown>) => { condutas.push(dados); return dados; }) };
    const repositorioVersoes = {
      create: jest.fn((dados: Record<string, unknown>) => ({ id: 'versao-1', criadoEm: new Date(), ...dados })),
      save: jest.fn(async (dados: Record<string, unknown>) => { versoes.push(dados); return dados; }),
      findOne: jest.fn(async () => versoes[versoes.length - 1] ?? null)
    };
    const gerenciador = { getRepository: jest.fn((entidade: unknown) => {
      if (entidade === PacienteOrm) return { findOne: jest.fn(async () => ({ id: 'paciente-1', profissionalResponsavelId: 'profissional-1' })) };
      if (entidade === CondutaTerapeuticaOrm) return { ...repositorioCondutas, findOne: jest.fn(async () => condutas[0] ?? { id: 'conduta-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', arquivadaEm: undefined }) };
      if (entidade === CondutaTerapeuticaVersaoOrm) return repositorioVersoes;
      if (entidade === AgendaConsultaOrm) return { findOne: jest.fn(async ({ where }: any) => agenda.find((c) => c.id === where.id && c.tenantId === where.tenantId && c.pacienteId === where.pacienteId) ?? null) };
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

  describe('PB-24 (Fase 275): vinculo opcional com consulta', () => {
    it('persiste consultaId na primeira versao quando a consulta pertence ao mesmo paciente', async () => {
      const { servico, versoes } = criarServico([{ id: 'consulta-1', tenantId: 'tenant-1', pacienteId: 'paciente-1' }]);
      const resultado = await servico.criar('tenant-1', 'paciente-1', usuario, {
        tipo: 'orientacao', titulo: 'Rotina', conteudo: 'Priorizar o cafe da manha.', consultaId: 'consulta-1'
      });
      expect(resultado.versoes[0]).toMatchObject({ consultaId: 'consulta-1' });
      expect(versoes[0]).toMatchObject({ consultaId: 'consulta-1' });
    });

    it('rejeita com 404 quando a consulta e de outro paciente', async () => {
      const { servico } = criarServico([{ id: 'consulta-1', tenantId: 'tenant-1', pacienteId: 'outro-paciente' }]);
      await expect(servico.criar('tenant-1', 'paciente-1', usuario, {
        tipo: 'orientacao', titulo: 'Rotina', conteudo: 'Priorizar o cafe da manha.', consultaId: 'consulta-1'
      })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('persiste consultaId na nova versao de uma conduta ja publicada', async () => {
      const { servico, versoes } = criarServico([{ id: 'consulta-1', tenantId: 'tenant-1', pacienteId: 'paciente-1' }]);
      versoes.push({
        id: 'versao-1', tenantId: 'tenant-1', condutaTerapeuticaId: 'conduta-1', numero: 1,
        tituloCriptografado: Buffer.from('cifrado:Rotina'), conteudoCriptografado: Buffer.from('cifrado:Priorizar o cafe da manha.'),
        publicadaEm: new Date(), descartadaEm: undefined
      });
      const resultado = await servico.criarNovaVersao('tenant-1', 'paciente-1', 'conduta-1', usuario, 'consulta-1');
      expect(resultado.versoes[0]).toMatchObject({ consultaId: 'consulta-1' });
    });
  });
});

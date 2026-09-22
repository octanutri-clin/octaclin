import { NotFoundException } from '@nestjs/common';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { ColetaExameLaboratorialOrm } from '../infraestrutura/coleta-exame-laboratorial.orm';
import { MarcadorExameLaboratorialOrm } from '../infraestrutura/marcador-exame-laboratorial.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { ServicoExamesLaboratoriais } from './servico-exames-laboratoriais';

describe('ServicoExamesLaboratoriais', () => {
  it('cifra marcadores e devolve somente a coleta do paciente acessivel', async () => {
    const dados: Record<string, any[]> = { coletas: [], marcadores: [] };
    const criarRepositorio = (nome: 'coleta' | 'marcador') => ({
      create: jest.fn((entrada: Record<string, unknown>) => entrada),
      save: jest.fn(async (entrada: Record<string, any>) => {
        const itens = dados[nome === 'coleta' ? 'coletas' : 'marcadores'];
        const salvo = { id: entrada.id ?? `${nome}-${itens.length + 1}`, criadoEm: new Date(), ...entrada };
        itens.push(salvo);
        return salvo;
      }),
      find: jest.fn(async () => dados[nome === 'coleta' ? 'coletas' : 'marcadores'])
    });
    const repositorios = { coleta: criarRepositorio('coleta'), marcador: criarRepositorio('marcador') };
    const gerenciador = {
      getRepository: jest.fn((entidade: { name: string }) => {
        if (entidade === PacienteOrm) return { findOne: jest.fn(async () => ({ id: 'paciente-1' })) };
        if (entidade === ColetaExameLaboratorialOrm) return repositorios.coleta;
        if (entidade === MarcadorExameLaboratorialOrm) return repositorios.marcador;
        throw new Error('Repositorio nao mapeado');
      })
    };
    const criptografia = {
      criptografar: jest.fn((valor: string) => Buffer.from(`cifrado:${valor}`)),
      descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cifrado:', ''))
    };
    const servico = new ServicoExamesLaboratoriais({ executar: async (_: string, fn: (arg: unknown) => unknown) => fn(gerenciador) } as never, criptografia as never);
    const usuario = { tenantId: 'tenant-1', usuarioId: 'usuario-1', papel: 'SuperAdmin', permissoes: ['pacientes.ler', 'pacientes.gerenciar'] } as never;

    const criado = await servico.criar('tenant-1', 'paciente-1', {
      coletadaEm: '2026-08-11', laboratorio: 'Laboratorio sintético', marcadores: [{ nome: 'Ferritina', valor: '42', unidade: 'ng/mL' }]
    }, usuario);

    expect(repositorios.marcador.save).toHaveBeenCalledWith(expect.objectContaining({ resultadoCriptografado: expect.any(Buffer) }));
    expect(criado.marcadores).toEqual([expect.objectContaining({ nome: 'Ferritina', valor: '42' })]);
  });

  describe('PB-24 (Fase 275): vinculo opcional com consulta', () => {
    function criarServico(agenda: Record<string, unknown>[]) {
      const dados: Record<string, any[]> = { coletas: [], marcadores: [] };
      const criarRepositorio = (nome: 'coleta' | 'marcador') => ({
        create: jest.fn((entrada: Record<string, unknown>) => entrada),
        save: jest.fn(async (entrada: Record<string, any>) => {
          const itens = dados[nome === 'coleta' ? 'coletas' : 'marcadores'];
          const salvo = { id: entrada.id ?? `${nome}-${itens.length + 1}`, criadoEm: new Date(), ...entrada };
          itens.push(salvo);
          return salvo;
        }),
        find: jest.fn(async () => dados[nome === 'coleta' ? 'coletas' : 'marcadores'])
      });
      const repositorios = { coleta: criarRepositorio('coleta'), marcador: criarRepositorio('marcador') };
      const gerenciador = {
        getRepository: jest.fn((entidade: unknown) => {
          if (entidade === PacienteOrm) return { findOne: jest.fn(async () => ({ id: 'paciente-1' })) };
          if (entidade === ColetaExameLaboratorialOrm) return repositorios.coleta;
          if (entidade === MarcadorExameLaboratorialOrm) return repositorios.marcador;
          if (entidade === AgendaConsultaOrm) return { findOne: jest.fn(async ({ where }: any) => agenda.find((c) => c.id === where.id && c.tenantId === where.tenantId && c.pacienteId === where.pacienteId) ?? null) };
          throw new Error('Repositorio nao mapeado');
        })
      };
      const criptografia = {
        criptografar: jest.fn((valor: string) => Buffer.from(`cifrado:${valor}`)),
        descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cifrado:', ''))
      };
      const servico = new ServicoExamesLaboratoriais({ executar: async (_: string, fn: (arg: unknown) => unknown) => fn(gerenciador) } as never, criptografia as never);
      return { servico, dados };
    }

    const usuario = { tenantId: 'tenant-1', usuarioId: 'usuario-1', papel: 'SuperAdmin', permissoes: ['pacientes.gerenciar'] } as never;

    it('persiste consultaId quando a consulta pertence ao mesmo tenant e paciente', async () => {
      const { servico, dados } = criarServico([{ id: 'consulta-1', tenantId: 'tenant-1', pacienteId: 'paciente-1' }]);
      const criado = await servico.criar('tenant-1', 'paciente-1', {
        coletadaEm: '2026-08-11', marcadores: [{ nome: 'Ferritina', valor: '42' }], consultaId: 'consulta-1'
      }, usuario);
      expect(criado.consultaId).toBe('consulta-1');
      expect(dados.coletas[0]).toEqual(expect.objectContaining({ consultaId: 'consulta-1' }));
    });

    it('rejeita com 404 quando a consulta e de outro paciente', async () => {
      const { servico } = criarServico([{ id: 'consulta-1', tenantId: 'tenant-1', pacienteId: 'outro-paciente' }]);
      await expect(servico.criar('tenant-1', 'paciente-1', {
        coletadaEm: '2026-08-11', marcadores: [{ nome: 'Ferritina', valor: '42' }], consultaId: 'consulta-1'
      }, usuario)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

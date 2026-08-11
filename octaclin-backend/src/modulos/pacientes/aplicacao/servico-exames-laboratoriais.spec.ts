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
});

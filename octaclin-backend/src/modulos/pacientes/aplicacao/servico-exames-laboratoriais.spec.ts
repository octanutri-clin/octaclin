import { ForbiddenException, NotFoundException } from '@nestjs/common';
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

  describe('PB-17: catalogo de marcadores', () => {
    function criarServicoCatalogo(entradaCatalogo: Record<string, unknown> | null, pacienteAcessivel = true) {
      const salvos: Record<string, unknown>[] = [];
      const repositorioColetas = {
        create: jest.fn((entrada: Record<string, unknown>) => entrada),
        save: jest.fn(async (entrada: Record<string, unknown>) => ({ id: 'coleta-1', ...entrada })),
        find: jest.fn(async () => [])
      };
      const repositorioMarcadores = {
        create: jest.fn((entrada: Record<string, unknown>) => entrada),
        save: jest.fn(async (entrada: Record<string, unknown>) => {
          const salvo = { id: `resultado-${salvos.length + 1}`, ...entrada };
          salvos.push(salvo);
          return salvo;
        })
      };
      const consultaCatalogo = jest.fn(async () => entradaCatalogo);
      const gerenciador = {
        getRepository: jest.fn((entidade: { name: string }) => {
          if (entidade === PacienteOrm) return { findOne: jest.fn(async () => pacienteAcessivel ? { id: 'paciente-1' } : null) };
          if (entidade === ColetaExameLaboratorialOrm) return repositorioColetas;
          if (entidade === MarcadorExameLaboratorialOrm) return repositorioMarcadores;
          if (entidade.name === 'CatalogoMarcadorExameOrm') return { findOne: consultaCatalogo };
          throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
        })
      };
      const criptografia = {
        criptografar: (valor: string) => Buffer.from(`cifrado:${valor}`),
        descriptografar: (valor: Buffer) => valor.toString().replace('cifrado:', '')
      };
      const servico = new ServicoExamesLaboratoriais({ executar: async (_: string, fn: (arg: unknown) => unknown) => fn(gerenciador) } as never, criptografia as never);
      return { servico, salvos, consultaCatalogo, repositorioColetas };
    }

    const usuario = { tenantId: 'tenant-1', usuarioId: 'usuario-1', papel: 'SuperAdmin', permissoes: ['pacientes.ler', 'pacientes.gerenciar'] } as never;

    it('usa o nome canonico e a faixa padrao do catalogo do tenant na coleta', async () => {
      const { servico, salvos, consultaCatalogo } = criarServicoCatalogo({
        id: 'catalogo-1', tenantId: 'tenant-1', arquivadoEm: null,
        definicaoCriptografada: Buffer.from('cifrado:{"nome":"Ferritina","unidade":"ng/mL","limiteInferior":"10","limiteSuperior":"40"}')
      });
      const criado = await servico.criar('tenant-1', 'paciente-1', {
        coletadaEm: '2026-08-11', marcadores: [{ nome: 'Nome livre ignorado', valor: '42', catalogoMarcadorId: 'catalogo-1' }]
      } as never, usuario);

      expect(consultaCatalogo).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'catalogo-1', tenantId: 'tenant-1' }) }));
      expect(salvos[0]).toEqual(expect.objectContaining({ catalogoMarcadorId: 'catalogo-1' }));
      expect(criado.marcadores[0]).toEqual(expect.objectContaining({
        nome: 'Ferritina', unidade: 'ng/mL', limiteInferior: '10', limiteSuperior: '40', situacaoFaixa: 'fora_da_faixa'
      }));
    });

    it('recusa catalogo ausente ou de outro tenant antes de gravar a coleta', async () => {
      const { servico, salvos } = criarServicoCatalogo(null);
      await expect(servico.criar('tenant-1', 'paciente-1', {
        coletadaEm: '2026-08-11', marcadores: [{ nome: 'Ferritina', valor: '42', catalogoMarcadorId: 'catalogo-outro-tenant' }]
      } as never, usuario)).rejects.toBeInstanceOf(NotFoundException);
      expect(salvos).toHaveLength(0);
    });

    it('nao reutiliza a faixa padrao quando a unidade do resultado muda', async () => {
      const { servico } = criarServicoCatalogo({
        id: 'catalogo-1', tenantId: 'tenant-1',
        definicaoCriptografada: Buffer.from('cifrado:{"nome":"Ferritina","unidade":"ng/mL","limiteInferior":"10","limiteSuperior":"40"}')
      });
      const criado = await servico.criar('tenant-1', 'paciente-1', {
        coletadaEm: '2026-08-11', marcadores: [{ nome: 'Ferritina', valor: '42', unidade: 'mg/dL', catalogoMarcadorId: 'catalogo-1' }]
      } as never, usuario);
      expect(criado.marcadores[0]).toEqual(expect.objectContaining({ unidade: 'mg/dL' }));
      expect(criado.marcadores[0].limiteInferior).toBeUndefined();
      expect(criado.marcadores[0].situacaoFaixa).toBeUndefined();
    });

    it('usa faixa ajustada no resultado e nao classifica valor textual', async () => {
      const { servico } = criarServicoCatalogo({
        id: 'catalogo-1', tenantId: 'tenant-1',
        definicaoCriptografada: Buffer.from('cifrado:{"nome":"Ferritina","unidade":"ng/mL","limiteInferior":"10","limiteSuperior":"40"}')
      });
      const criado = await servico.criar('tenant-1', 'paciente-1', {
        coletadaEm: '2026-08-11', marcadores: [
          { nome: 'Ferritina', valor: '42', catalogoMarcadorId: 'catalogo-1', limiteSuperior: '45' },
          { nome: 'Ferritina', valor: '<5', catalogoMarcadorId: 'catalogo-1' }
        ]
      } as never, usuario);
      expect(criado.marcadores[0]).toEqual(expect.objectContaining({ limiteSuperior: '45', situacaoFaixa: 'dentro_da_faixa' }));
      expect(criado.marcadores[1].situacaoFaixa).toBeUndefined();
    });

    it('nega paciente fora da carteira antes de consultar catalogo ou gravar', async () => {
      const { servico, salvos, consultaCatalogo } = criarServicoCatalogo(null, false);
      await expect(servico.criar('tenant-1', 'paciente-1', {
        coletadaEm: '2026-08-11', marcadores: [{ nome: 'Ferritina', valor: '42', catalogoMarcadorId: 'catalogo-1' }]
      } as never, usuario)).rejects.toBeInstanceOf(NotFoundException);
      expect(consultaCatalogo).not.toHaveBeenCalled();
      expect(salvos).toHaveLength(0);
    });

    it('nega listagem de paciente fora da carteira antes de consultar coletas', async () => {
      const { servico, repositorioColetas } = criarServicoCatalogo(null, false);
      await expect(servico.listar('tenant-1', 'paciente-fora-da-carteira', usuario))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(repositorioColetas.find).not.toHaveBeenCalled();
    });

    it('nao aceita tenant diferente da credencial no servico', async () => {
      const { servico, salvos, consultaCatalogo } = criarServicoCatalogo(null);
      await expect(servico.criar('tenant-outro', 'paciente-1', {
        coletadaEm: '2026-08-11', marcadores: [{ nome: 'Ferritina', valor: '42' }]
      } as never, usuario)).rejects.toBeInstanceOf(ForbiddenException);
      expect(consultaCatalogo).not.toHaveBeenCalled();
      expect(salvos).toHaveLength(0);
    });
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

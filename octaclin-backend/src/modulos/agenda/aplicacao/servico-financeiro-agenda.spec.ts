import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AgendaConsultaOrm } from '../infraestrutura/agenda-consulta.orm';
import { PacoteSessaoOrm } from '../infraestrutura/pacote-sessao.orm';
import { ServicoFinanceiroAgenda } from './servico-financeiro-agenda';

const colaborador: UsuarioAutenticado = {
  usuarioId: 'usuario-1',
  tenantId: 'tenant-1',
  papel: 'Collaborator',
  emailHash: 'hash',
  permissoes: []
};

const profissionalLogado: UsuarioAutenticado = { ...colaborador, papel: 'Professional' };

const criptografia = {
  criptografar: jest.fn((valor: string) => Buffer.from(valor, 'utf8')),
  descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8'))
};

function consulta(sobrescrever: Partial<AgendaConsultaOrm> = {}): AgendaConsultaOrm {
  return {
    id: 'consulta-1',
    tenantId: 'tenant-1',
    pacienteId: 'paciente-1',
    profissionalId: 'profissional-1',
    status: 'concluida',
    statusPagamento: 'pendente',
    valorCentavos: 0,
    inicioEm: new Date('2026-08-04T13:00:00.000Z'),
    fimEm: new Date('2026-08-04T14:00:00.000Z'),
    payload: {},
    ...sobrescrever
  } as AgendaConsultaOrm;
}

function montarServico(opcoes: {
  consulta?: AgendaConsultaOrm | null;
  consultas?: Partial<AgendaConsultaOrm>[];
  pacote?: Partial<PacoteSessaoOrm> | null;
  pacotes?: Partial<PacoteSessaoOrm>[];
  profissionalDoUsuario?: unknown;
  paciente?: unknown;
} = {}) {
  const salvarConsulta = jest.fn(async (dados: AgendaConsultaOrm) => dados);
  let filtroConsultas: Record<string, unknown> = {};
  let filtroPacotes: Record<string, unknown> = {};

  const gerenciador = {
    getRepository: jest.fn((entidade: unknown) => {
      if (entidade === AgendaConsultaOrm) {
        return {
          findOne: jest.fn(async () => (opcoes.consulta === undefined ? consulta() : opcoes.consulta)),
          find: jest.fn(async (parametros: { where: Record<string, unknown> }) => {
            filtroConsultas = parametros.where;
            return opcoes.consultas ?? [];
          }),
          save: salvarConsulta
        };
      }
      if (entidade === PacoteSessaoOrm) {
        return {
          findOne: jest.fn(async () => opcoes.pacote ?? null),
          find: jest.fn(async (parametros: { where: Record<string, unknown> }) => {
            filtroPacotes = parametros.where;
            return opcoes.pacotes ?? [];
          }),
          create: jest.fn((dados: Record<string, unknown>) => dados),
          save: jest.fn(async (dados: Record<string, unknown>) => ({
            id: 'pacote-1',
            criadoEm: new Date('2026-08-01T12:00:00.000Z'),
            ...dados
          }))
        };
      }
      if (entidade === ProfissionalOrm) {
        return {
          findOne: jest.fn(async () => opcoes.profissionalDoUsuario ?? null),
          find: jest.fn(async () => [
            {
              id: 'profissional-1',
              tenantId: 'tenant-1',
              nomeCriptografado: Buffer.from('Dra. Carla Lima', 'utf8')
            }
          ])
        };
      }
      if (entidade === PacienteOrm) {
        return {
          findOne: jest.fn(async () =>
            opcoes.paciente === undefined
              ? {
                  id: 'paciente-1',
                  tenantId: 'tenant-1',
                  profissionalResponsavelId: 'profissional-1',
                  nomeCriptografado: Buffer.from('Ana Souza', 'utf8')
                }
              : opcoes.paciente
          ),
          find: jest.fn(async () => [
            { id: 'paciente-1', nomeCriptografado: Buffer.from('Ana Souza', 'utf8') }
          ])
        };
      }
      return { find: jest.fn(async () => []), findOne: jest.fn(async () => null) };
    })
  };

  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };
  const servicoAgenda = { mapearRespostaPublica: jest.fn((registro: AgendaConsultaOrm) => registro) };

  return {
    servico: new ServicoFinanceiroAgenda(
      executorTenant as never,
      criptografia as never,
      servicoAgenda as never
    ),
    salvarConsulta,
    filtroConsultas: () => filtroConsultas,
    filtroPacotes: () => filtroPacotes
  };
}

describe('ServicoFinanceiroAgenda', () => {
  describe('registro de pagamento', () => {
    it('deve gravar valor, forma e data quando a consulta e marcada como paga', async () => {
      const { servico, salvarConsulta } = montarServico();

      await servico.registrarPagamento(
        'tenant-1',
        'consulta-1',
        { statusPagamento: 'pago', valorCentavos: 18000, formaPagamento: 'pix' },
        colaborador
      );

      const salva = salvarConsulta.mock.calls[0][0];
      expect(salva.valorCentavos).toBe(18000);
      expect(salva.formaPagamento).toBe('pix');
      expect(salva.pagoEm).toBeInstanceOf(Date);
    });

    it('deve recusar pagamento de consulta cancelada', async () => {
      const { servico } = montarServico({ consulta: consulta({ status: 'cancelada' }) });

      await expect(
        servico.registrarPagamento(
          'tenant-1',
          'consulta-1',
          { statusPagamento: 'pago', valorCentavos: 18000, formaPagamento: 'pix' },
          colaborador
        )
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('deve recusar marcar como paga sem valor ou sem forma de pagamento', async () => {
      const semValor = montarServico();
      await expect(
        semValor.servico.registrarPagamento(
          'tenant-1',
          'consulta-1',
          { statusPagamento: 'pago', formaPagamento: 'pix' },
          colaborador
        )
      ).rejects.toThrow('Informe o valor');

      const semForma = montarServico();
      await expect(
        semForma.servico.registrarPagamento(
          'tenant-1',
          'consulta-1',
          { statusPagamento: 'pago', valorCentavos: 18000 },
          colaborador
        )
      ).rejects.toThrow('forma de pagamento');
    });

    it('deve limpar a data de pagamento ao voltar para pendente', async () => {
      const { servico, salvarConsulta } = montarServico({
        consulta: consulta({ statusPagamento: 'pago', valorCentavos: 18000, pagoEm: new Date() })
      });

      await servico.registrarPagamento('tenant-1', 'consulta-1', { statusPagamento: 'pendente' }, colaborador);

      expect(salvarConsulta.mock.calls[0][0].pagoEm).toBeUndefined();
    });

    it('deve recusar pagamento avulso em consulta de pacote', async () => {
      const { servico } = montarServico({ consulta: consulta({ pacoteId: 'pacote-1' }) });

      await expect(
        servico.registrarPagamento(
          'tenant-1',
          'consulta-1',
          { statusPagamento: 'pago', valorCentavos: 18000, formaPagamento: 'pix' },
          colaborador
        )
      ).rejects.toThrow('paga no pacote');
    });

    it('deve manter o escopo do profissional na busca da consulta', async () => {
      const { servico } = montarServico({
        consulta: null,
        profissionalDoUsuario: { id: 'profissional-9', tenantId: 'tenant-1' }
      });

      await expect(
        servico.registrarPagamento('tenant-1', 'consulta-1', { statusPagamento: 'isento' }, profissionalLogado)
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('recebimentos do periodo', () => {
    it('deve fechar o periodo com recebido, pendente e quebra por profissional', async () => {
      const { servico } = montarServico({
        consultas: [
          consulta({ statusPagamento: 'pago', valorCentavos: 18000 }),
          consulta({ statusPagamento: 'pendente', valorCentavos: 15000 }),
          consulta({ status: 'cancelada', statusPagamento: 'pendente', valorCentavos: 99900 })
        ],
        pacotes: [
          { statusPagamento: 'pago', valorTotalCentavos: 150000 },
          { statusPagamento: 'pendente', valorTotalCentavos: 90000 }
        ]
      });

      const resumo = await servico.resumoRecebimentos(
        'tenant-1',
        { inicioEm: '2026-08-01T00:00:00.000Z', fimEm: '2026-08-31T23:59:59.000Z' },
        colaborador
      );

      expect(resumo.recebidoCentavos).toBe(18000);
      expect(resumo.pendenteCentavos).toBe(15000);
      expect(resumo.consultas).toBe(2);
      // Pacote sai em linha propria: somar junto contaria o atendimento duas vezes.
      expect(resumo.pacotesRecebidoCentavos).toBe(150000);
      expect(resumo.pacotesPendenteCentavos).toBe(90000);
      expect(resumo.porProfissional).toEqual([
        {
          profissionalId: 'profissional-1',
          profissionalNome: 'Dra. Carla Lima',
          consultas: 2,
          recebidoCentavos: 18000,
          pendenteCentavos: 15000,
          isentas: 0
        }
      ]);
    });

    it('deve ignorar o filtro de profissional pedido e usar o escopo do usuario Professional', async () => {
      const { servico, filtroConsultas } = montarServico({
        profissionalDoUsuario: { id: 'profissional-7', tenantId: 'tenant-1' }
      });

      await servico.resumoRecebimentos(
        'tenant-1',
        {
          inicioEm: '2026-08-01T00:00:00.000Z',
          fimEm: '2026-08-31T23:59:59.000Z',
          profissionalId: 'profissional-outro'
        },
        profissionalLogado
      );

      expect(filtroConsultas().profissionalId).toBe('profissional-7');
    });

    it('deve filtrar consultas e pacotes pelo paciente do deep link financeiro', async () => {
      const { servico, filtroConsultas, filtroPacotes } = montarServico();

      await servico.resumoRecebimentos(
        'tenant-1',
        {
          inicioEm: '2026-08-01T00:00:00.000Z',
          fimEm: '2026-08-31T23:59:59.000Z',
          pacienteId: 'paciente-1'
        },
        colaborador
      );

      expect(filtroConsultas().pacienteId).toBe('paciente-1');
      expect(filtroPacotes().pacienteId).toBe('paciente-1');
    });

    it('deve recusar periodo invertido e periodo maior que o teto', async () => {
      const { servico } = montarServico();

      await expect(
        servico.resumoRecebimentos(
          'tenant-1',
          { inicioEm: '2026-08-31T00:00:00.000Z', fimEm: '2026-08-01T00:00:00.000Z' },
          colaborador
        )
      ).rejects.toThrow('posterior');

      await expect(
        servico.resumoRecebimentos(
          'tenant-1',
          { inicioEm: '2020-01-01T00:00:00.000Z', fimEm: '2026-08-01T00:00:00.000Z' },
          colaborador
        )
      ).rejects.toThrow('Periodo maximo');
    });
  });

  describe('pacote de sessoes', () => {
    it('deve criar pacote pago com data de pagamento', async () => {
      const { servico } = montarServico();

      const pacote = await servico.criarPacote(
        'tenant-1',
        {
          pacienteId: 'paciente-1',
          titulo: 'Pacote 10 consultas',
          sessoesContratadas: 10,
          valorTotalCentavos: 150000,
          formaPagamento: 'pix',
          statusPagamento: 'pago'
        },
        colaborador
      );

      expect(pacote.sessoesDisponiveis).toBe(10);
      expect(pacote.pagoEm).toBeInstanceOf(Date);
      expect(pacote.pacienteNome).toBe('Ana Souza');
    });

    it('deve recusar pacote pago sem valor e validade no passado', async () => {
      const { servico } = montarServico();

      await expect(
        servico.criarPacote(
          'tenant-1',
          { pacienteId: 'paciente-1', titulo: 'Pacote', sessoesContratadas: 5, statusPagamento: 'pago' },
          colaborador
        )
      ).rejects.toThrow('valor total');

      await expect(
        servico.criarPacote(
          'tenant-1',
          {
            pacienteId: 'paciente-1',
            titulo: 'Pacote',
            sessoesContratadas: 5,
            validadeEm: '2020-01-01T00:00:00.000Z'
          },
          colaborador
        )
      ).rejects.toThrow('passado');
    });

    it('deve recusar pacote para paciente fora do escopo do profissional', async () => {
      const { servico } = montarServico({
        paciente: null,
        profissionalDoUsuario: { id: 'profissional-7', tenantId: 'tenant-1' }
      });

      await expect(
        servico.criarPacote(
          'tenant-1',
          { pacienteId: 'paciente-1', titulo: 'Pacote', sessoesContratadas: 5 },
          profissionalLogado
        )
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deve devolver o consumo real do pacote na listagem', async () => {
      const { servico } = montarServico({
        pacotes: [
          {
            id: 'pacote-1',
            tenantId: 'tenant-1',
            pacienteId: 'paciente-1',
            titulo: 'Pacote 10 consultas',
            sessoesContratadas: 10,
            valorTotalCentavos: 150000,
            statusPagamento: 'pago',
            criadoEm: new Date('2026-08-01T12:00:00.000Z')
          }
        ],
        consultas: [
          { pacoteId: 'pacote-1', status: 'concluida' },
          { pacoteId: 'pacote-1', status: 'falta' },
          { pacoteId: 'pacote-1', status: 'cancelada' },
          { pacoteId: 'pacote-1', status: 'agendada' }
        ]
      });

      const [pacote] = await servico.listarPacotes('tenant-1', colaborador);

      expect(pacote.sessoesConsumidas).toBe(2);
      expect(pacote.sessoesReservadas).toBe(1);
      expect(pacote.sessoesDisponiveis).toBe(7);
    });
  });
});

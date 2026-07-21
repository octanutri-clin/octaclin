import { ForbiddenException } from '@nestjs/common';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { EnvioQuestionarioOrm } from '../../questionarios/infraestrutura/envio-questionario.orm';
import { QuestionarioOrm } from '../../questionarios/infraestrutura/questionario.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { ServicoPortalPaciente } from './servico-portal-paciente';

function criarRepositorioFake(nome: string, dados: Record<string, any>) {
  const chaveColecao = nome === 'mensagem' ? 'mensagens' : `${nome}s`;
  const itens: Record<string, any>[] = dados[chaveColecao] ?? [];

  function corresponde(valorItem: unknown, valorConsulta: unknown) {
    if (
      valorConsulta &&
      typeof valorConsulta === 'object' &&
      '_type' in valorConsulta &&
      (valorConsulta as { _type?: string })._type === 'in'
    ) {
      return ((valorConsulta as { _value?: unknown[] })._value ?? []).includes(valorItem);
    }
    if (
      valorConsulta &&
      typeof valorConsulta === 'object' &&
      '_type' in valorConsulta &&
      (valorConsulta as { _type?: string })._type === 'isNull'
    ) {
      return valorItem === null || valorItem === undefined;
    }
    return valorItem === valorConsulta;
  }

  return {
    findOne: jest.fn(async (consulta: { where: Record<string, unknown> }) =>
      itens.find((item) => Object.entries(consulta.where).every(([chave, valor]) => corresponde(item[chave], valor))) ?? null
    ),
    find: jest.fn(async (consulta?: { where?: Record<string, unknown>; order?: Record<string, 'ASC' | 'DESC'>; take?: number }) => {
      let resultado = consulta?.where
        ? itens.filter((item) => Object.entries(consulta.where ?? {}).every(([chave, valor]) => corresponde(item[chave], valor)))
        : [...itens];
      const [campoOrdenacao, direcao] = Object.entries(consulta?.order ?? {})[0] ?? [];
      if (campoOrdenacao) {
        resultado = resultado.sort((a, b) => {
          const valorA = a[campoOrdenacao] instanceof Date ? a[campoOrdenacao].getTime() : a[campoOrdenacao];
          const valorB = b[campoOrdenacao] instanceof Date ? b[campoOrdenacao].getTime() : b[campoOrdenacao];
          return direcao === 'DESC' ? valorB - valorA : valorA - valorB;
        });
      }
      return consulta?.take ? resultado.slice(0, consulta.take) : resultado;
    })
  };
}

function criarServico(dados: Record<string, any>) {
  const repositorios = {
    paciente: criarRepositorioFake('paciente', dados),
    consulta: criarRepositorioFake('consulta', dados),
    envio: criarRepositorioFake('envio', dados),
    questionario: criarRepositorioFake('questionario', dados),
    mensagem: criarRepositorioFake('mensagem', dados)
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === PacienteOrm) return repositorios.paciente;
      if (entidade === AgendaConsultaOrm) return repositorios.consulta;
      if (entidade === EnvioQuestionarioOrm) return repositorios.envio;
      if (entidade === QuestionarioOrm) return repositorios.questionario;
      if (entidade === MensagemNotificacaoOrm) return repositorios.mensagem;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => operacao(gerenciador))
  };
  const criptografia = {
    descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8').replace('cripto:', ''))
  };

  return { servico: new ServicoPortalPaciente(executorTenant as never, criptografia as never), repositorios };
}

describe('ServicoPortalPaciente', () => {
  beforeEach(() => {
    process.env.OCTACLIN_WEB_URL = 'https://app.octaclin.test';
    process.env.FORMULARIO_PUBLICO_SEGREDO = 'segredo-teste-formulario';
  });

  it('deve montar portal autenticado somente com dados do paciente logado', async () => {
    const inicioConsulta = new Date('2026-08-10T13:00:00.000Z');
    const { servico } = criarServico({
      pacientes: [
        {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-1',
          nomeCriptografado: Buffer.from('cripto:Ana Paula'),
          statusAdesao: 'aderente',
          scoreRisco: '12.50',
          ultimoCheckinEm: new Date('2026-07-20T12:00:00.000Z')
        },
        {
          id: 'paciente-2',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-2',
          nomeCriptografado: Buffer.from('cripto:Outro Paciente')
        }
      ],
      consultas: [
        {
          id: 'consulta-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          titulo: 'Consulta nutricional',
          inicioEm: inicioConsulta,
          fimEm: new Date('2026-08-10T13:50:00.000Z'),
          status: 'agendada',
          local: 'Online',
          googleEventHtmlLink: 'https://calendar.google.com/event'
        },
        {
          id: 'consulta-2',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-2',
          titulo: 'Consulta de outro paciente',
          inicioEm: inicioConsulta,
          fimEm: new Date('2026-08-10T13:50:00.000Z'),
          status: 'agendada'
        }
      ],
      envios: [
        {
          id: 'envio-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          questionarioId: 'questionario-1',
          status: 'enviado',
          expiraEm: new Date('2026-08-12T12:00:00.000Z')
        },
        {
          id: 'envio-2',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          questionarioId: 'questionario-2',
          status: 'respondido'
        },
        {
          id: 'envio-3',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-2',
          questionarioId: 'questionario-1',
          status: 'enviado'
        }
      ],
      questionarios: [
        { id: 'questionario-1', tenantId: 'tenant-1', titulo: 'Check-in semanal' },
        { id: 'questionario-2', tenantId: 'tenant-1', titulo: 'Respondido' }
      ],
      mensagens: [
        {
          id: 'mensagem-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          status: 'enviado',
          payload: { assunto: 'Consulta agendada', texto: 'Sua consulta foi agendada.' },
          criadoEm: new Date('2026-07-20T14:00:00.000Z'),
          enviadoEm: new Date('2026-07-20T14:01:00.000Z')
        },
        {
          id: 'mensagem-2',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-2',
          status: 'enviado',
          payload: { texto: 'Nao deve aparecer' },
          criadoEm: new Date('2026-07-20T15:00:00.000Z')
        }
      ]
    });

    const portal = await servico.obterResumoPortal('tenant-1', 'usuario-paciente-1');

    expect(portal.paciente).toEqual(
      expect.objectContaining({
        id: 'paciente-1',
        nome: 'Ana Paula',
        statusAdesao: 'aderente',
        scoreRisco: '12.50'
      })
    );
    expect(portal.resumo).toEqual({ consultasProximas: 1, formulariosPendentes: 1, mensagensRecentes: 1 });
    expect(portal.consultasProximas).toEqual([
      expect.objectContaining({ id: 'consulta-1', titulo: 'Consulta nutricional', local: 'Online' })
    ]);
    expect(portal.formulariosPendentes).toEqual([
      expect.objectContaining({
        envioId: 'envio-1',
        questionarioId: 'questionario-1',
        titulo: 'Check-in semanal',
        status: 'enviado',
        linkFormulario: expect.stringContaining('/formularios/')
      })
    ]);
    expect(portal.mensagensRecentes).toEqual([
      expect.objectContaining({ id: 'mensagem-1', titulo: 'Consulta agendada', texto: 'Sua consulta foi agendada.' })
    ]);
  });

  it('deve rejeitar usuario sem paciente vinculado', async () => {
    const { servico } = criarServico({ pacientes: [], consultas: [], envios: [], questionarios: [], mensagens: [] });

    await expect(servico.obterResumoPortal('tenant-1', 'usuario-sem-paciente')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

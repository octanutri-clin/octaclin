import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AgendaBloqueioExternoOrm } from '../infraestrutura/agenda-bloqueio-externo.orm';
import { AgendaConsultaOrm } from '../infraestrutura/agenda-consulta.orm';
import { ServicoAgenda } from './servico-agenda';

const usuarioColaborador: UsuarioAutenticado = {
  usuarioId: 'usuario-colaborador-1',
  tenantId: 'tenant-1',
  papel: 'Collaborator',
  emailHash: 'hash-colaborador',
  permissoes: []
};

const usuarioProfissional: UsuarioAutenticado = {
  usuarioId: 'usuario-profissional-1',
  tenantId: 'tenant-1',
  papel: 'Professional',
  emailHash: 'hash-profissional',
  permissoes: []
};

function criarErroExclusao(constraint = 'ex_agenda_consultas_profissional_horario_ativo'): QueryFailedError {
  const erroPostgres = Object.assign(new Error('conflicting key value violates exclusion constraint'), {
    code: '23P01',
    constraint
  });
  return new QueryFailedError('insert into agenda_consultas', [], erroPostgres);
}

function criarErroSobreposicaoAgenda(): QueryFailedError {
  return criarErroExclusao();
}

function criarRepositorioFake(nome: string, dados: Record<string, unknown>) {
  let ultimoSalvo: Record<string, unknown> | null = null;
  return {
    create: jest.fn((entrada: Record<string, unknown>) => entrada),
    save: jest.fn(async (entrada: Record<string, unknown>) => {
      ultimoSalvo = { id: `${nome}-1`, criadoEm: new Date(), atualizadoEm: new Date(), ...entrada };
      return ultimoSalvo;
    }),
    remove: jest.fn(async (entrada: Record<string, unknown>) => entrada),
    find: jest.fn(async (criterios?: { where?: Record<string, unknown> }) => {
      if (nome === 'bloqueioExterno') return dados.bloqueiosExternos ?? [];
      if (nome === 'bloqueioManual') return dados.bloqueiosManuais ?? [];
      const consultas = (dados.consultas ?? []) as Array<Record<string, unknown>>;
      const status = criterios?.where?.status as { _value?: unknown[] } | string | undefined;
      const statusAceitos = typeof status === 'string' ? [status] : status?._value;
      return consultas.filter((consulta) => {
        if (criterios?.where?.tenantId && consulta.tenantId !== criterios.where.tenantId) return false;
        if (criterios?.where?.profissionalId && consulta.profissionalId !== criterios.where.profissionalId) return false;
        return !statusAceitos || statusAceitos.includes(consulta.status);
      });
    }),
    findOne: jest.fn(async (criterios?: { where?: Record<string, unknown> }) => {
      if (nome === 'paciente') {
        const pacientes =
          (dados.pacientes as Array<Record<string, unknown>> | undefined) ??
          (dados.paciente ? [dados.paciente as Record<string, unknown>] : []);
        return (
          pacientes.find((paciente) =>
            Object.entries(criterios?.where ?? {}).every(([chave, valor]) => {
              if (valor && typeof valor === 'object' && '_type' in (valor as Record<string, unknown>)) {
                return (valor as { _type?: string })._type === 'isNull'
                  ? paciente[chave] === undefined || paciente[chave] === null
                  : true;
              }
              return paciente[chave] === valor;
            })
          ) ?? null
        );
      }
      if (nome === 'profissional') return dados.profissional ?? null;
      if (nome === 'bloqueioManual') {
        const bloqueios = (dados.bloqueiosManuais ?? []) as Array<Record<string, unknown>>;
        return bloqueios.find((bloqueio) =>
          Object.entries(criterios?.where ?? {}).every(([chave, valor]) => bloqueio[chave] === valor)
        ) ?? null;
      }
      const consultas = dados.consultas as Array<Record<string, unknown>> | undefined;
      if (consultas && criterios?.where) {
        const candidatas = ultimoSalvo ? [ultimoSalvo, ...consultas] : consultas;
        return (
          candidatas.find((consulta) =>
            Object.entries(criterios.where ?? {}).every(([chave, valor]) => consulta[chave] === valor)
          ) ?? null
        );
      }
      return dados.consulta ?? ultimoSalvo;
    }),
    exists: jest.fn(async (criterios: { where: Record<string, unknown> }) => {
      if (nome === 'bloqueioExterno' || nome === 'bloqueioManual') {
        const bloqueios = (nome === 'bloqueioExterno' ? dados.bloqueiosExternos ?? [] : dados.bloqueiosManuais ?? []) as Array<Record<string, unknown>>;
        const where = criterios.where;
        return bloqueios.some((bloqueio) => {
          // Verificar tenantId e profissionalId
          if (bloqueio.tenantId !== where.tenantId || bloqueio.profissionalId !== where.profissionalId) return false;
          // Verificar LessThan(inicioEm) e MoreThan(fimEm)
          const inicioEmOperador = where.inicioEm as { _value?: Date };
          const fimEmOperador = where.fimEm as { _value?: Date };
          if (inicioEmOperador?._value && fimEmOperador?._value) {
            return (bloqueio.inicioEm as Date) < inicioEmOperador._value && (bloqueio.fimEm as Date) > fimEmOperador._value;
          }
          return false;
        });
      }
      return false;
    })
  };
}

function criarServico(dados: Record<string, unknown> = {}) {
  const repositorios = {
    consulta: criarRepositorioFake('consulta', dados),
    paciente: criarRepositorioFake('paciente', dados),
    profissional: criarRepositorioFake('profissional', dados),
    bloqueioExterno: criarRepositorioFake('bloqueioExterno', dados),
    bloqueioManual: criarRepositorioFake('bloqueioManual', dados)
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === AgendaConsultaOrm) return repositorios.consulta;
      if (entidade === PacienteOrm) return repositorios.paciente;
      if (entidade === ProfissionalOrm) return repositorios.profissional;
      if (entidade === AgendaBloqueioExternoOrm) return repositorios.bloqueioExterno;
      if (entidade.name === 'AgendaBloqueioManualOrm') return repositorios.bloqueioManual;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };
  const criptografia = {
    descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8').replace('cripto:', ''))
  } as unknown as CriptografiaDadosSensiveis;
  const googleCalendar = {
    criarEvento: jest.fn(async () => ({ sincronizado: true, calendarId: 'primary', eventId: 'event-1', htmlLink: 'https://calendar.google/event' })),
    atualizarEvento: jest.fn(async () => ({ sincronizado: true, calendarId: 'primary', eventId: 'event-1', htmlLink: 'https://calendar.google/event-editado' })),
    cancelarEvento: jest.fn(async () => ({ sincronizado: true, calendarId: 'primary', eventId: 'event-1', htmlLink: 'https://calendar.google/event-editado' }))
  };
  const comunicacoes = {
    listarCanais: jest.fn(async () => [
      ...((dados.canais as Array<Record<string, unknown>> | undefined) ?? [
        { id: 'canal-email', tipo: 'email', ativo: true, nome: 'Email' },
        { id: 'canal-whatsapp', tipo: 'whatsapp', ativo: true, nome: 'WhatsApp' }
      ])
    ]),
    listarTemplates: jest.fn(async () => [
      ...((dados.templates as Array<Record<string, unknown>> | undefined) ?? [
        { id: 'template-email', canal: 'email', aprovado: true, nome: 'Agendamento email', conteudo: {} },
        { id: 'template-whatsapp', canal: 'whatsapp', aprovado: true, nome: 'Agendamento WhatsApp', conteudo: {} }
      ])
    ]),
    dispararMensagem: jest.fn(async (_tenantId: string, entrada: { canalId: string }) => ({
      id: entrada.canalId === 'canal-email' ? 'mensagem-email' : 'mensagem-whatsapp'
    }))
  };
  const processador = {
    processarMensagem: jest.fn(async () => undefined)
  };
  const servicoConexao = {
    obterConexaoAtiva: jest.fn(async () => (dados.credenciaisGoogle as unknown) ?? undefined)
  };

  return {
    servico: new ServicoAgenda(
      executorTenant as never,
      criptografia,
      googleCalendar as never,
      comunicacoes as never,
      processador as never,
      servicoConexao as never
    ),
    repositorios,
    googleCalendar,
    comunicacoes,
    processador,
    servicoConexao
  };
}

describe('ServicoAgenda', () => {
  it('lista no feed apenas o intervalo solicitado e oculta os detalhes de bloqueio Google', async () => {
    const { servico } = criarServico({
      consultas: [
        {
          id: 'consulta-visivel',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          profissionalId: 'profissional-1',
          titulo: 'Consulta - Ana',
          inicioEm: new Date('2026-08-10T12:00:00.000Z'),
          fimEm: new Date('2026-08-10T13:00:00.000Z'),
          timezone: 'America/Sao_Paulo',
          status: 'agendada',
          notificacoes: {},
          payload: { pacienteNome: 'Ana' }
        },
        {
          id: 'consulta-fora-do-periodo',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-2',
          profissionalId: 'profissional-1',
          titulo: 'Consulta - Fora',
          inicioEm: new Date('2026-08-20T12:00:00.000Z'),
          fimEm: new Date('2026-08-20T13:00:00.000Z'),
          timezone: 'America/Sao_Paulo',
          status: 'agendada',
          notificacoes: {},
          payload: { pacienteNome: 'Fora' }
        }
      ],
      bloqueiosExternos: [
        {
          id: 'bloqueio-google-1',
          tenantId: 'tenant-1',
          profissionalId: 'profissional-1',
          googleEventId: 'evento-privado-google',
          inicioEm: new Date('2026-08-11T14:00:00.000Z'),
          fimEm: new Date('2026-08-11T15:00:00.000Z')
        }
      ]
    });

    const resultado = await (servico as unknown as {
      listarFeed: (tenantId: string, dados: { inicioEm: string; fimEm: string; profissionalId?: string }, usuario: UsuarioAutenticado) => Promise<unknown[]>;
    }).listarFeed(
      'tenant-1',
      { inicioEm: '2026-08-10T00:00:00.000Z', fimEm: '2026-08-17T00:00:00.000Z', profissionalId: 'profissional-1' },
      usuarioColaborador
    );

    expect(resultado).toEqual([
      expect.objectContaining({ id: 'consulta-visivel', tipo: 'consulta' }),
      {
        id: 'bloqueio-google-1',
        tipo: 'google_indisponivel',
        profissionalId: 'profissional-1',
        inicioEm: new Date('2026-08-11T14:00:00.000Z'),
        fimEm: new Date('2026-08-11T15:00:00.000Z'),
        rotulo: 'Indisponivel'
      }
    ]);
    expect(JSON.stringify(resultado)).not.toContain('evento-privado-google');
  });

  it('cria e remove bloqueio manual do profissional sem expor uma consulta', async () => {
    const bloqueio = {
      id: 'bloqueio-manual-1',
      tenantId: 'tenant-1',
      profissionalId: 'profissional-1',
      tipo: 'reuniao',
      inicioEm: new Date('2026-08-12T10:00:00.000Z'),
      fimEm: new Date('2026-08-12T11:00:00.000Z')
    };
    const profissional = { id: 'profissional-1', tenantId: 'tenant-1', arquivadoEm: null };
    const { servico } = criarServico({ profissional });

    const resultado = await servico.criarBloqueioManual(
      'tenant-1',
      { profissionalId: 'profissional-1', tipo: 'reuniao', inicioEm: '2026-08-12T10:00:00.000Z', fimEm: '2026-08-12T11:00:00.000Z' },
      usuarioColaborador
    );
    const { servico: servicoComBloqueio, repositorios } = criarServico({ profissional, bloqueiosManuais: [bloqueio] });
    await expect(
      (servicoComBloqueio as unknown as { removerBloqueioManual: (tenantId: string, bloqueioId: string, usuario: UsuarioAutenticado) => Promise<{ id: string }> }).removerBloqueioManual(
        'tenant-1',
        'bloqueio-manual-1',
        usuarioColaborador
      )
    ).resolves.toEqual({ id: 'bloqueio-manual-1' });

    expect(resultado).toEqual(expect.objectContaining({ tipo: 'bloqueio_manual', rotulo: 'Reuniao' }));
    expect(repositorios.bloqueioManual.remove).toHaveBeenCalledWith(bloqueio);
  });

  it('traduz corrida de sobreposicao ao criar consulta para conflito de horario', async () => {
    const { servico, repositorios } = criarServico({
      paciente: {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1',
        nomeCriptografado: Buffer.from('cripto:Ana Paula')
      },
      profissional: {
        id: 'profissional-1',
        tenantId: 'tenant-1',
        nomeCriptografado: Buffer.from('cripto:Dra Carla')
      }
    });
    repositorios.consulta.save.mockRejectedValueOnce(criarErroSobreposicaoAgenda());

    await expect(
      servico.criarConsulta(
        'tenant-1',
        {
          pacienteId: 'paciente-1',
          profissionalId: 'profissional-1',
          inicioEm: '2026-07-22T12:00:00.000Z',
          duracaoMinutos: 60
        },
        usuarioColaborador
      )
    ).rejects.toThrow('Ja existe consulta agendada neste horario para o profissional.');
  });

  it('traduz corrida de sobreposicao ao remarcar consulta para conflito de horario', async () => {
    const consultaExistente = {
      id: 'consulta-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      profissionalId: 'profissional-1',
      titulo: 'Consulta',
      inicioEm: new Date('2026-07-22T12:00:00.000Z'),
      fimEm: new Date('2026-07-22T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      status: 'agendada',
      notificacoes: {},
      payload: {}
    };
    const { servico, repositorios } = criarServico({ consultas: [consultaExistente] });
    repositorios.consulta.save.mockRejectedValueOnce(criarErroSobreposicaoAgenda());

    await expect(
      servico.remarcarConsultaComoSistema(
        'tenant-1',
        'consulta-1',
        {
          inicioEm: '2026-07-23T12:00:00.000Z',
          duracaoMinutos: 60
        },
        'profissional-1'
      )
    ).rejects.toThrow('Ja existe consulta agendada neste horario para o profissional.');
  });

  it('preserva como erro tecnico um 23P01 originado por outra constraint', async () => {
    const erroTecnico = criarErroExclusao('ex_outra_regra_de_exclusao');
    const { servico, repositorios } = criarServico({
      paciente: {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1',
        nomeCriptografado: Buffer.from('cripto:Ana Paula')
      },
      profissional: {
        id: 'profissional-1',
        tenantId: 'tenant-1',
        nomeCriptografado: Buffer.from('cripto:Dra Carla')
      }
    });
    repositorios.consulta.save.mockRejectedValueOnce(erroTecnico);

    await expect(
      servico.criarConsulta(
        'tenant-1',
        {
          pacienteId: 'paciente-1',
          profissionalId: 'profissional-1',
          inicioEm: '2026-07-22T12:00:00.000Z',
          duracaoMinutos: 60
        },
        usuarioColaborador
      )
    ).rejects.toBe(erroTecnico);
  });

  it('deve criar consulta, sincronizar Google Calendar e disparar notificacoes', async () => {
    const { servico, repositorios, googleCalendar, comunicacoes, processador } = criarServico({
      paciente: {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1',
        nomeCriptografado: Buffer.from('cripto:Ana Paula')
      },
      profissional: {
        id: 'profissional-1',
        tenantId: 'tenant-1',
        nomeCriptografado: Buffer.from('cripto:Dra Carla')
      }
    });

    const consulta = await servico.criarConsulta(
      'tenant-1',
      {
        pacienteId: 'paciente-1',
        profissionalId: 'profissional-1',
        inicioEm: '2026-07-22T12:00:00.000Z',
        duracaoMinutos: 60,
        local: 'Consultorio central',
        emailContato: 'ana@example.com',
        whatsappContato: '5511992362080',
        enviarNotificacoes: true
      },
      usuarioColaborador
    );

    expect(repositorios.consulta.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        pacienteId: 'paciente-1',
        profissionalId: 'profissional-1',
        status: 'agendada',
        inicioEm: new Date('2026-07-22T12:00:00.000Z'),
        fimEm: new Date('2026-07-22T13:00:00.000Z')
      })
    );
    expect(googleCalendar.criarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        resumo: 'Consulta OctaClin - Ana Paula',
        inicioEm: new Date('2026-07-22T12:00:00.000Z'),
        fimEm: new Date('2026-07-22T13:00:00.000Z'),
        timezone: 'America/Sao_Paulo',
        local: 'Consultorio central',
        emailConvidado: 'ana@example.com'
      })
    );
    expect(comunicacoes.dispararMensagem).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        pacienteId: 'paciente-1',
        canalId: 'canal-email',
        templateId: 'template-email',
        payload: expect.objectContaining({
          destino: 'ana@example.com',
          nomePaciente: 'Ana Paula',
          texto: expect.stringContaining('sua consulta foi agendada para 22/07/2026 as 09:00')
        })
      })
    );
    expect(comunicacoes.dispararMensagem).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        canalId: 'canal-whatsapp',
        templateId: 'template-whatsapp',
        payload: expect.objectContaining({
          destino: '5511992362080',
          observacao: expect.stringContaining('sua consulta foi agendada para 22/07/2026 as 09:00')
        })
      })
    );
    expect(processador.processarMensagem).toHaveBeenCalledWith('tenant-1', 'mensagem-email', { propagarErro: false });
    expect(processador.processarMensagem).toHaveBeenCalledWith('tenant-1', 'mensagem-whatsapp', { propagarErro: false });
    expect(consulta.googleEventId).toBe('event-1');
    expect(consulta.notificacoes.email).toEqual(expect.objectContaining({ status: 'enviado' }));
    expect(consulta.notificacoes.whatsapp).toEqual(expect.objectContaining({ status: 'enviado' }));
  });

  it('deve resolver credenciais Google do profissional conectado e repassar ao criar evento no Google Calendar', async () => {
    const credenciaisDoProfissional = {
      clientId: 'client-profissional-1',
      clientSecret: 'secret-profissional-1',
      refreshToken: 'refresh-profissional-1',
      calendarId: 'calendar-profissional-1'
    };
    const { servico, googleCalendar, servicoConexao } = criarServico({
      paciente: {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1',
        nomeCriptografado: Buffer.from('cripto:Ana Paula')
      },
      profissional: {
        id: 'profissional-1',
        tenantId: 'tenant-1',
        nomeCriptografado: Buffer.from('cripto:Dra Carla')
      },
      credenciaisGoogle: credenciaisDoProfissional
    });

    await servico.criarConsulta(
      'tenant-1',
      {
        pacienteId: 'paciente-1',
        profissionalId: 'profissional-1',
        inicioEm: '2026-07-22T12:00:00.000Z',
        duracaoMinutos: 60,
        enviarNotificacoes: false
      },
      usuarioColaborador
    );

    expect(servicoConexao.obterConexaoAtiva).toHaveBeenCalledWith('tenant-1', 'profissional-1');
    expect(googleCalendar.criarEvento).toHaveBeenCalledWith(
      expect.objectContaining({ credenciais: credenciaisDoProfissional })
    );
  });

  it('deve usar template Meta mapeado para consulta agendada e montar parametros do corpo', async () => {
    const { servico, comunicacoes } = criarServico({
      paciente: {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1',
        nomeCriptografado: Buffer.from('cripto:Ana Paula')
      },
      profissional: {
        id: 'profissional-1',
        tenantId: 'tenant-1',
        nomeCriptografado: Buffer.from('cripto:Dra Carla')
      },
      templates: [
        { id: 'template-email', canal: 'email', aprovado: true, nome: 'Agendamento email', conteudo: {} },
        {
          id: 'template-whatsapp-generico',
          canal: 'whatsapp',
          aprovado: true,
          nome: 'Resposta manual',
          codigoExterno: 'resposta_manual',
          conteudo: { evento: 'whatsapp.manual', idioma: 'pt_BR' }
        },
        {
          id: 'template-whatsapp-agenda',
          canal: 'whatsapp',
          aprovado: true,
          nome: 'Consulta agendada',
          codigoExterno: 'consulta_agendada',
          conteudo: {
            evento: 'agenda.consulta.agendada',
            idioma: 'pt_BR',
            parametros: ['nomePaciente', 'dataConsulta', 'horaConsulta']
          }
        }
      ]
    });

    await servico.criarConsulta(
      'tenant-1',
      {
        pacienteId: 'paciente-1',
        profissionalId: 'profissional-1',
        inicioEm: '2026-07-22T12:00:00.000Z',
        duracaoMinutos: 60,
        emailContato: 'ana@example.com',
        whatsappContato: '5511992362080',
        enviarNotificacoes: true
      },
      usuarioColaborador
    );

    expect(comunicacoes.dispararMensagem).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        canalId: 'canal-whatsapp',
        templateId: 'template-whatsapp-agenda',
        payload: expect.objectContaining({
          idioma: 'pt_BR',
          evento: 'agenda.consulta.agendada',
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: 'Ana Paula' },
                { type: 'text', text: '22/07/2026' },
                { type: 'text', text: '09:00' }
              ]
            }
          ]
        })
      })
    );
  });

  it('deve rejeitar consultas com data final anterior ao inicio', async () => {
    const { servico } = criarServico();

    await expect(
      servico.criarConsulta(
        'tenant-1',
        {
          pacienteId: 'paciente-1',
          inicioEm: '2026-07-22T12:00:00.000Z',
          fimEm: '2026-07-22T11:00:00.000Z'
        },
        usuarioColaborador
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deve rejeitar consulta que conflita com horario agendado do mesmo profissional', async () => {
    const { servico } = criarServico({
      paciente: {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1',
        nomeCriptografado: Buffer.from('cripto:Ana Paula')
      },
      profissional: {
        id: 'profissional-1',
        tenantId: 'tenant-1',
        nomeCriptografado: Buffer.from('cripto:Dra Carla')
      },
      consultas: [
        {
          id: 'consulta-existente',
          tenantId: 'tenant-1',
          profissionalId: 'profissional-1',
          pacienteId: 'paciente-2',
          status: 'agendada',
          inicioEm: new Date('2026-07-22T12:30:00.000Z'),
          fimEm: new Date('2026-07-22T13:30:00.000Z')
        }
      ]
    });

    await expect(
      servico.criarConsulta(
        'tenant-1',
        {
          pacienteId: 'paciente-1',
          profissionalId: 'profissional-1',
          inicioEm: '2026-07-22T12:00:00.000Z',
          duracaoMinutos: 60
        },
        usuarioColaborador
      )
    ).rejects.toThrow('Ja existe consulta agendada neste horario para o profissional.');
  });

  it('bloqueia agendamento quando ha um bloqueio externo do Google no mesmo horario', async () => {
    const { servico } = criarServico({
      paciente: {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1',
        nomeCriptografado: Buffer.from('cripto:Ana Paula')
      },
      profissional: {
        id: 'profissional-1',
        tenantId: 'tenant-1',
        nomeCriptografado: Buffer.from('cripto:Dra Carla')
      },
      bloqueiosExternos: [
        {
          id: 'bloqueio-1',
          tenantId: 'tenant-1',
          profissionalId: 'profissional-1',
          googleEventId: 'google-evento-externo-1',
          inicioEm: new Date('2026-07-22T12:30:00.000Z'),
          fimEm: new Date('2026-07-22T13:30:00.000Z')
        }
      ]
    });

    await expect(
      servico.criarConsulta(
        'tenant-1',
        {
          pacienteId: 'paciente-1',
          profissionalId: 'profissional-1',
          inicioEm: '2026-07-22T12:00:00.000Z',
          duracaoMinutos: 60
        },
        usuarioColaborador
      )
    ).rejects.toThrow('Ja existe consulta agendada neste horario para o profissional.');
  });

  it('detecta conflito com bloqueio externo consultando por sobreposicao de horario (nao mais em memoria com take:500)', async () => {
    const bloqueioInicio = new Date('2026-09-01T10:00:00.000Z');
    const bloqueioFim = new Date('2026-09-01T10:30:00.000Z');
    const janelaInicio = new Date('2026-09-01T09:45:00.000Z');
    const janelaFim = new Date('2026-09-01T10:15:00.000Z');
    const { servico, repositorios } = criarServico({
      paciente: {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1',
        nomeCriptografado: Buffer.from('cripto:Ana Paula')
      },
      profissional: {
        id: 'profissional-1',
        tenantId: 'tenant-1',
        nomeCriptografado: Buffer.from('cripto:Dra Carla')
      },
      bloqueiosExternos: [
        {
          id: 'bloqueio-agenda-externa-1',
          tenantId: 'tenant-1',
          profissionalId: 'profissional-1',
          googleEventId: 'google-event-external-1',
          inicioEm: bloqueioInicio,
          fimEm: bloqueioFim
        }
      ]
    });

    // Tentar agendar consulta que sobrepõe o bloqueio (janela: 09:45-10:15, bloqueio: 10:00-10:30)
    await expect(
      servico.criarConsulta(
        'tenant-1',
        {
          pacienteId: 'paciente-1',
          profissionalId: 'profissional-1',
          inicioEm: janelaInicio.toISOString(),
          fimEm: janelaFim.toISOString()
        },
        usuarioColaborador
      )
    ).rejects.toThrow('Ja existe consulta agendada neste horario para o profissional.');

    // Verificar que o .exists() foi chamado com tenantId, profissionalId, e os operadores TypeORM
    // onde inicioEm: LessThan(janelaFim) e fimEm: MoreThan(janelaInicio)
    expect(repositorios.bloqueioExterno.exists).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          profissionalId: 'profissional-1',
          inicioEm: expect.objectContaining({ _value: janelaFim }),
          fimEm: expect.objectContaining({ _value: janelaInicio })
        })
      })
    );
  });

  it('remarcarConsultaComoSistema atualiza a consulta usando o profissionalId informado, sem exigir UsuarioAutenticado', async () => {
    const consultaExistente = {
      id: 'consulta-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      profissionalId: 'prof-1',
      titulo: 'Consulta - Ana Paula',
      inicioEm: new Date('2026-07-22T12:00:00.000Z'),
      fimEm: new Date('2026-07-22T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      status: 'agendada',
      local: 'Sala 1',
      observacoes: 'Primeira consulta',
      googleCalendarId: 'primary',
      googleEventId: 'event-1',
      googleEventHtmlLink: 'https://calendar.google/event',
      notificacoes: {},
      payload: { pacienteNome: 'Ana Paula', profissionalNome: 'Dra Carla', emailContato: 'ana@example.com' },
      criadoEm: new Date('2026-07-20T12:00:00.000Z'),
      atualizadoEm: new Date('2026-07-20T12:00:00.000Z')
    };
    const { servico, googleCalendar, repositorios } = criarServico({
      consulta: consultaExistente,
      consultas: [consultaExistente]
    });

    const consulta = await servico.remarcarConsultaComoSistema(
      'tenant-1',
      'consulta-1',
      {
        inicioEm: '2026-07-23T14:00:00.000Z',
        duracaoMinutos: 45
      },
      'prof-1'
    );

    expect(repositorios.consulta.findOne).toHaveBeenCalledWith({
      where: { id: 'consulta-1', tenantId: 'tenant-1', profissionalId: 'prof-1' },
      lock: { mode: 'pessimistic_write' }
    });
    expect(consulta.inicioEm).toEqual(new Date('2026-07-23T14:00:00.000Z'));
    expect(consulta.fimEm).toEqual(new Date('2026-07-23T14:45:00.000Z'));
    expect(consulta.payload.historico).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          acao: 'remarcada',
          origem: 'google_agenda',
          inicioNovoEm: '2026-07-23T14:00:00.000Z'
        })
      ])
    );
    expect(googleCalendar.criarEvento).not.toHaveBeenCalled();
    expect(googleCalendar.atualizarEvento).not.toHaveBeenCalled();
  });

  it('deve remarcar consulta e atualizar evento no Google Calendar', async () => {
    const consultaExistente = {
      id: 'consulta-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      profissionalId: 'profissional-1',
      titulo: 'Consulta - Ana Paula',
      inicioEm: new Date('2026-07-22T12:00:00.000Z'),
      fimEm: new Date('2026-07-22T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      status: 'agendada',
      local: 'Sala 1',
      observacoes: 'Primeira consulta',
      googleCalendarId: 'primary',
      googleEventId: 'event-1',
      googleEventHtmlLink: 'https://calendar.google/event',
      notificacoes: {},
      payload: { pacienteNome: 'Ana Paula', profissionalNome: 'Dra Carla', emailContato: 'ana@example.com' },
      criadoEm: new Date('2026-07-20T12:00:00.000Z'),
      atualizadoEm: new Date('2026-07-20T12:00:00.000Z')
    };
    const { servico, googleCalendar, repositorios } = criarServico({
      consulta: consultaExistente,
      consultas: [consultaExistente]
    });

    const consulta = await servico.remarcarConsulta(
      'tenant-1',
      'consulta-1',
      {
        inicioEm: '2026-07-23T14:00:00.000Z',
        duracaoMinutos: 45,
        local: 'Sala 2',
        observacoes: 'Remarcada por solicitacao do paciente'
      },
      usuarioColaborador
    );

    expect(googleCalendar.atualizarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 'primary',
        eventId: 'event-1',
        inicioEm: new Date('2026-07-23T14:00:00.000Z'),
        fimEm: new Date('2026-07-23T14:45:00.000Z'),
        local: 'Sala 2',
        emailConvidado: 'ana@example.com'
      })
    );
    expect(repositorios.consulta.findOne).toHaveBeenCalledWith({
      where: { id: 'consulta-1', tenantId: 'tenant-1' },
      lock: { mode: 'pessimistic_write' }
    });
    expect(consulta.inicioEm).toEqual(new Date('2026-07-23T14:00:00.000Z'));
    expect(consulta.fimEm).toEqual(new Date('2026-07-23T14:45:00.000Z'));
    expect(consulta.notificacoes.googleCalendar).toEqual(expect.objectContaining({ sincronizado: true }));
    expect(consulta.payload.historico).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          acao: 'remarcada',
          inicioAnteriorEm: '2026-07-22T12:00:00.000Z',
          inicioNovoEm: '2026-07-23T14:00:00.000Z'
        })
      ])
    );
  });

  it('deve cancelar consulta e cancelar evento no Google Calendar', async () => {
    const consultaExistente = {
      id: 'consulta-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      profissionalId: 'profissional-1',
      titulo: 'Consulta - Ana Paula',
      inicioEm: new Date('2026-07-22T12:00:00.000Z'),
      fimEm: new Date('2026-07-22T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      status: 'agendada',
      googleCalendarId: 'primary',
      googleEventId: 'event-1',
      notificacoes: {},
      payload: { pacienteNome: 'Ana Paula' },
      criadoEm: new Date('2026-07-20T12:00:00.000Z'),
      atualizadoEm: new Date('2026-07-20T12:00:00.000Z')
    };
    const { servico, googleCalendar, repositorios } = criarServico({
      consulta: consultaExistente,
      consultas: [consultaExistente]
    });

    const consulta = await servico.cancelarConsulta(
      'tenant-1',
      'consulta-1',
      { motivo: 'Paciente solicitou remarcacao futura.' },
      usuarioColaborador
    );

    expect(googleCalendar.cancelarEvento).toHaveBeenCalledWith({ calendarId: 'primary', eventId: 'event-1' });
    expect(repositorios.consulta.findOne).toHaveBeenCalledWith({
      where: { id: 'consulta-1', tenantId: 'tenant-1' },
      lock: { mode: 'pessimistic_write' }
    });
    expect(consulta.status).toBe('cancelada');
    expect(consulta.payload.historico).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          acao: 'cancelada',
          motivo: 'Paciente solicitou remarcacao futura.'
        })
      ])
    );
  });

  it('registra origem profissional no historico ao cancelar pelo console', async () => {
    const consultaExistente = {
      id: 'consulta-profissional',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      profissionalId: 'profissional-1',
      titulo: 'Consulta - Ana Paula',
      inicioEm: new Date('2026-07-22T12:00:00.000Z'),
      fimEm: new Date('2026-07-22T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      status: 'agendada',
      notificacoes: {},
      payload: {}
    };
    const { servico } = criarServico({ consultas: [consultaExistente] });

    const consulta = await servico.cancelarConsulta(
      'tenant-1',
      consultaExistente.id,
      {},
      usuarioColaborador
    );

    expect(consulta.payload.historico).toEqual(
      expect.arrayContaining([expect.objectContaining({ acao: 'cancelada', origem: 'profissional' })])
    );
  });

  it('registra origem paciente somente quando a consulta pertence ao paciente autenticado', async () => {
    const consultaExistente = {
      id: 'consulta-paciente',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      profissionalId: 'profissional-1',
      titulo: 'Consulta - Ana Paula',
      inicioEm: new Date('2026-07-22T12:00:00.000Z'),
      fimEm: new Date('2026-07-22T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      status: 'agendada',
      notificacoes: {},
      payload: {}
    };
    const { servico } = criarServico({
      consultas: [consultaExistente],
      pacientes: [
        {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-1',
          profissionalResponsavelId: 'profissional-1'
        },
        {
          id: 'paciente-2',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-2',
          profissionalResponsavelId: 'profissional-1'
        }
      ]
    });
    const desmarcar = (
      servico as unknown as {
        desmarcarConsultaPeloPaciente(
          tenantId: string,
          consultaId: string,
          usuarioId: string
        ): Promise<{ payload: Record<string, unknown> }>;
      }
    ).desmarcarConsultaPeloPaciente;

    await expect(
      desmarcar.call(servico, 'tenant-1', consultaExistente.id, 'usuario-paciente-2')
    ).rejects.toThrow('Consulta nao encontrada.');

    const consulta = await desmarcar.call(
      servico,
      'tenant-1',
      consultaExistente.id,
      'usuario-paciente-1'
    );
    expect(consulta.payload.historico).toEqual(
      expect.arrayContaining([expect.objectContaining({ acao: 'cancelada', origem: 'paciente' })])
    );
  });

  it('registra origem google sem converter para origem interna', async () => {
    const consultaExistente = {
      id: 'consulta-google',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      profissionalId: 'profissional-1',
      titulo: 'Consulta - Ana Paula',
      inicioEm: new Date('2026-07-22T12:00:00.000Z'),
      fimEm: new Date('2026-07-22T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      status: 'agendada',
      notificacoes: {},
      payload: {}
    };
    const { servico } = criarServico({ consultas: [consultaExistente] });

    const consulta = await servico.cancelarConsultaComoSistema(
      'tenant-1',
      consultaExistente.id,
      {},
      'profissional-1'
    );

    expect(consulta.payload.historico).toEqual(
      expect.arrayContaining([expect.objectContaining({ acao: 'cancelada', origem: 'google' })])
    );
  });

  it('cancela o evento Google ao registrar cancelada como desfecho', async () => {
    const consultaExistente = {
      id: 'consulta-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      profissionalId: 'profissional-1',
      titulo: 'Consulta - Ana Paula',
      inicioEm: new Date('2026-07-22T12:00:00.000Z'),
      fimEm: new Date('2026-07-22T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      status: 'agendada',
      googleCalendarId: 'primary',
      googleEventId: 'event-1',
      notificacoes: {},
      payload: { pacienteNome: 'Ana Paula' },
      criadoEm: new Date('2026-07-20T12:00:00.000Z'),
      atualizadoEm: new Date('2026-07-20T12:00:00.000Z')
    };
    const { servico, googleCalendar, repositorios } = criarServico({
      consulta: consultaExistente,
      consultas: [consultaExistente]
    });

    const consulta = await servico.registrarDesfecho(
      'tenant-1',
      'consulta-1',
      { status: 'cancelada' },
      usuarioColaborador
    );

    expect(googleCalendar.cancelarEvento).toHaveBeenCalledWith({ calendarId: 'primary', eventId: 'event-1' });
    expect(repositorios.consulta.findOne).toHaveBeenCalledWith({
      where: { id: 'consulta-1', tenantId: 'tenant-1' },
      lock: { mode: 'pessimistic_write' }
    });
    expect(consulta).toEqual(
      expect.objectContaining({
        status: 'cancelada',
        notificacoes: expect.objectContaining({
          googleCalendar: expect.objectContaining({ sincronizado: true })
        })
      })
    );
    await expect(
      servico.registrarDesfecho('tenant-1', 'consulta-1', { status: 'cancelada' }, usuarioColaborador)
    ).rejects.toThrow('Consulta encerrada nao pode receber novo desfecho.');
    expect(googleCalendar.cancelarEvento).toHaveBeenCalledTimes(1);
  });

  it('permite ao profissional concluir apenas a propria consulta', async () => {
    const consultaUm = {
      id: 'consulta-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      profissionalId: 'profissional-1',
      titulo: 'Consulta - Ana Paula',
      inicioEm: new Date('2026-07-22T12:00:00.000Z'),
      fimEm: new Date('2026-07-22T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      status: 'agendada',
      notificacoes: {},
      payload: {},
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };
    const consultaDois = {
      ...consultaUm,
      id: 'consulta-2',
      pacienteId: 'paciente-2',
      profissionalId: 'profissional-2'
    };
    const { servico, repositorios } = criarServico({
      profissional: {
        id: 'profissional-1',
        tenantId: 'tenant-1',
        usuarioId: 'usuario-profissional-1'
      },
      consultas: [consultaUm, consultaDois]
    });

    await expect(
      servico.registrarDesfecho('tenant-1', 'consulta-1', { status: 'concluida' }, usuarioProfissional)
    ).resolves.toEqual(expect.objectContaining({ status: 'concluida' }));
    await expect(
      servico.registrarDesfecho('tenant-1', 'consulta-2', { status: 'falta' }, usuarioProfissional)
    ).rejects.toThrow('Consulta nao encontrada.');
    expect(repositorios.consulta.findOne).toHaveBeenCalledWith({
      where: {
        id: 'consulta-1',
        tenantId: 'tenant-1',
        profissionalId: 'profissional-1'
      },
      lock: { mode: 'pessimistic_write' }
    });
  });

  it('mantem consulta reagendada ativa e nao permite desfecho terminal duas vezes', async () => {
    const consulta = {
      id: 'consulta-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      profissionalId: 'profissional-1',
      titulo: 'Consulta - Ana Paula',
      inicioEm: new Date('2026-07-22T12:00:00.000Z'),
      fimEm: new Date('2026-07-22T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      status: 'agendada',
      googleCalendarId: 'primary',
      googleEventId: 'event-1',
      notificacoes: {},
      payload: {},
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };
    const { servico } = criarServico({
      profissional: {
        id: 'profissional-1',
        tenantId: 'tenant-1',
        usuarioId: 'usuario-profissional-1'
      },
      consultas: [consulta]
    });

    await servico.remarcarConsulta(
      'tenant-1',
      'consulta-1',
      { inicioEm: '2026-07-23T14:00:00.000Z', duracaoMinutos: 45 },
      usuarioProfissional
    );
    expect(consulta.status).toBe('reagendada');

    await servico.registrarDesfecho(
      'tenant-1',
      'consulta-1',
      { status: 'concluida' },
      usuarioProfissional
    );
    await expect(
      servico.registrarDesfecho('tenant-1', 'consulta-1', { status: 'falta' }, usuarioProfissional)
    ).rejects.toThrow('Consulta encerrada nao pode receber novo desfecho.');
    await expect(
      servico.cancelarConsulta('tenant-1', 'consulta-1', {}, usuarioProfissional)
    ).rejects.toThrow('Consulta encerrada nao pode ser cancelada.');
  });

  it('mantem reagendada em conflito e libera horario de consulta terminal', async () => {
    const consultaReagendada = {
      id: 'consulta-reagendada',
      tenantId: 'tenant-1',
      profissionalId: 'profissional-1',
      pacienteId: 'paciente-2',
      status: 'reagendada',
      inicioEm: new Date('2026-07-22T12:30:00.000Z'),
      fimEm: new Date('2026-07-22T13:30:00.000Z')
    };
    const consultaConcluida = {
      ...consultaReagendada,
      id: 'consulta-concluida',
      status: 'concluida'
    };
    const dadosBase = {
      paciente: {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1',
        nomeCriptografado: Buffer.from('cripto:Ana Paula')
      },
      profissional: {
        id: 'profissional-1',
        tenantId: 'tenant-1',
        nomeCriptografado: Buffer.from('cripto:Dra Carla')
      }
    };
    const entrada = {
      pacienteId: 'paciente-1',
      profissionalId: 'profissional-1',
      inicioEm: '2026-07-22T12:00:00.000Z',
      duracaoMinutos: 60
    };

    const servicoComReagendada = criarServico({ ...dadosBase, consultas: [consultaReagendada] }).servico;
    await expect(
      servicoComReagendada.criarConsulta('tenant-1', entrada, usuarioColaborador)
    ).rejects.toThrow('Ja existe consulta agendada neste horario para o profissional.');

    const servicoComConcluida = criarServico({ ...dadosBase, consultas: [consultaConcluida] }).servico;
    await expect(
      servicoComConcluida.criarConsulta('tenant-1', entrada, usuarioColaborador)
    ).resolves.toEqual(expect.objectContaining({ status: 'agendada' }));
  });

  it('deve respeitar contato estruturado e preferencias do portal do paciente', async () => {
    const { servico, comunicacoes } = criarServico({
      paciente: {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1',
        nomeCriptografado: Buffer.from('cripto:Ana Paula'),
        contatoCriptografado: Buffer.from(
          'cripto:{"email":"ana@example.com","whatsapp":"5511992362080","preferencias":{"email":true,"whatsapp":false}}'
        )
      },
      profissional: {
        id: 'profissional-1',
        tenantId: 'tenant-1',
        nomeCriptografado: Buffer.from('cripto:Dra Carla')
      }
    });

    const consulta = await servico.criarConsulta(
      'tenant-1',
      {
        pacienteId: 'paciente-1',
        inicioEm: '2026-07-22T12:00:00.000Z',
        enviarNotificacoes: true
      },
      usuarioColaborador
    );

    expect(comunicacoes.dispararMensagem).toHaveBeenCalledTimes(1);
    expect(comunicacoes.dispararMensagem).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        canalId: 'canal-email',
        payload: expect.objectContaining({ destino: 'ana@example.com' })
      })
    );
    expect(consulta.notificacoes.whatsapp).toEqual({ status: 'ignorado', motivo: 'contato_ausente' });
  });

  describe('escopo pacientes_responsaveis para Professional', () => {
    it('deve forcar profissionalId para o proprio profissional ao criar consulta como Professional', async () => {
      const { servico, repositorios } = criarServico({
        paciente: {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          profissionalResponsavelId: 'profissional-outro-2',
          nomeCriptografado: Buffer.from('cripto:Ana Paula')
        },
        profissional: {
          id: 'profissional-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-profissional-1',
          nomeCriptografado: Buffer.from('cripto:Dra Carla')
        }
      });

      await servico.criarConsulta(
        'tenant-1',
        {
          pacienteId: 'paciente-1',
          profissionalId: 'profissional-outro-2',
          inicioEm: '2026-07-22T12:00:00.000Z',
          duracaoMinutos: 60,
          enviarNotificacoes: false
        },
        usuarioProfissional
      );

      expect(repositorios.consulta.save).toHaveBeenCalledWith(
        expect.objectContaining({ profissionalId: 'profissional-1' })
      );
    });

    it('deve listar consultas filtrando apenas pelo profissional autenticado', async () => {
      const { servico, repositorios } = criarServico({
        profissional: { id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' }
      });

      await servico.listarConsultas('tenant-1', usuarioProfissional);

      expect(repositorios.consulta.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ profissionalId: 'profissional-1' }) })
      );
    });

    it('deve tratar consulta de outro profissional como nao encontrada ao remarcar', async () => {
      const repositorios = {
        consulta: {
          create: jest.fn((entrada: Record<string, unknown>) => entrada),
          save: jest.fn(async (entrada: Record<string, unknown>) => entrada),
          find: jest.fn(async () => []),
          findOne: jest.fn(async () => null)
        },
        paciente: { findOne: jest.fn(async () => null) },
        profissional: {
          findOne: jest.fn(async () => ({ id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' }))
        }
      };
      const gerenciador = {
        getRepository: jest.fn((entidade: { name: string }) => {
          if (entidade === AgendaConsultaOrm) return repositorios.consulta;
          if (entidade === PacienteOrm) return repositorios.paciente;
          if (entidade === ProfissionalOrm) return repositorios.profissional;
          throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
        })
      };
      const servico = new ServicoAgenda(
        {
          executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
            operacao(gerenciador)
          )
        } as never,
        { descriptografar: jest.fn() } as never,
        {} as never,
        {} as never,
        {} as never,
        { obterConexaoAtiva: jest.fn(async () => undefined) } as never
      );

      await expect(
        servico.remarcarConsulta(
          'tenant-1',
          'consulta-1',
          { inicioEm: '2026-07-23T14:00:00.000Z', duracaoMinutos: 45 },
          usuarioProfissional
        )
      ).rejects.toThrow('Consulta nao encontrada.');

      expect(repositorios.consulta.findOne).toHaveBeenCalledWith({
        where: { id: 'consulta-1', tenantId: 'tenant-1', profissionalId: 'profissional-1' },
        lock: { mode: 'pessimistic_write' }
      });
    });

    it('remarcarConsultaComoSistema lanca NotFoundException quando tenantId/profissionalId nao correspondem ao dono real da consulta, mesmo com o octaclinConsultaId correto', async () => {
      // Simula o comportamento real do banco: o where clause com tenantId/profissionalId do dono
      // verdadeiro (resolvido pelo ServicoSincronizacaoGoogleCalendar a partir do canal watch confiavel)
      // filtra a consulta fora do resultado quando o webhook informa um tenant/profissional errado,
      // mesmo que o octaclinConsultaId aponte para uma consulta real de outro tenant.
      const repositorioConsulta = {
        create: jest.fn((entrada: Record<string, unknown>) => entrada),
        save: jest.fn(async (entrada: Record<string, unknown>) => entrada),
        find: jest.fn(async () => []),
        findOne: jest.fn(async (consulta: { where: Record<string, unknown> }) => {
          const dono = { id: 'consulta-1', tenantId: 'tenant-legitimo', profissionalId: 'profissional-legitimo' };
          const bate = Object.entries(consulta.where).every(([chave, valor]) => (dono as Record<string, unknown>)[chave] === valor);
          return bate ? dono : null;
        })
      };
      const gerenciador = {
        getRepository: jest.fn((entidade: { name: string }) => {
          if (entidade === AgendaConsultaOrm) return repositorioConsulta;
          throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
        })
      };
      const servico = new ServicoAgenda(
        {
          executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
            operacao(gerenciador)
          )
        } as never,
        { descriptografar: jest.fn() } as never,
        {} as never,
        {} as never,
        {} as never,
        { obterConexaoAtiva: jest.fn(async () => undefined) } as never
      );

      await expect(
        servico.remarcarConsultaComoSistema(
          'tenant-atacante',
          'consulta-1',
          { inicioEm: '2026-07-23T14:00:00.000Z', duracaoMinutos: 45 },
          'profissional-atacante'
        )
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(repositorioConsulta.findOne).toHaveBeenCalledWith({
        where: { id: 'consulta-1', tenantId: 'tenant-atacante', profissionalId: 'profissional-atacante' },
        lock: { mode: 'pessimistic_write' }
      });
    });
  });
});

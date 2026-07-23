import { BadRequestException } from '@nestjs/common';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
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

function criarRepositorioFake(nome: string, dados: Record<string, unknown>) {
  let ultimoSalvo: Record<string, unknown> | null = null;
  return {
    create: jest.fn((entrada: Record<string, unknown>) => entrada),
    save: jest.fn(async (entrada: Record<string, unknown>) => {
      ultimoSalvo = { id: `${nome}-1`, criadoEm: new Date(), atualizadoEm: new Date(), ...entrada };
      return ultimoSalvo;
    }),
    find: jest.fn(async () => dados.consultas ?? []),
    findOne: jest.fn(async () => {
      if (nome === 'paciente') return dados.paciente ?? null;
      if (nome === 'profissional') return dados.profissional ?? null;
      return dados.consulta ?? ultimoSalvo;
    })
  };
}

function criarServico(dados: Record<string, unknown> = {}) {
  const repositorios = {
    consulta: criarRepositorioFake('consulta', dados),
    paciente: criarRepositorioFake('paciente', dados),
    profissional: criarRepositorioFake('profissional', dados)
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === AgendaConsultaOrm) return repositorios.consulta;
      if (entidade === PacienteOrm) return repositorios.paciente;
      if (entidade === ProfissionalOrm) return repositorios.profissional;
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

  return {
    servico: new ServicoAgenda(
      executorTenant as never,
      criptografia,
      googleCalendar as never,
      comunicacoes as never,
      processador as never
    ),
    repositorios,
    googleCalendar,
    comunicacoes,
    processador
  };
}

describe('ServicoAgenda', () => {
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
        timezone: 'America/Sao_Paulo'
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
    expect(consulta.notificacoes.email.status).toBe('enviado');
    expect(consulta.notificacoes.whatsapp.status).toBe('enviado');
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
      payload: { pacienteNome: 'Ana Paula', profissionalNome: 'Dra Carla' },
      criadoEm: new Date('2026-07-20T12:00:00.000Z'),
      atualizadoEm: new Date('2026-07-20T12:00:00.000Z')
    };
    const { servico, googleCalendar } = criarServico({ consulta: consultaExistente, consultas: [consultaExistente] });

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
        local: 'Sala 2'
      })
    );
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
    const { servico, googleCalendar } = criarServico({ consulta: consultaExistente, consultas: [consultaExistente] });

    const consulta = await servico.cancelarConsulta(
      'tenant-1',
      'consulta-1',
      { motivo: 'Paciente solicitou remarcacao futura.' },
      usuarioColaborador
    );

    expect(googleCalendar.cancelarEvento).toHaveBeenCalledWith({ calendarId: 'primary', eventId: 'event-1' });
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
        {} as never
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
        where: { id: 'consulta-1', tenantId: 'tenant-1', profissionalId: 'profissional-1' }
      });
    });
  });
});

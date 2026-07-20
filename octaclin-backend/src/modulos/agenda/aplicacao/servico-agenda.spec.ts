import { BadRequestException } from '@nestjs/common';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AgendaConsultaOrm } from '../infraestrutura/agenda-consulta.orm';
import { ServicoAgenda } from './servico-agenda';

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
    criarEvento: jest.fn(async () => ({ sincronizado: true, calendarId: 'primary', eventId: 'event-1', htmlLink: 'https://calendar.google/event' }))
  };
  const comunicacoes = {
    listarCanais: jest.fn(async () => [
      { id: 'canal-email', tipo: 'email', ativo: true, nome: 'Email' },
      { id: 'canal-whatsapp', tipo: 'whatsapp', ativo: true, nome: 'WhatsApp' }
    ]),
    listarTemplates: jest.fn(async () => [
      { id: 'template-email', canal: 'email', aprovado: true, nome: 'Agendamento email' },
      { id: 'template-whatsapp', canal: 'whatsapp', aprovado: true, nome: 'Agendamento WhatsApp' }
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

    const consulta = await servico.criarConsulta('tenant-1', {
      pacienteId: 'paciente-1',
      profissionalId: 'profissional-1',
      inicioEm: '2026-07-22T12:00:00.000Z',
      duracaoMinutos: 60,
      emailContato: 'ana@example.com',
      whatsappContato: '5511992362080',
      enviarNotificacoes: true
    });

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

  it('deve rejeitar consultas com data final anterior ao inicio', async () => {
    const { servico } = criarServico();

    await expect(
      servico.criarConsulta('tenant-1', {
        pacienteId: 'paciente-1',
        inicioEm: '2026-07-22T12:00:00.000Z',
        fimEm: '2026-07-22T11:00:00.000Z'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

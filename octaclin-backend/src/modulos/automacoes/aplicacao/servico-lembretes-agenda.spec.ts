import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { CanalNotificacaoOrm } from '../../comunicacoes/infraestrutura/canal-notificacao.orm';
import { TemplateMensagemOrm } from '../../comunicacoes/infraestrutura/template-mensagem.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ServicoLembretesAgenda } from './servico-lembretes-agenda';

function criarRepositorioConsultas(dados: Record<string, unknown>) {
  return {
    find: jest.fn(async () => dados.consultas ?? []),
    save: jest.fn(async (entrada: Record<string, unknown>) => entrada)
  };
}

function criarServico(dados: Record<string, unknown> = {}) {
  const repositorioConsultas = criarRepositorioConsultas(dados);
  const repositorioPacientes = {
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
      ((dados.pacientes as Record<string, unknown>[] | undefined) ?? []).find((paciente) =>
        Object.entries(where).every(([chave, valor]) => paciente[chave] === valor)
      ) ?? null
    )
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === AgendaConsultaOrm) return repositorioConsultas;
      if (entidade === PacienteOrm) return repositorioPacientes;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };
  const comunicacoes = {
    listarCanais: jest.fn(async () =>
      (dados.canais as CanalNotificacaoOrm[] | undefined) ?? [
        { id: 'canal-email', tipo: 'email', ativo: true, nome: 'Email' },
        { id: 'canal-whatsapp', tipo: 'whatsapp', ativo: true, nome: 'WhatsApp' }
      ]
    ),
    listarTemplates: jest.fn(async () =>
      (dados.templates as TemplateMensagemOrm[] | undefined) ?? [
        {
          id: 'template-email-lembrete',
          canal: 'email',
          aprovado: true,
          nome: 'Lembrete email',
          conteudo: { evento: 'agenda.consulta.lembrete' }
        },
        {
          id: 'template-whatsapp-lembrete',
          canal: 'whatsapp',
          aprovado: true,
          nome: 'Lembrete WhatsApp',
          codigoExterno: 'consulta_lembrete',
          conteudo: {
            evento: 'agenda.consulta.lembrete',
            idioma: 'pt_BR',
            parametros: ['nomePaciente', 'dataConsulta', 'horaConsulta']
          }
        }
      ]
    ),
    dispararMensagem: jest.fn(async (_tenantId: string, entrada: { canalId: string }) => ({
      id: entrada.canalId === 'canal-email' ? 'mensagem-email' : 'mensagem-whatsapp'
    })),
    publicarEventoNotificacao: jest.fn(async () => undefined)
  };
  const criptografia = {
    descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8').replace('cripto:', ''))
  };

  return {
    servico: new ServicoLembretesAgenda(executorTenant as never, comunicacoes as never, criptografia as never),
    repositorioConsultas,
    repositorioPacientes,
    comunicacoes,
  };
}

describe('ServicoLembretesAgenda', () => {
  it('deve enviar lembrete de consulta nas proximas 24h por email e WhatsApp com idempotencia registrada', async () => {
    const consulta = {
      id: 'consulta-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      titulo: 'Consulta - Ana Paula',
      inicioEm: new Date('2026-07-23T12:00:00.000Z'),
      fimEm: new Date('2026-07-23T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      status: 'agendada',
      notificacoes: {},
      payload: {
        pacienteNome: 'Ana Paula',
        profissionalNome: 'Dra Carla',
        emailContato: 'ana@example.com',
        whatsappContato: '5511992362080'
      }
    };
    const { servico, repositorioConsultas, comunicacoes } = criarServico({ consultas: [consulta] });

    const resultado = await servico.processarLembretesConsulta('tenant-1', new Date('2026-07-22T12:00:00.000Z'));

    expect(resultado).toEqual({ consultasAvaliadas: 1, lembretesProcessados: 1, lembretesIgnorados: 0 });
    expect(comunicacoes.dispararMensagem).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        canalId: 'canal-email',
        templateId: 'template-email-lembrete',
        payload: expect.objectContaining({
          destino: 'ana@example.com',
          evento: 'agenda.consulta.lembrete',
          texto: expect.stringContaining('lembrar que sua consulta esta agendada para 23/07/2026 as 09:00')
        })
      })
    );
    expect(comunicacoes.dispararMensagem).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        canalId: 'canal-whatsapp',
        templateId: 'template-whatsapp-lembrete',
        payload: expect.objectContaining({
          destino: '5511992362080',
          idioma: 'pt_BR',
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: 'Ana Paula' },
                { type: 'text', text: '23/07/2026' },
                { type: 'text', text: '09:00' }
              ]
            }
          ]
        })
      })
    );
    expect(comunicacoes.publicarEventoNotificacao).toHaveBeenCalledWith('tenant-1', 'mensagem-email');
    expect(comunicacoes.publicarEventoNotificacao).toHaveBeenCalledWith('tenant-1', 'mensagem-whatsapp');
    expect(repositorioConsultas.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'consulta-1',
        notificacoes: expect.objectContaining({
          lembrete24h: expect.objectContaining({
            status: 'processado',
            email: { status: 'pendente', mensagemId: 'mensagem-email' },
            whatsapp: { status: 'pendente', mensagemId: 'mensagem-whatsapp' }
          })
        })
      })
    );
  });

  it('deve ignorar consulta com lembrete ja processado sem reenviar mensagens', async () => {
    const { servico, repositorioConsultas, comunicacoes } = criarServico({
      consultas: [
        {
          id: 'consulta-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          titulo: 'Consulta - Ana Paula',
          inicioEm: new Date('2026-07-23T12:00:00.000Z'),
          fimEm: new Date('2026-07-23T13:00:00.000Z'),
          timezone: 'America/Sao_Paulo',
          status: 'agendada',
          notificacoes: { lembrete24h: { status: 'processado', processadoEm: '2026-07-22T11:00:00.000Z' } },
          payload: { pacienteNome: 'Ana Paula', emailContato: 'ana@example.com' }
        }
      ]
    });

    const resultado = await servico.processarLembretesConsulta('tenant-1', new Date('2026-07-22T12:00:00.000Z'));

    expect(resultado).toEqual({ consultasAvaliadas: 1, lembretesProcessados: 0, lembretesIgnorados: 1 });
    expect(comunicacoes.dispararMensagem).not.toHaveBeenCalled();
    expect(repositorioConsultas.save).not.toHaveBeenCalled();
  });

  it('deve respeitar canal preferido do paciente quando houver contato disponivel', async () => {
    const consulta = {
      id: 'consulta-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      titulo: 'Consulta - Ana Paula',
      inicioEm: new Date('2026-07-23T12:00:00.000Z'),
      fimEm: new Date('2026-07-23T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      status: 'agendada',
      notificacoes: {},
      payload: {
        pacienteNome: 'Ana Paula',
        emailContato: 'ana@example.com',
        whatsappContato: '5511992362080'
      }
    };
    const { servico, repositorioConsultas, comunicacoes } = criarServico({
      consultas: [consulta],
      pacientes: [
        {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          contatoCriptografado: Buffer.from(
            'cripto:{"email":"ana@example.com","whatsapp":"5511992362080","preferencias":{"email":true,"whatsapp":true,"canalPreferido":"whatsapp","horarioPermitido":{"inicio":"08:00","fim":"20:00","timezone":"America/Sao_Paulo"}}}'
          )
        }
      ]
    });

    await servico.processarLembretesConsulta('tenant-1', new Date('2026-07-22T12:00:00.000Z'));

    expect(comunicacoes.dispararMensagem).toHaveBeenCalledTimes(1);
    expect(comunicacoes.dispararMensagem).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        canalId: 'canal-whatsapp',
        payload: expect.objectContaining({ destino: '5511992362080' })
      })
    );
    expect(repositorioConsultas.save).toHaveBeenCalledWith(
      expect.objectContaining({
        notificacoes: expect.objectContaining({
          lembrete24h: expect.objectContaining({
            email: { status: 'ignorado', motivo: 'canal_nao_preferido' },
            whatsapp: { status: 'pendente', mensagemId: 'mensagem-whatsapp' }
          })
        })
      })
    );
  });

  it('deve ignorar lembrete fora do horario permitido pelo paciente', async () => {
    const consulta = {
      id: 'consulta-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      titulo: 'Consulta - Ana Paula',
      inicioEm: new Date('2026-07-23T12:00:00.000Z'),
      fimEm: new Date('2026-07-23T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      status: 'agendada',
      notificacoes: {},
      payload: {
        pacienteNome: 'Ana Paula',
        emailContato: 'ana@example.com',
        whatsappContato: '5511992362080'
      }
    };
    const { servico, repositorioConsultas, comunicacoes } = criarServico({
      consultas: [consulta],
      pacientes: [
        {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          contatoCriptografado: Buffer.from(
            'cripto:{"preferencias":{"email":true,"whatsapp":true,"canalPreferido":"qualquer","horarioPermitido":{"inicio":"13:00","fim":"18:00","timezone":"America/Sao_Paulo"}}}'
          )
        }
      ]
    });

    const resultado = await servico.processarLembretesConsulta('tenant-1', new Date('2026-07-22T12:00:00.000Z'));

    expect(resultado).toEqual({ consultasAvaliadas: 1, lembretesProcessados: 1, lembretesIgnorados: 0 });
    expect(comunicacoes.dispararMensagem).not.toHaveBeenCalled();
    expect(repositorioConsultas.save).toHaveBeenCalledWith(
      expect.objectContaining({
        notificacoes: expect.objectContaining({
          lembrete24h: expect.objectContaining({
            status: 'ignorado',
            motivo: 'fora_horario_preferido',
            email: { status: 'ignorado', motivo: 'fora_horario_preferido' },
            whatsapp: { status: 'ignorado', motivo: 'fora_horario_preferido' }
          })
        })
      })
    );
  });
});

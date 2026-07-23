import { NotFoundException } from '@nestjs/common';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { EnvioQuestionarioOrm } from '../../questionarios/infraestrutura/envio-questionario.orm';
import { QuestionarioOrm } from '../../questionarios/infraestrutura/questionario.orm';
import { RespostaCheckinOrm } from '../../questionarios/infraestrutura/resposta-checkin.orm';
import { AcompanhamentoTarefaOrm } from '../infraestrutura/acompanhamento-tarefa.orm';
import { EvolucaoClinicaOrm } from '../infraestrutura/evolucao-clinica.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { ServicoPacientes } from './servico-pacientes';

function criarGerenciadorFake(repositorio: Record<string, unknown>) {
  if ('paciente' in repositorio || 'profissional' in repositorio) {
    return {
      getRepository: jest.fn((entidade: unknown) => {
        if (entidade === PacienteOrm) return repositorio.paciente;
        if (entidade === ProfissionalOrm) return repositorio.profissional;
        return repositorio.paciente;
      })
    };
  }

  return {
    getRepository: jest.fn().mockReturnValue(repositorio)
  };
}

const limitesPermitidos = {
  checarLimite: jest.fn(async () => ({ permitido: true }))
};

describe('ServicoPacientes', () => {
  it('deve criar paciente dentro do contexto do tenant e criptografar dados sensiveis', async () => {
    const repositorioPacientes = {
      create: jest.fn((dados: Record<string, unknown>) => dados),
      save: jest.fn(async (dados: Record<string, unknown>) => ({ id: 'paciente-1', ...dados }))
    };
    const repositorioProfissionais = {
      findOne: jest.fn(async () => ({ id: 'profissional-1', tenantId: 'tenant-1' }))
    };
    const gerenciador = criarGerenciadorFake({
      paciente: repositorioPacientes,
      profissional: repositorioProfissionais
    });
    const executorTenant = {
      executar: jest.fn((tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao(gerenciador)
      )
    };
    const criptografia = {
      criptografar: jest.fn((valor: string) => Buffer.from(`criptografado:${valor}`)),
      descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('criptografado:', ''))
    };
    const servico = new ServicoPacientes(executorTenant as never, criptografia as never, limitesPermitidos as never);

    const paciente = await servico.criar('tenant-1', {
      profissionalResponsavelId: 'profissional-1',
      nome: 'Maria',
      contato: 'maria@example.com'
    });

    expect(executorTenant.executar).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    expect(criptografia.criptografar).toHaveBeenCalledWith('Maria');
    expect(paciente).toEqual(expect.objectContaining({ nome: 'Maria', contato: 'maria@example.com' }));
  });

  it('deve limitar a paginacao em no maximo 100 itens', async () => {
    const repositorio = {
      findAndCount: jest.fn(async () => [[], 0])
    };
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(criarGerenciadorFake(repositorio))
        )
      } as never,
      { criptografar: jest.fn(), descriptografar: jest.fn() } as never,
      limitesPermitidos as never
    );

    await servico.listar('tenant-1', 1, 500);

    expect(repositorio.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });

  it('deve bloquear criacao de paciente quando limite do plano for atingido', async () => {
    const repositorio = {
      create: jest.fn((dados: Record<string, unknown>) => dados),
      save: jest.fn(async (dados: Record<string, unknown>) => ({ id: 'paciente-1', ...dados }))
    };
    const executorTenant = {
      executar: jest.fn((tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao(criarGerenciadorFake(repositorio))
      )
    };
    const limites = {
      checarLimite: jest.fn(async () => ({
        permitido: false,
        recurso: 'pacientes',
        plano: 'Plano gratuito',
        uso: 25,
        limite: 25,
        restante: 0,
        mensagem: 'Limite de pacientes atingido para o Plano gratuito.'
      }))
    };
    const servico = new ServicoPacientes(
      executorTenant as never,
      { criptografar: jest.fn(), descriptografar: jest.fn() } as never,
      limites as never
    );

    await expect(
      servico.criar('tenant-1', {
        profissionalResponsavelId: 'profissional-1',
        nome: 'Maria',
        contato: 'maria@example.com'
      })
    ).rejects.toThrow('Limite de pacientes atingido para o Plano gratuito.');

    expect(limites.checarLimite).toHaveBeenCalledWith('tenant-1', 'pacientes');
    expect(repositorio.save).not.toHaveBeenCalled();
  });

  it('deve impedir criar paciente com profissional responsavel de outro tenant', async () => {
    const repositorioPacientes = {
      create: jest.fn((dados: Record<string, unknown>) => dados),
      save: jest.fn(async (dados: Record<string, unknown>) => ({ id: 'paciente-1', ...dados }))
    };
    const repositorioProfissionais = {
      findOne: jest.fn(async () => null)
    };
    const gerenciador = criarGerenciadorFake({
      paciente: repositorioPacientes,
      profissional: repositorioProfissionais
    });
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(gerenciador)
        )
      } as never,
      { criptografar: jest.fn(), descriptografar: jest.fn() } as never,
      limitesPermitidos as never
    );

    await expect(
      servico.criar('tenant-1', {
        profissionalResponsavelId: 'profissional-tenant-2',
        nome: 'Maria',
        contato: 'maria@example.com'
      })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repositorioProfissionais.findOne).toHaveBeenCalledWith({
      where: { id: 'profissional-tenant-2', tenantId: 'tenant-1', arquivadoEm: expect.any(Object) }
    });
    expect(repositorioPacientes.save).not.toHaveBeenCalled();
  });

  it('deve impedir atualizar paciente para profissional responsavel de outro tenant', async () => {
    const paciente = {
      id: 'paciente-1',
      tenantId: 'tenant-1',
      profissionalResponsavelId: 'profissional-1',
      nomeCriptografado: Buffer.from('cripto:Maria'),
      contatoCriptografado: Buffer.from('cripto:maria@example.com'),
      statusAdesao: 'novo',
      scoreRisco: '0'
    };
    const repositorioPacientes = {
      findOne: jest.fn(async () => paciente),
      save: jest.fn(async (dados: Record<string, unknown>) => dados)
    };
    const repositorioProfissionais = {
      findOne: jest.fn(async () => null)
    };
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(
            criarGerenciadorFake({
              paciente: repositorioPacientes,
              profissional: repositorioProfissionais
            })
          )
        )
      } as never,
      {
        criptografar: jest.fn(),
        descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', ''))
      } as never,
      limitesPermitidos as never
    );

    await expect(
      servico.atualizar('tenant-1', 'paciente-1', {
        profissionalResponsavelId: 'profissional-tenant-2'
      })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repositorioProfissionais.findOne).toHaveBeenCalledWith({
      where: { id: 'profissional-tenant-2', tenantId: 'tenant-1', arquivadoEm: expect.any(Object) }
    });
    expect(repositorioPacientes.save).not.toHaveBeenCalled();
  });

  it('deve retornar pacientes com campos sensiveis descriptografados na listagem', async () => {
    const repositorio = {
      findAndCount: jest.fn(async () => [
        [
          {
            id: 'paciente-1',
            tenantId: 'tenant-1',
            profissionalResponsavelId: 'profissional-1',
            nomeCriptografado: Buffer.from('cripto:Maria'),
            contatoCriptografado: Buffer.from('cripto:maria@example.com'),
            statusAdesao: 'novo',
            scoreRisco: '0',
            criadoEm: new Date('2026-01-01T00:00:00Z'),
            atualizadoEm: new Date('2026-01-01T00:00:00Z')
          }
        ],
        1
      ])
    };
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(criarGerenciadorFake(repositorio))
        )
      } as never,
      {
        criptografar: jest.fn(),
        descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', ''))
      } as never,
      limitesPermitidos as never
    );

    const resposta = await servico.listar('tenant-1');

    expect(resposta.itens[0]).toEqual(expect.objectContaining({ nome: 'Maria', contato: 'maria@example.com' }));
  });

  it('deve exibir contato principal quando paciente possui contato estruturado pelo portal', async () => {
    const repositorio = {
      findAndCount: jest.fn(async () => [
        [
          {
            id: 'paciente-1',
            tenantId: 'tenant-1',
            profissionalResponsavelId: 'profissional-1',
            nomeCriptografado: Buffer.from('cripto:Maria'),
            contatoCriptografado: Buffer.from(
              'cripto:{"email":"maria@example.com","whatsapp":"5511999999999","preferencias":{"email":true,"whatsapp":false}}'
            ),
            statusAdesao: 'novo',
            scoreRisco: '0',
            criadoEm: new Date('2026-01-01T00:00:00Z'),
            atualizadoEm: new Date('2026-01-01T00:00:00Z')
          }
        ],
        1
      ])
    };
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(criarGerenciadorFake(repositorio))
        )
      } as never,
      {
        criptografar: jest.fn(),
        descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', ''))
      } as never,
      limitesPermitidos as never
    );

    const resposta = await servico.listar('tenant-1');

    expect(resposta.itens[0]).toEqual(expect.objectContaining({ nome: 'Maria', contato: 'maria@example.com' }));
  });

  it('deve falhar ao arquivar paciente inexistente', async () => {
    const repositorio = {
      update: jest.fn(async () => ({ affected: 0 }))
    };
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(criarGerenciadorFake(repositorio))
        )
      } as never,
      { criptografar: jest.fn(), descriptografar: jest.fn() } as never,
      limitesPermitidos as never
    );

    await expect(servico.arquivar('tenant-1', 'paciente-inexistente')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deve montar prontuario longitudinal do paciente com agenda, formularios, respostas e mensagens', async () => {
    const paciente = {
      id: 'paciente-1',
      tenantId: 'tenant-1',
      profissionalResponsavelId: 'profissional-1',
      nomeCriptografado: Buffer.from('cripto:Maria'),
      contatoCriptografado: Buffer.from('cripto:maria@example.com'),
      statusAdesao: 'risco',
      scoreRisco: '82',
      ultimoCheckinEm: new Date('2026-07-21T10:00:00.000Z'),
      criadoEm: new Date('2026-07-01T10:00:00.000Z'),
      atualizadoEm: new Date('2026-07-21T10:00:00.000Z')
    };
    const repositorios = new Map<unknown, Record<string, unknown>>([
      [
        PacienteOrm,
        {
          findOne: jest.fn(async () => paciente)
        }
      ],
      [
        AgendaConsultaOrm,
        {
          find: jest.fn(async () => [
            {
              id: 'consulta-1',
              tenantId: 'tenant-1',
              pacienteId: 'paciente-1',
              titulo: 'Consulta de retorno',
              inicioEm: new Date('2026-07-22T13:00:00.000Z'),
              fimEm: new Date('2026-07-22T14:00:00.000Z'),
              status: 'agendada',
              local: 'Online'
            }
          ])
        }
      ],
      [
        EnvioQuestionarioOrm,
        {
          find: jest.fn(async () => [
            {
              id: 'envio-1',
              tenantId: 'tenant-1',
              pacienteId: 'paciente-1',
              questionarioId: 'questionario-1',
              status: 'enviado',
              enviadoEm: new Date('2026-07-20T13:00:00.000Z'),
              expiraEm: new Date('2026-07-25T13:00:00.000Z')
            }
          ])
        }
      ],
      [
        RespostaCheckinOrm,
        {
          find: jest.fn(async () => [
            {
              id: 'resposta-1',
              tenantId: 'tenant-1',
              pacienteId: 'paciente-1',
              envioQuestionarioId: 'envio-1',
              scoreFinal: '74.5',
              finalizadoEm: new Date('2026-07-21T15:00:00.000Z'),
              criadoEm: new Date('2026-07-21T14:55:00.000Z')
            }
          ])
        }
      ],
      [
        QuestionarioOrm,
        {
          find: jest.fn(async () => [
            {
              id: 'questionario-1',
              tenantId: 'tenant-1',
              titulo: 'Check-in semanal',
              status: 'publicado',
              versao: 2
            }
          ])
        }
      ],
      [
        AcompanhamentoTarefaOrm,
        {
          find: jest.fn(async () => [])
        }
      ],
      [
        EvolucaoClinicaOrm,
        {
          find: jest.fn(async () => [])
        }
      ],
      [
        MensagemNotificacaoOrm,
        {
          find: jest.fn(async () => [
            {
              id: 'mensagem-1',
              tenantId: 'tenant-1',
              pacienteId: 'paciente-1',
              status: 'recebido',
              payload: { texto: 'Estou com duvida no plano.' },
              criadoEm: new Date('2026-07-22T16:00:00.000Z')
            }
          ])
        }
      ]
    ]);
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao({ getRepository: jest.fn((entidade) => repositorios.get(entidade)) })
        )
      } as never,
      {
        criptografar: jest.fn(),
        descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', ''))
      } as never,
      limitesPermitidos as never
    );

    const prontuario = await servico.obterProntuario('tenant-1', 'paciente-1');

    expect(prontuario.paciente).toEqual(expect.objectContaining({ id: 'paciente-1', nome: 'Maria', contato: 'maria@example.com' }));
    expect(prontuario.resumo).toEqual({
      consultas: 1,
      formulariosPendentes: 1,
      respostas: 1,
      mensagens: 1,
      evolucoes: 0,
      tarefasPendentes: 0,
      ultimoEventoEm: new Date('2026-07-22T16:00:00.000Z')
    });
    expect(prontuario.linhaDoTempo.map((evento: { tipo: string }) => evento.tipo)).toEqual([
      'mensagem',
      'consulta',
      'resposta_formulario',
      'formulario'
    ]);
    expect(prontuario.linhaDoTempo[0]).toEqual(
      expect.objectContaining({
        titulo: 'Mensagem recebida',
        descricao: 'Estou com duvida no plano.'
      })
    );
    expect(prontuario.linhaDoTempo[2]).toEqual(
      expect.objectContaining({
        titulo: 'Resposta de Check-in semanal',
        descricao: 'Score final 74.5'
      })
    );
  });

  it('deve criar evolucao clinica privada criptografada e listar no prontuario', async () => {
    const paciente = {
      id: 'paciente-1',
      tenantId: 'tenant-1',
      profissionalResponsavelId: 'profissional-1',
      nomeCriptografado: Buffer.from('cripto:Maria'),
      statusAdesao: 'em_acompanhamento',
      scoreRisco: '40',
      criadoEm: new Date('2026-07-01T10:00:00.000Z'),
      atualizadoEm: new Date('2026-07-01T10:00:00.000Z')
    };
    const evolucoesSalvas: Record<string, unknown>[] = [];
    const repositorios = new Map<unknown, Record<string, unknown>>([
      [PacienteOrm, { findOne: jest.fn(async () => paciente) }],
      [AgendaConsultaOrm, { find: jest.fn(async () => []) }],
      [EnvioQuestionarioOrm, { find: jest.fn(async () => []) }],
      [RespostaCheckinOrm, { find: jest.fn(async () => []) }],
      [QuestionarioOrm, { find: jest.fn(async () => []) }],
      [MensagemNotificacaoOrm, { find: jest.fn(async () => []) }],
      [AcompanhamentoTarefaOrm, { find: jest.fn(async () => []) }],
      [
        EvolucaoClinicaOrm,
        {
          create: jest.fn((dados: Record<string, unknown>) => dados),
          save: jest.fn(async (dados: Record<string, unknown>) => {
            const salvo = {
              id: 'evolucao-1',
              criadoEm: new Date('2026-07-22T17:00:00.000Z'),
              atualizadoEm: new Date('2026-07-22T17:00:00.000Z'),
              ...dados
            };
            evolucoesSalvas.push(salvo);
            return salvo;
          }),
          find: jest.fn(async () => evolucoesSalvas)
        }
      ]
    ]);
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao({ getRepository: jest.fn((entidade) => repositorios.get(entidade)) })
        )
      } as never,
      {
        criptografar: jest.fn((valor: string) => Buffer.from(`cripto:${valor}`)),
        descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', ''))
      } as never,
      limitesPermitidos as never
    );

    const evolucao = await servico.criarEvolucaoClinica('tenant-1', 'paciente-1', 'usuario-profissional-1', {
      titulo: 'Consulta inicial',
      conteudo: 'Paciente relatou melhora de adesao.',
      tipo: 'consulta',
      visibilidade: 'privada'
    });
    const prontuario = await servico.obterProntuario('tenant-1', 'paciente-1');

    expect(evolucao).toEqual(
      expect.objectContaining({
        pacienteId: 'paciente-1',
        autorUsuarioId: 'usuario-profissional-1',
        titulo: 'Consulta inicial',
        conteudo: 'Paciente relatou melhora de adesao.',
        tipo: 'consulta',
        visibilidade: 'privada'
      })
    );
    expect(evolucoesSalvas[0]).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        conteudoCriptografado: Buffer.from('cripto:Paciente relatou melhora de adesao.')
      })
    );
    expect(prontuario.resumo.evolucoes).toBe(1);
    expect(prontuario.linhaDoTempo[0]).toEqual(
      expect.objectContaining({
        tipo: 'evolucao_clinica',
        titulo: 'Consulta inicial',
        descricao: 'Paciente relatou melhora de adesao.'
      })
    );
  });

  it('deve criar tarefa de acompanhamento e exibir pendencia no prontuario', async () => {
    const paciente = {
      id: 'paciente-1',
      tenantId: 'tenant-1',
      profissionalResponsavelId: 'profissional-1',
      nomeCriptografado: Buffer.from('cripto:Maria'),
      statusAdesao: 'em_acompanhamento',
      scoreRisco: '40',
      criadoEm: new Date('2026-07-01T10:00:00.000Z'),
      atualizadoEm: new Date('2026-07-01T10:00:00.000Z')
    };
    const tarefasSalvas: Record<string, unknown>[] = [];
    const repositorios = new Map<unknown, Record<string, unknown>>([
      [PacienteOrm, { findOne: jest.fn(async () => paciente) }],
      [AgendaConsultaOrm, { find: jest.fn(async () => []) }],
      [EnvioQuestionarioOrm, { find: jest.fn(async () => []) }],
      [RespostaCheckinOrm, { find: jest.fn(async () => []) }],
      [QuestionarioOrm, { find: jest.fn(async () => []) }],
      [MensagemNotificacaoOrm, { find: jest.fn(async () => []) }],
      [EvolucaoClinicaOrm, { find: jest.fn(async () => []) }],
      [
        AcompanhamentoTarefaOrm,
        {
          create: jest.fn((dados: Record<string, unknown>) => dados),
          save: jest.fn(async (dados: Record<string, unknown>) => {
            const salvo = {
              id: 'tarefa-1',
              criadoEm: new Date('2026-07-22T18:00:00.000Z'),
              atualizadoEm: new Date('2026-07-22T18:00:00.000Z'),
              ...dados
            };
            tarefasSalvas.push(salvo);
            return salvo;
          }),
          find: jest.fn(async () => tarefasSalvas)
        }
      ]
    ]);
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao({ getRepository: jest.fn((entidade) => repositorios.get(entidade)) })
        )
      } as never,
      {
        criptografar: jest.fn((valor: string) => Buffer.from(`cripto:${valor}`)),
        descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', ''))
      } as never,
      limitesPermitidos as never
    );

    const tarefa = await servico.criarTarefaAcompanhamento('tenant-1', 'paciente-1', 'usuario-profissional-1', {
      titulo: 'Beber agua no periodo da tarde',
      descricao: 'Meta diaria de 1 litro entre 13h e 18h.',
      categoria: 'meta',
      prioridade: 'media',
      vencimentoEm: '2026-07-29T18:00:00.000Z'
    });
    const prontuario = await servico.obterProntuario('tenant-1', 'paciente-1');

    expect(tarefa).toEqual(
      expect.objectContaining({
        pacienteId: 'paciente-1',
        profissionalId: 'usuario-profissional-1',
        titulo: 'Beber agua no periodo da tarde',
        descricao: 'Meta diaria de 1 litro entre 13h e 18h.',
        categoria: 'meta',
        prioridade: 'media',
        status: 'pendente'
      })
    );
    expect(tarefasSalvas[0]).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        descricaoCriptografada: Buffer.from('cripto:Meta diaria de 1 litro entre 13h e 18h.')
      })
    );
    expect(prontuario.resumo.tarefasPendentes).toBe(1);
    expect(prontuario.linhaDoTempo[0]).toEqual(
      expect.objectContaining({
        tipo: 'tarefa_acompanhamento',
        titulo: 'Beber agua no periodo da tarde',
        descricao: 'Meta diaria de 1 litro entre 13h e 18h.',
        status: 'pendente'
      })
    );
  });
});

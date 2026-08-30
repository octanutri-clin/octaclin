import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ExecucaoRegraOrm } from '../infraestrutura/execucao-regra.orm';
import { RegraAutomacaoOrm } from '../infraestrutura/regra-automacao.orm';
import { ServicoRecallInatividade } from './servico-recall-inatividade';

const AGORA = new Date('2026-08-03T12:00:00.000Z');
const USUARIO = { tenantId: 'tenant-1', usuarioId: 'usuario-1', papel: 'SuperAdmin' } as never;

function diasAtras(dias: number): Date {
  return new Date(AGORA.getTime() - dias * 24 * 60 * 60 * 1000);
}

function contato(sobrescritas: Record<string, unknown> = {}) {
  return Buffer.from(
    `cripto:${JSON.stringify({ email: 'ana@example.test', whatsapp: '5511900000000', ...sobrescritas })}`,
    'utf8'
  );
}

function paciente(sobrescritas: Record<string, unknown> = {}) {
  return {
    id: 'paciente-1',
    tenantId: 'tenant-1',
    profissionalResponsavelId: 'profissional-1',
    statusAdesao: 'ativo',
    contatoCriptografado: contato(),
    arquivadoEm: null,
    ...sobrescritas
  };
}

const regraPadrao = {
  id: 'regra-1',
  tenantId: 'tenant-1',
  profissionalId: 'profissional-1',
  nome: 'Recall de inativos',
  gatilho: { tipo: 'paciente.inativo', diasSemConsulta: 60 },
  condicoes: [],
  acoes: [{ tipo: 'enviar_template' }],
  ativa: true
};

interface DadosCenario {
  regras?: Record<string, unknown>[];
  pacientes?: Record<string, unknown>[];
  ultimasConsultas?: { pacienteId: string; ultimaEm: Date }[];
  execucoes?: Record<string, unknown>[];
  canais?: Record<string, unknown>[];
  templates?: Record<string, unknown>[];
  falharEnvio?: boolean;
  falharPublicacao?: boolean;
  falharRegistro?: boolean;
  contatoIndecifravel?: boolean;
}

function criarServico(dados: DadosCenario = {}) {
  const execucoesSalvas: Record<string, unknown>[] = [];

  const repositorioRegras = {
    find: jest.fn(async () => dados.regras ?? [regraPadrao]),
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
      (dados.regras ?? [regraPadrao]).find((regra) =>
        Object.entries(where).every(([chave, valor]) => regra[chave] === valor)
      ) ?? null
    )
  };
  const repositorioPacientes = {
    find: jest.fn(async () => dados.pacientes ?? [paciente()]),
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
      (dados.pacientes ?? [paciente()]).find((item) => item.id === where.id) ?? null
    )
  };
  const repositorioExecucoes = {
    find: jest.fn(async () => dados.execucoes ?? []),
    create: jest.fn((entrada: Record<string, unknown>) => ({ id: `execucao-${execucoesSalvas.length + 1}`, ...entrada })),
    save: jest.fn(async (entrada: Record<string, unknown>) => {
      if (dados.falharRegistro && entrada.pacienteId) throw new Error('Banco indisponivel ao registrar execucao.');
      execucoesSalvas.push(entrada);
      return entrada;
    })
  };
  const construtorConsultas: Record<string, jest.Mock> = {
    getRawMany: jest.fn(async () => dados.ultimasConsultas ?? [])
  };
  for (const metodo of ['select', 'addSelect', 'where', 'andWhere', 'groupBy']) {
    construtorConsultas[metodo] = jest.fn(() => construtorConsultas);
  }
  const repositorioConsultas = { createQueryBuilder: jest.fn(() => construtorConsultas) };

  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === RegraAutomacaoOrm) return repositorioRegras;
      if (entidade === PacienteOrm) return repositorioPacientes;
      if (entidade === ExecucaoRegraOrm) return repositorioExecucoes;
      if (entidade === AgendaConsultaOrm) return repositorioConsultas;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => operacao(gerenciador))
  };
  const comunicacoes = {
    listarCanais: jest.fn(async () =>
      dados.canais ?? [
        { id: 'canal-email', tipo: 'email', ativo: true },
        { id: 'canal-whatsapp', tipo: 'whatsapp', ativo: true }
      ]
    ),
    listarTemplates: jest.fn(async () =>
      dados.templates ?? [
        {
          id: 'template-whatsapp-recall',
          canal: 'whatsapp',
          aprovado: true,
          conteudo: { evento: 'paciente.recall.inatividade' }
        }
      ]
    ),
    dispararMensagemSistema: jest.fn(async () => {
      if (dados.falharEnvio) throw new Error('Meta recusou o envio.');
      return { id: 'mensagem-1' };
    }),
    publicarEventoNotificacao: jest.fn(async () => {
      if (dados.falharPublicacao) throw new Error('Redis indisponivel.');
      return undefined;
    })
  };
  const criptografia = {
    descriptografar: jest.fn((valor: Buffer) => {
      if (dados.contatoIndecifravel) throw new Error('Chave de criptografia invalida.');
      return valor.toString('utf8').replace('cripto:', '');
    })
  };

  return {
    servico: new ServicoRecallInatividade(executorTenant as never, comunicacoes as never, criptografia as never),
    comunicacoes,
    repositorioPacientes,
    execucoesSalvas
  };
}

describe('ServicoRecallInatividade.simular', () => {
  it('deve listar exatamente quem seria contatado sem enviar nada', async () => {
    const { servico, comunicacoes, execucoesSalvas } = criarServico({
      ultimasConsultas: [{ pacienteId: 'paciente-1', ultimaEm: diasAtras(120) }]
    });

    const resultado = await servico.simular('tenant-1', 'regra-1', USUARIO, AGORA);

    expect(resultado.candidatos).toEqual([
      { pacienteId: 'paciente-1', diasSemConsulta: 120, ultimaConsultaConcluidaEm: diasAtras(120) }
    ]);
    expect(comunicacoes.dispararMensagemSistema).not.toHaveBeenCalled();
    expect(execucoesSalvas[0]).toMatchObject({ status: 'executado', resultado: { simulacao: true, totalCandidatos: 1 } });
  });

  it('deve mostrar o motivo de cada paciente excluido', async () => {
    const { servico } = criarServico({
      pacientes: [
        paciente({ id: 'opt-out', contatoCriptografado: contato({ preferencias: { email: false, whatsapp: false } }) }),
        paciente({ id: 'sem-contato', contatoCriptografado: null }),
        paciente({ id: 'ativo' })
      ],
      ultimasConsultas: [
        { pacienteId: 'opt-out', ultimaEm: diasAtras(400) },
        { pacienteId: 'sem-contato', ultimaEm: diasAtras(400) },
        { pacienteId: 'ativo', ultimaEm: diasAtras(3) }
      ]
    });

    const resultado = await servico.simular('tenant-1', 'regra-1', USUARIO, AGORA);

    expect(resultado.candidatos).toEqual([]);
    expect(resultado.excluidos).toEqual([
      { pacienteId: 'opt-out', motivo: 'opt_out' },
      { pacienteId: 'sem-contato', motivo: 'sem_contato' },
      { pacienteId: 'ativo', motivo: 'consulta_recente' }
    ]);
  });

  it('deve recusar simular regra que nao usa o gatilho de inatividade', async () => {
    const { servico } = criarServico({ regras: [{ ...regraPadrao, gatilho: { tipo: 'checkin.atrasado' } }] });

    await expect(servico.simular('tenant-1', 'regra-1', USUARIO, AGORA)).rejects.toThrow(
      'Esta regra nao usa o gatilho de inatividade.'
    );
  });

  it('deve buscar apenas pacientes do profissional dono da regra', async () => {
    const { servico, repositorioPacientes } = criarServico();

    await servico.simular('tenant-1', 'regra-1', USUARIO, AGORA);

    expect(repositorioPacientes.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-1' })
      })
    );
  });
});

describe('ServicoRecallInatividade.processarRecalls', () => {
  it('deve enviar recall e registrar execucao por paciente contatado', async () => {
    const { servico, comunicacoes, execucoesSalvas } = criarServico({
      ultimasConsultas: [{ pacienteId: 'paciente-1', ultimaEm: diasAtras(120) }]
    });

    const resultado = await servico.processarRecalls('tenant-1', AGORA);

    expect(resultado).toEqual({
      regrasAvaliadas: 1,
      recallsEnviados: 1,
      recallsFalhados: 0,
      pacientesIgnorados: 0,
      regrasComErro: 0,
      contatosIlegiveis: 0
    });
    expect(comunicacoes.dispararMensagemSistema).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ pacienteId: 'paciente-1', canalId: 'canal-whatsapp' })
    );
    expect(comunicacoes.publicarEventoNotificacao).toHaveBeenCalledWith('tenant-1', 'mensagem-1');
    expect(execucoesSalvas[0]).toMatchObject({ pacienteId: 'paciente-1', status: 'executado' });
  });

  it('nao deve deixar falha de envio passar em silencio', async () => {
    const { servico, execucoesSalvas } = criarServico({
      ultimasConsultas: [{ pacienteId: 'paciente-1', ultimaEm: diasAtras(120) }],
      falharEnvio: true
    });

    const resultado = await servico.processarRecalls('tenant-1', AGORA);

    expect(resultado).toMatchObject({ recallsEnviados: 0, recallsFalhados: 1 });
    expect(execucoesSalvas[0]).toMatchObject({ status: 'falhou', erro: 'Meta recusou o envio.' });
  });

  it('deve ignorar paciente sem template de recall aprovado em vez de enviar template errado', async () => {
    const { servico, comunicacoes, execucoesSalvas } = criarServico({
      ultimasConsultas: [{ pacienteId: 'paciente-1', ultimaEm: diasAtras(120) }],
      templates: [{ id: 'template-outro', canal: 'whatsapp', aprovado: true, conteudo: { evento: 'agenda.consulta.lembrete' } }]
    });

    const resultado = await servico.processarRecalls('tenant-1', AGORA);

    expect(comunicacoes.dispararMensagemSistema).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({ recallsEnviados: 0, pacientesIgnorados: 1 });
    expect(execucoesSalvas[0]).toMatchObject({ status: 'ignorado', resultado: { envio: { motivo: 'template_ausente' } } });
  });

  it('nao deve recontatar paciente que ja recebeu recall dentro do intervalo minimo', async () => {
    const { servico, comunicacoes } = criarServico({
      ultimasConsultas: [{ pacienteId: 'paciente-1', ultimaEm: diasAtras(120) }],
      execucoes: [
        {
          id: 'execucao-antiga',
          pacienteId: 'paciente-1',
          regraId: 'regra-1',
          status: 'executado',
          resultado: { simulacao: false },
          criadoEm: diasAtras(5)
        }
      ]
    });

    const resultado = await servico.processarRecalls('tenant-1', AGORA);

    expect(comunicacoes.dispararMensagemSistema).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({ recallsEnviados: 0, pacientesIgnorados: 1 });
  });

  it('nao deve deixar simulacao anterior consumir o teto de frequencia', async () => {
    const { servico, comunicacoes } = criarServico({
      ultimasConsultas: [{ pacienteId: 'paciente-1', ultimaEm: diasAtras(120) }],
      execucoes: [
        {
          id: 'execucao-simulada',
          pacienteId: 'paciente-1',
          regraId: 'regra-1',
          status: 'executado',
          resultado: { simulacao: true },
          criadoEm: diasAtras(1)
        }
      ]
    });

    const resultado = await servico.processarRecalls('tenant-1', AGORA);

    expect(comunicacoes.dispararMensagemSistema).toHaveBeenCalledTimes(1);
    expect(resultado).toMatchObject({ recallsEnviados: 1 });
  });

  it('nao deve marcar como falha quando so a publicacao imediata cair, porque o outbox ainda entrega', async () => {
    const { servico, execucoesSalvas } = criarServico({
      ultimasConsultas: [{ pacienteId: 'paciente-1', ultimaEm: diasAtras(120) }],
      falharPublicacao: true
    });

    const resultado = await servico.processarRecalls('tenant-1', AGORA);

    // Marcar 'falhou' aqui furaria o teto de frequencia: a mensagem sai pelo outbox e o
    // paciente ficaria elegivel de novo amanha, recebendo recall duplicado.
    expect(resultado).toMatchObject({ recallsEnviados: 1, recallsFalhados: 0 });
    expect(execucoesSalvas[0]).toMatchObject({ status: 'executado' });
  });

  it('nao deve interromper a rodada quando o registro de uma execucao falhar', async () => {
    const { servico } = criarServico({
      pacientes: [paciente({ id: 'paciente-1' }), paciente({ id: 'paciente-2' })],
      ultimasConsultas: [
        { pacienteId: 'paciente-1', ultimaEm: diasAtras(120) },
        { pacienteId: 'paciente-2', ultimaEm: diasAtras(200) }
      ],
      falharRegistro: true
    });

    const resultado = await servico.processarRecalls('tenant-1', AGORA);

    expect(resultado).toMatchObject({ recallsFalhados: 2 });
  });

  it('deve separar contato ilegivel de paciente sem contato cadastrado', async () => {
    const { servico } = criarServico({
      ultimasConsultas: [{ pacienteId: 'paciente-1', ultimaEm: diasAtras(120) }],
      contatoIndecifravel: true
    });

    const resultado = await servico.processarRecalls('tenant-1', AGORA);

    expect(resultado).toMatchObject({ recallsEnviados: 0, contatosIlegiveis: 1 });
  });

  it('deve ignorar regras que nao usam o gatilho de inatividade', async () => {
    const { servico, comunicacoes } = criarServico({
      regras: [{ ...regraPadrao, gatilho: { tipo: 'checkin.atrasado' } }]
    });

    const resultado = await servico.processarRecalls('tenant-1', AGORA);

    expect(resultado.regrasAvaliadas).toBe(0);
    expect(comunicacoes.dispararMensagemSistema).not.toHaveBeenCalled();
  });
});

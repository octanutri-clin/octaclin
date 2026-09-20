import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { LogDiarioRapidoOrm } from '../../mobile/infraestrutura/log-diario-rapido.orm';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { ProcessadorOutboxGatilhosAutomacao } from '../../automacoes/aplicacao/processador-outbox-gatilhos-automacao';
import { RegraAutomacaoOrm } from '../../automacoes/infraestrutura/regra-automacao.orm';
import { ExecucaoRegraOrm } from '../../automacoes/infraestrutura/execucao-regra.orm';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { PrioridadeAcompanhamentoHistoricoOrm } from '../infraestrutura/prioridade-acompanhamento-historico.orm';
import { PrioridadeAcompanhamentoPacienteOrm } from '../infraestrutura/prioridade-acompanhamento-paciente.orm';
import { ServicoRecalculoPrioridadeAcompanhamento } from './servico-recalculo-prioridade-acompanhamento';

const AGORA = new Date('2026-09-18T09:00:00.000Z');
const DIA_MS = 24 * 60 * 60 * 1000;

function diasAtras(dias: number): Date {
  return new Date(AGORA.getTime() - dias * DIA_MS);
}

function criptografiaFake() {
  return {
    criptografar: jest.fn((valor: string) => Buffer.from(`cripto:${valor}`)),
    descriptografar: jest.fn((valor: Buffer) => {
      const texto = valor.toString();
      if (!texto.startsWith('cripto:')) throw new Error('chave invalida');
      return texto.replace('cripto:', '');
    })
  };
}

interface Cenario {
  pacientes?: Record<string, unknown>[];
  consultasPorPaciente?: Record<string, Record<string, unknown>[]>;
  diarioPorPaciente?: Record<string, Record<string, unknown> | undefined>;
  prioridadeAtualPorPaciente?: Record<string, Record<string, unknown> | undefined>;
  historicoExistente?: Record<string, unknown>[];
  /** Regras de automacao ativas visiveis ao gatilho `paciente.risco_alto`. */
  regrasAutomacao?: Record<string, unknown>[];
}

function montarServico(cenario: Cenario = {}) {
  const pacientes = cenario.pacientes ?? [{ id: 'paciente-1', tenantId: 'tenant-1', arquivadoEm: null }];
  const consultasPorPaciente = cenario.consultasPorPaciente ?? {};
  const diarioPorPaciente = cenario.diarioPorPaciente ?? {};
  const prioridadesAtuais = new Map<string, Record<string, unknown>>(
    Object.entries(cenario.prioridadeAtualPorPaciente ?? {}).filter(
      (entrada): entrada is [string, Record<string, unknown>] => Boolean(entrada[1])
    )
  );
  const prioridadesSalvas: Record<string, unknown>[] = [];
  const historicoSalvo: Record<string, unknown>[] = [...(cenario.historicoExistente ?? [])];
  const regrasAutomacao = cenario.regrasAutomacao ?? [];
  const execucoesRegra: Record<string, unknown>[] = [];
  const outboxEventos: Record<string, unknown>[] = [];
  const idsInseridos = new Set<string>();

  const repositorioPacientes = {
    find: jest.fn(async (_opcoes: Record<string, unknown>) => pacientes),
    // Usado por `dispararGatilhoAutomacao` (fundacao do PB-03) para resolver o
    // profissional responsavel do paciente antes de casar regras.
    findOne: jest.fn(
      async ({ where }: { where: { id: string; tenantId: string } }) =>
        pacientes.find((paciente) => paciente.id === where.id && paciente.tenantId === where.tenantId) ?? null
    )
  };
  const repositorioRegraAutomacao = {
    find: jest.fn(
      async ({ where }: { where: { tenantId: string; ativa: boolean; profissionalId: string; gatilho: { _value?: Record<string, unknown> } } }) =>
        regrasAutomacao.filter(
          (regra) =>
            regra.tenantId === where.tenantId &&
            regra.ativa === where.ativa &&
            regra.profissionalId === where.profissionalId &&
            (regra.gatilho as Record<string, unknown> | undefined)?.tipo === where.gatilho?._value?.tipo
        )
    )
  };
  const repositorioConsultas = {
    find: jest.fn(async ({ where }: { where: { pacienteId: string; status?: string; inicioEm?: { _value?: unknown } } }) => {
      const consultas = consultasPorPaciente[where.pacienteId] ?? [];
      const valorJanela = where.inicioEm?._value;
      const [inicio, fim] = Array.isArray(valorJanela) ? valorJanela : [valorJanela, undefined];
      return consultas.filter((consulta) => {
        if (where.status && consulta.status !== where.status) return false;
        if (inicio instanceof Date && (consulta.inicioEm as Date) < inicio) return false;
        if (fim instanceof Date && (consulta.inicioEm as Date) > fim) return false;
        return true;
      });
    }),
    findOne: jest.fn(
      async ({ where, order }: { where: { pacienteId: string; status?: string } | { pacienteId: string; status?: string }[]; order: { inicioEm: 'ASC' | 'DESC' } }) => {
        const alternativas = Array.isArray(where) ? where : [where];
        const pacienteId = alternativas[0]?.pacienteId;
        const status = new Set(alternativas.map((item) => item.status));
        const consultas = (consultasPorPaciente[pacienteId] ?? [])
          .filter((consulta) => status.has(consulta.status as string))
          .sort((a, b) => {
            const diferenca = (a.inicioEm as Date).getTime() - (b.inicioEm as Date).getTime();
            return order.inicioEm === 'ASC' ? diferenca : -diferenca;
          });
        return consultas[0] ?? null;
      }
    )
  };
  const repositorioDiarios = {
    findOne: jest.fn(async ({ where }: { where: { pacienteId: string } }) => diarioPorPaciente[where.pacienteId] ?? null)
  };
  const repositorioPrioridadeAtual = {
    findOne: jest.fn(async ({ where }: { where: { pacienteId: string } }) => prioridadesAtuais.get(where.pacienteId) ?? null),
    create: jest.fn((dados: Record<string, unknown>) => ({ ...dados })),
    save: jest.fn(async (registro: Record<string, unknown>) => {
      prioridadesAtuais.set(registro.pacienteId as string, registro);
      prioridadesSalvas.push(registro);
      return registro;
    })
  };
  const repositorioHistorico = {
    findOne: jest.fn(
      async ({ where }: { where: { tenantId: string; pacienteId: string; tipoEvento: string; versaoFormula: string } }) => {
        const candidatos = historicoSalvo
          .filter(
            (linha) =>
              linha.tenantId === where.tenantId &&
              linha.pacienteId === where.pacienteId &&
              linha.tipoEvento === where.tipoEvento &&
              linha.versaoFormula === where.versaoFormula
          )
          .sort((a, b) => (b.criadoEm as Date).getTime() - (a.criadoEm as Date).getTime());
        return candidatos[0] ?? null;
      }
    ),
    create: jest.fn((dados: Record<string, unknown>) => ({ criadoEm: AGORA, ...dados })),
    save: jest.fn(async (registro: Record<string, unknown>) => {
      historicoSalvo.push(registro);
      return registro;
    })
  };

  const gerenciador = {
    getRepository: jest.fn((entidade: unknown) => {
      if (entidade === PacienteOrm) return repositorioPacientes;
      if (entidade === AgendaConsultaOrm) return repositorioConsultas;
      if (entidade === LogDiarioRapidoOrm) return repositorioDiarios;
      if (entidade === PrioridadeAcompanhamentoPacienteOrm) return repositorioPrioridadeAtual;
      if (entidade === PrioridadeAcompanhamentoHistoricoOrm) return repositorioHistorico;
      if (entidade === RegraAutomacaoOrm) return repositorioRegraAutomacao;
      throw new Error(`Repositorio nao mapeado no teste: ${(entidade as { name?: string })?.name ?? entidade}`);
    }),
    // Suporta os inserts idempotentes de `dispararGatilhoAutomacao` (fundacao
    // do PB-03, reutilizada pelo gatilho `paciente.risco_alto`).
    createQueryBuilder: jest.fn(() => {
      let alvo: Record<string, unknown>[] | undefined;
      let valoresAtuais: Record<string, unknown> = {};
      const builder: {
        insert: () => typeof builder;
        into: (entidade: unknown) => typeof builder;
        values: (valores: Record<string, unknown>) => typeof builder;
        orIgnore: () => typeof builder;
        execute: () => Promise<{ identifiers: unknown[] }>;
      } = {
        insert: jest.fn(() => builder),
        into: jest.fn((entidade: unknown) => {
          if (entidade === ExecucaoRegraOrm) alvo = execucoesRegra;
          else if (entidade === OutboxEventoOrm) alvo = outboxEventos;
          else throw new Error('Entidade nao suportada no insert fake.');
          return builder;
        }),
        values: jest.fn((valores: Record<string, unknown>) => {
          valoresAtuais = valores;
          return builder;
        }),
        orIgnore: jest.fn(() => builder),
        execute: jest.fn(async () => {
          const id = String(valoresAtuais.id);
          if (!idsInseridos.has(id)) {
            idsInseridos.add(id);
            alvo!.push({ ...valoresAtuais });
          }
          return { identifiers: [] };
        })
      };
      return builder;
    })
  };

  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (g: unknown) => Promise<unknown>) => operacao(gerenciador))
  };

  const servico = new ServicoRecalculoPrioridadeAcompanhamento(executorTenant as never, criptografiaFake() as never);

  return {
    servico,
    executorTenant,
    repositorioPacientes,
    repositorioConsultas,
    repositorioPrioridadeAtual,
    repositorioHistorico,
    repositorioRegraAutomacao,
    prioridadesSalvas,
    historicoSalvo,
    execucoesRegra,
    outboxEventos
  };
}

describe('ServicoRecalculoPrioridadeAcompanhamento', () => {
  it('recalcula todos os pacientes ativos do tenant explicito, sem tocar em outro tenant', async () => {
    const { servico, executorTenant, repositorioPacientes } = montarServico({
      pacientes: [
        { id: 'paciente-1', tenantId: 'tenant-1', arquivadoEm: null },
        { id: 'paciente-2', tenantId: 'tenant-1', arquivadoEm: null }
      ]
    });

    const resultado = await servico.recalcularTenant('tenant-1', AGORA);

    expect(executorTenant.executar).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    const chamada = repositorioPacientes.find.mock.calls[0][0] as {
      where: { tenantId: string; arquivadoEm: { _type?: string } };
    };
    expect(chamada.where.tenantId).toBe('tenant-1');
    expect(chamada.where.arquivadoEm._type).toBe('isNull');
    expect(resultado.pacientesAvaliados).toBe(2);
  });

  it('grava o estado atual e um evento de historico na primeira vez que calcula o paciente', async () => {
    const { servico, prioridadesSalvas, historicoSalvo } = montarServico({
      pacientes: [{ id: 'paciente-1', tenantId: 'tenant-1', arquivadoEm: null }],
      consultasPorPaciente: {
        'paciente-1': [
          { id: 'consulta-1', pacienteId: 'paciente-1', status: 'falta', inicioEm: diasAtras(1) },
          { id: 'consulta-2', pacienteId: 'paciente-1', status: 'falta', inicioEm: diasAtras(2) }
        ]
      }
    });

    const resultado = await servico.recalcularTenant('tenant-1', AGORA);

    expect(resultado.pacientesAtualizados).toBe(1);
    expect(resultado.pacientesInalterados).toBe(0);
    expect(resultado.pacientesComFalha).toBe(0);
    expect(prioridadesSalvas[0]).toEqual(
      expect.objectContaining({ tenantId: 'tenant-1', pacienteId: 'paciente-1', score: 60, faixa: 'media' })
    );
    expect(historicoSalvo).toHaveLength(1);
    expect(historicoSalvo[0]).toEqual(
      expect.objectContaining({ tenantId: 'tenant-1', pacienteId: 'paciente-1', tipoEvento: 'calculo', score: 60 })
    );
  });

  it('e idempotente por paciente, versao da formula e janela: nao duplica o historico ao rodar de novo no mesmo dia', async () => {
    const { servico, historicoSalvo, prioridadesSalvas } = montarServico({
      pacientes: [{ id: 'paciente-1', tenantId: 'tenant-1', arquivadoEm: null }],
      historicoExistente: [
        {
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          tipoEvento: 'calculo',
          versaoFormula: '1.1.0',
          score: 0,
          faixa: 'baixa',
          criadoEm: new Date('2026-09-18T02:00:00.000Z')
        }
      ]
    });

    const resultado = await servico.recalcularTenant('tenant-1', AGORA);

    expect(resultado.pacientesInalterados).toBe(1);
    expect(resultado.pacientesAtualizados).toBe(0);
    expect(historicoSalvo).toHaveLength(1);
    // O estado atual (cache) e sempre atualizado, mesmo quando o historico nao ganha linha nova.
    expect(prioridadesSalvas).toHaveLength(1);
  });

  it('registra novo evento de historico no dia seguinte, mesmo com a mesma versao da formula', async () => {
    const { servico, historicoSalvo } = montarServico({
      pacientes: [{ id: 'paciente-1', tenantId: 'tenant-1', arquivadoEm: null }],
      historicoExistente: [
        {
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          tipoEvento: 'calculo',
          versaoFormula: '1.1.0',
          score: 0,
          faixa: 'baixa',
          criadoEm: new Date('2026-09-17T10:00:00.000Z')
        }
      ]
    });

    await servico.recalcularTenant('tenant-1', AGORA);

    expect(historicoSalvo).toHaveLength(2);
  });

  it('preserva o override existente ao atualizar o estado calculado', async () => {
    const overrideCriadoEm = diasAtras(3);
    const overrideExpiraEm = new Date(AGORA.getTime() + 30 * DIA_MS);
    const { servico, prioridadesSalvas } = montarServico({
      pacientes: [{ id: 'paciente-1', tenantId: 'tenant-1', arquivadoEm: null }],
      prioridadeAtualPorPaciente: {
        'paciente-1': {
          id: 'prioridade-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          score: 10,
          faixa: 'baixa',
          fatores: [],
          versaoFormula: '1.1.0',
          calculadoEm: diasAtras(5),
          overrideFaixa: 'alta',
          overrideCodigoMotivo: 'decisao_clinica',
          overrideJustificativaCriptografada: Buffer.from('cripto:justificativa'),
          overrideExpiraEm,
          overrideAtorUsuarioId: 'usuario-profissional-1',
          overrideCriadoEm
        }
      }
    });

    await servico.recalcularTenant('tenant-1', AGORA);

    expect(prioridadesSalvas[0]).toEqual(
      expect.objectContaining({
        overrideFaixa: 'alta',
        overrideCodigoMotivo: 'decisao_clinica',
        overrideExpiraEm,
        overrideAtorUsuarioId: 'usuario-profissional-1',
        overrideCriadoEm
      })
    );
  });

  it('uma falha em um paciente preserva o ultimo valor valido e nao interrompe os demais', async () => {
    const { servico, executorTenant, prioridadesSalvas, repositorioPrioridadeAtual } = montarServico({
      pacientes: [
        { id: 'paciente-com-falha', tenantId: 'tenant-1', arquivadoEm: null },
        { id: 'paciente-ok', tenantId: 'tenant-1', arquivadoEm: null }
      ],
      // consultaId vazio faz o calculador de dominio (265.1) rejeitar a
      // entrada com excecao -- simula um dado corrompido chegando ao job.
      consultasPorPaciente: {
        'paciente-com-falha': [{ id: '', pacienteId: 'paciente-com-falha', status: 'falta', inicioEm: diasAtras(1) }]
      },
      prioridadeAtualPorPaciente: {
        'paciente-com-falha': {
          id: 'prioridade-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-com-falha',
          score: 25,
          faixa: 'media',
          fatores: [],
          versaoFormula: '1.1.0',
          calculadoEm: diasAtras(1)
        }
      }
    });

    const resultado = await servico.recalcularTenant('tenant-1', AGORA);

    expect(resultado.pacientesAvaliados).toBe(2);
    expect(resultado.pacientesComFalha).toBe(1);
    // Uma transacao curta lista os pacientes e cada paciente usa sua propria
    // transacao. Assim, um erro SQL que aborte uma delas nao contamina as
    // escritas dos pacientes seguintes.
    expect(executorTenant.executar).toHaveBeenCalledTimes(3);
    expect(prioridadesSalvas.some((registro) => registro.pacienteId === 'paciente-ok')).toBe(true);
    expect(repositorioPrioridadeAtual.save).not.toHaveBeenCalledWith(
      expect.objectContaining({ pacienteId: 'paciente-com-falha' })
    );
  });

  it('busca faltas, ultima consulta concluida e proxima consulta sem compartilhar janela ou limite', async () => {
    const ultimaConcluida = diasAtras(120);
    const proxima = new Date(AGORA.getTime() + 180 * DIA_MS);
    const { servico, repositorioConsultas, prioridadesSalvas } = montarServico({
      consultasPorPaciente: {
        'paciente-1': [
          { id: 'consulta-concluida-antiga', pacienteId: 'paciente-1', status: 'concluida', inicioEm: ultimaConcluida },
          { id: 'consulta-futura', pacienteId: 'paciente-1', status: 'agendada', inicioEm: proxima }
        ]
      }
    });

    await servico.recalcularTenant('tenant-1', AGORA);

    expect(repositorioConsultas.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', pacienteId: 'paciente-1', status: 'falta' })
      })
    );
    expect(repositorioConsultas.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'concluida' }),
        order: { inicioEm: 'DESC' }
      })
    );
    expect(repositorioConsultas.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.arrayContaining([
          expect.objectContaining({ status: 'agendada' }),
          expect.objectContaining({ status: 'reagendada' })
        ]),
        order: { inicioEm: 'ASC' }
      })
    );
    expect(prioridadesSalvas[0]).toEqual(expect.objectContaining({ score: 0 }));
  });

  it('pontua sem retorno quando a ultima consulta concluida ocorreu ha mais de 100 dias', async () => {
    const { servico, prioridadesSalvas } = montarServico({
      consultasPorPaciente: {
        'paciente-1': [
          { id: 'consulta-concluida-antiga', pacienteId: 'paciente-1', status: 'concluida', inicioEm: diasAtras(120) }
        ]
      }
    });

    await servico.recalcularTenant('tenant-1', AGORA);

    expect(prioridadesSalvas[0]).toEqual(expect.objectContaining({ score: 25, faixa: 'baixa' }));
    expect(prioridadesSalvas[0]?.fatores).toContainEqual({ codigo: 'sem_retorno_programado', pontos: 25 });
  });

  it('sem sinal algum, mantem score zero e fatores vazios (formulario_vencido nao existe mais na formula 1.1.0)', async () => {
    const { servico, prioridadesSalvas } = montarServico({
      pacientes: [{ id: 'paciente-1', tenantId: 'tenant-1', arquivadoEm: null }]
    });

    await servico.recalcularTenant('tenant-1', AGORA);

    expect(prioridadesSalvas[0]?.fatores).toEqual([]);
    expect(prioridadesSalvas[0]?.score).toBe(0);
  });

  it('calcula adesao baixa a partir do registro de habitos mais recente decifrado', async () => {
    const { servico, prioridadesSalvas } = montarServico({
      pacientes: [{ id: 'paciente-1', tenantId: 'tenant-1', arquivadoEm: null }],
      diarioPorPaciente: {
        'paciente-1': {
          id: 'diario-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          tipo: 'humor',
          valorCriptografado: Buffer.from('cripto:{"adesaoPlano":20}'),
          registradoEm: AGORA
        }
      }
    });

    await servico.recalcularTenant('tenant-1', AGORA);

    expect(prioridadesSalvas[0]).toEqual(expect.objectContaining({ score: 15, faixa: 'baixa' }));
  });

  it('nao derruba o paciente quando o registro de habitos esta ilegivel: so ignora esse sinal', async () => {
    const { servico, prioridadesSalvas } = montarServico({
      pacientes: [{ id: 'paciente-1', tenantId: 'tenant-1', arquivadoEm: null }],
      diarioPorPaciente: {
        'paciente-1': {
          id: 'diario-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          tipo: 'humor',
          valorCriptografado: Buffer.from('ruido'),
          registradoEm: AGORA
        }
      }
    });

    const resultado = await servico.recalcularTenant('tenant-1', AGORA);

    expect(resultado.pacientesComFalha).toBe(0);
    expect(prioridadesSalvas[0]).toEqual(expect.objectContaining({ score: 0, faixa: 'baixa' }));
  });
});

describe('ServicoRecalculoPrioridadeAcompanhamento - gatilho paciente.risco_alto (Fase 267.2)', () => {
  const AGORA_DIA_SEGUINTE = new Date(AGORA.getTime() + DIA_MS);
  const pacienteComProfissional = { id: 'paciente-1', tenantId: 'tenant-1', arquivadoEm: null, profissionalResponsavelId: 'profissional-1' };
  const regraRiscoAlto = {
    id: 'regra-risco-alto-1',
    tenantId: 'tenant-1',
    profissionalId: 'profissional-1',
    ativa: true,
    gatilho: { tipo: 'paciente.risco_alto' }
  };

  const consultasBaixa = [{ id: 'falta-unica', pacienteId: 'paciente-1', status: 'falta', inicioEm: diasAtras(1) }];
  const consultasAlta = [
    { id: 'falta-1', pacienteId: 'paciente-1', status: 'falta', inicioEm: diasAtras(1) },
    { id: 'falta-2', pacienteId: 'paciente-1', status: 'falta', inicioEm: diasAtras(2) },
    { id: 'concluida-antiga', pacienteId: 'paciente-1', status: 'concluida', inicioEm: diasAtras(61) }
  ];

  it('dispara uma vez quando a faixa sobe de baixa/media para alta', async () => {
    const consultasPorPaciente: Record<string, Record<string, unknown>[]> = { 'paciente-1': consultasBaixa };
    const { servico, execucoesRegra, outboxEventos } = montarServico({
      pacientes: [pacienteComProfissional],
      consultasPorPaciente,
      regrasAutomacao: [regraRiscoAlto]
    });

    const primeiro = await servico.recalcularTenant('tenant-1', AGORA);
    expect(primeiro.pacientesAtualizados).toBe(1);
    expect(execucoesRegra).toHaveLength(0);

    consultasPorPaciente['paciente-1'] = consultasAlta;
    const segundo = await servico.recalcularTenant('tenant-1', AGORA_DIA_SEGUINTE);

    expect(segundo.pacientesAtualizados).toBe(1);
    expect(execucoesRegra).toHaveLength(1);
    expect(execucoesRegra[0]).toEqual(
      expect.objectContaining({ tenantId: 'tenant-1', regraId: 'regra-risco-alto-1', pacienteId: 'paciente-1', status: 'pendente' })
    );
    expect(outboxEventos).toHaveLength(1);
    expect(outboxEventos[0]).toEqual(
      expect.objectContaining({ tenantId: 'tenant-1', tipo: 'automacao.gatilho.disparar', status: 'pendente' })
    );
    expect(JSON.stringify(execucoesRegra.concat(outboxEventos))).not.toMatch(/score|fator|justificativa/i);
  });

  it('dispara no primeiro calculo do paciente quando ele ja nasce em alta', async () => {
    const { servico, execucoesRegra } = montarServico({
      pacientes: [pacienteComProfissional],
      consultasPorPaciente: { 'paciente-1': consultasAlta },
      regrasAutomacao: [regraRiscoAlto]
    });

    await servico.recalcularTenant('tenant-1', AGORA);

    expect(execucoesRegra).toHaveLength(1);
  });

  it('nao dispara de novo quando a faixa ja estava alta (alta -> alta)', async () => {
    const { servico, execucoesRegra } = montarServico({
      pacientes: [pacienteComProfissional],
      consultasPorPaciente: { 'paciente-1': consultasAlta },
      regrasAutomacao: [regraRiscoAlto],
      historicoExistente: [
        {
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          tipoEvento: 'calculo',
          versaoFormula: '1.1.0',
          score: 85,
          faixa: 'alta',
          criadoEm: diasAtras(1)
        }
      ],
      prioridadeAtualPorPaciente: {
        'paciente-1': {
          id: 'prioridade-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          score: 85,
          faixa: 'alta',
          fatores: [],
          versaoFormula: '1.1.0',
          calculadoEm: diasAtras(1)
        }
      }
    });

    await servico.recalcularTenant('tenant-1', AGORA);

    expect(execucoesRegra).toHaveLength(0);
  });

  it('nao dispara quando a faixa calculada permanece em baixa ou media', async () => {
    const { servico, execucoesRegra } = montarServico({
      pacientes: [pacienteComProfissional],
      consultasPorPaciente: { 'paciente-1': consultasBaixa },
      regrasAutomacao: [regraRiscoAlto]
    });

    await servico.recalcularTenant('tenant-1', AGORA);

    expect(execucoesRegra).toHaveLength(0);
  });

  it('override manual para alta nao dispara automacao: so a faixa calculada deterministicamente conta', async () => {
    const { servico, execucoesRegra, outboxEventos } = montarServico({
      pacientes: [pacienteComProfissional],
      consultasPorPaciente: { 'paciente-1': consultasBaixa },
      regrasAutomacao: [regraRiscoAlto],
      prioridadeAtualPorPaciente: {
        'paciente-1': {
          id: 'prioridade-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          score: 0,
          faixa: 'baixa',
          fatores: [],
          versaoFormula: '1.1.0',
          calculadoEm: diasAtras(5),
          overrideFaixa: 'alta',
          overrideCodigoMotivo: 'acompanhamento_intensificado',
          overrideAtorUsuarioId: 'usuario-profissional-1',
          overrideCriadoEm: diasAtras(3)
        }
      }
    });

    await servico.recalcularTenant('tenant-1', AGORA);

    expect(execucoesRegra).toHaveLength(0);
    expect(outboxEventos).toHaveLength(0);
  });

  it('retry/reexecucao no mesmo dia nao duplica o disparo', async () => {
    const { servico, execucoesRegra, outboxEventos } = montarServico({
      pacientes: [pacienteComProfissional],
      consultasPorPaciente: { 'paciente-1': consultasAlta },
      regrasAutomacao: [regraRiscoAlto]
    });

    await servico.recalcularTenant('tenant-1', AGORA);
    await servico.recalcularTenant('tenant-1', AGORA);

    expect(execucoesRegra).toHaveLength(1);
    expect(outboxEventos).toHaveLength(1);
  });

  it('respeita isolamento por tenant e profissional: so a regra do profissional responsavel pelo paciente dispara', async () => {
    const { servico, execucoesRegra } = montarServico({
      pacientes: [pacienteComProfissional],
      consultasPorPaciente: { 'paciente-1': consultasAlta },
      regrasAutomacao: [
        { id: 'regra-outro-profissional', tenantId: 'tenant-1', profissionalId: 'profissional-outro', ativa: true, gatilho: { tipo: 'paciente.risco_alto' } },
        { id: 'regra-outro-tenant', tenantId: 'tenant-2', profissionalId: 'profissional-1', ativa: true, gatilho: { tipo: 'paciente.risco_alto' } },
        regraRiscoAlto
      ]
    });

    await servico.recalcularTenant('tenant-1', AGORA);

    expect(execucoesRegra).toHaveLength(1);
    expect(execucoesRegra[0]).toEqual(expect.objectContaining({ regraId: 'regra-risco-alto-1' }));
  });

  it('o evento de outbox gerado pela entrada em risco alto e recuperado pelo processador quando a fila falha', async () => {
    const { servico, outboxEventos } = montarServico({
      pacientes: [pacienteComProfissional],
      consultasPorPaciente: { 'paciente-1': consultasAlta },
      regrasAutomacao: [regraRiscoAlto]
    });

    await servico.recalcularTenant('tenant-1', AGORA);
    expect(outboxEventos).toHaveLength(1);

    const evento = { ...outboxEventos[0], tentativas: 0, criadoEm: AGORA } as OutboxEventoOrm;
    const repositorioOutbox = {
      find: jest.fn(async () => [evento]),
      update: jest.fn(async () => ({ affected: 1 })),
      save: jest.fn(async (registro: OutboxEventoOrm) => registro)
    };
    const fonteDados = {
      createQueryRunner: jest.fn(() => ({
        connect: jest.fn(async () => undefined),
        release: jest.fn(async () => undefined),
        query: jest.fn(async (sql: string) => (sql.includes('pg_try_advisory_lock') ? [{ obtida: true }] : []))
      })),
      getRepository: (entidade: unknown) => {
        if (entidade === TenantOrm) return { find: jest.fn(async () => [{ id: 'tenant-1', status: 'ativo' }]) };
        throw new Error('Repositorio inesperado');
      }
    };
    const executorTenantOutbox = {
      executar: (_tenantId: string, operacao: (g: unknown) => Promise<unknown>) => operacao({ getRepository: () => repositorioOutbox })
    };
    const filaAutomacoes = { add: jest.fn(async () => Promise.reject(new Error('fila indisponivel'))) };

    const processador = new ProcessadorOutboxGatilhosAutomacao(
      fonteDados as never,
      executorTenantOutbox as never,
      filaAutomacoes as never
    );
    await processador.processarPendentes();

    expect(repositorioOutbox.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pendente', erro: expect.stringContaining('fila indisponivel') })
    );
  });
});

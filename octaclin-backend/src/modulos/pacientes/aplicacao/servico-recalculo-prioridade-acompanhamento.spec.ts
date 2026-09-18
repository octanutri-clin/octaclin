import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { LogDiarioRapidoOrm } from '../../mobile/infraestrutura/log-diario-rapido.orm';
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

  const repositorioPacientes = {
    find: jest.fn(async (_opcoes: Record<string, unknown>) => pacientes)
  };
  const repositorioConsultas = {
    find: jest.fn(async ({ where }: { where: { pacienteId: string } }) => consultasPorPaciente[where.pacienteId] ?? [])
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
      throw new Error(`Repositorio nao mapeado no teste: ${(entidade as { name?: string })?.name ?? entidade}`);
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
    repositorioPrioridadeAtual,
    repositorioHistorico,
    prioridadesSalvas,
    historicoSalvo
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
    const { servico, prioridadesSalvas, repositorioPrioridadeAtual } = montarServico({
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
    expect(prioridadesSalvas.some((registro) => registro.pacienteId === 'paciente-ok')).toBe(true);
    expect(repositorioPrioridadeAtual.save).not.toHaveBeenCalledWith(
      expect.objectContaining({ pacienteId: 'paciente-com-falha' })
    );
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

import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { ExecucaoRegraOrm } from '../infraestrutura/execucao-regra.orm';
import { RegraAutomacaoOrm } from '../infraestrutura/regra-automacao.orm';
import { ServicoCheckinAtrasado } from './servico-checkin-atrasado';

const AGORA = new Date('2026-09-20T09:00:00.000Z');
const DIA_MS = 24 * 60 * 60 * 1000;
const USUARIO = { tenantId: 'tenant-1', usuarioId: 'usuario-1', papel: 'SuperAdmin' } as never;

function diasAtras(dias: number): Date {
  return new Date(AGORA.getTime() - dias * DIA_MS);
}

const regraPadrao = {
  id: 'regra-1',
  tenantId: 'tenant-1',
  profissionalId: 'profissional-1',
  nome: 'Checkin atrasado',
  gatilho: { tipo: 'checkin.atrasado', diasSemCheckin: 7, intervaloMinimoDias: 7, limitePorExecucao: 100 },
  condicoes: [],
  acoes: [{ tipo: 'notificar_profissional' }],
  ativa: true
};

function paciente(sobrescritas: Record<string, unknown> = {}) {
  return {
    id: 'paciente-1',
    tenantId: 'tenant-1',
    profissionalResponsavelId: 'profissional-1',
    ultimoCheckinEm: null,
    criadoEm: diasAtras(400),
    arquivadoEm: null,
    ...sobrescritas
  };
}

interface Cenario {
  regras?: Record<string, unknown>[];
  pacientes?: Record<string, unknown>[];
  execucoesExistentes?: Record<string, unknown>[];
}

interface QueryBuilderFake {
  insert: () => QueryBuilderFake;
  into: (entidade: unknown) => QueryBuilderFake;
  values: (valores: Record<string, unknown>) => QueryBuilderFake;
  orIgnore: () => QueryBuilderFake;
  execute: () => Promise<{ identifiers: unknown[] }>;
}

function criarServico(dados: Cenario = {}) {
  const regras = dados.regras ?? [regraPadrao];
  const pacientes = dados.pacientes ?? [paciente()];
  const execucoes: Record<string, unknown>[] = [...(dados.execucoesExistentes ?? [])];
  const idsInseridos = new Set<string>();

  const repositorioRegras = {
    find: jest.fn(async ({ where }: { where: { tenantId: string; ativa: boolean } }) =>
      regras.filter((regra) => regra.tenantId === where.tenantId && regra.ativa === where.ativa)
    ),
    findOne: jest.fn(
      async ({ where }: { where: { id: string; tenantId: string; profissionalId?: string } }) =>
        regras.find(
          (regra) =>
            regra.id === where.id &&
            regra.tenantId === where.tenantId &&
            (!where.profissionalId || regra.profissionalId === where.profissionalId)
        ) ?? null
    )
  };
  const repositorioPacientes = {
    find: jest.fn(
      async ({ where }: { where: { tenantId: string; profissionalResponsavelId: string; arquivadoEm: unknown } }) =>
        pacientes.filter(
          (item) =>
            item.tenantId === where.tenantId &&
            item.profissionalResponsavelId === where.profissionalResponsavelId &&
            !item.arquivadoEm
        )
    )
  };
  const repositorioExecucoes = {
    find: jest.fn(
      async ({
        where
      }: {
        where: { tenantId: string; regraId: string; pacienteId: { _value?: string[] } };
      }) => {
        const permitidos = new Set(where.pacienteId?._value ?? []);
        return execucoes
          .filter((item) => item.tenantId === where.tenantId && item.regraId === where.regraId && permitidos.has(item.pacienteId as string))
          .sort((a, b) => (b.criadoEm as Date).getTime() - (a.criadoEm as Date).getTime());
      }
    ),
    create: jest.fn((dado: Record<string, unknown>) => ({ id: `execucao-simulacao-${execucoes.length + 1}`, criadoEm: AGORA, ...dado })),
    save: jest.fn(async (registro: Record<string, unknown>) => {
      execucoes.push(registro);
      return registro;
    })
  };

  const gerenciador = {
    getRepository: jest.fn((entidade: unknown) => {
      if (entidade === RegraAutomacaoOrm) return repositorioRegras;
      if (entidade === PacienteOrm) return repositorioPacientes;
      if (entidade === ExecucaoRegraOrm) return repositorioExecucoes;
      throw new Error(`Repositorio nao mapeado no teste: ${(entidade as { name?: string })?.name ?? entidade}`);
    }),
    createQueryBuilder: jest.fn(() => {
      let alvo: 'execucao' | 'outbox' | undefined;
      let valoresAtuais: Record<string, unknown> = {};
      const builder: QueryBuilderFake = {
        insert: jest.fn(() => builder),
        into: jest.fn((entidade: unknown) => {
          if (entidade === ExecucaoRegraOrm) alvo = 'execucao';
          else if (entidade === OutboxEventoOrm) alvo = 'outbox';
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
            if (alvo === 'execucao') execucoes.push({ ...valoresAtuais });
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

  const servico = new ServicoCheckinAtrasado(executorTenant as never);

  return { servico, execucoes, repositorioRegras, repositorioPacientes, repositorioExecucoes };
}

describe('ServicoCheckinAtrasado.simular', () => {
  it('inclui paciente vencido e nunca despacha nenhuma acao (simulacao nunca cria execucao de disparo)', async () => {
    const { servico, execucoes } = criarServico({ pacientes: [paciente({ ultimoCheckinEm: diasAtras(10) })] });

    const resultado = await servico.simular('tenant-1', 'regra-1', USUARIO, AGORA);

    expect(resultado.candidatos).toEqual([{ pacienteId: 'paciente-1', diasSemCheckin: 10, referenciaEm: diasAtras(10) }]);
    expect(resultado.excluidos).toEqual([]);
    expect(execucoes).toHaveLength(1);
    expect(execucoes[0]).toEqual(expect.objectContaining({ resultado: expect.objectContaining({ simulacao: true }) }));
  });

  it('nao inclui paciente dentro do prazo', async () => {
    const { servico } = criarServico({ pacientes: [paciente({ ultimoCheckinEm: diasAtras(3) })] });

    const resultado = await servico.simular('tenant-1', 'regra-1', USUARIO, AGORA);

    expect(resultado.candidatos).toEqual([]);
    expect(resultado.excluidos).toEqual([{ pacienteId: 'paciente-1', motivo: 'dentro_do_prazo' }]);
  });

  it('usa criadoEm como referencia quando o paciente nunca fez check-in', async () => {
    const { servico } = criarServico({ pacientes: [paciente({ ultimoCheckinEm: null, criadoEm: diasAtras(9) })] });

    const resultado = await servico.simular('tenant-1', 'regra-1', USUARIO, AGORA);

    expect(resultado.candidatos).toEqual([{ pacienteId: 'paciente-1', diasSemCheckin: 9, referenciaEm: diasAtras(9) }]);
  });

  it('nao inclui paciente arquivado, de outro profissional ou de outro tenant', async () => {
    const { servico } = criarServico({
      pacientes: [
        paciente({ id: 'paciente-arquivado', ultimoCheckinEm: diasAtras(30), arquivadoEm: diasAtras(1) }),
        paciente({ id: 'paciente-outro-profissional', ultimoCheckinEm: diasAtras(30), profissionalResponsavelId: 'profissional-outro' }),
        paciente({ id: 'paciente-outro-tenant', ultimoCheckinEm: diasAtras(30), tenantId: 'tenant-2' })
      ]
    });

    const resultado = await servico.simular('tenant-1', 'regra-1', USUARIO, AGORA);

    expect(resultado.candidatos).toEqual([]);
  });

  it('respeita o intervalo minimo desde o ultimo disparo desta regra', async () => {
    const { servico } = criarServico({
      pacientes: [paciente({ ultimoCheckinEm: diasAtras(20) })],
      execucoesExistentes: [
        { tenantId: 'tenant-1', regraId: 'regra-1', pacienteId: 'paciente-1', criadoEm: diasAtras(2), resultado: {} }
      ]
    });

    const resultado = await servico.simular('tenant-1', 'regra-1', USUARIO, AGORA);

    expect(resultado.candidatos).toEqual([]);
    expect(resultado.excluidos).toEqual([{ pacienteId: 'paciente-1', motivo: 'disparo_recente' }]);
  });

  it('ignora simulacoes anteriores ao calcular o ultimo disparo (simulacao nao gasta o intervalo minimo)', async () => {
    const { servico } = criarServico({
      pacientes: [paciente({ ultimoCheckinEm: diasAtras(20) })],
      execucoesExistentes: [
        {
          tenantId: 'tenant-1',
          regraId: 'regra-1',
          pacienteId: 'paciente-1',
          criadoEm: diasAtras(2),
          resultado: { simulacao: true }
        }
      ]
    });

    const resultado = await servico.simular('tenant-1', 'regra-1', USUARIO, AGORA);

    expect(resultado.candidatos).toHaveLength(1);
  });

  it('aplica o limite por rodada de forma deterministica, priorizando quem esta mais atrasado', async () => {
    const { servico } = criarServico({
      regras: [{ ...regraPadrao, gatilho: { ...regraPadrao.gatilho, limitePorExecucao: 2 } }],
      pacientes: [
        paciente({ id: 'pouco-atrasado', ultimoCheckinEm: diasAtras(8) }),
        paciente({ id: 'muito-atrasado', ultimoCheckinEm: diasAtras(30) }),
        paciente({ id: 'medio-atrasado', ultimoCheckinEm: diasAtras(15) })
      ]
    });

    const resultado = await servico.simular('tenant-1', 'regra-1', USUARIO, AGORA);

    expect(resultado.candidatos.map((c) => c.pacienteId)).toEqual(['muito-atrasado', 'medio-atrasado']);
    expect(resultado.excluidos).toEqual([{ pacienteId: 'pouco-atrasado', motivo: 'limite_por_execucao' }]);
  });

  it('rejeita regra que nao usa o gatilho de checkin atrasado', async () => {
    const { servico } = criarServico({ regras: [{ ...regraPadrao, gatilho: { tipo: 'checkin' } }] });

    await expect(servico.simular('tenant-1', 'regra-1', USUARIO, AGORA)).rejects.toThrow(
      'Esta regra nao usa o gatilho de checkin atrasado.'
    );
  });
});

describe('ServicoCheckinAtrasado.processarRodada', () => {
  it('dispara a fundacao generica (cria execucao pendente e outbox) para cada candidato', async () => {
    const { servico, execucoes } = criarServico({ pacientes: [paciente({ ultimoCheckinEm: diasAtras(10) })] });

    const resultado = await servico.processarRodada('tenant-1', AGORA);

    expect(resultado.pacientesDisparados).toBe(1);
    expect(resultado.pacientesIgnorados).toBe(0);
    expect(resultado.regrasComErro).toBe(0);
    const disparo = execucoes.find((item) => item.regraId === 'regra-1' && item.status === 'pendente');
    expect(disparo).toEqual(expect.objectContaining({ tenantId: 'tenant-1', pacienteId: 'paciente-1', status: 'pendente' }));
    expect(JSON.stringify(disparo)).not.toMatch(/checkinsPerdidos|score|fator/i);
  });

  it('nao dispara paciente dentro do prazo', async () => {
    const { servico, execucoes } = criarServico({ pacientes: [paciente({ ultimoCheckinEm: diasAtras(3) })] });

    const resultado = await servico.processarRodada('tenant-1', AGORA);

    expect(resultado.pacientesDisparados).toBe(0);
    expect(resultado.pacientesIgnorados).toBe(1);
    expect(execucoes).toHaveLength(0);
  });

  it('retry/reexecucao da mesma rodada nao duplica o disparo (mesmo dia)', async () => {
    const { servico, execucoes } = criarServico({ pacientes: [paciente({ ultimoCheckinEm: diasAtras(10) })] });

    await servico.processarRodada('tenant-1', AGORA);
    await servico.processarRodada('tenant-1', AGORA);

    const disparos = execucoes.filter((item) => item.regraId === 'regra-1' && item.status === 'pendente');
    expect(disparos).toHaveLength(1);
  });

  it('uma regra com erro na selecao nao interrompe a avaliacao das demais regras da rodada', async () => {
    const regraComErro = { ...regraPadrao, id: 'regra-com-erro', profissionalId: 'profissional-com-erro' };
    const regraOk = { ...regraPadrao, id: 'regra-ok' };
    const { servico, repositorioPacientes, execucoes } = criarServico({
      regras: [regraComErro, regraOk],
      pacientes: [paciente({ ultimoCheckinEm: diasAtras(10) })]
    });
    repositorioPacientes.find.mockImplementationOnce(async () => {
      throw new Error('Banco indisponivel.');
    });

    const resultado = await servico.processarRodada('tenant-1', AGORA);

    expect(resultado.regrasComErro).toBe(1);
    expect(resultado.pacientesDisparados).toBe(1);
    expect(execucoes.some((item) => item.regraId === 'regra-ok' && item.status === 'pendente')).toBe(true);
  });
});

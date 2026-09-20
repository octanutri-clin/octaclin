import { EntityManager } from 'typeorm';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ExecucaoRegraOrm } from '../infraestrutura/execucao-regra.orm';
import { RegraAutomacaoOrm } from '../infraestrutura/regra-automacao.orm';
import {
  TIPO_OUTBOX_GATILHO_AUTOMACAO,
  dispararGatilhoAutomacao
} from './disparar-gatilho-automacao';

const tenantId = '11111111-1111-4111-8111-111111111111';
const pacienteId = '22222222-2222-4222-8222-222222222222';
const profissionalId = '33333333-3333-4333-8333-333333333333';
const regraId = '44444444-4444-4444-8444-444444444444';

interface InsercaoRegistrada {
  entidade: unknown;
  valores: Record<string, unknown>;
}

interface QueryBuilderFake {
  insert: () => QueryBuilderFake;
  into: (entidade: unknown) => QueryBuilderFake;
  values: (valores: Record<string, unknown>) => QueryBuilderFake;
  orIgnore: () => QueryBuilderFake;
  execute: () => Promise<{ identifiers: unknown[] }>;
}

function criarAmbiente(
  opcoes: {
    paciente?: Partial<PacienteOrm> | null;
    regras?: Partial<RegraAutomacaoOrm>[];
  } = {}
) {
  const paciente =
    opcoes.paciente === null ? null : { id: pacienteId, profissionalResponsavelId: profissionalId, ...opcoes.paciente };
  const regras = opcoes.regras ?? [{ id: regraId, tenantId, profissionalId, ativa: true }];

  const insercoes: InsercaoRegistrada[] = [];
  const idsExistentes = new Set<string>();

  const repositorioPacientes = { findOne: jest.fn(async () => paciente) };
  const repositorioRegras = { find: jest.fn(async () => regras) };

  const gerenciador = {
    getRepository: jest.fn((entidade: unknown) => {
      if (entidade === PacienteOrm) return repositorioPacientes;
      if (entidade === RegraAutomacaoOrm) return repositorioRegras;
      throw new Error('Repositorio inesperado.');
    }),
    createQueryBuilder: jest.fn(() => {
      let entidadeAlvo: unknown;
      let valoresAtuais: Record<string, unknown> = {};
      const builder: QueryBuilderFake = {
        insert: jest.fn(() => builder),
        into: jest.fn((entidade: unknown) => {
          entidadeAlvo = entidade;
          return builder;
        }),
        values: jest.fn((valores: Record<string, unknown>) => {
          valoresAtuais = valores;
          return builder;
        }),
        orIgnore: jest.fn(() => builder),
        execute: jest.fn(async () => {
          const id = String(valoresAtuais.id);
          if (!idsExistentes.has(id)) {
            idsExistentes.add(id);
            insercoes.push({ entidade: entidadeAlvo, valores: valoresAtuais });
          }
          return { identifiers: [] };
        })
      };
      return builder;
    })
  } as unknown as EntityManager;

  return { gerenciador, insercoes, repositorioPacientes, repositorioRegras };
}

describe('dispararGatilhoAutomacao', () => {
  const evento = {
    tipo: 'questionario.respondido' as const,
    pacienteId,
    origemTipo: 'envio_questionario',
    origemId: 'envio-1',
    contexto: { evento: 'questionario.respondido', envioId: 'envio-1' }
  };

  it('cria uma execucao e um evento de outbox por regra ativa correspondente', async () => {
    const { gerenciador, insercoes } = criarAmbiente();

    const disparos = await dispararGatilhoAutomacao(gerenciador, tenantId, evento);

    expect(disparos).toHaveLength(1);
    expect(insercoes.filter((item) => item.entidade === ExecucaoRegraOrm)).toHaveLength(1);
    expect(insercoes.filter((item) => item.entidade === OutboxEventoOrm)).toHaveLength(1);
    expect(disparos[0]).toEqual({
      execucaoId: expect.any(String),
      jobId: `execucao-regra-${disparos[0].execucaoId}`,
      contexto: evento.contexto
    });
  });

  it('e idempotente: repetir a mesma origem produz a mesma identidade e nao duplica registros', async () => {
    const { gerenciador, insercoes } = criarAmbiente();

    const primeiro = await dispararGatilhoAutomacao(gerenciador, tenantId, evento);
    const segundo = await dispararGatilhoAutomacao(gerenciador, tenantId, evento);

    expect(segundo).toEqual(primeiro);
    expect(insercoes.filter((item) => item.entidade === ExecucaoRegraOrm)).toHaveLength(1);
    expect(insercoes.filter((item) => item.entidade === OutboxEventoOrm)).toHaveLength(1);
  });

  it('usa uma identidade diferente para uma origem diferente', async () => {
    const { gerenciador } = criarAmbiente();

    const primeiro = await dispararGatilhoAutomacao(gerenciador, tenantId, evento);
    const segundo = await dispararGatilhoAutomacao(gerenciador, tenantId, { ...evento, origemId: 'envio-2' });

    expect(segundo[0].execucaoId).not.toBe(primeiro[0].execucaoId);
  });

  it('nao dispara quando o paciente nao tem profissional responsavel (isolamento defensivo)', async () => {
    const { gerenciador, repositorioRegras } = criarAmbiente({ paciente: null });

    const disparos = await dispararGatilhoAutomacao(gerenciador, tenantId, evento);

    expect(disparos).toEqual([]);
    expect(repositorioRegras.find).not.toHaveBeenCalled();
  });

  it('filtra regras pelo tenant e pelo profissional responsavel do paciente (isolamento cross-tenant/profissional)', async () => {
    const { gerenciador, repositorioRegras } = criarAmbiente();

    await dispararGatilhoAutomacao(gerenciador, tenantId, evento);

    expect(repositorioRegras.find).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId,
        ativa: true,
        profissionalId
      })
    });
  });

  it('nao dispara quando nenhuma regra ativa do profissional casa com o gatilho', async () => {
    const { gerenciador } = criarAmbiente({ regras: [] });

    const disparos = await dispararGatilhoAutomacao(gerenciador, tenantId, evento);

    expect(disparos).toEqual([]);
  });

  it('nao persiste conteudo clinico no payload duravel, apenas IDs opacos e o tipo do evento', async () => {
    const { gerenciador } = criarAmbiente();

    const disparos = await dispararGatilhoAutomacao(gerenciador, tenantId, evento);

    expect(JSON.stringify(disparos)).not.toMatch(/resposta|observ|sintoma/i);
  });

  it('grava o outbox com o tipo proprio de automacao', async () => {
    const { gerenciador, insercoes } = criarAmbiente();

    await dispararGatilhoAutomacao(gerenciador, tenantId, evento);

    const outbox = insercoes.find((item) => item.entidade === OutboxEventoOrm);
    expect(outbox?.valores.tipo).toBe(TIPO_OUTBOX_GATILHO_AUTOMACAO);
    expect(outbox?.valores.payload).toEqual({
      execucaoId: expect.any(String),
      jobId: expect.stringMatching(/^execucao-regra-/),
      contexto: evento.contexto
    });
  });
});

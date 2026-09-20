import { EntityManager } from 'typeorm';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { ExecucaoRegraOrm } from '../infraestrutura/execucao-regra.orm';
import { RegraAutomacaoOrm } from '../infraestrutura/regra-automacao.orm';
import { dispararGatilhoCheckinAdesaoBaixa } from './disparar-gatilho-checkin-adesao-baixa';

const tenantId = '11111111-1111-4111-8111-111111111111';
const pacienteId = '22222222-2222-4222-8222-222222222222';
const profissionalId = '33333333-3333-4333-8333-333333333333';
const checkinId = '55555555-5555-4555-8555-555555555555';

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

function criarAmbiente(regras: Partial<RegraAutomacaoOrm>[]) {
  const insercoes: InsercaoRegistrada[] = [];
  const idsExistentes = new Set<string>();
  const repositorioRegras = { find: jest.fn(async () => regras) };

  const gerenciador = {
    getRepository: jest.fn((entidade: unknown) => {
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

  return { gerenciador, insercoes, repositorioRegras };
}

const regraPadrao = { id: '44444444-4444-4444-8444-444444444444', tenantId, profissionalId, ativa: true };

describe('dispararGatilhoCheckinAdesaoBaixa', () => {
  it('dispara quando a adesao declarada fica abaixo do limiar da regra (default 50)', async () => {
    const { gerenciador, insercoes } = criarAmbiente([{ ...regraPadrao, gatilho: { tipo: 'checkin.adesao_baixa', limiarAdesao: 50 } }]);

    const disparos = await dispararGatilhoCheckinAdesaoBaixa(gerenciador, tenantId, {
      pacienteId,
      profissionalId,
      adesaoPlano: 30,
      checkinId
    });

    expect(disparos).toHaveLength(1);
    expect(insercoes.filter((item) => item.entidade === ExecucaoRegraOrm)).toHaveLength(1);
    expect(insercoes.filter((item) => item.entidade === OutboxEventoOrm)).toHaveLength(1);
  });

  it('nao dispara quando a adesao declarada e igual ou maior que o limiar da regra', async () => {
    const { gerenciador, insercoes } = criarAmbiente([{ ...regraPadrao, gatilho: { tipo: 'checkin.adesao_baixa', limiarAdesao: 50 } }]);

    const disparos = await dispararGatilhoCheckinAdesaoBaixa(gerenciador, tenantId, {
      pacienteId,
      profissionalId,
      adesaoPlano: 50,
      checkinId
    });

    expect(disparos).toEqual([]);
    expect(insercoes).toEqual([]);
  });

  it('respeita o limiar proprio de cada regra do mesmo profissional', async () => {
    const { gerenciador, insercoes } = criarAmbiente([
      { ...regraPadrao, id: 'regra-rigorosa', gatilho: { tipo: 'checkin.adesao_baixa', limiarAdesao: 80 } },
      { ...regraPadrao, id: 'regra-frouxa', gatilho: { tipo: 'checkin.adesao_baixa', limiarAdesao: 20 } }
    ]);

    const disparos = await dispararGatilhoCheckinAdesaoBaixa(gerenciador, tenantId, {
      pacienteId,
      profissionalId,
      adesaoPlano: 40,
      checkinId
    });

    expect(disparos).toHaveLength(1);
    expect(insercoes.filter((item) => item.entidade === ExecucaoRegraOrm)[0]?.valores.regraId).toBe('regra-rigorosa');
  });

  it('filtra regras pelo tenant e pelo profissional do check-in (isolamento cross-tenant/profissional)', async () => {
    const { gerenciador, repositorioRegras } = criarAmbiente([]);

    await dispararGatilhoCheckinAdesaoBaixa(gerenciador, tenantId, {
      pacienteId,
      profissionalId,
      adesaoPlano: 10,
      checkinId
    });

    expect(repositorioRegras.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId, ativa: true, profissionalId })
    });
  });

  it('nao dispara quando nao ha profissional responsavel (isolamento defensivo)', async () => {
    const { gerenciador, repositorioRegras } = criarAmbiente([{ ...regraPadrao, gatilho: { tipo: 'checkin.adesao_baixa', limiarAdesao: 50 } }]);

    const disparos = await dispararGatilhoCheckinAdesaoBaixa(gerenciador, tenantId, {
      pacienteId,
      profissionalId: '',
      adesaoPlano: 10,
      checkinId
    });

    expect(disparos).toEqual([]);
    expect(repositorioRegras.find).not.toHaveBeenCalled();
  });

  it('e idempotente: repetir o mesmo check-in produz a mesma identidade e nao duplica registros', async () => {
    const { gerenciador, insercoes } = criarAmbiente([{ ...regraPadrao, gatilho: { tipo: 'checkin.adesao_baixa', limiarAdesao: 50 } }]);
    const evento = { pacienteId, profissionalId, adesaoPlano: 10, checkinId };

    const primeiro = await dispararGatilhoCheckinAdesaoBaixa(gerenciador, tenantId, evento);
    const segundo = await dispararGatilhoCheckinAdesaoBaixa(gerenciador, tenantId, evento);

    expect(segundo).toEqual(primeiro);
    expect(insercoes.filter((item) => item.entidade === ExecucaoRegraOrm)).toHaveLength(1);
    expect(insercoes.filter((item) => item.entidade === OutboxEventoOrm)).toHaveLength(1);
  });

  it('nao persiste a adesao declarada nem outro dado do check-in no contexto duravel', async () => {
    const { gerenciador } = criarAmbiente([{ ...regraPadrao, gatilho: { tipo: 'checkin.adesao_baixa', limiarAdesao: 50 } }]);

    const disparos = await dispararGatilhoCheckinAdesaoBaixa(gerenciador, tenantId, {
      pacienteId,
      profissionalId,
      adesaoPlano: 10,
      checkinId
    });

    expect(disparos[0]?.contexto).toEqual({ evento: 'checkin.adesao_baixa' });
  });
});

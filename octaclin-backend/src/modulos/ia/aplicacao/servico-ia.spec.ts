import { AnaliseSentimentoOrm } from '../infraestrutura/analise-sentimento.orm';
import { ReconhecimentoAlimentarOrm } from '../infraestrutura/reconhecimento-alimentar.orm';
import { ServicoIa } from './servico-ia';

function criarRepositorioFake(nome: string, dados: Record<string, unknown>) {
  return {
    create: jest.fn((entrada: Record<string, unknown>) => ({ id: `${nome}-1`, ...entrada })),
    save: jest.fn(async (entrada: Record<string, unknown>) => entrada),
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => dados.cache ?? null)
  };
}

function criarServico(dados: Record<string, unknown> = {}) {
  const repositorios = {
    sentimento: criarRepositorioFake('sentimento', dados),
    alimento: criarRepositorioFake('alimento', dados)
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === AnaliseSentimentoOrm) return repositorios.sentimento;
      if (entidade === ReconhecimentoAlimentarOrm) return repositorios.alimento;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };

  return { servico: new ServicoIa(executorTenant as never), repositorios, executorTenant };
}

describe('ServicoIa', () => {
  const fetchOriginal = global.fetch;

  afterEach(() => {
    global.fetch = fetchOriginal;
    jest.restoreAllMocks();
  });

  it('deve persistir analise de sentimento no tenant sem salvar texto bruto', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        ansiedade_score: 20,
        frustracao_score: 75,
        motivacao_score: 40,
        confusao_score: 10,
        explicacao: { provedor: 'stub' }
      })
    })) as never;
    const { servico, repositorios, executorTenant } = criarServico();

    const analise = await servico.analisarSentimento('tenant-1', {
      pacienteId: 'paciente-1',
      texto: 'texto clinico sensivel'
    });

    expect(executorTenant.executar).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    expect(repositorios.sentimento.save).toHaveBeenCalledWith(
      expect.not.objectContaining({ texto: expect.any(String) })
    );
    expect(analise).toEqual(expect.objectContaining({ tenantId: 'tenant-1', alertaDisparado: true }));
  });

  it('deve retornar reconhecimento em cache sem chamar provedor externo', async () => {
    global.fetch = jest.fn() as never;
    const cache = { id: 'reconhecimento-1', tenantId: 'tenant-1', imagemHash: 'hash-local' };
    const { servico } = criarServico({ cache });

    await expect(
      servico.reconhecerAlimento('tenant-1', {
        pacienteId: 'paciente-1',
        arquivoMidiaId: 'midia-1',
        imagemUrl: 'https://example.com/prato.jpg'
      })
    ).resolves.toBe(cache);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

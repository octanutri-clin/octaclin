import { createHash } from 'crypto';
import { InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ArquivoMidiaOrm } from '../../mobile/infraestrutura/arquivo-midia.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AnaliseSentimentoOrm } from '../infraestrutura/analise-sentimento.orm';
import { ReconhecimentoAlimentarOrm } from '../infraestrutura/reconhecimento-alimentar.orm';
import { AnalisarSentimentoDto, ReconhecerAlimentoDto } from './dtos';
import { ServicoIa } from './servico-ia';

const ARMAZENAMENTO_BASE_URL = 'https://storage.test';
const URL_MIDIA_CONFIAVEL = `${ARMAZENAMENTO_BASE_URL}/bucket-clinico/tenant-1/paciente-1/imagem/midia-1`;

const usuarios: Record<'Professional' | 'SuperAdmin', UsuarioAutenticado> = {
  Professional: {
    usuarioId: 'usuario-profissional-1',
    tenantId: 'tenant-1',
    papel: 'Professional',
    emailHash: 'hash-profissional',
    permissoes: ['ia.executar']
  },
  SuperAdmin: {
    usuarioId: 'usuario-admin-1',
    tenantId: 'tenant-1',
    papel: 'SuperAdmin',
    emailHash: 'hash-admin',
    permissoes: ['ia.executar']
  }
};

interface RepositorioFake<T extends Record<string, unknown>> {
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  registros: T[];
}

interface DadosCenario {
  pacientes?: Array<Record<string, unknown>>;
  profissionais?: Array<Record<string, unknown>>;
  midias?: Array<Record<string, unknown>>;
  sentimentos?: Array<Record<string, unknown>>;
  reconhecimentos?: Array<Record<string, unknown>>;
}

interface ServicoIaEscopado {
  listarAnalisesSentimento(tenantId: string, usuario: UsuarioAutenticado): Promise<AnaliseSentimentoOrm[]>;
  analisarSentimento(
    tenantId: string,
    dados: AnalisarSentimentoDto,
    usuario: UsuarioAutenticado
  ): Promise<AnaliseSentimentoOrm>;
  listarReconhecimentosAlimentares(
    tenantId: string,
    usuario: UsuarioAutenticado
  ): Promise<ReconhecimentoAlimentarOrm[]>;
  reconhecerAlimento(
    tenantId: string,
    dados: ReconhecerAlimentoDto,
    usuario: UsuarioAutenticado
  ): Promise<ReconhecimentoAlimentarOrm>;
}

function valorCorresponde(atual: unknown, esperado: unknown): boolean {
  if (esperado instanceof FindOperator) {
    if (esperado.type === 'isNull') return atual === null || atual === undefined;
    if (esperado.type === 'in') return (esperado.value as unknown[]).includes(atual);
  }

  return atual === esperado;
}

function filtrar<T extends Record<string, unknown>>(registros: T[], where: Record<string, unknown> = {}): T[] {
  return registros.filter((registro) =>
    Object.entries(where).every(([campo, esperado]) => valorCorresponde(registro[campo], esperado))
  );
}

function criarRepositorioFake<T extends Record<string, unknown>>(
  nome: string,
  registrosIniciais: T[] = []
): RepositorioFake<T> {
  const registros = [...registrosIniciais];
  let sequencia = 0;
  return {
    registros,
    create: jest.fn((entrada: T) => ({
      id: `${nome}-${++sequencia}`,
      criadoEm: new Date('2026-07-28T12:00:00.000Z'),
      ...entrada
    })),
    save: jest.fn(async (entrada: T) => {
      registros.push(entrada);
      return entrada;
    }),
    find: jest.fn(async (opcoes?: { where?: Record<string, unknown> }) =>
      filtrar(registros, opcoes?.where)
    ),
    findOne: jest.fn(async (opcoes: { where: Record<string, unknown> }) =>
      filtrar(registros, opcoes.where)[0] ?? null
    )
  };
}

function dadosComDoisPacientes(): DadosCenario {
  const criadoEm = new Date('2026-07-28T10:00:00.000Z');
  return {
    pacientes: [
      {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1'
      },
      {
        id: 'paciente-2',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-2'
      }
    ],
    profissionais: [
      {
        id: 'profissional-1',
        tenantId: 'tenant-1',
        usuarioId: 'usuario-profissional-1'
      }
    ],
    midias: [
      {
        id: 'midia-1',
        tenantId: 'tenant-1',
        pacienteId: 'paciente-1',
        bucket: 'bucket-clinico',
        chaveObjeto: 'tenant-1/paciente-1/imagem/midia-1'
      },
      {
        id: 'midia-2',
        tenantId: 'tenant-1',
        pacienteId: 'paciente-2',
        bucket: 'bucket-clinico',
        chaveObjeto: 'tenant-1/paciente-2/imagem/midia-2'
      }
    ],
    sentimentos: [
      { id: 'sentimento-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', criadoEm },
      { id: 'sentimento-2', tenantId: 'tenant-1', pacienteId: 'paciente-2', criadoEm }
    ],
    reconhecimentos: [
      { id: 'reconhecimento-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', criadoEm },
      { id: 'reconhecimento-2', tenantId: 'tenant-1', pacienteId: 'paciente-2', criadoEm }
    ]
  };
}

function criarServico(dados: DadosCenario = {}) {
  const repositorios = {
    paciente: criarRepositorioFake('paciente', dados.pacientes ?? []),
    profissional: criarRepositorioFake('profissional', dados.profissionais ?? []),
    midia: criarRepositorioFake('midia', dados.midias ?? []),
    sentimento: criarRepositorioFake('sentimento', dados.sentimentos ?? []),
    alimento: criarRepositorioFake('alimento', dados.reconhecimentos ?? [])
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: unknown) => {
      if (entidade === PacienteOrm) return repositorios.paciente;
      if (entidade === ProfissionalOrm) return repositorios.profissional;
      if (entidade === ArquivoMidiaOrm) return repositorios.midia;
      if (entidade === AnaliseSentimentoOrm) return repositorios.sentimento;
      if (entidade === ReconhecimentoAlimentarOrm) return repositorios.alimento;
      throw new Error('Repositorio nao mapeado');
    }),
    query: jest.fn(async (_sql: string, _parametros?: unknown[]) => [])
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };
  const servico = new ServicoIa(executorTenant as never) as unknown as ServicoIaEscopado;

  return { servico, gerenciador, repositorios, executorTenant };
}

function respostaSentimento() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      ansiedade_score: 20,
      frustracao_score: 75,
      motivacao_score: 40,
      confusao_score: 10,
      explicacao: { provedor: 'stub' }
    })
  };
}

function hashReferencia(referencia: string): string {
  return createHash('sha256').update(referencia).digest('hex');
}

function respostaReconhecimento(
  referencia = URL_MIDIA_CONFIAVEL,
  provedor = 'vision-pro'
) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      provedor,
      imagem_hash: hashReferencia(referencia),
      alimentos_detectados: [{ nome: 'arroz' }],
      confianca_media: 0.92
    })
  };
}

function dadosReconhecimento(): ReconhecerAlimentoDto {
  return {
    pacienteId: 'paciente-1',
    arquivoMidiaId: 'midia-1',
    imagemUrl: 'https://atacante.test/imagem.jpg',
    imagemBase64: 'base64-controlado-pelo-cliente'
  };
}

async function aguardarCondicao(condicao: () => boolean): Promise<void> {
  for (let tentativa = 0; tentativa < 100; tentativa += 1) {
    if (condicao()) return;
    await new Promise<void>((resolver) => setImmediate(resolver));
  }
  throw new Error('Condicao de teste nao atingida.');
}

describe('ServicoIa', () => {
  const fetchOriginal = global.fetch;
  const armazenamentoOriginal = process.env.ARMAZENAMENTO_UPLOAD_BASE_URL;
  const timeoutOriginal = process.env.IA_SERVICE_TIMEOUT_MS;

  beforeEach(() => {
    process.env.ARMAZENAMENTO_UPLOAD_BASE_URL = ARMAZENAMENTO_BASE_URL;
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
    jest.useRealTimers();
    if (armazenamentoOriginal === undefined) {
      delete process.env.ARMAZENAMENTO_UPLOAD_BASE_URL;
    } else {
      process.env.ARMAZENAMENTO_UPLOAD_BASE_URL = armazenamentoOriginal;
    }
    if (timeoutOriginal === undefined) {
      delete process.env.IA_SERVICE_TIMEOUT_MS;
    } else {
      process.env.IA_SERVICE_TIMEOUT_MS = timeoutOriginal;
    }
    jest.restoreAllMocks();
  });

  it('filtra sentimentos e reconhecimentos na consulta pelos pacientes do Professional', async () => {
    const { servico, repositorios } = criarServico(dadosComDoisPacientes());

    const [sentimentos, reconhecimentos] = await Promise.all([
      servico.listarAnalisesSentimento('tenant-1', usuarios.Professional),
      servico.listarReconhecimentosAlimentares('tenant-1', usuarios.Professional)
    ]);

    expect(sentimentos.map((item) => item.id)).toEqual(['sentimento-1']);
    expect(reconhecimentos.map((item) => item.id)).toEqual(['reconhecimento-1']);
    expect(repositorios.sentimento.find).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', pacienteId: expect.any(FindOperator) },
      order: { criadoEm: 'DESC' },
      take: 50
    });
    expect(repositorios.alimento.find).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', pacienteId: expect.any(FindOperator) },
      order: { criadoEm: 'DESC' },
      take: 50
    });
  });

  it('mantem as listagens tenant-wide para SuperAdmin', async () => {
    const { servico } = criarServico(dadosComDoisPacientes());

    const [sentimentos, reconhecimentos] = await Promise.all([
      servico.listarAnalisesSentimento('tenant-1', usuarios.SuperAdmin),
      servico.listarReconhecimentosAlimentares('tenant-1', usuarios.SuperAdmin)
    ]);

    expect(sentimentos.map((item) => item.id)).toEqual(['sentimento-1', 'sentimento-2']);
    expect(reconhecimentos.map((item) => item.id)).toEqual(['reconhecimento-1', 'reconhecimento-2']);
  });

  it('rejeita analise de sentimento fora do escopo antes de chamar o provedor', async () => {
    global.fetch = jest.fn(async () => respostaSentimento()) as never;
    const { servico, repositorios } = criarServico(dadosComDoisPacientes());

    await expect(
      servico.analisarSentimento(
        'tenant-1',
        { pacienteId: 'paciente-2', texto: 'texto clinico sensivel' },
        usuarios.Professional
      )
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(repositorios.sentimento.save).not.toHaveBeenCalled();
  });

  it('mantem lock do paciente, chamada externa e save do sentimento na mesma transacao', async () => {
    global.fetch = jest.fn(async () => respostaSentimento()) as never;
    const { servico, repositorios, executorTenant } = criarServico(dadosComDoisPacientes());

    await servico.analisarSentimento(
      'tenant-1',
      { pacienteId: 'paciente-1', texto: 'texto clinico sensivel' },
      usuarios.Professional
    );

    expect(executorTenant.executar).toHaveBeenCalledTimes(1);
    expect(repositorios.paciente.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'paciente-1',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1'
      }),
      lock: { mode: 'pessimistic_write' }
    });
    expect(repositorios.paciente.findOne.mock.invocationCallOrder[0]).toBeLessThan(
      (global.fetch as jest.Mock).mock.invocationCallOrder[0]
    );
    expect((global.fetch as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      repositorios.sentimento.save.mock.invocationCallOrder[0]
    );
  });

  it('rejeita reconhecimento fora do escopo antes de consultar midia ou provedor', async () => {
    global.fetch = jest.fn(async () => respostaReconhecimento()) as never;
    const { servico, repositorios } = criarServico(dadosComDoisPacientes());

    await expect(
      servico.reconhecerAlimento(
        'tenant-1',
        { ...dadosReconhecimento(), pacienteId: 'paciente-2', arquivoMidiaId: 'midia-2' },
        usuarios.Professional
      )
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repositorios.midia.findOne).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('revalida ownership da midia com lock e rejeita divergencia antes do provedor', async () => {
    global.fetch = jest.fn(async () => respostaReconhecimento()) as never;
    const { servico, repositorios } = criarServico(dadosComDoisPacientes());

    await expect(
      servico.reconhecerAlimento(
        'tenant-1',
        { ...dadosReconhecimento(), arquivoMidiaId: 'midia-2' },
        usuarios.Professional
      )
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repositorios.midia.findOne).toHaveBeenCalledWith({
      where: { id: 'midia-2', tenantId: 'tenant-1', pacienteId: 'paciente-1' },
      lock: { mode: 'pessimistic_write' }
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('deriva URL e hash apenas da midia autorizada e ignora URL/base64 do cliente', async () => {
    global.fetch = jest.fn(async () => respostaReconhecimento()) as never;
    const { servico, repositorios } = criarServico(dadosComDoisPacientes());

    const reconhecimento = await servico.reconhecerAlimento(
      'tenant-1',
      dadosReconhecimento(),
      usuarios.Professional
    );

    const corpo = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
    expect(corpo).toEqual({ imagem_url: URL_MIDIA_CONFIAVEL, contexto: {} });
    expect(JSON.stringify(corpo)).not.toContain('atacante.test');
    expect(JSON.stringify(corpo)).not.toContain('base64-controlado-pelo-cliente');
    expect(repositorios.alimento.save).toHaveBeenCalledWith(
      expect.objectContaining({
        pacienteId: 'paciente-1',
        arquivoMidiaId: 'midia-1',
        provedor: 'vision-pro',
        imagemHash: hashReferencia(URL_MIDIA_CONFIAVEL)
      })
    );
    expect(reconhecimento).toEqual(expect.objectContaining({ provedor: 'vision-pro' }));
  });

  it('adquire locks antes de consultar cache, chamar provedor e salvar', async () => {
    global.fetch = jest.fn(async () => respostaReconhecimento()) as never;
    const { servico, gerenciador, repositorios, executorTenant } = criarServico(dadosComDoisPacientes());

    await servico.reconhecerAlimento('tenant-1', dadosReconhecimento(), usuarios.Professional);

    expect(executorTenant.executar).toHaveBeenCalledTimes(1);
    expect(repositorios.paciente.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } })
    );
    expect(repositorios.midia.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } })
    );
    expect(gerenciador.query).toHaveBeenCalledWith(
      'select pg_advisory_xact_lock($1, $2)',
      [expect.any(Number), expect.any(Number)]
    );
    expect(gerenciador.query.mock.invocationCallOrder[0]).toBeLessThan(
      repositorios.alimento.findOne.mock.invocationCallOrder[0]
    );
    expect(repositorios.alimento.findOne.mock.invocationCallOrder[0]).toBeLessThan(
      (global.fetch as jest.Mock).mock.invocationCallOrder[0]
    );
    expect((global.fetch as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      repositorios.alimento.save.mock.invocationCallOrder[0]
    );
  });

  it('reutiliza cache de qualquer provedor depois dos gates bloqueantes', async () => {
    global.fetch = jest.fn() as never;
    const cache = {
      id: 'reconhecimento-cache',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      arquivoMidiaId: 'midia-1',
      provedor: 'vision-enterprise',
      imagemHash: hashReferencia(URL_MIDIA_CONFIAVEL)
    };
    const dados = dadosComDoisPacientes();
    dados.reconhecimentos = [cache];
    const { servico, gerenciador, repositorios } = criarServico(dados);

    await expect(
      servico.reconhecerAlimento('tenant-1', dadosReconhecimento(), usuarios.Professional)
    ).resolves.toBe(cache);

    expect(gerenciador.query).toHaveBeenCalledTimes(1);
    expect(repositorios.alimento.findOne).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        pacienteId: 'paciente-1',
        arquivoMidiaId: 'midia-1',
        imagemHash: hashReferencia(URL_MIDIA_CONFIAVEL)
      }
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('nunca retorna cache de outro paciente ou outra midia', async () => {
    global.fetch = jest.fn(async () => respostaReconhecimento()) as never;
    const dados = dadosComDoisPacientes();
    dados.reconhecimentos = [
      {
        id: 'cache-outro-paciente',
        tenantId: 'tenant-1',
        pacienteId: 'paciente-2',
        arquivoMidiaId: 'midia-2',
        provedor: 'vision-pro',
        imagemHash: hashReferencia(URL_MIDIA_CONFIAVEL)
      }
    ];
    const { servico } = criarServico(dados);

    const reconhecimento = await servico.reconhecerAlimento(
      'tenant-1',
      dadosReconhecimento(),
      usuarios.Professional
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(reconhecimento).toEqual(expect.objectContaining({ pacienteId: 'paciente-1', arquivoMidiaId: 'midia-1' }));
  });

  it('rejeita hash divergente do provedor com erro sanitizado e sem persistir', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    global.fetch = jest.fn(async () => respostaReconhecimento('https://conteudo-divergente.test')) as never;
    const { servico, repositorios } = criarServico(dadosComDoisPacientes());

    let erroCapturado: unknown;
    try {
      await servico.reconhecerAlimento('tenant-1', dadosReconhecimento(), usuarios.Professional);
    } catch (erro) {
      erroCapturado = erro;
    }

    expect(erroCapturado).toBeInstanceOf(InternalServerErrorException);
    expect(JSON.stringify(erroCapturado)).not.toContain('conteudo-divergente');
    expect(repositorios.alimento.save).not.toHaveBeenCalled();
  });

  it('serializa concorrencia e faz a segunda chamada reutilizar o cache vencedor', async () => {
    let liberarPrimeiroFetch: ((resposta: ReturnType<typeof respostaReconhecimento>) => void) | undefined;
    global.fetch = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<ReturnType<typeof respostaReconhecimento>>((resolver) => {
            liberarPrimeiroFetch = resolver;
          })
      )
      .mockImplementation(async () => respostaReconhecimento()) as never;
    const { servico, gerenciador, executorTenant } = criarServico(dadosComDoisPacientes());
    let lockOcupado = false;
    const filaLock: Array<() => void> = [];

    gerenciador.query.mockImplementation(async (sql: string) => {
      if (!sql.includes('pg_advisory_xact_lock')) return [];
      if (lockOcupado) {
        await new Promise<void>((resolver) => filaLock.push(resolver));
      }
      lockOcupado = true;
      return [];
    });
    executorTenant.executar.mockImplementation(
      async (_tenantId: string, operacao: (gerenciadorTransacional: typeof gerenciador) => Promise<unknown>) => {
        try {
          return await operacao(gerenciador);
        } finally {
          if (lockOcupado) {
            lockOcupado = false;
            filaLock.shift()?.();
          }
        }
      }
    );

    const primeira = servico.reconhecerAlimento('tenant-1', dadosReconhecimento(), usuarios.Professional);
    await aguardarCondicao(() => (global.fetch as jest.Mock).mock.calls.length === 1);
    const segunda = servico.reconhecerAlimento('tenant-1', dadosReconhecimento(), usuarios.Professional);
    await aguardarCondicao(
      () => gerenciador.query.mock.calls.length === 2 || (global.fetch as jest.Mock).mock.calls.length === 2
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    liberarPrimeiroFetch?.(respostaReconhecimento());
    const [vencedor, reutilizado] = await Promise.all([primeira, segunda]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(gerenciador.query.mock.calls[0][1]).toEqual(gerenciador.query.mock.calls[1][1]);
    expect(vencedor).toBe(reutilizado);
  });

  it('sanitiza erro HTTP do provedor sem devolver o corpo externo', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 502,
      text: async () => 'segredo-do-provedor'
    })) as never;
    const { servico } = criarServico(dadosComDoisPacientes());

    let erroCapturado: unknown;
    try {
      await servico.analisarSentimento(
        'tenant-1',
        { pacienteId: 'paciente-1', texto: 'texto clinico sensivel' },
        usuarios.SuperAdmin
      );
    } catch (erro) {
      erroCapturado = erro;
    }

    expect(erroCapturado).toBeInstanceOf(InternalServerErrorException);
    expect(JSON.stringify(erroCapturado)).not.toContain('segredo-do-provedor');
    expect(clearTimeoutSpy).toHaveBeenCalledWith(setTimeoutSpy.mock.results[0].value);
  });

  it.each([
    ['ausente', undefined, 15000],
    ['vazio', '', 15000],
    ['nao numerico', 'abc', 15000],
    ['fracionario', '1500.5', 15000],
    ['abaixo do minimo', '999', 15000],
    ['acima do maximo', '60001', 15000],
    ['limite minimo', '1000', 1000],
    ['limite maximo', '60000', 60000],
    ['inteiro intermediario', '2500', 2500]
  ])('configura timeout %s e passa AbortSignal ao fetch', async (_caso, valor, esperado) => {
    if (valor === undefined) {
      delete process.env.IA_SERVICE_TIMEOUT_MS;
    } else {
      process.env.IA_SERVICE_TIMEOUT_MS = valor;
    }
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    global.fetch = jest.fn(async () => respostaSentimento()) as never;
    const { servico } = criarServico(dadosComDoisPacientes());

    await servico.analisarSentimento(
      'tenant-1',
      { pacienteId: 'paciente-1', texto: 'texto clinico sensivel' },
      usuarios.SuperAdmin
    );

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), esperado);
    expect((global.fetch as jest.Mock).mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(setTimeoutSpy.mock.results[0].value);
  });

  it('aborta fetch no timeout e devolve erro sanitizado sem espera real', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    process.env.IA_SERVICE_TIMEOUT_MS = '1000';
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    let sinalRecebido: AbortSignal | undefined;
    global.fetch = jest.fn((_url, opcoes) => {
      sinalRecebido = opcoes?.signal as AbortSignal;
      return new Promise((_resolver, rejeitar) => {
        sinalRecebido?.addEventListener(
          'abort',
          () => {
            const erro = new Error('texto clinico sensivel vindo do abort');
            erro.name = 'AbortError';
            rejeitar(erro);
          },
          { once: true }
        );
      });
    }) as never;
    const { servico, repositorios } = criarServico(dadosComDoisPacientes());

    const resultado = servico.analisarSentimento(
      'tenant-1',
      { pacienteId: 'paciente-1', texto: 'texto clinico sensivel' },
      usuarios.SuperAdmin
    );
    const resultadoCapturado = resultado.catch((erro: unknown) => erro);
    await aguardarCondicao(() => (global.fetch as jest.Mock).mock.calls.length === 1);
    expect(sinalRecebido?.aborted).toBe(false);

    await jest.advanceTimersByTimeAsync(1000);
    const erroCapturado = await resultadoCapturado;

    expect(erroCapturado).toBeInstanceOf(InternalServerErrorException);
    expect(JSON.stringify(erroCapturado)).not.toContain('texto clinico sensivel');
    expect(sinalRecebido?.aborted).toBe(true);
    expect(repositorios.sentimento.save).not.toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(setTimeoutSpy.mock.results[0].value);
    expect(JSON.stringify(logger.mock.calls)).not.toContain('texto clinico sensivel');
    expect(logger).toHaveBeenCalledWith('Timeout ao chamar o provedor de IA.', {
      caminho: '/analisar-sentimento',
      timeoutMs: 1000
    });
  });
});

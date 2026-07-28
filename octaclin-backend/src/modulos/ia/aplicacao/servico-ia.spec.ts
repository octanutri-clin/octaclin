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
      { id: 'midia-1', tenantId: 'tenant-1', pacienteId: 'paciente-1' },
      { id: 'midia-2', tenantId: 'tenant-1', pacienteId: 'paciente-2' }
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
    })
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

function respostaReconhecimento() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      provedor: 'heuristica-local',
      imagem_hash: 'hash-provedor',
      alimentos_detectados: [{ nome: 'arroz' }],
      confianca_media: 0.92
    })
  };
}

function hashReconhecimento(pacienteId: string, referencia: string): string {
  return createHash('sha256').update(pacienteId).update('\0').update(referencia).digest('hex');
}

describe('ServicoIa', () => {
  const fetchOriginal = global.fetch;

  afterEach(() => {
    global.fetch = fetchOriginal;
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

  it('persiste analise autorizada sem texto bruto e revalida o paciente depois do provedor', async () => {
    global.fetch = jest.fn(async () => respostaSentimento()) as never;
    const { servico, repositorios } = criarServico(dadosComDoisPacientes());

    const analise = await servico.analisarSentimento(
      'tenant-1',
      { pacienteId: 'paciente-1', texto: 'texto clinico sensivel' },
      usuarios.Professional
    );

    expect(repositorios.paciente.findOne).toHaveBeenCalledTimes(2);
    expect(repositorios.sentimento.save).toHaveBeenCalledWith(
      expect.not.objectContaining({ texto: expect.any(String) })
    );
    expect(analise).toEqual(expect.objectContaining({ tenantId: 'tenant-1', pacienteId: 'paciente-1' }));
  });

  it('nao persiste analise quando o Professional perde responsabilidade durante a chamada externa', async () => {
    global.fetch = jest.fn(async () => respostaSentimento()) as never;
    const { servico, repositorios } = criarServico(dadosComDoisPacientes());
    repositorios.paciente.findOne
      .mockResolvedValueOnce({ id: 'paciente-1', tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-1' })
      .mockResolvedValueOnce(null);

    await expect(
      servico.analisarSentimento(
        'tenant-1',
        { pacienteId: 'paciente-1', texto: 'texto clinico sensivel' },
        usuarios.Professional
      )
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(repositorios.sentimento.save).not.toHaveBeenCalled();
  });

  it('rejeita reconhecimento fora do escopo antes de consultar a midia ou chamar o provedor', async () => {
    global.fetch = jest.fn(async () => respostaReconhecimento()) as never;
    const { servico, repositorios } = criarServico(dadosComDoisPacientes());

    await expect(
      servico.reconhecerAlimento(
        'tenant-1',
        {
          pacienteId: 'paciente-2',
          arquivoMidiaId: 'midia-2',
          imagemUrl: 'https://example.com/prato.jpg'
        },
        usuarios.Professional
      )
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repositorios.midia.findOne).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejeita arquivo de outro paciente antes de chamar o provedor', async () => {
    global.fetch = jest.fn(async () => respostaReconhecimento()) as never;
    const { servico, repositorios } = criarServico(dadosComDoisPacientes());

    await expect(
      servico.reconhecerAlimento(
        'tenant-1',
        {
          pacienteId: 'paciente-1',
          arquivoMidiaId: 'midia-2',
          imagemUrl: 'https://example.com/prato.jpg'
        },
        usuarios.Professional
      )
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repositorios.midia.findOne).toHaveBeenCalledWith({
      where: { id: 'midia-2', tenantId: 'tenant-1', pacienteId: 'paciente-1' }
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('retorna cache somente quando pertence ao paciente solicitado', async () => {
    global.fetch = jest.fn() as never;
    const imagemUrl = 'https://example.com/prato.jpg';
    const hashLocal = hashReconhecimento('paciente-1', imagemUrl);
    const cache = {
      id: 'reconhecimento-cache',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      provedor: 'heuristica-local',
      imagemHash: hashLocal
    };
    const dados = dadosComDoisPacientes();
    dados.reconhecimentos = [cache];
    const { servico, repositorios } = criarServico(dados);

    await expect(
      servico.reconhecerAlimento(
        'tenant-1',
        { pacienteId: 'paciente-1', arquivoMidiaId: 'midia-1', imagemUrl },
        usuarios.Professional
      )
    ).resolves.toBe(cache);

    expect(repositorios.alimento.findOne).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        pacienteId: 'paciente-1',
        provedor: 'heuristica-local',
        imagemHash: hashLocal
      }
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('ignora cache com mesmo hash pertencente a outro paciente', async () => {
    global.fetch = jest.fn(async () => respostaReconhecimento()) as never;
    const imagemUrl = 'https://example.com/prato.jpg';
    const hashOutroPaciente = hashReconhecimento('paciente-2', imagemUrl);
    const hashPacienteSolicitado = hashReconhecimento('paciente-1', imagemUrl);
    const dados = dadosComDoisPacientes();
    dados.reconhecimentos = [
      {
        id: 'cache-outro-paciente',
        tenantId: 'tenant-1',
        pacienteId: 'paciente-2',
        provedor: 'heuristica-local',
        imagemHash: hashOutroPaciente
      }
    ];
    const { servico, repositorios } = criarServico(dados);

    const reconhecimento = await servico.reconhecerAlimento(
      'tenant-1',
      { pacienteId: 'paciente-1', arquivoMidiaId: 'midia-1', imagemUrl },
      usuarios.Professional
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(reconhecimento).toEqual(expect.objectContaining({ pacienteId: 'paciente-1' }));
    expect(repositorios.alimento.save).toHaveBeenCalledWith(
      expect.objectContaining({ pacienteId: 'paciente-1', imagemHash: hashPacienteSolicitado })
    );
    expect(hashPacienteSolicitado).not.toBe(hashOutroPaciente);
  });

  it('revalida paciente e midia antes de persistir o reconhecimento', async () => {
    global.fetch = jest.fn(async () => respostaReconhecimento()) as never;
    const { servico, repositorios } = criarServico(dadosComDoisPacientes());

    const reconhecimento = await servico.reconhecerAlimento(
      'tenant-1',
      {
        pacienteId: 'paciente-1',
        arquivoMidiaId: 'midia-1',
        imagemUrl: 'https://example.com/prato.jpg'
      },
      usuarios.Professional
    );

    expect(repositorios.paciente.findOne).toHaveBeenCalledTimes(2);
    expect(repositorios.midia.findOne).toHaveBeenCalledTimes(2);
    expect(reconhecimento).toEqual(expect.objectContaining({ pacienteId: 'paciente-1', arquivoMidiaId: 'midia-1' }));
  });

  it('nao persiste reconhecimento quando o Professional perde responsabilidade durante a chamada externa', async () => {
    global.fetch = jest.fn(async () => respostaReconhecimento()) as never;
    const { servico, repositorios } = criarServico(dadosComDoisPacientes());
    repositorios.paciente.findOne
      .mockResolvedValueOnce({ id: 'paciente-1', tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-1' })
      .mockResolvedValueOnce(null);

    await expect(
      servico.reconhecerAlimento(
        'tenant-1',
        {
          pacienteId: 'paciente-1',
          arquivoMidiaId: 'midia-1',
          imagemUrl: 'https://example.com/prato.jpg'
        },
        usuarios.Professional
      )
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(repositorios.alimento.save).not.toHaveBeenCalled();
  });

  it('sanitiza erro do provedor sem devolver o corpo externo', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
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
  });
});

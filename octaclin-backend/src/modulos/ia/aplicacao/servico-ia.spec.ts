import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ArquivoMidiaOrm } from '../../mobile/infraestrutura/arquivo-midia.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { RespostaCheckinOrm } from '../../questionarios/infraestrutura/resposta-checkin.orm';
import { AnaliseSentimentoOrm } from '../infraestrutura/analise-sentimento.orm';
import { ReconhecimentoAlimentarOrm } from '../infraestrutura/reconhecimento-alimentar.orm';
import { TranscricaoMidiaOrm } from '../infraestrutura/transcricao-midia.orm';
import { ServicoIa } from './servico-ia';

const HASH = 'a'.repeat(64);
const TOKEN = 'token-de-servico-ia-com-no-minimo-32-caracteres';

const usuarioSuperAdmin: UsuarioAutenticado = {
  usuarioId: 'usuario-admin-1',
  tenantId: 'tenant-1',
  papel: 'SuperAdmin',
  emailHash: 'hash-admin',
  permissoes: []
};

const usuarioProfissional: UsuarioAutenticado = {
  usuarioId: 'usuario-profissional-1',
  tenantId: 'tenant-1',
  papel: 'Professional',
  emailHash: 'hash-profissional',
  permissoes: []
};

function respostaHttp(corpo: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    text: jest.fn(async () => typeof corpo === 'string' ? corpo : JSON.stringify(corpo))
  };
}

function criarRepositorioFake(nome: string, dados: Record<string, unknown>) {
  return {
    create: jest.fn((entrada: Record<string, unknown>) => ({ id: `${nome}-1`, ...entrada })),
    save: jest.fn(async (entrada: Record<string, unknown>) => entrada),
    find: jest.fn(async () => (nome === 'paciente' ? dados.pacientes ?? [] : [])),
    findOne: jest.fn(async () => {
      if (nome === 'sentimento') return dados.analise ?? null;
      if (nome === 'alimento') return dados.reconhecimento ?? dados.cache ?? null;
      if (nome === 'paciente') return dados.paciente === null ? null : dados.paciente ?? { id: 'paciente-1', tenantId: 'tenant-1' };
      if (nome === 'profissional') return dados.profissional ?? null;
      if (nome === 'midia') return dados.midia === null ? null : dados.midia ?? {
        id: 'midia-1',
        tenantId: 'tenant-1',
        pacienteId: 'paciente-1',
        tipo: 'imagem',
        status: 'confirmado',
        hashConteudo: HASH,
        bucket: 'midias',
        chaveObjeto: 'tenant-1/paciente-1/prato.jpg'
      };
      if (nome === 'checkin') return dados.checkin ?? null;
      if (nome === 'transcricao') return dados.transcricao ?? null;
      return null;
    })
  };
}

function criarServico(dados: Record<string, unknown> = {}) {
  const repositorios = {
    sentimento: criarRepositorioFake('sentimento', dados),
    alimento: criarRepositorioFake('alimento', dados),
    paciente: criarRepositorioFake('paciente', dados),
    profissional: criarRepositorioFake('profissional', dados),
    midia: criarRepositorioFake('midia', dados),
    checkin: criarRepositorioFake('checkin', dados),
    transcricao: criarRepositorioFake('transcricao', dados)
  };
  const gerenciador = {
    query: jest.fn(async () => undefined),
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === AnaliseSentimentoOrm) return repositorios.sentimento;
      if (entidade === ReconhecimentoAlimentarOrm) return repositorios.alimento;
      if (entidade === PacienteOrm) return repositorios.paciente;
      if (entidade === ProfissionalOrm) return repositorios.profissional;
      if (entidade === ArquivoMidiaOrm) return repositorios.midia;
      if (entidade === RespostaCheckinOrm) return repositorios.checkin;
      if (entidade === TranscricaoMidiaOrm) return repositorios.transcricao;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };
  const armazenamento = {
    criarDownloadAssinado: jest.fn(async () => 'https://midias.example.test/prato.jpg?assinatura=temporaria')
  };

  return {
    servico: new ServicoIa(executorTenant as never, armazenamento as never),
    repositorios,
    gerenciador,
    armazenamento,
    executorTenant
  };
}

describe('ServicoIa', () => {
  const fetchOriginal = global.fetch;

  beforeEach(() => {
    process.env.IA_SERVICE_TOKEN = TOKEN;
    process.env.IA_SERVICE_URL = 'http://ia-service:8001';
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
    delete process.env.IA_SERVICE_TOKEN;
    delete process.env.IA_SERVICE_URL;
    delete process.env.IA_SERVICE_TIMEOUT_MS;
    jest.restoreAllMocks();
  });

  it('persiste analise sem salvar o texto clinico bruto e autentica o servico', async () => {
    global.fetch = jest.fn(async () => respostaHttp({
      ansiedade_score: 20,
      frustracao_score: 75,
      motivacao_score: 40,
      confusao_score: 10,
      explicacao: { provedor: 'stub' }
    })) as never;
    const { servico, repositorios } = criarServico();

    const analise = await servico.analisarSentimento('tenant-1', {
      pacienteId: 'paciente-1',
      texto: 'texto clinico sensivel'
    }, usuarioSuperAdmin);

    expect(repositorios.sentimento.save).toHaveBeenCalledWith(expect.not.objectContaining({ texto: expect.any(String) }));
    expect(global.fetch).toHaveBeenCalledWith(
      'http://ia-service:8001/analisar-sentimento',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }) })
    );
    expect(analise).toEqual(expect.objectContaining({ tenantId: 'tenant-1', alertaDisparado: false }));
  });

  it('falha fechada quando o segredo entre servicos nao esta configurado', async () => {
    delete process.env.IA_SERVICE_TOKEN;
    const { servico } = criarServico();

    await expect(servico.analisarSentimento('tenant-1', {
      pacienteId: 'paciente-1',
      texto: 'texto clinico'
    }, usuarioSuperAdmin)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejeita resposta de check-in que nao pertence ao paciente', async () => {
    global.fetch = jest.fn() as never;
    const { servico } = criarServico({ checkin: null });

    await expect(servico.analisarSentimento('tenant-1', {
      pacienteId: 'paciente-1',
      texto: 'texto clinico',
      respostaCheckinId: '11111111-1111-4111-8111-111111111111'
    }, usuarioSuperAdmin)).rejects.toBeInstanceOf(NotFoundException);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejeita transcricao cujo arquivo nao pertence ao paciente', async () => {
    global.fetch = jest.fn() as never;
    const { servico } = criarServico({
      transcricao: { id: 'transcricao-1', arquivoMidiaId: 'midia-outro-paciente' },
      midia: null
    });

    await expect(servico.analisarSentimento('tenant-1', {
      pacienteId: 'paciente-1',
      texto: 'texto clinico',
      transcricaoMidiaId: '22222222-2222-4222-8222-222222222222'
    }, usuarioSuperAdmin)).rejects.toBeInstanceOf(NotFoundException);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('retorna reconhecimento em cache depois de adquirir lock transacional', async () => {
    global.fetch = jest.fn() as never;
    const cache = { id: 'reconhecimento-1', tenantId: 'tenant-1', imagemHash: HASH };
    const { servico, gerenciador, repositorios } = criarServico({ cache });

    await expect(servico.reconhecerAlimento('tenant-1', {
      pacienteId: 'paciente-1',
      arquivoMidiaId: 'midia-1'
    }, usuarioSuperAdmin)).resolves.toBe(cache);

    expect(gerenciador.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), [expect.any(String)]);
    expect(repositorios.alimento.findOne).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', pacienteId: 'paciente-1', arquivoMidiaId: 'midia-1', imagemHash: HASH }
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('usa apenas a imagem privada validada e preserva seu hash de integridade', async () => {
    global.fetch = jest.fn(async () => respostaHttp({
      provedor: 'heuristica-local',
      imagem_hash: HASH,
      alimentos_detectados: [{ nome: 'arroz' }],
      confianca_media: 0.72,
      limitacoes: ['Exige revisao profissional.']
    })) as never;
    const { servico, armazenamento, repositorios } = criarServico();

    await servico.reconhecerAlimento('tenant-1', {
      pacienteId: 'paciente-1',
      arquivoMidiaId: 'midia-1',
      contexto: { observacao: 'Prato com arroz' }
    }, usuarioSuperAdmin);

    expect(armazenamento.criarDownloadAssinado).toHaveBeenCalledWith('midias', 'tenant-1/paciente-1/prato.jpg');
    const corpo = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
    expect(corpo).toEqual(expect.objectContaining({ imagem_hash: HASH }));
    expect(corpo.imagem_url).toContain('assinatura=temporaria');
    expect(repositorios.alimento.save).toHaveBeenCalledWith(expect.objectContaining({ imagemHash: HASH }));
  });

  it('rejeita hash divergente devolvido pelo provedor', async () => {
    global.fetch = jest.fn(async () => respostaHttp({
      provedor: 'heuristica-local',
      imagem_hash: 'b'.repeat(64),
      alimentos_detectados: [],
      limitacoes: []
    })) as never;
    const { servico } = criarServico();

    await expect(servico.reconhecerAlimento('tenant-1', {
      pacienteId: 'paciente-1',
      arquivoMidiaId: 'midia-1'
    }, usuarioSuperAdmin)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('nao expoe o corpo de erro retornado pelo provedor', async () => {
    global.fetch = jest.fn(async () => respostaHttp('segredo-interno-do-provedor', false, 500)) as never;
    const { servico } = criarServico();

    await expect(servico.analisarSentimento('tenant-1', {
      pacienteId: 'paciente-1',
      texto: 'texto clinico'
    }, usuarioSuperAdmin)).rejects.not.toThrow('segredo-interno-do-provedor');
  });

  it('interrompe resposta do provedor acima de 512 KiB', async () => {
    global.fetch = jest.fn(async () => respostaHttp('x'.repeat(512 * 1024 + 1))) as never;
    const { servico } = criarServico();

    await expect(servico.analisarSentimento('tenant-1', {
      pacienteId: 'paciente-1',
      texto: 'texto clinico'
    }, usuarioSuperAdmin)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('converte timeout do provedor em erro sanitizado', async () => {
    global.fetch = jest.fn(async () => {
      const erro = new Error('detalhe interno de rede');
      erro.name = 'TimeoutError';
      throw erro;
    }) as never;
    const { servico } = criarServico();

    await expect(servico.analisarSentimento('tenant-1', {
      pacienteId: 'paciente-1',
      texto: 'texto clinico'
    }, usuarioSuperAdmin)).rejects.not.toThrow('detalhe interno de rede');
  });

  it('registra a decisao humana na analise do mesmo tenant', async () => {
    const analise = {
      id: 'analise-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      frustracaoScore: '75',
      alertaDisparado: false,
      revisaoHumana: { status: 'pendente' }
    };
    const { servico, repositorios } = criarServico({ analise });

    await expect(servico.revisarAnaliseSentimento(
      'tenant-1',
      'analise-1',
      { decisao: 'editada', conteudoEditado: { interpretacao: 'Frustracao pontual.' } },
      usuarioSuperAdmin
    )).resolves.toEqual(expect.objectContaining({ revisaoHumana: expect.objectContaining({ status: 'editada' }) }));
    expect(repositorios.sentimento.save).toHaveBeenCalledWith(analise);
    expect(analise.alertaDisparado).toBe(true);
  });

  it('exige conteudo corrigido ao editar uma sugestao', async () => {
    const { servico } = criarServico({
      analise: { id: 'analise-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', revisaoHumana: { status: 'pendente' } }
    });
    await expect(servico.revisarAnaliseSentimento(
      'tenant-1',
      'analise-1',
      { decisao: 'editada' },
      usuarioSuperAdmin
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('limita a listagem aos pacientes do profissional', async () => {
    const { servico, repositorios } = criarServico({
      profissional: { id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' },
      pacientes: [{ id: 'paciente-1', tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-1' }]
    });

    await servico.listarAnalisesSentimento('tenant-1', usuarioProfissional);

    expect(repositorios.paciente.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ profissionalResponsavelId: 'profissional-1' }) })
    );
    expect(repositorios.sentimento.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ pacienteId: expect.anything() }) })
    );
  });
});

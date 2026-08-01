import { AnaliseSentimentoOrm } from '../infraestrutura/analise-sentimento.orm';
import { ReconhecimentoAlimentarOrm } from '../infraestrutura/reconhecimento-alimentar.orm';
import { ServicoIa } from './servico-ia';
import { BadRequestException } from '@nestjs/common';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';

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

function criarRepositorioFake(nome: string, dados: Record<string, unknown>) {
  return {
    create: jest.fn((entrada: Record<string, unknown>) => ({ id: `${nome}-1`, ...entrada })),
    save: jest.fn(async (entrada: Record<string, unknown>) => entrada),
    find: jest.fn(async () => (nome === 'paciente' ? dados.pacientes ?? [] : [])),
    findOne: jest.fn(async () => {
      if (nome === 'sentimento') return dados.analise ?? null;
      if (nome === 'alimento') return dados.reconhecimento ?? dados.cache ?? null;
      if (nome === 'paciente') return dados.paciente ?? { id: 'paciente-1', tenantId: 'tenant-1' };
      if (nome === 'profissional') return dados.profissional ?? null;
      return null;
    })
  };
}

function criarServico(dados: Record<string, unknown> = {}) {
  const repositorios = {
    sentimento: criarRepositorioFake('sentimento', dados),
    alimento: criarRepositorioFake('alimento', dados),
    paciente: criarRepositorioFake('paciente', dados),
    profissional: criarRepositorioFake('profissional', dados)
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === AnaliseSentimentoOrm) return repositorios.sentimento;
      if (entidade === ReconhecimentoAlimentarOrm) return repositorios.alimento;
      if (entidade === PacienteOrm) return repositorios.paciente;
      if (entidade === ProfissionalOrm) return repositorios.profissional;
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
    }, usuarioSuperAdmin);

    expect(executorTenant.executar).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    expect(repositorios.sentimento.save).toHaveBeenCalledWith(
      expect.not.objectContaining({ texto: expect.any(String) })
    );
    expect(analise).toEqual(expect.objectContaining({ tenantId: 'tenant-1', alertaDisparado: false }));
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
      }, usuarioSuperAdmin)
    ).resolves.toBe(cache);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('deve registrar a decisao humana na analise do mesmo tenant', async () => {
    const analise = {
      id: 'analise-1',
      tenantId: 'tenant-1',
      frustracaoScore: '75',
      alertaDisparado: false,
      revisaoHumana: { status: 'pendente' }
    };
    const { servico, repositorios } = criarServico({ analise });

    await expect(
      servico.revisarAnaliseSentimento(
        'tenant-1',
        'analise-1',
        {
          decisao: 'editada',
          observacao: 'Ajustar o contexto antes da conduta.',
          conteudoEditado: { interpretacao: 'Paciente relata frustracao pontual.' }
        },
        usuarioSuperAdmin
      )
    ).resolves.toEqual(
      expect.objectContaining({
        revisaoHumana: expect.objectContaining({
          status: 'editada',
          revisadoPor: 'usuario-admin-1',
          observacao: 'Ajustar o contexto antes da conduta.',
          conteudoEditado: { interpretacao: 'Paciente relata frustracao pontual.' }
        })
      })
    );
    expect(repositorios.sentimento.findOne).toHaveBeenCalledWith({
      where: { id: 'analise-1', tenantId: 'tenant-1' }
    });
    expect(repositorios.sentimento.save).toHaveBeenCalledWith(analise);
    expect(analise.alertaDisparado).toBe(true);
  });

  it('deve registrar rejeicao humana no reconhecimento alimentar do mesmo tenant', async () => {
    const reconhecimento = {
      id: 'reconhecimento-1',
      tenantId: 'tenant-1',
      revisaoHumana: { status: 'pendente' }
    };
    const { servico, repositorios } = criarServico({ reconhecimento });

    await servico.revisarReconhecimentoAlimentar(
      'tenant-1',
      'reconhecimento-1',
      { decisao: 'rejeitada', observacao: 'Imagem insuficiente.' },
      usuarioSuperAdmin
    );

    expect(reconhecimento.revisaoHumana).toEqual(
      expect.objectContaining({ status: 'rejeitada', revisadoPor: 'usuario-admin-1' })
    );
    expect(repositorios.alimento.save).toHaveBeenCalledWith(reconhecimento);
  });

  it('deve exigir a justificativa ao editar uma sugestao', async () => {
    const { servico } = criarServico({
      analise: { id: 'analise-1', tenantId: 'tenant-1', revisaoHumana: { status: 'pendente' } }
    });

    await expect(
      servico.revisarAnaliseSentimento(
        'tenant-1',
        'analise-1',
        { decisao: 'editada', observacao: 'Comentario sem conteudo corrigido.' },
        usuarioSuperAdmin
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deve isolar o cache alimentar por paciente', async () => {
    global.fetch = jest.fn() as never;
    const cache = { id: 'reconhecimento-1', tenantId: 'tenant-1', pacienteId: 'paciente-1' };
    const { servico, repositorios } = criarServico({ cache });

    await servico.reconhecerAlimento('tenant-1', {
      pacienteId: 'paciente-1',
      arquivoMidiaId: 'midia-1',
      imagemUrl: 'https://example.com/prato.jpg'
    }, usuarioSuperAdmin);

    expect(repositorios.alimento.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId: 'tenant-1', pacienteId: 'paciente-1' })
    });
  });

  it('deve limitar a listagem de sentimento aos pacientes do profissional', async () => {
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

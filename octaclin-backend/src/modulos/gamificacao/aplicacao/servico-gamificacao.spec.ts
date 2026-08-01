import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
import { BadgeOrm } from '../infraestrutura/badge.orm';
import { CirculoPacientesOrm } from '../infraestrutura/circulo-pacientes.orm';
import { DesafioOrm } from '../infraestrutura/desafio.orm';
import { MembroCirculoOrm } from '../infraestrutura/membro-circulo.orm';
import { ModeracaoPostOrm } from '../infraestrutura/moderacao-post.orm';
import { PacienteBadgeOrm } from '../infraestrutura/paciente-badge.orm';
import { ParticipacaoDesafioOrm } from '../infraestrutura/participacao-desafio.orm';
import { PostComunidadeOrm } from '../infraestrutura/post-comunidade.orm';
import { ServicoGamificacao } from './servico-gamificacao';

const usuarioColaborador: UsuarioAutenticado = {
  usuarioId: 'usuario-colaborador-1',
  tenantId: 'tenant-1',
  papel: 'Collaborator',
  emailHash: 'hash-colaborador',
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
    find: jest.fn(async () => dados.lista ?? []),
    findOne: jest.fn(async () => dados.existente ?? null)
  };
}

function criarServico(dados: Record<string, unknown> = {}) {
  const repositorios = {
    circulo: criarRepositorioFake('circulo', dados),
    membro: criarRepositorioFake('membro', dados),
    post: criarRepositorioFake('post', dados),
    moderacao: criarRepositorioFake('moderacao', dados),
    desafio: criarRepositorioFake('desafio', dados),
    participacao: criarRepositorioFake('participacao', dados),
    badge: criarRepositorioFake('badge', dados),
    pacienteBadge: criarRepositorioFake('paciente-badge', dados),
    paciente: criarRepositorioFake('paciente', dados),
    configuracao: criarRepositorioFake('configuracao', dados),
    profissional: {
      findOne: jest.fn(async () => dados.profissional ?? null)
    }
  };
  repositorios.circulo.findOne.mockImplementation(async () => dados.circulo ?? null);
  repositorios.desafio.findOne.mockImplementation(async () => dados.desafio ?? null);
  repositorios.badge.findOne.mockImplementation(async () => dados.badge ?? null);
  repositorios.participacao.findOne.mockImplementation(async () => dados.existente ?? null);
  repositorios.paciente.findOne.mockImplementation(async (consulta?: { where?: Record<string, unknown> }) => {
    const paciente = dados.paciente as Record<string, unknown> | undefined;
    if (!paciente) return null;
    const profissionalId = consulta?.where?.profissionalResponsavelId;
    return profissionalId && paciente.profissionalResponsavelId !== profissionalId ? null : paciente;
  });
  repositorios.configuracao.findOne.mockImplementation(async () => dados.configuracao ?? null);
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === CirculoPacientesOrm) return repositorios.circulo;
      if (entidade === MembroCirculoOrm) return repositorios.membro;
      if (entidade === PostComunidadeOrm) return repositorios.post;
      if (entidade === ModeracaoPostOrm) return repositorios.moderacao;
      if (entidade === DesafioOrm) return repositorios.desafio;
      if (entidade === ParticipacaoDesafioOrm) return repositorios.participacao;
      if (entidade === BadgeOrm) return repositorios.badge;
      if (entidade === PacienteBadgeOrm) return repositorios.pacienteBadge;
      if (entidade === PacienteOrm) return repositorios.paciente;
      if (entidade === TenantConfiguracaoOrm) return repositorios.configuracao;
      if (entidade === ProfissionalOrm) return repositorios.profissional;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };

  return { servico: new ServicoGamificacao(executorTenant as never), repositorios, executorTenant };
}

describe('ServicoGamificacao', () => {
  const configuracaoCompleta = {
    id: 'configuracao-1',
    tenantId: 'tenant-1',
    chave: 'gamificacao',
    valor: { metasBadgesHabilitados: true, comunidadeHabilitada: true, rankingHabilitado: true },
    criadoEm: new Date('2026-08-01T00:00:00.000Z')
  };

  it('deve considerar todos os recursos desabilitados quando a configuracao nao existe', async () => {
    const { servico } = criarServico();

    await expect(servico.obterConfiguracao('tenant-1')).resolves.toEqual({
      metasBadgesHabilitados: false,
      comunidadeHabilitada: false,
      rankingHabilitado: false
    });
  });

  it('deve atualizar parcialmente a unica configuracao de gamificacao do tenant', async () => {
    const { servico, repositorios } = criarServico({ configuracao: configuracaoCompleta });

    await expect(servico.atualizarConfiguracao('tenant-1', { comunidadeHabilitada: false })).resolves.toEqual({
      metasBadgesHabilitados: true,
      comunidadeHabilitada: false,
      rankingHabilitado: true
    });
    expect(repositorios.configuracao.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'configuracao-1',
        tenantId: 'tenant-1',
        chave: 'gamificacao',
        valor: { metasBadgesHabilitados: true, comunidadeHabilitada: false, rankingHabilitado: true }
      })
    );
  });

  it.each([
    ['criar circulo', (servico: ServicoGamificacao) =>
      servico.criarCirculo('tenant-1', { profissionalId: 'profissional-1', nome: 'Grupo', objetivo: 'Meta' }, usuarioColaborador)],
    ['adicionar membro', (servico: ServicoGamificacao) =>
      servico.entrarCirculo('tenant-1', 'circulo-1', { pacienteId: 'paciente-1' }, usuarioColaborador)],
    ['criar post', (servico: ServicoGamificacao) =>
      servico.criarPost('tenant-1', { circuloId: 'circulo-1', pacienteId: 'paciente-1', conteudo: 'Conteudo' }, usuarioColaborador)]
  ])('deve bloquear comunidade desabilitada ao %s', async (_nome, executar) => {
    const { servico } = criarServico();

    await expect(executar(servico)).rejects.toThrow('Comunidade de gamificacao desabilitada.');
  });

  it.each([
    ['criar meta', (servico: ServicoGamificacao) =>
      servico.criarDesafio('tenant-1', {
        profissionalId: 'profissional-1', titulo: 'Meta', descricao: 'Descricao', regraPontuacao: {},
        iniciaEm: '2026-08-01T00:00:00.000Z', terminaEm: '2026-08-15T00:00:00.000Z'
      }, usuarioColaborador)],
    ['atualizar progresso', (servico: ServicoGamificacao) =>
      servico.atualizarProgresso('tenant-1', {
        desafioId: 'desafio-1', pacienteId: 'paciente-1', pontos: 1, progresso: {}
      }, usuarioColaborador)],
    ['criar badge', (servico: ServicoGamificacao) =>
      servico.criarBadge('tenant-1', { nome: 'Badge', iconeSvg: '<svg />', regraConquista: {} })],
    ['conceder badge', (servico: ServicoGamificacao) =>
      servico.concederBadge('tenant-1', { pacienteId: 'paciente-1', badgeId: 'badge-1' }, usuarioColaborador)]
  ])('deve bloquear metas e badges desabilitados ao %s', async (_nome, executar) => {
    const { servico } = criarServico();

    await expect(executar(servico)).rejects.toThrow('Metas e badges de gamificacao desabilitados.');
  });

  it('deve bloquear ranking independentemente de metas e badges', async () => {
    const { servico } = criarServico({
      configuracao: { ...configuracaoCompleta, valor: { metasBadgesHabilitados: true } }
    });

    await expect(servico.ranking('tenant-1', 'desafio-1', usuarioColaborador)).rejects.toThrow(
      'Ranking de gamificacao desabilitado.'
    );
  });

  it('deve criar post e registro de moderacao no mesmo tenant', async () => {
    const { servico, repositorios, executorTenant } = criarServico({
      configuracao: configuracaoCompleta,
      circulo: { id: 'circulo-1', tenantId: 'tenant-1', profissionalId: 'profissional-1' },
      paciente: { id: 'paciente-1', tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-1' }
    });

    const post = await servico.criarPost('tenant-1', {
      circuloId: 'circulo-1',
      pacienteId: 'paciente-1',
      conteudo: 'Senti vergonha de falhar no desafio.'
    }, usuarioColaborador);

    expect(executorTenant.executar).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    expect(post.status).toBe('pendente_moderacao');
    expect(repositorios.post.save).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1' }));
    expect(repositorios.moderacao.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', postId: post.id, status: 'pendente' })
    );
  });

  it('deve atualizar progresso de desafio reutilizando participacao existente no tenant', async () => {
    const { servico, repositorios } = criarServico({
      configuracao: configuracaoCompleta,
      desafio: { id: 'desafio-1', tenantId: 'tenant-1', profissionalId: 'profissional-1' },
      paciente: { id: 'paciente-1', tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-1' },
      existente: { id: 'participacao-1', pontos: '10' }
    });

    await servico.atualizarProgresso('tenant-1', {
      desafioId: 'desafio-1',
      pacienteId: 'paciente-1',
      pontos: 25,
      progresso: { checkins: 3 }
    }, usuarioColaborador);

    expect(repositorios.participacao.findOne).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', desafioId: 'desafio-1', pacienteId: 'paciente-1' }
    });
    expect(repositorios.participacao.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'participacao-1', tenantId: 'tenant-1', pontos: '25' })
    );
  });

  describe('escopo pacientes_responsaveis para Professional', () => {
    it('deve forcar profissionalId para o proprio profissional ao criar circulo como Professional', async () => {
      const { servico, repositorios } = criarServico({
        configuracao: configuracaoCompleta,
        profissional: { id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' }
      });

      await servico.criarCirculo(
        'tenant-1',
        { profissionalId: 'profissional-outro-2', nome: 'Circulo teste', objetivo: 'Objetivo' },
        usuarioProfissional
      );

      expect(repositorios.circulo.save).toHaveBeenCalledWith(expect.objectContaining({ profissionalId: 'profissional-1' }));
    });

    it('deve manter profissionalId enviado ao criar circulo como Collaborator', async () => {
      const { servico, repositorios } = criarServico();

      repositorios.configuracao.findOne.mockResolvedValue(configuracaoCompleta);
      repositorios.profissional.findOne.mockResolvedValue({ id: 'profissional-escolhido-1', tenantId: 'tenant-1' });

      await servico.criarCirculo(
        'tenant-1',
        { profissionalId: 'profissional-escolhido-1', nome: 'Circulo teste', objetivo: 'Objetivo' },
        usuarioColaborador
      );

      expect(repositorios.circulo.save).toHaveBeenCalledWith(
        expect.objectContaining({ profissionalId: 'profissional-escolhido-1' })
      );
    });

    it('deve listar circulos filtrando apenas pelo profissional autenticado', async () => {
      const { servico, repositorios } = criarServico({
        configuracao: configuracaoCompleta,
        profissional: { id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' }
      });

      await servico.listarCirculos('tenant-1', usuarioProfissional);

      expect(repositorios.circulo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ profissionalId: 'profissional-1' }) })
      );
    });

    it('deve forcar profissionalId para o proprio profissional ao criar desafio como Professional', async () => {
      const { servico, repositorios } = criarServico({
        configuracao: configuracaoCompleta,
        profissional: { id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' }
      });

      await servico.criarDesafio(
        'tenant-1',
        {
          profissionalId: 'profissional-outro-2',
          titulo: 'Desafio teste',
          descricao: 'Descricao',
          regraPontuacao: {},
          iniciaEm: '2026-08-01T00:00:00.000Z',
          terminaEm: '2026-08-15T00:00:00.000Z'
        },
        usuarioProfissional
      );

      expect(repositorios.desafio.save).toHaveBeenCalledWith(expect.objectContaining({ profissionalId: 'profissional-1' }));
    });

    it('deve listar desafios filtrando apenas pelo profissional autenticado', async () => {
      const { servico, repositorios } = criarServico({
        configuracao: configuracaoCompleta,
        profissional: { id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' }
      });

      await servico.listarDesafios('tenant-1', usuarioProfissional);

      expect(repositorios.desafio.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ profissionalId: 'profissional-1' }) })
      );
    });

    it('deve rejeitar progresso de paciente fora do profissional autenticado', async () => {
      const { servico, repositorios } = criarServico({
        configuracao: configuracaoCompleta,
        profissional: { id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' },
        desafio: { id: 'desafio-1', tenantId: 'tenant-1', profissionalId: 'profissional-1' },
        paciente: { id: 'paciente-2', tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-2' }
      });

      await expect(servico.atualizarProgresso('tenant-1', {
        desafioId: 'desafio-1', pacienteId: 'paciente-2', pontos: 5, progresso: {}
      }, usuarioProfissional)).rejects.toThrow('Paciente nao encontrado no escopo da gamificacao.');
      expect(repositorios.participacao.save).not.toHaveBeenCalled();
    });
  });
});

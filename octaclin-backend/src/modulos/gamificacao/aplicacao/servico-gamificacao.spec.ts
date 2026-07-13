import { BadgeOrm } from '../infraestrutura/badge.orm';
import { CirculoPacientesOrm } from '../infraestrutura/circulo-pacientes.orm';
import { DesafioOrm } from '../infraestrutura/desafio.orm';
import { MembroCirculoOrm } from '../infraestrutura/membro-circulo.orm';
import { ModeracaoPostOrm } from '../infraestrutura/moderacao-post.orm';
import { PacienteBadgeOrm } from '../infraestrutura/paciente-badge.orm';
import { ParticipacaoDesafioOrm } from '../infraestrutura/participacao-desafio.orm';
import { PostComunidadeOrm } from '../infraestrutura/post-comunidade.orm';
import { ServicoGamificacao } from './servico-gamificacao';

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
    pacienteBadge: criarRepositorioFake('paciente-badge', dados)
  };
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
  it('deve criar post e registro de moderacao no mesmo tenant', async () => {
    const { servico, repositorios, executorTenant } = criarServico();

    const post = await servico.criarPost('tenant-1', {
      circuloId: 'circulo-1',
      pacienteId: 'paciente-1',
      conteudo: 'Senti vergonha de falhar no desafio.'
    });

    expect(executorTenant.executar).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    expect(post.status).toBe('pendente_moderacao');
    expect(repositorios.post.save).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1' }));
    expect(repositorios.moderacao.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', postId: post.id, status: 'pendente' })
    );
  });

  it('deve atualizar progresso de desafio reutilizando participacao existente no tenant', async () => {
    const { servico, repositorios } = criarServico({ existente: { id: 'participacao-1', pontos: '10' } });

    await servico.atualizarProgresso('tenant-1', {
      desafioId: 'desafio-1',
      pacienteId: 'paciente-1',
      pontos: 25,
      progresso: { checkins: 3 }
    });

    expect(repositorios.participacao.findOne).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', desafioId: 'desafio-1', pacienteId: 'paciente-1' }
    });
    expect(repositorios.participacao.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'participacao-1', tenantId: 'tenant-1', pontos: '25' })
    );
  });
});

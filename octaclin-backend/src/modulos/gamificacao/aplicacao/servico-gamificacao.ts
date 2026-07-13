import { Injectable } from '@nestjs/common';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { moderarConteudo } from '../dominio/moderacao';
import { BadgeOrm } from '../infraestrutura/badge.orm';
import { CirculoPacientesOrm } from '../infraestrutura/circulo-pacientes.orm';
import { DesafioOrm } from '../infraestrutura/desafio.orm';
import { MembroCirculoOrm } from '../infraestrutura/membro-circulo.orm';
import { ModeracaoPostOrm } from '../infraestrutura/moderacao-post.orm';
import { PacienteBadgeOrm } from '../infraestrutura/paciente-badge.orm';
import { ParticipacaoDesafioOrm } from '../infraestrutura/participacao-desafio.orm';
import { PostComunidadeOrm } from '../infraestrutura/post-comunidade.orm';
import {
  AtualizarProgressoDesafioDto,
  ConcederBadgeDto,
  CriarBadgeDto,
  CriarCirculoDto,
  CriarDesafioDto,
  CriarPostDto,
  EntrarCirculoDto
} from './dtos';

@Injectable()
export class ServicoGamificacao {
  constructor(private readonly executorTenant: ExecutorTenant) {}

  async listarCirculos(tenantId: string): Promise<CirculoPacientesOrm[]> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(CirculoPacientesOrm).find({
        where: { tenantId },
        order: { criadoEm: 'DESC' },
        take: 100
      })
    );
  }

  async criarCirculo(tenantId: string, dados: CriarCirculoDto): Promise<CirculoPacientesOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(CirculoPacientesOrm).save(
        gerenciador.getRepository(CirculoPacientesOrm).create({
          tenantId,
          profissionalId: dados.profissionalId,
          nome: dados.nome,
          objetivo: dados.objetivo,
          privado: dados.privado ?? true
        })
      )
    );
  }

  async entrarCirculo(tenantId: string, circuloId: string, dados: EntrarCirculoDto): Promise<MembroCirculoOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(MembroCirculoOrm).save(
        gerenciador.getRepository(MembroCirculoOrm).create({ tenantId, circuloId, pacienteId: dados.pacienteId })
      )
    );
  }

  async criarPost(tenantId: string, dados: CriarPostDto): Promise<PostComunidadeOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const moderacao = moderarConteudo(dados.conteudo);
      const statusPost = moderacao.status === 'aprovado' ? 'publicado' : 'pendente_moderacao';
      const post = await gerenciador.getRepository(PostComunidadeOrm).save(
        gerenciador.getRepository(PostComunidadeOrm).create({
          tenantId,
          circuloId: dados.circuloId,
          pacienteId: dados.pacienteId,
          conteudo: dados.conteudo,
          status: statusPost
        })
      );

      await gerenciador.getRepository(ModeracaoPostOrm).save(
        gerenciador.getRepository(ModeracaoPostOrm).create({
          tenantId,
          postId: post.id,
          status: moderacao.status,
          pontuacaoRisco: String(moderacao.pontuacaoRisco),
          motivos: moderacao.motivos
        })
      );

      return post;
    });
  }

  async listarDesafios(tenantId: string): Promise<DesafioOrm[]> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(DesafioOrm).find({
        where: { tenantId },
        order: { criadoEm: 'DESC' },
        take: 100
      })
    );
  }

  async criarDesafio(tenantId: string, dados: CriarDesafioDto): Promise<DesafioOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(DesafioOrm).save(
        gerenciador.getRepository(DesafioOrm).create({
          tenantId,
          profissionalId: dados.profissionalId,
          titulo: dados.titulo,
          descricao: dados.descricao,
          regraPontuacao: dados.regraPontuacao,
          iniciaEm: new Date(dados.iniciaEm),
          terminaEm: new Date(dados.terminaEm)
        })
      )
    );
  }

  async atualizarProgresso(tenantId: string, dados: AtualizarProgressoDesafioDto): Promise<ParticipacaoDesafioOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ParticipacaoDesafioOrm);
      const existente = await repositorio.findOne({
        where: { tenantId, desafioId: dados.desafioId, pacienteId: dados.pacienteId }
      });

      return repositorio.save(
        repositorio.create({
          ...(existente ?? {}),
          tenantId,
          desafioId: dados.desafioId,
          pacienteId: dados.pacienteId,
          pontos: String(dados.pontos),
          progresso: dados.progresso
        })
      );
    });
  }

  async ranking(tenantId: string, desafioId: string): Promise<ParticipacaoDesafioOrm[]> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(ParticipacaoDesafioOrm).find({
        where: { tenantId, desafioId },
        order: { pontos: 'DESC' },
        take: 100
      })
    );
  }

  async listarBadges(tenantId: string): Promise<BadgeOrm[]> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(BadgeOrm).find({
        where: { tenantId },
        order: { nome: 'ASC' },
        take: 100
      })
    );
  }

  async criarBadge(tenantId: string, dados: CriarBadgeDto): Promise<BadgeOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(BadgeOrm).save(
        gerenciador.getRepository(BadgeOrm).create({
          tenantId,
          nome: dados.nome,
          descricao: dados.descricao,
          iconeSvg: dados.iconeSvg,
          regraConquista: dados.regraConquista
        })
      )
    );
  }

  async concederBadge(tenantId: string, dados: ConcederBadgeDto): Promise<PacienteBadgeOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(PacienteBadgeOrm).save(
        gerenciador.getRepository(PacienteBadgeOrm).create({
          tenantId,
          pacienteId: dados.pacienteId,
          badgeId: dados.badgeId
        })
      )
    );
  }
}

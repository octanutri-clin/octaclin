import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
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
  AtualizarConfiguracaoGamificacaoDto,
  AtualizarProgressoDesafioDto,
  ConcederBadgeDto,
  CriarBadgeDto,
  CriarCirculoDto,
  CriarDesafioDto,
  CriarPostDto,
  EntrarCirculoDto
} from './dtos';

const CHAVE_CONFIGURACAO = 'gamificacao';

export interface ConfiguracaoGamificacao {
  metasBadgesHabilitados: boolean;
  comunidadeHabilitada: boolean;
  rankingHabilitado: boolean;
}

@Injectable()
export class ServicoGamificacao {
  constructor(private readonly executorTenant: ExecutorTenant) {}

  async obterConfiguracao(tenantId: string): Promise<ConfiguracaoGamificacao> {
    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      this.obterConfiguracaoNoGerenciador(gerenciador, tenantId)
    );
  }

  async atualizarConfiguracao(
    tenantId: string,
    dados: AtualizarConfiguracaoGamificacaoDto
  ): Promise<ConfiguracaoGamificacao> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(TenantConfiguracaoOrm);
      const atual = await repositorio.findOne({ where: { tenantId, chave: CHAVE_CONFIGURACAO } });
      const configuracao = {
        metasBadgesHabilitados: atual?.valor.metasBadgesHabilitados === true,
        comunidadeHabilitada: atual?.valor.comunidadeHabilitada === true,
        rankingHabilitado: atual?.valor.rankingHabilitado === true,
        ...dados
      };
      await repositorio.save(
        repositorio.create({
          id: atual?.id,
          tenantId,
          chave: CHAVE_CONFIGURACAO,
          valor: configuracao,
          criadoEm: atual?.criadoEm
        })
      );
      return configuracao;
    });
  }

  async listarCirculos(tenantId: string, usuario: UsuarioAutenticado): Promise<CirculoPacientesOrm[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.exigirRecurso(gerenciador, tenantId, 'comunidade');
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      return gerenciador.getRepository(CirculoPacientesOrm).find({
        where: { tenantId, ...(profissionalId ? { profissionalId } : {}) },
        order: { criadoEm: 'DESC' },
        take: 100
      });
    });
  }

  async criarCirculo(tenantId: string, dados: CriarCirculoDto, usuario: UsuarioAutenticado): Promise<CirculoPacientesOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.exigirRecurso(gerenciador, tenantId, 'comunidade');
      const profissionalId = await this.validarProfissional(gerenciador, tenantId, dados.profissionalId, usuario);
      return gerenciador.getRepository(CirculoPacientesOrm).save(
        gerenciador.getRepository(CirculoPacientesOrm).create({
          tenantId,
          profissionalId,
          nome: dados.nome,
          objetivo: dados.objetivo,
          privado: dados.privado ?? true
        })
      );
    });
  }

  async entrarCirculo(
    tenantId: string,
    circuloId: string,
    dados: EntrarCirculoDto,
    usuario: UsuarioAutenticado
  ): Promise<MembroCirculoOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.exigirRecurso(gerenciador, tenantId, 'comunidade');
      const circulo = await this.obterCirculoNoEscopo(gerenciador, tenantId, circuloId, usuario);
      await this.validarPaciente(gerenciador, tenantId, dados.pacienteId, circulo.profissionalId);
      return gerenciador.getRepository(MembroCirculoOrm).save(
        gerenciador.getRepository(MembroCirculoOrm).create({ tenantId, circuloId, pacienteId: dados.pacienteId })
      );
    });
  }

  async criarPost(tenantId: string, dados: CriarPostDto, usuario: UsuarioAutenticado): Promise<PostComunidadeOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.exigirRecurso(gerenciador, tenantId, 'comunidade');
      const circulo = await this.obterCirculoNoEscopo(gerenciador, tenantId, dados.circuloId, usuario);
      await this.validarPaciente(gerenciador, tenantId, dados.pacienteId, circulo.profissionalId);
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

  async listarDesafios(tenantId: string, usuario: UsuarioAutenticado): Promise<DesafioOrm[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.exigirRecurso(gerenciador, tenantId, 'metasBadges');
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      return gerenciador.getRepository(DesafioOrm).find({
        where: { tenantId, ...(profissionalId ? { profissionalId } : {}) },
        order: { criadoEm: 'DESC' },
        take: 100
      });
    });
  }

  async criarDesafio(tenantId: string, dados: CriarDesafioDto, usuario: UsuarioAutenticado): Promise<DesafioOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.exigirRecurso(gerenciador, tenantId, 'metasBadges');
      const profissionalId = await this.validarProfissional(gerenciador, tenantId, dados.profissionalId, usuario);
      return gerenciador.getRepository(DesafioOrm).save(
        gerenciador.getRepository(DesafioOrm).create({
          tenantId,
          profissionalId,
          titulo: dados.titulo,
          descricao: dados.descricao,
          regraPontuacao: dados.regraPontuacao,
          iniciaEm: new Date(dados.iniciaEm),
          terminaEm: new Date(dados.terminaEm)
        })
      );
    });
  }

  async atualizarProgresso(
    tenantId: string,
    dados: AtualizarProgressoDesafioDto,
    usuario: UsuarioAutenticado
  ): Promise<ParticipacaoDesafioOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.exigirRecurso(gerenciador, tenantId, 'metasBadges');
      const desafio = await this.obterDesafioNoEscopo(gerenciador, tenantId, dados.desafioId, usuario);
      await this.validarPaciente(gerenciador, tenantId, dados.pacienteId, desafio.profissionalId);
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

  async ranking(tenantId: string, desafioId: string, usuario: UsuarioAutenticado): Promise<ParticipacaoDesafioOrm[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.exigirRecurso(gerenciador, tenantId, 'ranking');
      await this.obterDesafioNoEscopo(gerenciador, tenantId, desafioId, usuario);
      return gerenciador.getRepository(ParticipacaoDesafioOrm).find({
        where: { tenantId, desafioId },
        order: { pontos: 'DESC' },
        take: 100
      });
    });
  }

  async listarBadges(tenantId: string): Promise<BadgeOrm[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.exigirRecurso(gerenciador, tenantId, 'metasBadges');
      return gerenciador.getRepository(BadgeOrm).find({
        where: { tenantId },
        order: { nome: 'ASC' },
        take: 100
      });
    });
  }

  async criarBadge(tenantId: string, dados: CriarBadgeDto): Promise<BadgeOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.exigirRecurso(gerenciador, tenantId, 'metasBadges');
      return gerenciador.getRepository(BadgeOrm).save(
        gerenciador.getRepository(BadgeOrm).create({
          tenantId,
          nome: dados.nome,
          descricao: dados.descricao,
          iconeSvg: dados.iconeSvg,
          regraConquista: dados.regraConquista
        })
      );
    });
  }

  async concederBadge(
    tenantId: string,
    dados: ConcederBadgeDto,
    usuario: UsuarioAutenticado
  ): Promise<PacienteBadgeOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.exigirRecurso(gerenciador, tenantId, 'metasBadges');
      const badge = await gerenciador.getRepository(BadgeOrm).findOne({ where: { id: dados.badgeId, tenantId } });
      if (!badge) throw new NotFoundException('Badge nao encontrado no escopo da gamificacao.');
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      await this.validarPaciente(gerenciador, tenantId, dados.pacienteId, profissionalId);
      return gerenciador.getRepository(PacienteBadgeOrm).save(
        gerenciador.getRepository(PacienteBadgeOrm).create({
          tenantId,
          pacienteId: dados.pacienteId,
          badgeId: dados.badgeId
        })
      );
    });
  }

  private async obterConfiguracaoNoGerenciador(
    gerenciador: EntityManager,
    tenantId: string
  ): Promise<ConfiguracaoGamificacao> {
    const registro = await gerenciador.getRepository(TenantConfiguracaoOrm).findOne({
      where: { tenantId, chave: CHAVE_CONFIGURACAO }
    });
    return {
      metasBadgesHabilitados: registro?.valor.metasBadgesHabilitados === true,
      comunidadeHabilitada: registro?.valor.comunidadeHabilitada === true,
      rankingHabilitado: registro?.valor.rankingHabilitado === true
    };
  }

  private async exigirRecurso(
    gerenciador: EntityManager,
    tenantId: string,
    recurso: 'metasBadges' | 'comunidade' | 'ranking'
  ): Promise<void> {
    const configuracao = await this.obterConfiguracaoNoGerenciador(gerenciador, tenantId);
    if (recurso === 'metasBadges' && !configuracao.metasBadgesHabilitados) {
      throw new ForbiddenException('Metas e badges de gamificacao desabilitados.');
    }
    if (recurso === 'comunidade' && !configuracao.comunidadeHabilitada) {
      throw new ForbiddenException('Comunidade de gamificacao desabilitada.');
    }
    if (recurso === 'ranking' && !configuracao.rankingHabilitado) {
      throw new ForbiddenException('Ranking de gamificacao desabilitado.');
    }
  }

  private async validarProfissional(
    gerenciador: EntityManager,
    tenantId: string,
    profissionalIdSolicitado: string,
    usuario: UsuarioAutenticado
  ): Promise<string> {
    const profissionalIdDoUsuario = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const profissionalId = profissionalIdDoUsuario ?? profissionalIdSolicitado;
    const profissional = await gerenciador.getRepository(ProfissionalOrm).findOne({
      where: { id: profissionalId, tenantId, arquivadoEm: IsNull() }
    });
    if (!profissional) throw new NotFoundException('Profissional nao encontrado no escopo da gamificacao.');
    return profissional.id;
  }

  private async validarPaciente(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    profissionalId?: string
  ): Promise<PacienteOrm> {
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
      where: { id: pacienteId, tenantId, arquivadoEm: IsNull(), ...(profissionalId ? { profissionalResponsavelId: profissionalId } : {}) }
    });
    if (!paciente) throw new NotFoundException('Paciente nao encontrado no escopo da gamificacao.');
    return paciente;
  }

  private async obterCirculoNoEscopo(
    gerenciador: EntityManager,
    tenantId: string,
    circuloId: string,
    usuario: UsuarioAutenticado
  ): Promise<CirculoPacientesOrm> {
    const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const circulo = await gerenciador.getRepository(CirculoPacientesOrm).findOne({
      where: { id: circuloId, tenantId, ...(profissionalId ? { profissionalId } : {}) }
    });
    if (!circulo) throw new NotFoundException('Circulo nao encontrado no escopo da gamificacao.');
    return circulo;
  }

  private async obterDesafioNoEscopo(
    gerenciador: EntityManager,
    tenantId: string,
    desafioId: string,
    usuario: UsuarioAutenticado
  ): Promise<DesafioOrm> {
    const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const desafio = await gerenciador.getRepository(DesafioOrm).findOne({
      where: { id: desafioId, tenantId, ...(profissionalId ? { profissionalId } : {}) }
    });
    if (!desafio) throw new NotFoundException('Meta nao encontrada no escopo da gamificacao.');
    return desafio;
  }
}

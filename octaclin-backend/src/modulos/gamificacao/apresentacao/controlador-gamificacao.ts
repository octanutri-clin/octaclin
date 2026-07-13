import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import {
  AtualizarProgressoDesafioDto,
  ConcederBadgeDto,
  CriarBadgeDto,
  CriarCirculoDto,
  CriarDesafioDto,
  CriarPostDto,
  EntrarCirculoDto
} from '../aplicacao/dtos';
import { ServicoGamificacao } from '../aplicacao/servico-gamificacao';

@Controller('gamificacao')
@UseGuards(GuardaJwt, GuardaPapeis)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
export class ControladorGamificacao {
  constructor(
    private readonly servicoGamificacao: ServicoGamificacao,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Get('circulos')
  listarCirculos(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoGamificacao.listarCirculos(usuario.tenantId);
  }

  @Post('circulos')
  async criarCirculo(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarCirculoDto
  ) {
    const circulo = await this.servicoGamificacao.criarCirculo(usuario.tenantId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'gamificacao.circulo.criar', 'circulo_pacientes', circulo.id, {
      profissionalId: dados.profissionalId,
      privado: dados.privado ?? true
    });
    return circulo;
  }

  @Post('circulos/:id/membros')
  async entrarCirculo(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: EntrarCirculoDto
  ) {
    const membro = await this.servicoGamificacao.entrarCirculo(usuario.tenantId, id, dados);
    await this.registrarAuditoria(usuario, requisicao, 'gamificacao.circulo.membro_entrar', 'membro_circulo', membro.id, {
      circuloId: id,
      pacienteId: dados.pacienteId
    });
    return membro;
  }

  @Post('posts')
  async criarPost(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarPostDto
  ) {
    const post = await this.servicoGamificacao.criarPost(usuario.tenantId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'gamificacao.post.criar', 'post_comunidade', post.id, {
      circuloId: dados.circuloId,
      pacienteId: dados.pacienteId,
      status: post.status
    });
    return post;
  }

  @Get('desafios')
  listarDesafios(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoGamificacao.listarDesafios(usuario.tenantId);
  }

  @Post('desafios')
  async criarDesafio(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarDesafioDto
  ) {
    const desafio = await this.servicoGamificacao.criarDesafio(usuario.tenantId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'gamificacao.desafio.criar', 'desafio', desafio.id, {
      profissionalId: dados.profissionalId,
      iniciaEm: dados.iniciaEm,
      terminaEm: dados.terminaEm
    });
    return desafio;
  }

  @Post('desafios/progresso')
  async atualizarProgresso(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: AtualizarProgressoDesafioDto
  ) {
    const progresso = await this.servicoGamificacao.atualizarProgresso(usuario.tenantId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'gamificacao.desafio.progresso_atualizar', 'participacao_desafio', progresso.id, {
      desafioId: dados.desafioId,
      pacienteId: dados.pacienteId,
      pontos: dados.pontos
    });
    return progresso;
  }

  @Get('desafios/:id/ranking')
  ranking(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.servicoGamificacao.ranking(usuario.tenantId, id);
  }

  @Get('badges')
  listarBadges(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoGamificacao.listarBadges(usuario.tenantId);
  }

  @Post('badges')
  async criarBadge(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarBadgeDto
  ) {
    const badge = await this.servicoGamificacao.criarBadge(usuario.tenantId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'gamificacao.badge.criar', 'badge', badge.id, {
      iconeSvg: dados.iconeSvg
    });
    return badge;
  }

  @Post('badges/concessoes')
  async concederBadge(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: ConcederBadgeDto
  ) {
    const concessao = await this.servicoGamificacao.concederBadge(usuario.tenantId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'gamificacao.badge.conceder', 'paciente_badge', concessao.id, {
      pacienteId: dados.pacienteId,
      badgeId: dados.badgeId
    });
    return concessao;
  }

  private registrarAuditoria(
    usuario: UsuarioAutenticado,
    requisicao: Request,
    acao: string,
    recursoTipo: string,
    recursoId?: string,
    metadados?: Record<string, unknown>
  ) {
    return this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao,
      recursoTipo,
      recursoId,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados
    });
  }

  private obterUserAgent(requisicao: Request): string | undefined {
    const userAgent = requisicao.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
  }
}

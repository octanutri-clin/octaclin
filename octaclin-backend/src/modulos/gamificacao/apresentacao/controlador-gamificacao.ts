import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import {
  AtualizarConfiguracaoGamificacaoDto,
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
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
@Permissoes('gamificacao.gerenciar')
export class ControladorGamificacao {
  constructor(
    private readonly servicoGamificacao: ServicoGamificacao,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Get('configuracao')
  async obterConfiguracao(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request) {
    const configuracao = await this.servicoGamificacao.obterConfiguracao(usuario.tenantId);
    await this.registrarAuditoria(
      usuario,
      requisicao,
      'gamificacao.configuracao.ler',
      'tenant_configuracao',
      usuario.tenantId
    );
    return configuracao;
  }

  @Patch('configuracao')
  async atualizarConfiguracao(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: AtualizarConfiguracaoGamificacaoDto
  ) {
    const configuracao = await this.servicoGamificacao.atualizarConfiguracao(usuario.tenantId, dados);
    await this.registrarAuditoria(
      usuario,
      requisicao,
      'gamificacao.configuracao.atualizar',
      'tenant_configuracao',
      usuario.tenantId,
      { ...dados }
    );
    return configuracao;
  }

  @Get('circulos')
  listarCirculos(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoGamificacao.listarCirculos(usuario.tenantId, usuario);
  }

  @Post('circulos')
  async criarCirculo(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarCirculoDto
  ) {
    const circulo = await this.servicoGamificacao.criarCirculo(usuario.tenantId, dados, usuario);
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
    const membro = await this.servicoGamificacao.entrarCirculo(usuario.tenantId, id, dados, usuario);
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
    const post = await this.servicoGamificacao.criarPost(usuario.tenantId, dados, usuario);
    await this.registrarAuditoria(usuario, requisicao, 'gamificacao.post.criar', 'post_comunidade', post.id, {
      circuloId: dados.circuloId,
      pacienteId: dados.pacienteId,
      status: post.status
    });
    return post;
  }

  @Get('desafios')
  listarDesafios(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoGamificacao.listarDesafios(usuario.tenantId, usuario);
  }

  @Post('desafios')
  async criarDesafio(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarDesafioDto
  ) {
    const desafio = await this.servicoGamificacao.criarDesafio(usuario.tenantId, dados, usuario);
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
    const progresso = await this.servicoGamificacao.atualizarProgresso(usuario.tenantId, dados, usuario);
    await this.registrarAuditoria(usuario, requisicao, 'gamificacao.desafio.progresso_atualizar', 'participacao_desafio', progresso.id, {
      desafioId: dados.desafioId,
      pacienteId: dados.pacienteId,
      pontos: dados.pontos
    });
    return progresso;
  }

  @Get('desafios/:id/ranking')
  ranking(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.servicoGamificacao.ranking(usuario.tenantId, id, usuario);
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
    const concessao = await this.servicoGamificacao.concederBadge(usuario.tenantId, dados, usuario);
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

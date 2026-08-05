import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import {
  AtualizarConfiguracoesClienteDto,
  AtualizarModelosDocumentoClienteDto,
  AtualizarPapelUsuarioClienteDto,
  AtualizarPerfilEmpresaClienteDto,
  CriarUsuarioClienteDto,
  SolicitarAjusteAssinaturaClienteDto
} from '../aplicacao/dtos';
import { ServicoPortalCliente } from '../aplicacao/servico-portal-cliente';
import { ServicoUsuariosCliente } from '../aplicacao/servico-usuarios-cliente';

@Controller('cliente')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Client')
@Permissoes('cliente.acessar')
export class ControladorPortalCliente {
  constructor(
    private readonly servicoPortalCliente: ServicoPortalCliente,
    private readonly servicoUsuariosCliente: ServicoUsuariosCliente,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Get('resumo')
  obterResumo(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoPortalCliente.obterResumo(usuario.tenantId, usuario.usuarioId);
  }

  @Post('assinatura/interesse')
  @Permissoes('cliente.assinatura.ler')
  async solicitarAjusteAssinatura(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: SolicitarAjusteAssinaturaClienteDto
  ) {
    const solicitacao = await this.servicoPortalCliente.solicitarAjusteAssinatura(usuario.tenantId, usuario.usuarioId, dados);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'cliente.assinatura.solicitar_ajuste',
      recursoTipo: 'tenant',
      recursoId: usuario.tenantId,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        acao: solicitacao.acao,
        planoAtualId: solicitacao.planoAtualId,
        planoDesejado: solicitacao.planoDesejado,
        status: solicitacao.status
      }
    });
    return solicitacao;
  }

  @Get('configuracoes')
  @Permissoes('cliente.configuracoes.gerenciar')
  obterConfiguracoes(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoPortalCliente.obterConfiguracoes(usuario.tenantId);
  }

  @Patch('configuracoes')
  @Permissoes('cliente.configuracoes.gerenciar')
  atualizarConfiguracoes(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: AtualizarConfiguracoesClienteDto) {
    return this.servicoPortalCliente.atualizarConfiguracoes(usuario.tenantId, dados);
  }

  @Get('modelos-documento')
  @Permissoes('cliente.configuracoes.gerenciar')
  obterModelosDocumento(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoPortalCliente.obterModelosDocumento(usuario.tenantId);
  }

  @Patch('modelos-documento')
  @Permissoes('cliente.configuracoes.gerenciar')
  async atualizarModelosDocumento(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: AtualizarModelosDocumentoClienteDto
  ) {
    const modelos = await this.servicoPortalCliente.atualizarModelosDocumento(usuario.tenantId, dados);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'cliente.modelos_documento.atualizar',
      recursoTipo: 'tenant',
      recursoId: usuario.tenantId,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { tipos: Object.keys(dados) }
    });
    return modelos;
  }

  @Get('perfil-empresa')
  @Permissoes('cliente.configuracoes.gerenciar')
  obterPerfilEmpresa(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoPortalCliente.obterPerfilEmpresa(usuario.tenantId);
  }

  @Patch('perfil-empresa')
  @Permissoes('cliente.configuracoes.gerenciar')
  async atualizarPerfilEmpresa(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: AtualizarPerfilEmpresaClienteDto
  ) {
    const perfil = await this.servicoPortalCliente.atualizarPerfilEmpresa(usuario.tenantId, dados);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'cliente.perfil_empresa.atualizar',
      recursoTipo: 'tenant',
      recursoId: usuario.tenantId,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        tipoPessoa: dados.tipoPessoa,
        campos: Object.keys(dados).filter((campo) => dados[campo as keyof AtualizarPerfilEmpresaClienteDto] !== undefined)
      }
    });
    return perfil;
  }

  @Get('usuarios')
  @Permissoes('cliente.usuarios.ler')
  listarUsuarios(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoUsuariosCliente.listar(usuario.tenantId);
  }

  @Get('usuarios/convites')
  @Permissoes('cliente.convites.gerenciar')
  listarConvites(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoUsuariosCliente.listarConvites(usuario.tenantId);
  }

  @Get('usuarios/convites/historico')
  @Permissoes('cliente.convites.gerenciar')
  listarHistoricoConvites(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoUsuariosCliente.listarHistoricoConvites(usuario.tenantId);
  }

  @Get('usuarios/convites/historico/exportar.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="historico-convites-octaclin.csv"')
  @Permissoes('cliente.convites.gerenciar')
  exportarHistoricoConvites(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoUsuariosCliente.exportarHistoricoConvitesCsv(usuario.tenantId);
  }

  @Post('usuarios')
  @Permissoes('cliente.usuarios.convidar')
  async criarUsuario(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Body() dados: CriarUsuarioClienteDto) {
    const criado = await this.servicoUsuariosCliente.criar(usuario.tenantId, usuario.usuarioId, dados);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'cliente.convite.criar',
      recursoTipo: 'usuario',
      recursoId: criado.id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        role: criado.role,
        email: criado.email
      }
    });
    return criado;
  }

  @Delete('usuarios/:id')
  @Permissoes('cliente.usuarios.desativar')
  desativarUsuario(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.servicoUsuariosCliente.desativar(usuario.tenantId, usuario.usuarioId, id);
  }

  @Patch('usuarios/:id')
  @Permissoes('cliente.usuarios.gerenciar')
  async atualizarPapelUsuario(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: AtualizarPapelUsuarioClienteDto
  ) {
    const atualizado = await this.servicoUsuariosCliente.atualizarPapel(usuario.tenantId, usuario.usuarioId, id, dados);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'cliente.usuario.alterar_papel',
      recursoTipo: 'usuario',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { role: atualizado.role }
    });
    return atualizado;
  }

  @Post('usuarios/:id/convite/reenvio')
  @Permissoes('cliente.convites.gerenciar')
  async reenviarConvite(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) id: string) {
    const reenviado = await this.servicoUsuariosCliente.reenviarConvite(usuario.tenantId, usuario.usuarioId, id);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'cliente.convite.reenviar',
      recursoTipo: 'usuario',
      recursoId: reenviado.id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        role: reenviado.role,
        email: reenviado.email
      }
    });
    return reenviado;
  }

  @Delete('usuarios/:id/convite')
  @Permissoes('cliente.convites.gerenciar')
  async revogarConvite(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) id: string) {
    await this.servicoUsuariosCliente.revogarConvite(usuario.tenantId, usuario.usuarioId, id);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'cliente.convite.revogar',
      recursoTipo: 'usuario',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        usuarioAlvoId: id
      }
    });
  }

  private obterUserAgent(requisicao: Request): string | undefined {
    const userAgent = requisicao.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
  }
}

import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AtualizarConfiguracoesClienteDto, AtualizarPerfilEmpresaClienteDto, CriarUsuarioClienteDto } from '../aplicacao/dtos';
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

  @Post('usuarios')
  @Permissoes('cliente.usuarios.convidar')
  criarUsuario(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: CriarUsuarioClienteDto) {
    return this.servicoUsuariosCliente.criar(usuario.tenantId, usuario.usuarioId, dados);
  }

  @Delete('usuarios/:id')
  @Permissoes('cliente.usuarios.desativar')
  desativarUsuario(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.servicoUsuariosCliente.desativar(usuario.tenantId, usuario.usuarioId, id);
  }

  @Post('usuarios/:id/convite/reenvio')
  @Permissoes('cliente.convites.gerenciar')
  reenviarConvite(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.servicoUsuariosCliente.reenviarConvite(usuario.tenantId, usuario.usuarioId, id);
  }

  @Delete('usuarios/:id/convite')
  @Permissoes('cliente.convites.gerenciar')
  revogarConvite(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.servicoUsuariosCliente.revogarConvite(usuario.tenantId, usuario.usuarioId, id);
  }

  private obterUserAgent(requisicao: Request): string | undefined {
    const userAgent = requisicao.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
  }
}

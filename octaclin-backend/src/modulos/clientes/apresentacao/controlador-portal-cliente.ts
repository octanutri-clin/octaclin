import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AtualizarConfiguracoesClienteDto, CriarUsuarioClienteDto } from '../aplicacao/dtos';
import { ServicoPortalCliente } from '../aplicacao/servico-portal-cliente';
import { ServicoUsuariosCliente } from '../aplicacao/servico-usuarios-cliente';

@Controller('cliente')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Client')
@Permissoes('cliente.acessar')
export class ControladorPortalCliente {
  constructor(
    private readonly servicoPortalCliente: ServicoPortalCliente,
    private readonly servicoUsuariosCliente: ServicoUsuariosCliente
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
}

import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Papeis, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { CriarUsuarioClienteDto } from '../aplicacao/dtos';
import { ServicoPortalCliente } from '../aplicacao/servico-portal-cliente';
import { ServicoUsuariosCliente } from '../aplicacao/servico-usuarios-cliente';

@Controller('cliente')
@UseGuards(GuardaJwt, GuardaPapeis)
@Papeis('Client')
export class ControladorPortalCliente {
  constructor(
    private readonly servicoPortalCliente: ServicoPortalCliente,
    private readonly servicoUsuariosCliente: ServicoUsuariosCliente
  ) {}

  @Get('resumo')
  obterResumo(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoPortalCliente.obterResumo(usuario.tenantId, usuario.usuarioId);
  }

  @Get('usuarios')
  listarUsuarios(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoUsuariosCliente.listar(usuario.tenantId);
  }

  @Post('usuarios')
  criarUsuario(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: CriarUsuarioClienteDto) {
    return this.servicoUsuariosCliente.criar(usuario.tenantId, usuario.usuarioId, dados);
  }

  @Delete('usuarios/:id')
  desativarUsuario(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.servicoUsuariosCliente.desativar(usuario.tenantId, usuario.usuarioId, id);
  }
}

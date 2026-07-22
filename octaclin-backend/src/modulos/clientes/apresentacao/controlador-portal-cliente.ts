import { Controller, Get, UseGuards } from '@nestjs/common';
import { Papeis, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoPortalCliente } from '../aplicacao/servico-portal-cliente';

@Controller('cliente')
@UseGuards(GuardaJwt, GuardaPapeis)
@Papeis('Client')
export class ControladorPortalCliente {
  constructor(private readonly servicoPortalCliente: ServicoPortalCliente) {}

  @Get('resumo')
  obterResumo(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoPortalCliente.obterResumo(usuario.tenantId, usuario.usuarioId);
  }
}

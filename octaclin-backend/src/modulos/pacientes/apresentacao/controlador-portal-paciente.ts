import { Controller, Get, UseGuards } from '@nestjs/common';
import { Papeis, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoPortalPaciente } from '../aplicacao/servico-portal-paciente';

@Controller('portal')
@UseGuards(GuardaJwt, GuardaPapeis)
@Papeis('Patient')
export class ControladorPortalPaciente {
  constructor(private readonly servicoPortal: ServicoPortalPaciente) {}

  @Get('paciente')
  obterResumo(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoPortal.obterResumoPortal(usuario.tenantId, usuario.usuarioId);
  }
}

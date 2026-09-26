import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ServicoAuditoriaCliente } from '../aplicacao/servico-auditoria-cliente';
import { FiltrosAuditoriaClienteDto } from '../aplicacao/filtros-auditoria-cliente.dto';

@Controller('cliente/auditoria')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Client')
@Permissoes('cliente.acessar')
export class ControladorAuditoriaCliente {
  constructor(private readonly servico: ServicoAuditoriaCliente, private readonly auditoria: ServicoAuditoria) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Query() filtros: FiltrosAuditoriaClienteDto) {
    const resultado = await this.servico.listar(usuario.tenantId, filtros);
    await this.auditoria.registrar({
      tenantId: usuario.tenantId, usuarioId: usuario.usuarioId,
      acao: 'cliente.auditoria.consultar', recursoTipo: 'auditoria', garantirRetentativa: true
    });
    return resultado;
  }
}

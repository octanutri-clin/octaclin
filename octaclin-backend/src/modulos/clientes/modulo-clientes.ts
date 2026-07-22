import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { TenantOrm } from '../tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../usuarios/infraestrutura/usuario.orm';
import { ServicoPortalCliente } from './aplicacao/servico-portal-cliente';
import { ServicoUsuariosCliente } from './aplicacao/servico-usuarios-cliente';
import { ControladorPortalCliente } from './apresentacao/controlador-portal-cliente';

@Module({
  imports: [TypeOrmModule.forFeature([TenantOrm, UsuarioOrm]), ModuloAuth, ModuloTenancy],
  controllers: [ControladorPortalCliente],
  providers: [ServicoPortalCliente, ServicoUsuariosCliente],
  exports: [ServicoPortalCliente, ServicoUsuariosCliente]
})
export class ModuloClientes {}

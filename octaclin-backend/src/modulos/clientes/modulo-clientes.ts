import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { ModuloAuth } from '../auth/modulo-auth';
import { TokenRedefinicaoSenhaOrm } from '../auth/infraestrutura/token-redefinicao-senha.orm';
import { AdaptadorEmailSmtp } from '../comunicacoes/infraestrutura/adaptadores/adaptador-email-smtp';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { TenantOrm } from '../tenancy/infraestrutura/tenant.orm';
import { TenantConfiguracaoOrm } from '../tenancy/infraestrutura/tenant-configuracao.orm';
import { UsuarioOrm } from '../usuarios/infraestrutura/usuario.orm';
import { ServicoPortalCliente } from './aplicacao/servico-portal-cliente';
import { ServicoUsuariosCliente } from './aplicacao/servico-usuarios-cliente';
import { ControladorPortalCliente } from './apresentacao/controlador-portal-cliente';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantOrm, TenantConfiguracaoOrm, UsuarioOrm, TokenRedefinicaoSenhaOrm, UserActionLogOrm]),
    ModuloAuth,
    ModuloTenancy
  ],
  controllers: [ControladorPortalCliente],
  providers: [ServicoPortalCliente, ServicoUsuariosCliente, ServicoAuditoria, AdaptadorEmailSmtp],
  exports: [ServicoPortalCliente, ServicoUsuariosCliente]
})
export class ModuloClientes {}

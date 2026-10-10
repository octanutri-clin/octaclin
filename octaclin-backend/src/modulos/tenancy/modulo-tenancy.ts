import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecutorTenant } from '../../infraestrutura/banco-dados/executor-tenant';
import { TenantOrm } from './infraestrutura/tenant.orm';
import { TenantConfiguracaoOrm } from './infraestrutura/tenant-configuracao.orm';
import { UsuarioOrm } from '../usuarios/infraestrutura/usuario.orm';
import { MaterialEducativoOrm } from '../materiais/infraestrutura/material-educativo.orm';
import { ServicoKitInicialClinica } from './aplicacao/servico-kit-inicial-clinica';

@Module({
  imports: [TypeOrmModule.forFeature([TenantOrm, TenantConfiguracaoOrm, UsuarioOrm, MaterialEducativoOrm])],
  providers: [ExecutorTenant, ServicoKitInicialClinica],
  exports: [ExecutorTenant, ServicoKitInicialClinica]
})
export class ModuloTenancy {}

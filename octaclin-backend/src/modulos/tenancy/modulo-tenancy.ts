import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecutorTenant } from '../../infraestrutura/banco-dados/executor-tenant';
import { TenantOrm } from './infraestrutura/tenant.orm';

@Module({
  imports: [TypeOrmModule.forFeature([TenantOrm])],
  providers: [ExecutorTenant],
  exports: [ExecutorTenant]
})
export class ModuloTenancy {}

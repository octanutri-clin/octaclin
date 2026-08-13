import { Global, Module } from '@nestjs/common';
import { ModuloTenancy } from '../../modulos/tenancy/modulo-tenancy';
import { ServicoFeatureFlags } from './servico-feature-flags';
import { GuardaFeatureFlag } from './guarda-feature-flag';

@Global()
@Module({
  imports: [ModuloTenancy],
  providers: [ServicoFeatureFlags, GuardaFeatureFlag],
  exports: [ServicoFeatureFlags, GuardaFeatureFlag]
})
export class ModuloFeatureFlags {}

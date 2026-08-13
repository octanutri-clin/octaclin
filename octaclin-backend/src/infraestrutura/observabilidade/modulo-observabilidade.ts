import { Global, Module } from '@nestjs/common';
import { ServicoTelemetriaOperacional } from './servico-telemetria-operacional';

@Global()
@Module({
  providers: [ServicoTelemetriaOperacional],
  exports: [ServicoTelemetriaOperacional]
})
export class ModuloObservabilidade {}

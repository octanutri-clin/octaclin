import { Module } from '@nestjs/common';
import { ControladorSaude } from './controlador-saude';
import { ServicoSaude } from './servico-saude';

@Module({
  controllers: [ControladorSaude],
  providers: [ServicoSaude],
  exports: [ServicoSaude]
})
export class ModuloSaude {}

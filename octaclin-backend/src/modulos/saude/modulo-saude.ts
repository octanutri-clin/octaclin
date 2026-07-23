import { Module } from '@nestjs/common';
import { ControladorSaude } from './controlador-saude';
import { ServicoSaude } from './servico-saude';

@Module({
  controllers: [ControladorSaude],
  providers: [ServicoSaude]
})
export class ModuloSaude {}

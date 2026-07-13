import { Module } from '@nestjs/common';
import { ControladorSaude } from './controlador-saude';

@Module({
  controllers: [ControladorSaude]
})
export class ModuloSaude {}

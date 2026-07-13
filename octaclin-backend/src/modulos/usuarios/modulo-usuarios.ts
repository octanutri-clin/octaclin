import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuarioOrm } from './infraestrutura/usuario.orm';

@Module({
  imports: [TypeOrmModule.forFeature([UsuarioOrm])],
  exports: [TypeOrmModule]
})
export class ModuloUsuarios {}

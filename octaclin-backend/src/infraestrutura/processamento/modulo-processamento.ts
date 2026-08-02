import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { criarConexaoRedis } from '../../modulos/comunicacoes/aplicacao/configuracao-redis';

@Global()
@Module({
  imports: [BullModule.forRoot({ connection: criarConexaoRedis() }), ScheduleModule.forRoot()],
  exports: [BullModule]
})
export class ModuloProcessamento {}

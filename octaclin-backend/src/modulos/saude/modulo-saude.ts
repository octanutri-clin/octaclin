import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { criarConexaoRedis } from '../comunicacoes/aplicacao/configuracao-redis';
import { ControladorSaude } from './controlador-saude';
import { REDIS_SAUDE, ServicoSaude } from './servico-saude';

@Module({
  controllers: [ControladorSaude],
  providers: [
    {
      provide: REDIS_SAUDE,
      useFactory: () => new Redis({ ...criarConexaoRedis(), lazyConnect: true, connectTimeout: 1_500, commandTimeout: 1_500 })
    },
    ServicoSaude
  ],
  exports: [ServicoSaude]
})
export class ModuloSaude {}

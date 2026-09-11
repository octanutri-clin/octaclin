import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { criarConexaoRedis } from '../comunicacoes/aplicacao/configuracao-redis';
import { clamavConfigurado, obterConfiguracaoClamav } from '../../infraestrutura/armazenamento/configuracao-clamav';
import { MecanismoClamAv } from '../../infraestrutura/armazenamento/mecanismo-clamav';
import { ControladorSaude } from './controlador-saude';
import { ANTIMALWARE_SAUDE, REDIS_SAUDE, ServicoSaude } from './servico-saude';

@Module({
  controllers: [ControladorSaude],
  providers: [
    {
      provide: REDIS_SAUDE,
      useFactory: () => new Redis({ ...criarConexaoRedis(), lazyConnect: true, connectTimeout: 1_500, commandTimeout: 1_500 })
    },
    {
      provide: ANTIMALWARE_SAUDE,
      useFactory: () => {
        if (!clamavConfigurado()) return undefined;
        const { host, porta, timeoutMs } = obterConfiguracaoClamav();
        return new MecanismoClamAv(host, porta, timeoutMs);
      }
    },
    ServicoSaude
  ],
  exports: [ServicoSaude]
})
export class ModuloSaude {}

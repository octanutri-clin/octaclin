import Redis from 'ioredis';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ServicoProtecaoAbuso } from './servico-protecao-abuso';

const descreverRedisReal = process.env.REDIS_PROVA_REAL === 'true' ? describe : describe.skip;

descreverRedisReal('ServicoProtecaoAbuso com Redis real', () => {
  const prefixo = `octaclin:teste:abuso:${process.pid}`;
  let redis: Redis;
  let servico: ServicoProtecaoAbuso;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_PROVA_URL ?? 'redis://127.0.0.1:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });
    await redis.connect();
    servico = new ServicoProtecaoAbuso(redis);
  });

  afterEach(async () => {
    const chaves = await redis.keys(`${prefixo}:*`);
    if (chaves.length) await redis.del(...chaves);
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('admite exatamente o limite e rejeita o excedente sob concorrencia', async () => {
    const politica = {
      maxTentativas: 10,
      janelaMs: 60_000,
      bloqueioMs: 120_000,
      mensagemBloqueio: 'Bloqueado.'
    };

    const resultados = await Promise.allSettled(
      Array.from({ length: 40 }, () => servico.consumirTentativa(`${prefixo}:limite`, politica, 1_000))
    );
    const aceitas = resultados.filter((resultado) => resultado.status === 'fulfilled');
    const rejeitadas = resultados.filter((resultado) => resultado.status === 'rejected');

    expect(aceitas).toHaveLength(politica.maxTentativas);
    expect(rejeitadas).toHaveLength(30);
    for (const resultado of rejeitadas) {
      expect(resultado.status).toBe('rejected');
      if (resultado.status === 'rejected') {
        expect(resultado.reason).toBeInstanceOf(HttpException);
        expect((resultado.reason as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    }
  });

  it('concede uma unica reserva de idempotencia em chamadas concorrentes', async () => {
    const resultados = await Promise.all(
      Array.from({ length: 40 }, () => servico.reservarIdempotencia(`${prefixo}:replay`, 60_000))
    );

    expect(resultados.filter(Boolean)).toHaveLength(1);
    await expect(servico.obterEstadoIdempotencia(`${prefixo}:replay`)).resolves.toBe('processando');
    await servico.concluirIdempotencia(`${prefixo}:replay`, 60_000);
    await expect(servico.obterEstadoIdempotencia(`${prefixo}:replay`)).resolves.toBe('concluido');
  });
});

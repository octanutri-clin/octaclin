import { HttpException, HttpStatus } from '@nestjs/common';
import { ClienteRedisProtecaoAbuso, PoliticaProtecaoAbuso, ServicoProtecaoAbuso } from './servico-protecao-abuso';

class ClienteRedisFalso implements ClienteRedisProtecaoAbuso {
  private readonly valores = new Map<string, string>();

  async get(chave: string): Promise<string | null> {
    return this.valores.get(chave) ?? null;
  }

  async set(chave: string, valor: string, _modo?: 'PX', _duracaoMs?: number, condicao?: 'NX'): Promise<unknown> {
    if (condicao === 'NX' && this.valores.has(chave)) return null;
    this.valores.set(chave, valor);
    return 'OK';
  }

  async del(chave: string): Promise<unknown> {
    return this.valores.delete(chave) ? 1 : 0;
  }

  async eval(
    _script: string,
    quantidadeChaves: number,
    chave: string,
    agoraBruto: string,
    janelaBruta: string,
    maxTentativasBruto: string,
    bloqueioBruto: string
  ): Promise<[number, number]> {
    expect(quantidadeChaves).toBe(1);

    const agora = Number(agoraBruto);
    const janelaMs = Number(janelaBruta);
    const maxTentativas = Number(maxTentativasBruto);
    const bloqueioMs = Number(bloqueioBruto);
    const existente = this.valores.get(chave) ?? null;
    const registro = existente ? (JSON.parse(existente) as { quantidade: number; expiraEm: number; bloqueadoAte?: number }) : null;
    const atual = !registro || registro.expiraEm <= agora ? { quantidade: 0, expiraEm: agora + janelaMs } : registro;

    atual.quantidade += 1;
    if (atual.quantidade >= maxTentativas) atual.bloqueadoAte = agora + bloqueioMs;

    this.valores.set(chave, JSON.stringify(atual));
    return [atual.quantidade, atual.bloqueadoAte ?? 0];
  }
}

describe('ServicoProtecaoAbuso', () => {
  const politica = {
    maxTentativas: 3,
    janelaMs: 60_000,
    bloqueioMs: 120_000,
    mensagemBloqueio: 'Muitas tentativas. Tente novamente em alguns minutos.'
  };

  it('deve bloquear a chave apos exceder o limite de falhas', async () => {
    const servico = new ServicoProtecaoAbuso(new ClienteRedisFalso());

    await servico.verificarDisponibilidade('login:tenant:ana@example.com', politica, 1_000);
    await servico.registrarFalha('login:tenant:ana@example.com', politica, 1_000);
    await servico.registrarFalha('login:tenant:ana@example.com', politica, 2_000);
    await servico.registrarFalha('login:tenant:ana@example.com', politica, 3_000);

    await expect(servico.verificarDisponibilidade('login:tenant:ana@example.com', politica, 4_000)).rejects.toThrow(
      HttpException
    );
    try {
      await servico.verificarDisponibilidade('login:tenant:ana@example.com', politica, 4_000);
    } catch (erro) {
      expect((erro as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('deve preservar todas as falhas concorrentes para bloquear no limite', async () => {
    const servico = new ServicoProtecaoAbuso(new ClienteRedisFalso());
    const politicaConcorrente: PoliticaProtecaoAbuso = {
      maxTentativas: 5,
      janelaMs: 60_000,
      bloqueioMs: 120_000,
      mensagemBloqueio: 'Bloqueado.'
    };

    await Promise.all(
      Array.from({ length: politicaConcorrente.maxTentativas }, () =>
        servico.registrarFalha('login:tenant:concorrente@example.com', politicaConcorrente, 1_000)
      )
    );

    await expect(
      servico.verificarDisponibilidade('login:tenant:concorrente@example.com', politicaConcorrente, 1_001)
    ).rejects.toThrow(HttpException);
  });

  it('deve admitir no maximo o limite configurado sob concorrencia real', async () => {
    const servico = new ServicoProtecaoAbuso(new ClienteRedisFalso());
    const politicaConcorrente: PoliticaProtecaoAbuso = {
      maxTentativas: 5,
      janelaMs: 60_000,
      bloqueioMs: 120_000,
      mensagemBloqueio: 'Bloqueado.'
    };

    const resultados = await Promise.allSettled(
      Array.from({ length: 8 }, () => servico.consumirTentativa('publico:ip-sintetico', politicaConcorrente, 1_000))
    );

    expect(resultados.filter((resultado) => resultado.status === 'fulfilled')).toHaveLength(5);
    expect(resultados.filter((resultado) => resultado.status === 'rejected')).toHaveLength(3);
  });

  it('deve reservar apenas uma execucao para a mesma chave sob concorrencia', async () => {
    const servico = new ServicoProtecaoAbuso(new ClienteRedisFalso());

    const resultados = await Promise.all(
      Array.from({ length: 8 }, () => servico.reservarIdempotencia('webhook:replay:hash-sintetico', 60_000))
    );

    expect(resultados.filter(Boolean)).toHaveLength(1);
    await expect(servico.obterEstadoIdempotencia('webhook:replay:hash-sintetico')).resolves.toBe('processando');
    await servico.concluirIdempotencia('webhook:replay:hash-sintetico', 60_000);
    await expect(servico.obterEstadoIdempotencia('webhook:replay:hash-sintetico')).resolves.toBe('concluido');
    await servico.liberarIdempotencia('webhook:replay:hash-sintetico');
    await expect(servico.reservarIdempotencia('webhook:replay:hash-sintetico', 60_000)).resolves.toBe(true);
  });

  it('deve limpar tentativas quando a autenticacao for bem sucedida', async () => {
    const servico = new ServicoProtecaoAbuso(new ClienteRedisFalso());

    await servico.registrarFalha('login:tenant:ana@example.com', politica, 1_000);
    await servico.registrarFalha('login:tenant:ana@example.com', politica, 2_000);
    await servico.registrarSucesso('login:tenant:ana@example.com');

    await expect(servico.verificarDisponibilidade('login:tenant:ana@example.com', politica, 3_000)).resolves.not.toThrow();
    await servico.registrarFalha('login:tenant:ana@example.com', politica, 4_000);
    await expect(servico.verificarDisponibilidade('login:tenant:ana@example.com', politica, 5_000)).resolves.not.toThrow();
  });

  it('deve liberar a chave apos o periodo de bloqueio', async () => {
    const servico = new ServicoProtecaoAbuso(new ClienteRedisFalso());

    await servico.registrarFalha('recuperacao:tenant:ana@example.com', politica, 1_000);
    await servico.registrarFalha('recuperacao:tenant:ana@example.com', politica, 2_000);
    await servico.registrarFalha('recuperacao:tenant:ana@example.com', politica, 3_000);

    await expect(servico.verificarDisponibilidade('recuperacao:tenant:ana@example.com', politica, 4_000)).rejects.toThrow(
      HttpException
    );
    await expect(
      servico.verificarDisponibilidade('recuperacao:tenant:ana@example.com', politica, 124_000)
    ).resolves.not.toThrow();
  });
});

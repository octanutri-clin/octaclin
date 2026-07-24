import { HttpException, HttpStatus } from '@nestjs/common';
import { ClienteRedisProtecaoAbuso, ServicoProtecaoAbuso } from './servico-protecao-abuso';

class ClienteRedisFalso implements ClienteRedisProtecaoAbuso {
  private readonly valores = new Map<string, string>();

  async get(chave: string): Promise<string | null> {
    return this.valores.get(chave) ?? null;
  }

  async set(chave: string, valor: string): Promise<unknown> {
    this.valores.set(chave, valor);
    return 'OK';
  }

  async del(chave: string): Promise<unknown> {
    return this.valores.delete(chave) ? 1 : 0;
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

import { HttpException, HttpStatus } from '@nestjs/common';
import { ServicoProtecaoAbuso } from './servico-protecao-abuso';

describe('ServicoProtecaoAbuso', () => {
  const politica = {
    maxTentativas: 3,
    janelaMs: 60_000,
    bloqueioMs: 120_000,
    mensagemBloqueio: 'Muitas tentativas. Tente novamente em alguns minutos.'
  };

  it('deve bloquear a chave apos exceder o limite de falhas', () => {
    const servico = new ServicoProtecaoAbuso();

    servico.verificarDisponibilidade('login:tenant:ana@example.com', politica, 1_000);
    servico.registrarFalha('login:tenant:ana@example.com', politica, 1_000);
    servico.registrarFalha('login:tenant:ana@example.com', politica, 2_000);
    servico.registrarFalha('login:tenant:ana@example.com', politica, 3_000);

    expect(() => servico.verificarDisponibilidade('login:tenant:ana@example.com', politica, 4_000)).toThrow(
      HttpException
    );
    try {
      servico.verificarDisponibilidade('login:tenant:ana@example.com', politica, 4_000);
    } catch (erro) {
      expect((erro as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('deve limpar tentativas quando a autenticacao for bem sucedida', () => {
    const servico = new ServicoProtecaoAbuso();

    servico.registrarFalha('login:tenant:ana@example.com', politica, 1_000);
    servico.registrarFalha('login:tenant:ana@example.com', politica, 2_000);
    servico.registrarSucesso('login:tenant:ana@example.com');

    expect(() => servico.verificarDisponibilidade('login:tenant:ana@example.com', politica, 3_000)).not.toThrow();
    servico.registrarFalha('login:tenant:ana@example.com', politica, 4_000);
    expect(() => servico.verificarDisponibilidade('login:tenant:ana@example.com', politica, 5_000)).not.toThrow();
  });

  it('deve liberar a chave apos o periodo de bloqueio', () => {
    const servico = new ServicoProtecaoAbuso();

    servico.registrarFalha('recuperacao:tenant:ana@example.com', politica, 1_000);
    servico.registrarFalha('recuperacao:tenant:ana@example.com', politica, 2_000);
    servico.registrarFalha('recuperacao:tenant:ana@example.com', politica, 3_000);

    expect(() => servico.verificarDisponibilidade('recuperacao:tenant:ana@example.com', politica, 4_000)).toThrow(
      HttpException
    );
    expect(() => servico.verificarDisponibilidade('recuperacao:tenant:ana@example.com', politica, 124_000)).not.toThrow();
  });
});

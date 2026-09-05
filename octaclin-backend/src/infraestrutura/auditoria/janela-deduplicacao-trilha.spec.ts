import { criarJanelaDeduplicacaoTrilha } from './janela-deduplicacao-trilha';

/**
 * O modulo e dominio puro com estado de processo: sem Nest, sem I/O, relogio
 * recebido por parametro. Testa-lo pelos dois chamadores deixaria sem prova
 * justamente o que nao aparece pela porta deles -- teto de chaves, ordem de
 * eviction, residual de supressao e o que acontece quando a escrita reservada
 * nao chega a acontecer.
 *
 * A propriedade que todos os testes abaixo cercam e uma so, e e assimetrica: no
 * pior caso a janela grava de novo; nunca deixa de gravar um evento distinto.
 *
 * O residual (`suprimidos`) tem garantia mais fraca que o evento -- eviction e
 * restart o perdem em silencio. Os testes de residual abaixo cercam o unico
 * caminho de perda que o modulo se compromete a fechar: o da escrita reservada
 * que nao aconteceu.
 */

const JANELA_MS = 60_000;
const AGORA = Date.parse('2026-09-03T10:00:00.000Z');

function criarJanela(maximoChaves = 10, alvoAposPoda = 8) {
  return criarJanelaDeduplicacaoTrilha({ janelaMs: JANELA_MS, maximoChaves, alvoAposPoda });
}

describe('JanelaDeduplicacaoTrilha', () => {
  it('deve gravar a primeira ocorrencia de uma chave e suprimir as repeticoes dentro da janela', () => {
    const janela = criarJanela();

    expect(janela.reservar('a', AGORA).suprimir).toBe(false);
    janela.confirmar('a', AGORA);

    expect(janela.reservar('a', AGORA + 1).suprimir).toBe(true);
    expect(janela.reservar('a', AGORA + JANELA_MS - 1).suprimir).toBe(true);
  });

  it('deve voltar a gravar quando a janela expira', () => {
    const janela = criarJanela();
    janela.reservar('a', AGORA);
    janela.confirmar('a', AGORA);

    expect(janela.reservar('a', AGORA + JANELA_MS).suprimir).toBe(false);
  });

  it('nunca deve suprimir uma chave distinta, mesmo no mesmo instante', () => {
    const janela = criarJanela();
    janela.reservar('a', AGORA);
    janela.confirmar('a', AGORA);

    expect(janela.reservar('b', AGORA).suprimir).toBe(false);
    expect(janela.reservar('c', AGORA).suprimir).toBe(false);
  });

  it('deve voltar a gravar quando a escrita reservada falhou e a reserva foi liberada', () => {
    const janela = criarJanela();
    expect(janela.reservar('a', AGORA).suprimir).toBe(false);

    // Escrita rejeitada: uma unica falha nao pode silenciar a chave pela janela
    // inteira, senao a supressao passaria a esconder evento que nunca foi
    // gravado.
    janela.liberar('a', AGORA);

    expect(janela.reservar('a', AGORA + 1).suprimir).toBe(false);
  });

  it('deve preservar as supressoes acumuladas quando a reserva e liberada', () => {
    const janela = criarJanela();
    janela.reservar('a', AGORA);
    janela.reservar('a', AGORA + 1);

    // A escrita reservada nao aconteceu, mas a repeticao acima foi suprimida de
    // verdade. Apagar a entrada aqui -- o comportamento da fase 1, de quando ela
    // nao guardava contagem -- levaria essa supressao junto, e a trilha
    // sub-reportaria o volume sem marcador nenhum.
    janela.liberar('a', AGORA);

    expect(janela.reservar('a', AGORA + 2)).toEqual({ suprimir: false, suprimidos: 1 });
  });

  it('deve preservar o residual que a escrita liberada ia gravar', () => {
    const janela = criarJanela();
    janela.reservar('a', AGORA);
    janela.confirmar('a', AGORA);
    janela.reservar('a', AGORA + 1);
    janela.reservar('a', AGORA + 2);

    // O evento que reabre a janela recebe o residual de 2 e falha ao grava-lo.
    // Sem a preservacao, esses dois eventos desapareceriam da contagem: a
    // reserva ja tinha tirado o residual do mapa.
    expect(janela.reservar('a', AGORA + JANELA_MS).suprimidos).toBe(2);
    janela.liberar('a', AGORA + JANELA_MS);

    expect(janela.reservar('a', AGORA + JANELA_MS + 1)).toEqual({ suprimir: false, suprimidos: 2 });
  });

  it('nao deve reportar o mesmo residual duas vezes depois de uma escrita confirmada', () => {
    const janela = criarJanela();
    janela.reservar('a', AGORA);
    janela.confirmar('a', AGORA);
    janela.reservar('a', AGORA + 1);

    const reabertura = janela.reservar('a', AGORA + JANELA_MS);
    janela.confirmar('a', AGORA + JANELA_MS);
    expect(reabertura.suprimidos).toBe(1);

    // A linha existe e ja reporta o residual; devolve-lo de novo inflaria a
    // contagem, que e o erro simetrico do sub-reporte.
    expect(janela.reservar('a', AGORA + 2 * JANELA_MS).suprimidos).toBe(0);
  });

  it('nao deve liberar uma reserva ja confirmada', () => {
    const janela = criarJanela();
    janela.reservar('a', AGORA);
    janela.confirmar('a', AGORA);
    janela.liberar('a', AGORA);

    expect(janela.reservar('a', AGORA + 1).suprimir).toBe(true);
  });

  it('nao deve liberar a reserva vigente quando o instante e de outra reserva', () => {
    const janela = criarJanela();
    janela.reservar('a', AGORA);
    janela.confirmar('a', AGORA);
    janela.reservar('a', AGORA + JANELA_MS);

    // Rejeicao tardia da escrita anterior, que ja nao e a reserva viva.
    janela.liberar('a', AGORA);

    expect(janela.tamanho()).toBe(1);
  });

  it('nao deve confirmar uma reserva que ja foi substituida por outra mais nova', () => {
    const janela = criarJanela();
    janela.reservar('a', AGORA);
    janela.reservar('a', AGORA + JANELA_MS);

    // Confirmacao tardia da primeira escrita: se ela promovesse a reserva nova,
    // uma falha da escrita nova ficaria sem `liberar` e silenciaria a chave.
    janela.confirmar('a', AGORA);
    janela.liberar('a', AGORA + JANELA_MS);

    expect(janela.reservar('a', AGORA + JANELA_MS + 1).suprimir).toBe(false);
  });

  it('deve contar as escritas suprimidas e devolver o residual no evento que reabre a janela', () => {
    const janela = criarJanela();
    janela.reservar('a', AGORA);
    janela.confirmar('a', AGORA);
    janela.reservar('a', AGORA + 1);
    janela.reservar('a', AGORA + 2);
    janela.reservar('a', AGORA + 3);

    const reabertura = janela.reservar('a', AGORA + JANELA_MS);

    expect(reabertura.suprimir).toBe(false);
    expect(reabertura.suprimidos).toBe(3);
  });

  it('deve zerar o residual depois de reporta-lo uma vez', () => {
    const janela = criarJanela();
    janela.reservar('a', AGORA);
    janela.reservar('a', AGORA + 1);
    janela.reservar('a', AGORA + JANELA_MS);

    expect(janela.reservar('a', AGORA + 2 * JANELA_MS).suprimidos).toBe(0);
  });

  it('nao deve devolver residual na escrita suprimida, que e a que nao chega a trilha', () => {
    const janela = criarJanela();
    janela.reservar('a', AGORA);

    expect(janela.reservar('a', AGORA + 1)).toEqual({ suprimir: true, suprimidos: 0 });
  });

  it('deve podar ate o alvo quando o teto de chaves e atingido', () => {
    const janela = criarJanela(10, 8);
    for (let indice = 0; indice < 10; indice += 1) janela.reservar(`chave-${indice}`, AGORA);

    expect(janela.tamanho()).toBe(10);

    // A 11a insercao encosta no teto: a poda derruba o excedente antes de
    // inserir, e nao uma chave por insercao -- varredura amortizada.
    janela.reservar('chave-10', AGORA);

    expect(janela.tamanho()).toBe(9);
  });

  it('deve descartar primeiro a chave expirada, e nao a chave em uso, ao podar', () => {
    const janela = criarJanela(3, 2);
    janela.reservar('antiga', AGORA);
    janela.reservar('viva-1', AGORA + JANELA_MS);
    janela.reservar('viva-2', AGORA + JANELA_MS);

    janela.reservar('nova', AGORA + JANELA_MS);

    // `antiga` ja tinha expirado, entao voltar a grava-la e o comportamento
    // correto; as duas vivas continuam suprimindo.
    expect(janela.reservar('viva-1', AGORA + JANELA_MS + 1).suprimir).toBe(true);
    expect(janela.reservar('viva-2', AGORA + JANELA_MS + 1).suprimir).toBe(true);
  });

  it('deve evictar por ordem de uso, e nao de criacao, quando nada expirou', () => {
    const janela = criarJanela(3, 2);
    janela.reservar('primeira', AGORA);
    janela.reservar('segunda', AGORA);
    janela.reservar('terceira', AGORA);

    // Uso da mais antiga: ela vai para o fim da fila de eviction, porque a
    // chave persistente e justamente a que a dedup precisa manter viva.
    janela.reservar('primeira', AGORA + 1);

    janela.reservar('quarta', AGORA + 1);

    expect(janela.reservar('primeira', AGORA + 2).suprimir).toBe(true);
    expect(janela.reservar('segunda', AGORA + 2).suprimir).toBe(false);
  });

  it('deve esquecer todo o estado ao reiniciar, voltando a gravar', () => {
    const janela = criarJanela();
    janela.reservar('a', AGORA);
    janela.reiniciar();

    expect(janela.tamanho()).toBe(0);
    expect(janela.reservar('a', AGORA).suprimir).toBe(false);
  });

  it('deve manter janelas independentes entre instancias', () => {
    const primeira = criarJanela();
    const segunda = criarJanela();
    primeira.reservar('a', AGORA);

    expect(segunda.reservar('a', AGORA).suprimir).toBe(false);
  });
});

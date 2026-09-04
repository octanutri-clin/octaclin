/**
 * Janela de deduplicacao de escrita na trilha (PR 52, fase 2).
 *
 * A fase 1b construiu esta mecanica dentro de `auditoria-autorizacao.ts` para
 * conter a amplificacao de `auth.autorizacao.negada`. A fase 2 precisa da mesma
 * mecanica para `auth.login.sucesso` (EXC-AUD-002): quem tem credencial valida
 * e entra em laco de login grava sem limite numa tabela append-only, e cada
 * linha e custo permanente porque a trilha entra em backup.
 *
 * A escolha aqui foi **generalizar em vez de copiar**. Duas copias da mesma
 * janela divergiriam -- e a copia que divergisse seria a que ninguem lembraria
 * de testar, exatamente o argumento que ja esta escrito em
 * `auditoria-autorizacao.ts` para as duas guardas compartilharem uma janela so.
 * O modulo continua sendo dominio puro: sem Nest, sem I/O, relogio recebido por
 * parametro, para que teto de chaves, poda e ordem de eviction possam ser
 * provados sem subir aplicacao.
 *
 * O que este modulo **nao** e: um controle de seguranca. E otimizacao de
 * volume. O estado e por processo e em memoria, e entre replicas cada uma tem a
 * sua -- N replicas gravam ate N vezes o mesmo evento por janela. Se o processo
 * reinicia, o pior caso e gravar de novo; nunca deixar de gravar um evento
 * distinto. Essa assimetria e a propriedade que os dois chamadores dependem, e
 * e o que a reserva provisoria abaixo protege.
 *
 * A assimetria vale para o **evento**, e nao para o residual. Na fase 1 as duas
 * coisas eram a mesma, porque nao havia contagem a carregar; desde que a API
 * passou a devolver `suprimidos`, o residual e uma segunda grandeza com garantia
 * mais fraca: ele e best-effort e some em silencio quando a chave e evictada
 * pelo teto ou quando o processo reinicia -- sem marcador nenhum na trilha. Isso
 * esta dito aqui de proposito para que ninguem leia a assimetria acima como
 * promessa de contagem exata. O unico caminho de perda que sai barato ja esta
 * fechado: `liberar` preserva o residual em vez de apagar a entrada.
 */

export interface OpcoesJanelaDeduplicacao {
  /** Duracao da supressao de uma mesma identidade de evento. */
  janelaMs: number;
  /**
   * Teto de chaves vivas. Obrigatorio, e nao opcional com padrao: quando a
   * identidade do evento carrega parte influenciada pelo cliente (rota, alvo),
   * uma defesa contra amplificacao na trilha sem teto vira amplificacao de
   * memoria no processo. Quem instancia tem de ter feito essa conta.
   */
  maximoChaves: number;
  /**
   * Alvo de tamanho apos uma poda.
   *
   * A poda so vale a pena se for amortizada. Reduzir para `maximoChaves - 1`
   * faria a insercao seguinte reencostar no teto, e toda chamada subsequente
   * pagaria uma varredura O(n) -- justamente sob a rajada que a janela existe
   * para conter.
   */
  alvoAposPoda: number;
}

export interface ReservaJanela {
  /** `true` quando a escrita deve ser suprimida por repetir evento identico. */
  suprimir: boolean;
  /**
   * Quantas escritas foram suprimidas para esta chave desde a ultima janela
   * encerrada. Preenchido apenas quando `suprimir` e `false`, isto e, no evento
   * que reabre a janela e portanto pode carregar o residual.
   *
   * Sem isto o teto compraria volume com cegueira: a trilha passaria a
   * sub-reportar o numero real de eventos e ninguem conseguiria distinguir "um
   * login" de "mil logins colapsados em um". A contagem e o formato que a
   * secao 4.2 da politica de redacao manda usar -- volume e seguro de gravar,
   * conteudo nao.
   *
   * O que esta contagem **nao** e: garantida. Ela e best-effort. Duas perdas
   * continuam possiveis e nenhuma delas deixa marca na trilha -- eviction da
   * chave pelo teto e restart do processo. Nesses casos a trilha volta a
   * sub-reportar exatamente como sub-reportaria sem contador, e quem le nao tem
   * como saber. Fechar isso exigiria persistir o residual fora do processo, o
   * oposto do que um teto de escrita existe para fazer. Portanto: leia
   * `loginsSuprimidos` como piso do volume colapsado, nunca como total exato.
   */
  suprimidos: number;
}

export interface JanelaDeduplicacaoTrilha {
  /**
   * Decide entre gravar e suprimir, e **reserva** a chave quando decide gravar.
   *
   * A reserva nasce nao confirmada de proposito: enquanto a escrita esta em
   * voo, as repeticoes do mesmo evento nao disparam N escritas simultaneas,
   * mas uma escrita que falhe nao pode silenciar aquela chave pela janela
   * inteira. Quem chama e obrigado a fechar o par com {@link confirmar} ou
   * {@link liberar}.
   */
  reservar(chave: string, agora: number): ReservaJanela;
  /** Promove a reserva a escrita efetiva: dai em diante a supressao e legitima. */
  confirmar(chave: string, agora: number): void;
  /** Desfaz a reserva de uma escrita que nao aconteceu. */
  liberar(chave: string, agora: number): void;
  /** Ponto de reinicio do estado, para que um teste nao contamine o seguinte. */
  reiniciar(): void;
  /** Quantidade de chaves vivas. Existe para o teste provar teto e poda. */
  tamanho(): number;
}

interface EntradaJanela {
  /** Instante da reserva. A expiracao conta a partir daqui, confirmada ou nao. */
  instante: number;
  /**
   * `false` enquanto a escrita esta em voo. So a confirmacao torna a supressao
   * legitima; ver `liberar`.
   */
  confirmada: boolean;
  /** Escritas ja suprimidas por esta entrada. Vira o residual da proxima. */
  suprimidos: number;
  /**
   * Residual que esta reserva recebeu da janela anterior e entregou ao chamador
   * para gravar. Fica guardado ate o desfecho: `confirmar` o zera, porque a
   * linha existe e ja reporta a contagem; `liberar` o devolve a `suprimidos`,
   * porque a linha nao existiu e a contagem nao pode morrer com ela.
   */
  residualCarregado: number;
  /**
   * `true` depois de `liberar`. A entrada sobrevive a liberacao apenas como
   * portadora do residual: ela nao suprime mais nada, e o proximo evento da
   * chave reabre a janela normalmente.
   */
  liberada: boolean;
}

export function criarJanelaDeduplicacaoTrilha(opcoes: OpcoesJanelaDeduplicacao): JanelaDeduplicacaoTrilha {
  const entradas = new Map<string, EntradaJanela>();

  function podarChavesExpiradas(agora: number): void {
    for (const [chave, entrada] of entradas) {
      if (agora - entrada.instante >= opcoes.janelaMs) entradas.delete(chave);
    }

    // `Map` preserva ordem de insercao e este modulo reinsere a chave a cada uso
    // (ver `reservar`), entao a ordem e de uso e nao de criacao: o que sai
    // primeiro e a chave ha mais tempo sem evento, e nao a chave mais
    // persistente -- que e exatamente a que a dedup precisa manter viva.
    //
    // Perder uma entrada nao perde auditoria: o proximo evento daquela chave
    // volta a ser gravado. Perde-se o residual acumulado, e essa e a troca certa
    // -- residual e metrica, evento e evidencia. A perda e **silenciosa**: a
    // trilha volta a sub-reportar aquele volume sem marcador nenhum, igual ao
    // que acontece num restart. Esta escrito porque um teto que perde a propria
    // contagem sem avisar e o defeito que `suprimidos` existe para conter, e o
    // leitor precisa saber que ele volta nestes dois casos.
    while (entradas.size > opcoes.alvoAposPoda) {
      const maisAntiga = entradas.keys().next();
      if (maisAntiga.done) break;
      entradas.delete(maisAntiga.value);
    }
  }

  return {
    reservar(chave: string, agora: number): ReservaJanela {
      const anterior = entradas.get(chave);

      // `liberada` sai da supressao: a entrada so continua viva para carregar o
      // residual da escrita que falhou, e suprimir com base nela esconderia
      // evento que nunca chegou a trilha.
      if (anterior !== undefined && !anterior.liberada && agora - anterior.instante < opcoes.janelaMs) {
        anterior.suprimidos += 1;
        // `Map.set` em chave existente nao reordena; o `delete` antes e o que
        // transforma a eviction do teto em LRU de verdade.
        entradas.delete(chave);
        entradas.set(chave, anterior);
        return { suprimir: true, suprimidos: 0 };
      }

      // A janela anterior expirou: o residual dela e reportado por este evento,
      // que e o unico portador disponivel. Nao ha timer para emitir residual de
      // chave que nunca mais acontece, e nao deve haver: um timer manteria viva
      // uma referencia por chave so para gravar uma contagem, o oposto do que
      // um teto de escrita existe para fazer.
      const suprimidos = anterior?.suprimidos ?? 0;

      if (entradas.size >= opcoes.maximoChaves) podarChavesExpiradas(agora);
      entradas.delete(chave);
      entradas.set(chave, {
        instante: agora,
        confirmada: false,
        suprimidos: 0,
        residualCarregado: suprimidos,
        liberada: false
      });
      return { suprimir: false, suprimidos };
    },

    // `residualCarregado` nao precisa ser zerado aqui: `liberar` ja se recusa a
    // mexer numa entrada confirmada, entao nao ha caminho em que o residual de
    // uma escrita que aconteceu seja devolvido e gravado duas vezes.
    confirmar(chave: string, agora: number): void {
      const entrada = entradas.get(chave);
      if (entrada?.instante === agora) entrada.confirmada = true;
    },

    /**
     * O `instante` identifica a reserva: se outra ja tomou o lugar desta, a
     * comparacao falha e nada muda. Uma reserva confirmada tambem nao e desfeita
     * -- confirmada significa que a escrita aconteceu.
     *
     * A entrada e marcada, e nao apagada. Apagar era o comportamento da fase 1,
     * quando a entrada nao guardava contagem; hoje ela guarda, e apagar levaria
     * junto as supressoes acumuladas e o residual que a reserva ia gravar -- a
     * trilha sub-reportaria aquele volume em silencio, que e o defeito que
     * `suprimidos` existe para conter. Marcada, a entrada nao suprime mais nada
     * (ver `reservar`) e o proximo evento da chave grava e leva o residual.
     */
    liberar(chave: string, agora: number): void {
      const entrada = entradas.get(chave);
      if (!entrada || entrada.confirmada || entrada.instante !== agora) return;
      entrada.liberada = true;
      entrada.suprimidos += entrada.residualCarregado;
      entrada.residualCarregado = 0;
    },

    reiniciar(): void {
      entradas.clear();
    },

    tamanho(): number {
      return entradas.size;
    }
  };
}

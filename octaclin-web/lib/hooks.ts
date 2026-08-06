import { useCallback, useEffect, useRef } from 'react';

interface RequisicaoCancelavel {
  signal: AbortSignal;
  ehAtual: () => boolean;
}

export function useRequisicaoCancelavel() {
  const sequenciaRef = useRef(0);
  const controladorRef = useRef<AbortController | null>(null);

  const iniciar = useCallback((): RequisicaoCancelavel => {
    controladorRef.current?.abort();
    const controlador = new AbortController();
    controladorRef.current = controlador;
    const sequencia = ++sequenciaRef.current;
    return {
      signal: controlador.signal,
      ehAtual: () => sequencia === sequenciaRef.current
    };
  }, []);

  useEffect(() => () => controladorRef.current?.abort(), []);

  return iniciar;
}

/**
 * Intervalo de atualizacao automatica dos paineis (Fase 210). Mais folgado que o
 * sino: a lista inteira e mais cara que o contador, e quem esta com a tela
 * aberta ja recebe o aviso pelo sino em ate 5s.
 */
export const INTERVALO_ATUALIZACAO_PAINEL_MS = 20000;

/**
 * Recarrega em intervalo fixo enquanto a aba esta visivel.
 *
 * A pausa em aba oculta nao e economia de request: e o que impede vinte abas
 * esquecidas de manter o backend acordado. Ao voltar, recarrega na hora, senao o
 * usuario olharia dados velhos ate o proximo tick.
 */
export function useAtualizacaoPeriodica(recarregar: () => void, intervaloMs: number) {
  const recarregarRef = useRef(recarregar);
  recarregarRef.current = recarregar;

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let temporizador: ReturnType<typeof setInterval> | undefined;

    const parar = () => {
      if (temporizador) clearInterval(temporizador);
      temporizador = undefined;
    };

    const iniciar = () => {
      parar();
      temporizador = setInterval(() => recarregarRef.current(), intervaloMs);
    };

    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'visible') {
        recarregarRef.current();
        iniciar();
      } else {
        parar();
      }
    };

    if (document.visibilityState === 'visible') iniciar();
    document.addEventListener('visibilitychange', aoMudarVisibilidade);

    return () => {
      parar();
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [intervaloMs]);
}

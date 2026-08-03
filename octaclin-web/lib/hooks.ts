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

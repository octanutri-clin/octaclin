import { useEffect } from 'react';
import { registrarProtecaoAntesUnload } from './proteger-alteracoes-nao-salvas.mjs';

export function useProtecaoAlteracoesNaoSalvas(alteracoesPendentes: boolean): void {
  useEffect(
    () => registrarProtecaoAntesUnload(window, alteracoesPendentes),
    [alteracoesPendentes]
  );
}

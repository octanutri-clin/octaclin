export type AlvoBeforeUnload = Pick<Window, 'addEventListener' | 'removeEventListener'>;

export declare function registrarProtecaoAntesUnload(
  alvo: AlvoBeforeUnload,
  alteracoesPendentes: boolean
): () => void;

export function registrarProtecaoAntesUnload(alvo, alteracoesPendentes) {
  if (!alteracoesPendentes) return () => {};

  function impedirSaida(evento) {
    evento.preventDefault();
    evento.returnValue = '';
  }

  alvo.addEventListener('beforeunload', impedirSaida);
  return () => alvo.removeEventListener('beforeunload', impedirSaida);
}

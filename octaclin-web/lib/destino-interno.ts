const ORIGEM_SENTINELA = 'https://octaclin.invalid';
const CAMINHO_API = /^\/api(?:\/|$)/;
const CODIFICACAO_PERIGOSA = /%(?:0[0-9a-f]|1[0-9a-f]|2f|5c)/i;
const CARACTERE_CONTROLE_OU_BARRA_INVERSA = /[\u0000-\u001f\u007f\\]/;

export function sanitizarDestinoInterno(valor: string | undefined, fallback: string): string {
  if (
    !valor ||
    !valor.startsWith('/') ||
    valor.startsWith('//') ||
    CAMINHO_API.test(valor) ||
    CODIFICACAO_PERIGOSA.test(valor) ||
    CARACTERE_CONTROLE_OU_BARRA_INVERSA.test(valor)
  ) {
    return fallback;
  }

  try {
    const destino = new URL(valor, ORIGEM_SENTINELA);
    if (destino.origin !== ORIGEM_SENTINELA || CAMINHO_API.test(destino.pathname)) return fallback;
    return `${destino.pathname}${destino.search}${destino.hash}`;
  } catch {
    return fallback;
  }
}

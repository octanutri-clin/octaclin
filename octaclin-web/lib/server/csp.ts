const AMBIENTE_DESENVOLVIMENTO = 'development';

export function criarNonceCsp(): string {
  return crypto.randomUUID().replaceAll('-', '');
}

export function criarPoliticaConteudo(nonce: string, ambiente = process.env.NODE_ENV): string {
  const desenvolvimento = ambiente === AMBIENTE_DESENVOLVIMENTO;
  const diretivas = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}'${desenvolvimento ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' ${desenvolvimento ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    // A interface possui estilos dinamicos de geometria e progresso. Esta excecao
    // fica restrita a atributos; blocos <style> continuam exigindo nonce.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // Uploads diretos usam URLs HTTPS assinadas e de curta duracao emitidas pelo backend.
    "connect-src 'self' https: wss:",
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'"
  ];

  if (!desenvolvimento) diretivas.push('upgrade-insecure-requests');
  return diretivas.join('; ');
}

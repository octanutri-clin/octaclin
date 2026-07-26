function baseBackend(): string {
  const base = process.env.OCTACLIN_BACKEND_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim() || 'http://localhost:3000';
  return base.replace(/\/$/, '');
}

export function urlCallbackGoogleAgenda(): string {
  return `${baseBackend()}/agenda/google/callback`;
}

export function urlWebhookGoogleAgenda(): string {
  return `${baseBackend()}/agenda/google/notificacoes`;
}

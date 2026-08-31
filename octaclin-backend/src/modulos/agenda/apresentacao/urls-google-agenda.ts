import { origemPublicaConfigurada } from '../../../infraestrutura/seguranca/seguranca-integracoes-externas';

function baseBackend(): string {
  return origemPublicaConfigurada(
    process.env.OCTACLIN_BACKEND_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim(),
    'URL publica do backend',
    'http://localhost:3000'
  );
}

export function urlCallbackGoogleAgenda(): string {
  return `${baseBackend()}/agenda/google/callback`;
}

export function urlWebhookGoogleAgenda(): string {
  return `${baseBackend()}/agenda/google/notificacoes`;
}

export function urlInicioGoogleAgenda(ticket: string): string {
  const url = new URL('/agenda/google/iniciar', `${baseBackend()}/`);
  url.searchParams.set('ticket', ticket);
  return url.toString();
}

export function urlRetornoWebGoogleAgenda(): string {
  const baseWeb = origemPublicaConfigurada(process.env.OCTACLIN_WEB_URL, 'URL publica da web', 'http://localhost:3001');
  return `${baseWeb}/agenda?google=conectado`;
}

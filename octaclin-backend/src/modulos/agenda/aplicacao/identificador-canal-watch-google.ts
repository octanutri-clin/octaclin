import { randomUUID } from 'crypto';

const PREFIXO_CANAL_WATCH_GOOGLE = 'octaclin-gcal';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const PADRAO_CANAL_WATCH_GOOGLE = new RegExp(
  `^${PREFIXO_CANAL_WATCH_GOOGLE}-(?:(${UUID})-(${UUID}))$|^${PREFIXO_CANAL_WATCH_GOOGLE}:(${UUID}):(${UUID})$`,
  'i'
);

export function gerarIdentificadorCanalWatchGoogle(tenantId: string): string {
  return `${PREFIXO_CANAL_WATCH_GOOGLE}-${tenantId}-${randomUUID()}`;
}

export function extrairTenantIdDoCanalWatchGoogle(canalWatchId: string): string | undefined {
  const correspondencia = PADRAO_CANAL_WATCH_GOOGLE.exec(canalWatchId);
  return correspondencia?.[1] ?? correspondencia?.[3];
}

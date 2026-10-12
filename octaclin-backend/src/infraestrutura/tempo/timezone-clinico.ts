import type { EntityManager } from 'typeorm';

const TIMEZONE_CLINICO_PADRAO = 'America/Sao_Paulo';

/**
 * Timezone da clinica, hoje derivado da mesma variavel usada pela
 * integracao com o Google Calendar. Extraido de `ServicoDashboardClinico`
 * (Fase 264.4) para ser compartilhado por qualquer calculo de "hoje" que
 * precise da mesma nocao de dia civil da clinica -- ver
 * `docs/history/phases/PLANO_FASE_273.md`, secao 5.
 */
export function obterTimezoneClinico(valor = process.env.GOOGLE_CALENDAR_TIMEZONE): string {
  const configurado = valor?.trim() || TIMEZONE_CLINICO_PADRAO;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: configurado }).format();
    return configurado;
  } catch {
    return TIMEZONE_CLINICO_PADRAO;
  }
}

/** Server-owned account configuration, scoped by the verified tenant; no browser input. */
export async function obterTimezoneClinicoDoTenant(m: EntityManager, tenantId: string): Promise<string> {
  const [config] = await m.query(`select valor->>'timezone' as timezone from tenant_configuracoes
    where tenant_id=$1 and chave='conta_cliente' for share`, [tenantId]);
  const configurado = typeof config?.timezone === 'string' && config.timezone.trim()
    ? config.timezone : undefined;
  return obterTimezoneClinico(configurado);
}

/** Data corrente (YYYY-MM-DD) no timezone informado, para comparar com colunas `date`. */
export function dataIsoNoTimezoneClinico(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
}

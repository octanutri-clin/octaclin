const TIMEZONE_CLINICO_PADRAO = 'America/Sao_Paulo';

/**
 * Timezone da clinica, hoje derivado da mesma variavel usada pela
 * integracao com o Google Calendar. Extraido de `ServicoDashboardClinico`
 * (Fase 264.4) para ser compartilhado por qualquer calculo de "hoje" que
 * precise da mesma nocao de dia civil da clinica -- ver
 * `docs/history/phases/PLANO_FASE_273.md`, secao 5.
 */
export function obterTimezoneClinico(): string {
  const configurado = process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() || TIMEZONE_CLINICO_PADRAO;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: configurado }).format();
    return configurado;
  } catch {
    return TIMEZONE_CLINICO_PADRAO;
  }
}

/** Data corrente (YYYY-MM-DD) no timezone informado, para comparar com colunas `date`. */
export function dataIsoNoTimezoneClinico(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
}

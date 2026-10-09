import { CronExpressionParser } from 'cron-parser';
import type { ModoEntregaNotificacao } from './politica-notificacoes';

const EXPRESSAO_RESUMO_DIARIO = '0 9 * * *';
const EXPRESSAO_RESUMO_SEMANAL = '0 9 * * 1';
const COMPRIMENTO_MAXIMO_TIMEZONE = 80;

export function validarTimezoneNotificacao(timezone: string): string {
  const normalizado = timezone.trim();
  if (!normalizado || normalizado.length > COMPRIMENTO_MAXIMO_TIMEZONE) {
    throw new RangeError('Fuso horario invalido.');
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: normalizado }).format(new Date(0));
  } catch {
    throw new RangeError('Fuso horario invalido.');
  }
  return normalizado;
}

/** Retorna o primeiro vencimento estritamente posterior ao evento no fuso escolhido. */
export function proximoResumoNotificacao(
  modo: ModoEntregaNotificacao,
  eventoEm: Date,
  timezone: string
): Date {
  if (modo !== 'diario' && modo !== 'semanal') {
    throw new RangeError('Somente preferencias de digest possuem vencimento.');
  }
  if (!Number.isFinite(eventoEm.getTime())) throw new RangeError('Instante do evento invalido.');

  const timezoneValidado = validarTimezoneNotificacao(timezone);
  const expressao = modo === 'diario' ? EXPRESSAO_RESUMO_DIARIO : EXPRESSAO_RESUMO_SEMANAL;
  return CronExpressionParser.parse(expressao, {
    currentDate: eventoEm,
    tz: timezoneValidado
  }).next().toDate();
}

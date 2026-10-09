/**
 * Mediana arredondada dos últimos três intervalos entre até quatro consultas.
 * A lista pode estar em qualquer ordem; intervalos são dias civis no fuso dado.
 */
export function medianaIntervalosConsultaDias(consultas: readonly Date[], timezone = 'America/Sao_Paulo'): number | null {
  const recentes = consultas
    .filter((consulta) => Number.isFinite(consulta.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())
    .slice(0, 4);
  if (recentes.length < 2) return null;

  const dias = recentes.map((consulta) => Date.parse(`${dataCivilConsulta(consulta, timezone)}T00:00:00Z`) / 86_400_000);
  const intervalos = dias.slice(0, 3)
    .map((dia, indice) => dia - dias[indice + 1])
    .filter((intervalo) => intervalo > 0)
    .sort((a, b) => a - b);
  if (!intervalos.length) return null;

  const meio = Math.floor(intervalos.length / 2);
  return Math.round(intervalos.length % 2
    ? intervalos[meio]
    : (intervalos[meio - 1] + intervalos[meio]) / 2);
}

export function dataCivilConsulta(data: Date, timezone = 'America/Sao_Paulo'): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(data);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((item) => item.type === tipo)?.value ?? '0';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

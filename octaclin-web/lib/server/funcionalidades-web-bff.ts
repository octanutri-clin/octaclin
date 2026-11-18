/**
 * Funcionalidades da web que só aparecem com opt-in explícito do servidor web (FOOD06 P3, decisão Q-F de 2026-11-17).
 *
 * `OCTACLIN_WEB_RESTRICOES_CLINICAS` liga as telas de restrições na web. Só o valor literal `true` liga; ausente ou
 * qualquer outro valor mantém desligado. Ligar a web **não** liga o backend: a flag `restricoes.clinicas` do tenant
 * continua sendo a fronteira, e a ativação segue bloqueada por ATV-1 a ATV-9. Lida só no servidor; nunca embarcada
 * no bundle (não usa o prefixo `NEXT_PUBLIC_`).
 */
export function restricoesClinicasHabilitadasNaWeb(ambiente: NodeJS.ProcessEnv = process.env): boolean {
  return ambiente.OCTACLIN_WEB_RESTRICOES_CLINICAS === "true";
}

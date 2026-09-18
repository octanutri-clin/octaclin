const DATA_CAMPO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Converte a data do input sem empurra-la para 23:59:59 UTC. Preservar o
 * horario atual faz a opcao maxima exibida (hoje + 90 dias) continuar dentro
 * do limite exato de 90 dias validado pelo backend.
 */
export function converterDataOverrideParaIso(valor: string, agora = new Date()): string {
  const partes = DATA_CAMPO.exec(valor);
  if (!partes) throw new Error('Data de expiracao invalida.');

  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  const dataValidacao = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    dataValidacao.getUTCFullYear() !== ano ||
    dataValidacao.getUTCMonth() !== mes - 1 ||
    dataValidacao.getUTCDate() !== dia
  ) {
    throw new Error('Data de expiracao invalida.');
  }

  const expiraEm = new Date(agora);
  expiraEm.setUTCFullYear(ano, mes - 1, dia);
  return expiraEm.toISOString();
}

/** Datas civis estritas; nenhuma referência clínica ou política é ativada aqui. */
const DIA_MS = 86_400_000;
export function instanteCivil(valor: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith('0000')) throw new Error('data_civil_invalida');
  const instante = Date.parse(`${valor}T00:00:00.000Z`);
  if (!Number.isFinite(instante) || new Date(instante).toISOString().slice(0, 10) !== valor) throw new Error('data_civil_invalida');
  return instante;
}
export function idadePediatrica(nascimento: string, avaliacao: string) {
  const dias = (instanteCivil(avaliacao) - instanteCivil(nascimento)) / DIA_MS;
  if (dias < 0) throw new Error('avaliacao_anterior_ao_nascimento');
  const anosCompletos = Number(avaliacao.slice(0, 4)) - Number(nascimento.slice(0, 4)) - (avaliacao.slice(5) < nascimento.slice(5) ? 1 : 0);
  return { dias, mesesEstatisticos: dias / 30.4375, anosCompletos };
}
/** Convenção técnica explícita: limita o dia ao último dia do mês de destino. */
export function somarMesesCivis(data: string, meses: number): string {
  instanteCivil(data);
  if (!Number.isSafeInteger(meses) || Math.abs(meses) > 1440) throw new Error('intervalo_civil_invalido');
  const base = new Date(`${data}T00:00:00.000Z`);
  const dia = base.getUTCDate();
  base.setUTCDate(1);
  base.setUTCMonth(base.getUTCMonth() + meses);
  const ultimo = new Date(base.getTime());
  ultimo.setUTCMonth(ultimo.getUTCMonth() + 1);
  ultimo.setUTCDate(0);
  base.setUTCDate(Math.min(dia, ultimo.getUTCDate()));
  const resultado = base.toISOString().slice(0, 10);
  instanteCivil(resultado);
  return resultado;
}

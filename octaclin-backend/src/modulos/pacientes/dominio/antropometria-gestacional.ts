import { ContextoGestacional, ReferenciaGestacional } from './contexto-gestacional';
import { ALGORITHM_VERSION_GESTACIONAL, SOURCE_ID_GESTACIONAL, faixaGestacional, GrupoImcGestacional } from './referencia-gestacional-ms';
export interface ResultadoGestacional {
  source_id: string; algorithm_version: string;
  condicao: 'gestante'|'nao_gestante'|'nao_informada'; origemCondicao: 'confirmada'|'perfil_legado';
  gestacaoId?: string; referenciaNumero?: number; referencia?: ReferenciaGestacional; contexto?: ContextoGestacional;
  imcReferencia?: number; grupo?: GrupoImcGestacional; ganhoKg?: number; semanaCurva?: number;
  faixa?: { minimo: number; maximo: number }; classificacao?: 'abaixo'|'dentro'|'acima'; motivos: string[];
  unidades: { peso: 'kg'; altura: 'cm' }; precisao: { peso?: string; pesoReferencia?: string; alturaReferencia?: string };
}
type Fracao = { n: bigint; d: bigint };
/** Decimal recebido, inclusive notacao cientifica, sem tolerancia arbitraria. */
function fracao(v: number): Fracao {
  const [coef,expoente] = Math.abs(v).toString().toLowerCase().split('e');
  const partes = coef.split('.');
  const casas = (partes[1]?.length ?? 0)-Number(expoente ?? 0);
  const n = BigInt(partes.join(''))*(v < 0 ? -1n : 1n);
  return casas >= 0 ? { n,d: 10n**BigInt(casas) } : { n: n*10n**BigInt(-casas),d: 1n };
}
function comparar(a: Fracao,b: Fracao) { const delta = a.n*b.d-b.n*a.d; return delta < 0n ? -1 : delta > 0n ? 1 : 0; }
function valido(n: number|undefined,min: number,max: number): n is number { return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max; }
export function calcularAntropometriaGestacional(entrada: {
  condicao: ResultadoGestacional['condicao']; origemCondicao: ResultadoGestacional['origemCondicao'];
  idadeAnos?: number; pesoKg?: number; contexto?: ContextoGestacional; referencia?: ReferenciaGestacional;
}): ResultadoGestacional {
  const { contexto: c = {},referencia: r = {} } = entrada;
  const out: ResultadoGestacional = { source_id: SOURCE_ID_GESTACIONAL,algorithm_version: ALGORITHM_VERSION_GESTACIONAL,condicao: entrada.condicao,origemCondicao: entrada.origemCondicao,
    gestacaoId: c.gestacaoId,referenciaNumero: c.referenciaNumero,contexto: { ...c },referencia: { ...r },motivos: [],unidades: { peso: 'kg',altura: 'cm' },precisao: { peso: entrada.pesoKg?.toString(),pesoReferencia: r.pesoKg?.toString(),alturaReferencia: r.alturaCm?.toString() } };
  const motivos = out.motivos;
  if (entrada.condicao !== 'gestante') {motivos.push('condicao_nao_gestante_ou_nao_informada');return out;}
  if (!c.gestacaoId || !c.referenciaNumero) motivos.push('gestacao_sem_vinculo');
  if (entrada.idadeAnos === undefined) motivos.push('idade_nao_informada');
  else if (entrada.idadeAnos < 18) motivos.push('referencia_nao_validada_para_adolescente');
  if (c.tipo !== 'unica') motivos.push(c.tipo === 'multipla' ? 'referencia_nao_validada_para_gestacao_multipla' : 'tipo_gestacao_nao_informado');
  if (c.risco !== 'habitual') motivos.push(c.risco === 'alto' ? 'referencia_nao_validada_para_alto_risco' : 'risco_nao_informado');
  if (!c.origemIdadeGestacional || c.origemIdadeGestacional === 'nao_informada') motivos.push('origem_idade_gestacional_nao_informada');
  if (c.idadeGestacionalInconsistente) motivos.push('idade_gestacional_inconsistente');
  if (!Number.isInteger(c.semanas) || !valido(c.semanas,0,45) || !Number.isInteger(c.dias ?? 0) || !valido(c.dias ?? 0,0,6)) motivos.push('idade_gestacional_nao_informada_ou_invalida');
  else {out.semanaCurva = c.semanas!+((c.dias ?? 0) >= 4 ? 1 : 0);if (out.semanaCurva < 10 || out.semanaCurva > 40) motivos.push('semana_fora_da_referencia');}
  if (!r.origem) motivos.push('origem_peso_referencia_nao_informada');
  if (r.origem === 'peso_habitual_informado' && !r.pesoHabitualAnteriorConfirmado) motivos.push('peso_habitual_anterior_nao_confirmado');
  if (r.origem === 'inicio_gestacao_medido' && (!Number.isInteger(r.semanasMedida) || !valido(r.semanasMedida,0,8) || !Number.isInteger(r.diasMedida ?? 0) || !valido(r.diasMedida ?? 0,0,6) || r.semanasMedida! * 7+(r.diasMedida ?? 0) > 56)) motivos.push('medida_substituta_nao_elegivel_ate_8s0d');
  if (!valido(r.pesoKg,1,500) || !valido(r.alturaCm,30,250)) motivos.push('referencia_peso_altura_incompleta_ou_invalida');
  else {
    const p = fracao(r.pesoKg),h = fracao(r.alturaCm);
    const imc = { n: p.n*10000n*h.d*h.d,d: p.d*h.n*h.n };
    out.imcReferencia = Number(imc.n)/Number(imc.d);
    if (comparar(imc,fracao(8)) < 0 || comparar(imc,fracao(100)) > 0) motivos.push('referencia_fora_plausibilidade_tecnica');
    else out.grupo = comparar(imc,fracao(18.5)) < 0 ? 'baixo_peso' : comparar(imc,fracao(25)) < 0 ? 'eutrofia' : comparar(imc,fracao(30)) < 0 ? 'sobrepeso' : 'obesidade';
  }
  if (!valido(entrada.pesoKg,1,500)) motivos.push('peso_avaliacao_ausente_ou_invalido');
  if (valido(entrada.pesoKg,1,500) && valido(r.pesoKg,1,500)) {
    const peso = fracao(entrada.pesoKg),ref = fracao(r.pesoKg);
    const ganho = { n: peso.n*ref.d-ref.n*peso.d,d: peso.d*ref.d };
    out.ganhoKg = Number(ganho.n)/Number(ganho.d);
    if (!motivos.length && out.grupo && out.semanaCurva !== undefined) {
      out.faixa = faixaGestacional(out.semanaCurva,out.grupo);
      if (out.faixa) out.classificacao = comparar(ganho,fracao(out.faixa.minimo)) < 0 ? 'abaixo' : comparar(ganho,fracao(out.faixa.maximo)) > 0 ? 'acima' : 'dentro';
    }
  }
  return out;
}

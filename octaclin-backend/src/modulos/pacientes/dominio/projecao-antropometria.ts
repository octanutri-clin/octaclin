import { ResultadoAntropometrico, MedidasAntropometricas, SITIOS_DOBRA, SITIOS_CIRCUNFERENCIA } from './antropometria';
import { projetarPediatrico } from './antropometria-pediatrica';
import type { ResultadoGestacional } from './antropometria-gestacional';
function objeto(v: unknown): Record<string,unknown> | undefined { return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string,unknown> : undefined; }
function selecionar(v: unknown, campos: readonly string[]) {
  const o = objeto(v); return o ? Object.fromEntries(campos.filter(k => Object.hasOwn(o,k)).map(k => [k,o[k]])) : undefined;
}
function numeros(v: unknown, campos: readonly string[]) {
  const o = objeto(v); return o ? Object.fromEntries(campos.filter(k => typeof o[k] === 'number' && Number.isFinite(o[k])).map(k => [k,o[k]])) : undefined;
}
export function projetarMedidasAntropometricas(v: unknown): MedidasAntropometricas {
  const m = objeto(v) ?? {};
  return { pesoKg: typeof m.pesoKg === 'number' && Number.isFinite(m.pesoKg) ? m.pesoKg : undefined,alturaCm: typeof m.alturaCm === 'number' && Number.isFinite(m.alturaCm) ? m.alturaCm : undefined,circunferencias: numeros(m.circunferencias,SITIOS_CIRCUNFERENCIA),dobras: numeros(m.dobras,SITIOS_DOBRA) };
}
export function projetarResultadoAntropometrico(v: unknown): ResultadoAntropometrico {
  const r = objeto(v);
  if (!r) return { protocoloAplicado: 'nenhum',avisos: ['registro_ilegivel'] };
  const g = selecionar(r.gestacional,['source_id','algorithm_version','condicao','origemCondicao','gestacaoId','referenciaNumero','imcReferencia','grupo','ganhoKg','semanaCurva','classificacao','motivos']);
  if (g) {
    const original = objeto(r.gestacional)!;
    g.referencia = selecionar(original.referencia,['pesoKg','alturaCm','origem','dataPeso','semanasMedida','diasMedida','pesoHabitualAnteriorConfirmado']);
    g.contexto = selecionar(original.contexto,['gestacaoId','referenciaNumero','semanas','dias','tipo','risco','origemIdadeGestacional','dataFonteIdadeGestacional','idadeGestacionalInconsistente']);
    g.faixa = selecionar(original.faixa,['minimo','maximo']);
    g.unidades = selecionar(original.unidades,['peso','altura']);
    g.precisao = selecionar(original.precisao,['peso','pesoReferencia','alturaReferencia']);
  }
  const basico = selecionar(r,['protocoloAplicado','imc','classificacaoImc','rcq','classificacaoRcq','circunferenciaCinturaCm','classificacaoCircunferenciaCintura','percentualGordura','massaGordaKg','massaMagraKg','formulaAplicada'])!;
  // Tipagem só após projeção executável em todos os níveis conhecidos.
  return { ...basico, protocoloAplicado: (basico.protocoloAplicado ?? 'nenhum') as ResultadoAntropometrico['protocoloAplicado'],avisos: Array.isArray(r.avisos) ? r.avisos.filter((a): a is string => typeof a === 'string') : ['registro_ilegivel'],gestacional: g as unknown as ResultadoGestacional | undefined,pediatrico: projetarPediatrico(r.pediatrico) };
}

/** Candidato computacional isolado. Não importado por serviços/controladores; sem dados científicos incorporados. */
import { escoreLms, inversaLms, ParametrosLms, percentilNormal, PercentilNormal } from './calculo-crescimento';
import { IndicadorPediatrico, INDICADORES_PEDIATRICOS } from './antropometria-pediatrica';
interface ReferenciaSintetica extends ParametrosLms { id: string; minimo: number; maximo: number; caudas: boolean }
interface EntradaCandidata { meses: number; pesoKg?: number; alturaCm?: number; tecnica: 'deitado'|'em_pe'|'nao_informada'; edema: 'sim'|'nao'|'desconhecido' }
interface ResultadoCandidato { estado: 'experimental'|'bloqueado'|'reconferir'; motivo?: string; referencia?: string; zBruto?: number; percentil?: PercentilNormal }
export function normalizarMedidaCandidata(originalCm: number, tecnica: EntradaCandidata['tecnica'], meses: number) {
  if (!Number.isFinite(originalCm) || originalCm <= 0 || !Number.isFinite(meses) || meses < 0) throw new Error('medida_invalida');
  if (tecnica === 'nao_informada') throw new Error('tecnica_nao_informada');
  if (tecnica === 'em_pe' && meses < 9) throw new Error('tecnica_exige_reconferencia');
  const ajusteCm = tecnica === 'em_pe' && meses < 24 ? 0.7 : tecnica === 'deitado' && meses >= 24 ? -0.7 : 0;
  if (originalCm + ajusteCm <= 0) throw new Error('medida_invalida');
  return { originalCm, usadoCm: originalCm + ajusteCm, ajusteCm };
}
export function escoreComCaudas(valor: number, p: ParametrosLms, ajustar: boolean): number {
  const z = escoreLms(valor,p);
  if (!ajustar || Math.abs(z) <= 3) return z;
  const sinal = z > 0 ? 1 : -1;
  const sd3 = inversaLms(sinal*3,p), sd2 = inversaLms(sinal*2,p);
  const delta = Math.abs(sd3-sd2);
  if (!(delta > 0)) throw new Error('cauda_invalida');
  return sinal*3 + (valor-sd3)/delta;
}
export function calcularIndicadoresCandidatos(e: EntradaCandidata, referencias: Partial<Record<IndicadorPediatrico,ReferenciaSintetica>>): Record<IndicadorPediatrico,ResultadoCandidato> {
  let altura: number | undefined, motivoAltura: string | undefined;
  if (e.alturaCm !== undefined) {
    try { altura = normalizarMedidaCandidata(e.alturaCm,e.tecnica,e.meses).usadoCm; }
    catch (erro) { motivoAltura = erro instanceof Error ? erro.message : 'medida_invalida'; }
  }
  const resultado = {} as Record<IndicadorPediatrico,ResultadoCandidato>;
  for (const indicador of INDICADORES_PEDIATRICOS) {
    const bloquear = (motivo: string) => { resultado[indicador] = { estado: 'bloqueado', motivo }; };
    const dependePeso = indicador !== 'estatura_idade', dependeAltura = indicador !== 'peso_idade';
    if (dependePeso && e.edema !== 'nao') { bloquear(e.edema === 'sim' ? 'edema_presente' : 'edema_nao_avaliado'); continue; }
    if (dependeAltura && motivoAltura) { bloquear(motivoAltura); continue; }
    if ((dependePeso && e.pesoKg === undefined) || (dependeAltura && altura === undefined)) { bloquear('medida_ausente'); continue; }
    const r = referencias[indicador];
    if (!r) { bloquear('referencia_ausente'); continue; }
    const x = indicador === 'peso_estatura' ? altura! : e.meses;
    if (!Number.isFinite(x) || x < r.minimo || x > r.maximo) { bloquear('fora_da_referencia'); continue; }
    const valor = indicador === 'imc_idade' ? e.pesoKg! / (altura!/100)**2 : indicador === 'estatura_idade' ? altura! : e.pesoKg!;
    try {
      const z = escoreComCaudas(valor,r,r.caudas);
      const minimo = indicador === 'estatura_idade' || indicador === 'peso_idade' ? -6 : -5;
      const maximo = indicador === 'estatura_idade' ? 6 : 5;
      resultado[indicador] = z < minimo || z > maximo ? { estado: 'reconferir', motivo: 'flag_estatistica', referencia: r.id, zBruto: z } : { estado: 'experimental', referencia: r.id, zBruto: z, percentil: percentilNormal(z) };
    } catch { bloquear('dominio_matematico_invalido'); }
  }
  return resultado;
}

/** Tabela candidata MS2011 da ficha REV5. Não consumida pelo backend assistencial. */
export function classificacaoSisvanCandidata(indicador: IndicadorPediatrico, z: number, faixa: 'menor_de_5'|'5_a_19'): string | undefined {
  if (!Number.isFinite(z)) return undefined;
  if (indicador === 'peso_estatura' && faixa !== 'menor_de_5') return undefined;
  if (indicador === 'estatura_idade') return z < -3 ? 'muito_baixa_estatura_para_idade' : z < -2 ? 'baixa_estatura_para_idade' : 'estatura_adequada_para_idade';
  if (indicador === 'peso_idade') return z < -3 ? 'muito_baixo_peso_para_idade' : z < -2 ? 'baixo_peso_para_idade' : z <= 2 ? 'peso_adequado_para_idade' : 'peso_elevado_para_idade';
  if (z < -3) return 'magreza_acentuada';
  if (z < -2) return 'magreza';
  if (z <= 1) return 'eutrofia';
  if (faixa === 'menor_de_5') return z <= 2 ? 'risco_de_sobrepeso' : z <= 3 ? 'sobrepeso' : 'obesidade';
  return z <= 2 ? 'sobrepeso' : z <= 3 ? 'obesidade' : 'obesidade_grave';
}

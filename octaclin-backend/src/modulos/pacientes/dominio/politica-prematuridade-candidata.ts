/** Proposta CL07 isolada: não importada pelo caminho assistencial. Não comprova elegibilidade. */
import { idadePediatrica, instanteCivil, somarMesesCivis } from './idade-pediatrica';
export function politicaPrematuridadeCandidata(nascimento: string, avaliacao: string, semanas: number, dias: number) {
  if (!Number.isInteger(semanas) || !Number.isInteger(dias) || semanas < 20 || semanas > 45 || dias < 0 || dias > 6) throw new Error('idade_gestacional_invalida');
  const cronologica = idadePediatrica(nascimento,avaliacao).dias;
  const ig = semanas*7+dias, diferenca = 280-ig;
  const idadeCorrigidaDias = cronologica-diferenca;
  const idadePosMenstrualDias = ig+cronologica;
  const prazoMesesCorrigidos = ig < 224 ? 36 : 24;
  const corrigidaCivil = new Date(instanteCivil(avaliacao)-diferenca*86400000).toISOString().slice(0,10);
  const limite = somarMesesCivis(nascimento,prazoMesesCorrigidos);
  const elegibilidadeEtariaCandidata = ig >= 182 && ig < 259 && cronologica > 2;
  const referenciaProposta = !elegibilidadeEtariaCandidata || idadePosMenstrualDias < 189 ? 'sem_classificacao' : idadePosMenstrualDias <= 448 ? 'intergrowth' : idadeCorrigidaDias < 0 ? 'sem_classificacao' : corrigidaCivil <= limite ? 'oms_corrigida' : 'oms_cronologica';
  return { versao: 'CL07-proposta-rev5-v1', estado: 'proposta_nao_ratificada' as const, idadeCronologicaDias: cronologica, idadePosMenstrualDias, idadeCorrigidaDias, prazoMesesCorrigidos, referenciaProposta, limiteCorrigidoCivil: limite };
}

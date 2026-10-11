/** CL07 REV9 ratificada, implementação isolada: não importada pelo caminho assistencial. Não comprova elegibilidade. */
import { idadePediatrica, instanteCivil, somarMesesCivis } from './idade-pediatrica';
export function politicaPrematuridadeCandidata(nascimento: string, avaliacao: string, semanas: number, dias: number) {
  if (!Number.isInteger(semanas) || !Number.isInteger(dias) || semanas < 20 || semanas > 45 || dias < 0 || dias > 6) throw new Error('idade_gestacional_invalida');
  const cronologica = idadePediatrica(nascimento,avaliacao).dias;
  const ig = semanas*7+dias, diferenca = 280-ig;
  const idadeCorrigidaDias = cronologica-diferenca;
  const idadePosMenstrualDias = ig+cronologica;
  const prazoMesesCorrigidos = ig < 224 ? 36 : 24;
  const dpp = new Date(instanteCivil(nascimento)+diferenca*86400000).toISOString().slice(0,10);
  const limite = somarMesesCivis(dpp,prazoMesesCorrigidos);
  const elegibilidadeEtariaCandidata = ig >= 182 && ig < 259 && cronologica > 2;
  const referenciaProposta = ig >= 259 || cronologica <= 2 || idadePosMenstrualDias < 189 ? 'sem_classificacao' : idadePosMenstrualDias <= 448 ? elegibilidadeEtariaCandidata ? 'intergrowth' : 'sem_classificacao' : idadeCorrigidaDias < 0 ? 'sem_classificacao' : avaliacao <= limite ? 'oms_corrigida' : 'oms_cronologica';
  return { versao: 'CL07-ratificada-rev9-v1', estado: 'validacao_computacional_pendente' as const, idadeCronologicaDias: cronologica, idadePosMenstrualDias, idadeCorrigidaDias, prazoMesesCorrigidos, referenciaProposta, limiteCorrigidoCivil: limite };
}

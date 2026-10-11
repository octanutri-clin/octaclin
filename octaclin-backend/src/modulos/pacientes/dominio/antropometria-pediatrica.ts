import { idadePediatrica, instanteCivil } from './idade-pediatrica';

export const INDICADORES_PEDIATRICOS = ['imc_idade', 'estatura_idade', 'peso_idade', 'peso_estatura'] as const;
export type IndicadorPediatrico = typeof INDICADORES_PEDIATRICOS[number];
export interface ContextoPediatrico {
  confirmado: true;
  nascimento?: string;
  sexoCurva: 'masculino' | 'feminino' | 'nao_informado';
  tecnica: 'deitado' | 'em_pe' | 'nao_informada';
  edema: 'sim' | 'nao' | 'desconhecido';
  nascimentoTipo: 'a_termo' | 'prematuro' | 'nao_informado';
  semanasNascimento?: number;
  diasNascimento?: number;
  origemGestacional?: 'documentada' | 'informada' | 'nao_informada';
  tipoMedida: 'nascimento' | 'pos_natal' | 'nao_informado';
  gestacaoUnica?: 'sim' | 'nao' | 'desconhecido';
  malformacaoImportante?: 'sim' | 'nao' | 'desconhecido';
  restricaoCrescimentoFetal?: 'sim' | 'nao' | 'desconhecido';
  morbidadePosNatalGrave?: 'sim' | 'nao' | 'desconhecido';
  origemElegibilidade?: 'documentada' | 'informada' | 'nao_informada';
}
export interface SnapshotPediatrico {
  versao: 'pediatrico-medidas-v1' | 'pediatrico-medidas-v2';
  protocoloG02?: 'g02-rev9-3dd197df';
  estado: 'protocolos_bloqueados';
  avaliadaEm: string;
  contexto: ContextoPediatrico;
  idade?: { dias: number; mesesEstatisticos: number; anosCompletos: number };
  idadePosMenstrualDias?: number;
  idadeCorrigidaDias?: number;
  medidas: { pesoKg?: number; alturaCm?: number };
  indicadores: { indicador: IndicadorPediatrico; estado: 'bloqueado'; motivo: 'protocolo_nao_ratificado' | 'validacao_computacional_e_direitos_pendentes' | 'medida_ausente' }[];
}
const falhar = () => { throw new Error('contexto_pediatrico_invalido'); };
function contextoPermitido(c: ContextoPediatrico): ContextoPediatrico {
  if (!c || c.confirmado !== true || !['masculino', 'feminino', 'nao_informado'].includes(c.sexoCurva) || !['deitado', 'em_pe', 'nao_informada'].includes(c.tecnica) || !['sim', 'nao', 'desconhecido'].includes(c.edema) || !['a_termo', 'prematuro', 'nao_informado'].includes(c.nascimentoTipo) || !['nascimento', 'pos_natal', 'nao_informado'].includes(c.tipoMedida)) falhar();
  if (c.nascimento !== undefined) { if (typeof c.nascimento !== 'string') falhar(); instanteCivil(c.nascimento); }
  if (c.origemGestacional !== undefined && !['documentada', 'informada', 'nao_informada'].includes(c.origemGestacional)) falhar();
  const temIg = c.semanasNascimento !== undefined || c.diasNascimento !== undefined;
  if (temIg && (!Number.isInteger(c.semanasNascimento) || c.semanasNascimento! < 20 || c.semanasNascimento! > 45 || !Number.isInteger(c.diasNascimento) || c.diasNascimento! < 0 || c.diasNascimento! > 6 || !['documentada', 'informada', 'nao_informada'].includes(c.origemGestacional!))) falhar();
  for (const campo of ['gestacaoUnica','malformacaoImportante','restricaoCrescimentoFetal','morbidadePosNatalGrave'] as const) if (c[campo] !== undefined && !['sim','nao','desconhecido'].includes(c[campo]!)) falhar();
  if (c.origemElegibilidade !== undefined && !['documentada','informada','nao_informada'].includes(c.origemElegibilidade)) falhar();
  return { gestacaoUnica: c.gestacaoUnica, malformacaoImportante: c.malformacaoImportante, restricaoCrescimentoFetal: c.restricaoCrescimentoFetal, morbidadePosNatalGrave: c.morbidadePosNatalGrave, origemElegibilidade: c.origemElegibilidade, confirmado: true, nascimento: c.nascimento, sexoCurva: c.sexoCurva, tecnica: c.tecnica, edema: c.edema, nascimentoTipo: c.nascimentoTipo, semanasNascimento: c.semanasNascimento, diasNascimento: c.diasNascimento, origemGestacional: c.origemGestacional, tipoMedida: c.tipoMedida };
}
/** Registro factual; não há flag, provider ou parâmetro que habilite classificação. */
export function registrarContextoPediatrico(contexto: ContextoPediatrico, avaliadaEm: string, medidas: { pesoKg?: number; alturaCm?: number }): SnapshotPediatrico {
  const c = contextoPermitido(contexto);
  instanteCivil(avaliadaEm);
  const idade = c.nascimento ? idadePediatrica(c.nascimento, avaliadaEm) : undefined;
  if (idade && idade.anosCompletos >= 20) falhar();
  for (const [valor, maximo] of ([[medidas.pesoKg, 500], [medidas.alturaCm, 250]] as const)) if (valor !== undefined && (!Number.isFinite(valor) || valor <= 0 || valor > maximo)) falhar();
  const ig = c.semanasNascimento === undefined ? undefined : c.semanasNascimento * 7 + c.diasNascimento!;
  return {
    versao: 'pediatrico-medidas-v2', protocoloG02: 'g02-rev9-3dd197df', estado: 'protocolos_bloqueados', avaliadaEm, contexto: c, idade,
    idadePosMenstrualDias: ig === undefined || !idade ? undefined : idade.dias + ig,
    idadeCorrigidaDias: ig === undefined || !idade ? undefined : idade.dias - (280 - ig),
    medidas: { pesoKg: medidas.pesoKg, alturaCm: medidas.alturaCm },
    indicadores: INDICADORES_PEDIATRICOS.map(indicador => ({ indicador, estado: 'bloqueado', motivo: (indicador !== 'peso_idade' && medidas.alturaCm === undefined) || (indicador !== 'estatura_idade' && medidas.pesoKg === undefined) ? 'medida_ausente' : 'validacao_computacional_e_direitos_pendentes' }))
  };
}
/** Allowlist executável: não retorna JSON cifrado cru, campos extras ou protocolos futuros. */
export function projetarPediatrico(valor: unknown): SnapshotPediatrico | undefined {
  if (!valor || typeof valor !== 'object') return undefined;
  const p = valor as SnapshotPediatrico;
  try {
    if (!['pediatrico-medidas-v1','pediatrico-medidas-v2'].includes(p.versao) || p.estado !== 'protocolos_bloqueados' || !p.medidas || !Array.isArray(p.indicadores) || p.indicadores.length !== 4) return undefined;
    if (p.versao === 'pediatrico-medidas-v2' && p.protocoloG02 !== 'g02-rev9-3dd197df') return undefined;
    const motivoProtocolo = p.versao === 'pediatrico-medidas-v1' ? 'protocolo_nao_ratificado' : 'validacao_computacional_e_direitos_pendentes';
    const contexto = contextoPermitido(p.contexto);
    instanteCivil(p.avaliadaEm);
    if (p.idade && ![p.idade.dias, p.idade.mesesEstatisticos, p.idade.anosCompletos].every(Number.isFinite)) return undefined;
    if (p.indicadores.some((i, n) => i.indicador !== INDICADORES_PEDIATRICOS[n] || i.estado !== 'bloqueado' || !['medida_ausente', motivoProtocolo].includes(i.motivo))) return undefined;
    if ([p.idadePosMenstrualDias, p.idadeCorrigidaDias, p.medidas.pesoKg, p.medidas.alturaCm].some(v => v !== undefined && !Number.isFinite(v))) return undefined;
    return { versao: p.versao, ...(p.versao === 'pediatrico-medidas-v2' ? { protocoloG02: p.protocoloG02 } : {}), estado: p.estado, avaliadaEm: p.avaliadaEm, contexto, idade: p.idade ? { dias: p.idade.dias, mesesEstatisticos: p.idade.mesesEstatisticos, anosCompletos: p.idade.anosCompletos } : undefined, idadePosMenstrualDias: p.idadePosMenstrualDias, idadeCorrigidaDias: p.idadeCorrigidaDias, medidas: { pesoKg: p.medidas.pesoKg, alturaCm: p.medidas.alturaCm }, indicadores: p.indicadores.map(i => ({ indicador: i.indicador, estado: i.estado, motivo: i.motivo })) };
  } catch { return undefined; }
}

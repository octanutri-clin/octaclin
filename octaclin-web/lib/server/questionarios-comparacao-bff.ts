import { UUID_QST } from './questionarios-paginacao-bff';

const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const uuid = (v: unknown): v is string => typeof v === 'string' && UUID_QST.test(v);
const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const valorNumerico = (v: unknown) => numero(v) || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)));
const textoOuNull = (v: unknown): v is string | null => v === null || typeof v === 'string';
const tipos = ['texto_longo', 'sim_nao', 'likert', 'linear', 'metrica', 'multipla_escolha', 'upload_midia'] as const;
const motivos = ['snapshot_ausente', 'snapshot_invalido', 'pergunta_ausente', 'definicao_alterada', 'sem_resposta', 'valor_invalido', 'parametros_ausentes', 'nao_numerico', 'anexo'] as const;
type Tipo = typeof tipos[number];
type Motivo = typeof motivos[number];

export function corpoComparacaoQst(v: unknown) {
  if (!objeto(v) || Object.keys(v).some(k => !['pacienteId', 'respostaIds'].includes(k)) || !uuid(v.pacienteId)
    || !Array.isArray(v.respostaIds) || v.respostaIds.length !== 2 || !v.respostaIds.every(uuid)) throw new Error();
  const respostaIds = v.respostaIds.map(id => id.toLowerCase());
  if (new Set(respostaIds).size !== 2) throw new Error();
  return { pacienteId: v.pacienteId.toLowerCase(), respostaIds };
}

function cabecalho(v: unknown) {
  if (!objeto(v) || !uuid(v.respostaId) || !uuid(v.envioId)
    || !(v.finalizadoEm === null || (typeof v.finalizadoEm === 'string' && Number.isFinite(Date.parse(v.finalizadoEm))))
    || !(v.versaoQuestionario === null || (Number.isSafeInteger(v.versaoQuestionario) && Number(v.versaoQuestionario) >= 1))) throw new Error();
  return { respostaId: v.respostaId, envioId: v.envioId, finalizadoEm: v.finalizadoEm as string | null, versaoQuestionario: v.versaoQuestionario as number | null };
}

function valor(v: unknown, tipo: Tipo | null) {
  if (!objeto(v) || !['respondida', 'sem_resposta', 'valor_indisponivel', 'anexo'].includes(String(v.estado))) throw new Error();
  if (v.estado !== 'respondida' && v.valor !== null) throw new Error();
  if (v.estado === 'anexo') {
    if (tipo !== 'upload_midia' || !Number.isInteger(v.quantidadeArquivos) || Number(v.quantidadeArquivos) < 1 || Number(v.quantidadeArquivos) > 10) throw new Error();
    return { estado: 'anexo' as const, valor: null, quantidadeArquivos: Number(v.quantidadeArquivos) };
  }
  if (v.estado === 'respondida') {
    if (tipo === 'upload_midia' || !(typeof v.valor === 'string' || typeof v.valor === 'boolean' || numero(v.valor)
      || (tipo !== null && Array.isArray(v.valor) && v.valor.length <= 1000 && v.valor.every(x => typeof x === 'string')))) throw new Error();
    return { estado: 'respondida' as const, valor: v.valor as string | number | boolean | string[] };
  }
  return { estado: v.estado as 'sem_resposta' | 'valor_indisponivel', valor: null };
}

function item(v: unknown) {
  if (!objeto(v) || !uuid(v.perguntaId) || !textoOuNull(v.enunciadoA) || !textoOuNull(v.enunciadoB)
    || !textoOuNull(v.unidade) || !textoOuNull(v.unidadeA) || !textoOuNull(v.unidadeB)
    || !(v.tipoA === null || tipos.includes(v.tipoA as Tipo)) || !(v.tipoB === null || tipos.includes(v.tipoB as Tipo))
    || typeof v.compativel !== 'boolean' || !(v.motivo === null || motivos.includes(v.motivo as Motivo))
    || !(v.delta === null || numero(v.delta))) throw new Error();
  const tipoA = v.tipoA as Tipo | null, tipoB = v.tipoB as Tipo | null;
  const a = valor(v.a, tipoA), b = valor(v.b, tipoB);
  if (!v.compativel && (v.delta !== null || v.motivo === null)) throw new Error();
  if (v.compativel && (tipoA === null || tipoA !== tipoB)) throw new Error();
  if (v.delta !== null && (!v.compativel || v.motivo !== null || tipoA !== tipoB || !['metrica', 'linear', 'likert'].includes(tipoA ?? '')
    || a.estado !== 'respondida' || b.estado !== 'respondida' || !valorNumerico(a.valor) || !valorNumerico(b.valor))) throw new Error();
  if (v.delta !== null && tipoA === 'metrica' && (!v.unidade?.trim() || v.unidadeA !== v.unidade || v.unidadeB !== v.unidade)) throw new Error();
  return { perguntaId: v.perguntaId, enunciadoA: v.enunciadoA, enunciadoB: v.enunciadoB, tipoA, tipoB,
    unidade: v.unidade, unidadeA: v.unidadeA, unidadeB: v.unidadeB, a, b, compativel: v.compativel,
    motivo: v.motivo as Motivo | null, delta: v.delta as number | null };
}

/** Apenas validação de formato/contexto e allowlist; o cálculo pertence ao backend. */
export function projetarComparacaoQst(v: unknown, questionarioId: string, consulta: ReturnType<typeof corpoComparacaoQst>) {
  if (!objeto(v) || v.questionarioId !== questionarioId || v.pacienteId !== consulta.pacienteId
    || !['cronologica', 'selecao'].includes(String(v.ordem)) || typeof v.timezone !== 'string' || v.timezone.length > 80
    || !Array.isArray(v.itens) || v.itens.length > 2000) throw new Error();
  new Intl.DateTimeFormat('pt-BR', { timeZone: v.timezone });
  const a = cabecalho(v.a), b = cabecalho(v.b);
  if (a.respostaId === b.respostaId || ![a.respostaId, b.respostaId].every(id => consulta.respostaIds.includes(id))) throw new Error();
  if (v.ordem === 'selecao' && (a.respostaId !== consulta.respostaIds[0] || b.respostaId !== consulta.respostaIds[1])) throw new Error();
  const itens = v.itens.map(item);
  if (new Set(itens.map(i => i.perguntaId)).size !== itens.length) throw new Error();
  return { questionarioId, pacienteId: consulta.pacienteId, timezone: v.timezone, ordem: v.ordem as 'cronologica' | 'selecao', a, b, itens };
}

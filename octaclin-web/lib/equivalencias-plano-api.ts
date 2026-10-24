import type { AlternativaEdicao, DocumentoEdicaoPlano } from './edicao-plano';
import { ErroApiPlanoAlimentar } from './plano-alimentar-api';
export type NutrienteEquivalencia = 'energiaKcal' | 'proteinasG' | 'carboidratosG' | 'gordurasG';
export interface PoliticaEquivalencia { passoPorcaoGramas: '1' | '0.1' | '0.01' | '0.001' }
export interface PreferenciasEquivalencia extends PoliticaEquivalencia {
 schemaVersao: 1; unidades: 'gramas' | 'gramas_e_medida_disponivel';
 casasGramas: number; casasNutrientes: number; modoComparacao: 'compacto' | 'detalhado';
}
export interface PreferenciasEquivalenciaResposta { preferencias: PreferenciasEquivalencia; revisao: number }
export type MacrosEquivalencia = Partial<Record<NutrienteEquivalencia, string>>;
export interface FatosEquivalenciaApi {
 descricao: string; preparacao?: string; baseGramas: string; nutrientes: MacrosEquivalencia;
 fonte?: { codigo: string; versao?: string; revisao?: number; hashConteudo?: string };
}
export type ResultadoEquivalenciaApi = { estado: 'indisponivel'; motivo: string; nutriente: NutrienteEquivalencia } | {
 estado: 'calculavel'; nutriente: NutrienteEquivalencia; aplicavel: boolean; motivosAplicacao: string[];
 porcaoMatematica: { numerador: string; denominador: string }; porcaoMatematicaGramas: string;
 porcaoMatematicaAproximada: boolean; porcaoSugeridaGramas: string; porcaoEfetivaGramas: string;
 nutrienteAlvo: string; obtido: string; delta: string; diferencaAbsoluta: string; deltaPercentual: string;
 nutrientesPorcao: MacrosEquivalencia; avisos: string[];
};
export interface ImpactoEquivalenciaApi {
 estado: 'completo' | 'incompleto'; antes: MacrosEquivalencia; depois: MacrosEquivalencia; diferencas: MacrosEquivalencia;
}
export interface MedidaPreviaEquivalenciaApi {
 id: string; revisao: number; nome: string; quantidade: string; aproximada: boolean;
 podeAplicarQuantidade: boolean; gramasAposMedida?: string; quantidadeReferencia: number; pesoReferenciaGramas: number;
}
export interface LinhaPreviaEquivalenciaApi {
 chaveCliente: string; alimento?: FatosEquivalenciaApi; resultado: ResultadoEquivalenciaApi; fingerprint?: string;
 impacto?: ImpactoEquivalenciaApi; comparacaoIndividual?: ImpactoEquivalenciaApi;
 medidas?: { itens: MedidaPreviaEquivalenciaApi[]; total: number; pagina: number; limite: number };
}
export interface PreviaEquivalenciasApi {
 fingerprint: string; rascunhoRevisao: number; nutriente: NutrienteEquivalencia;
 principal: FatosEquivalenciaApi; alternativas: LinhaPreviaEquivalenciaApi[];
}
export interface PedidoPreviaEquivalenciasApi {
 versaoId: string; rascunhoRevisaoEsperada: number; documentoEdicao: DocumentoEdicaoPlano;
 itemChave: string; nutriente: NutrienteEquivalencia; alternativas: AlternativaEdicao[]; politica: PoliticaEquivalencia;
}
export interface EquivalenciaAplicadaApi {
 aplicacaoId: string; estado: 'calculada_revisada' | 'revisao_pendente' | 'desvinculada_manualmente';
 nutriente: NutrienteEquivalencia; politica: PoliticaEquivalencia; algoritmo: 'equivalencia-nutriente-v1';
 porcaoPrincipalGramas: string; porcaoEfetivaGramas: string; fingerprintResolucao: string;
 principal: FatosEquivalenciaApi; alternativa: FatosEquivalenciaApi;
 resultado: Extract<ResultadoEquivalenciaApi, { estado: 'calculavel' }>;
}
export type IntencaoEquivalenciaEdicao = { aplicacaoId: string } | {
 acao: 'calcular' | 'recalcular'; aplicacaoId: string; anteriorAplicacaoId?: string;
 fingerprintEsperado: string; nutriente: NutrienteEquivalencia; politica: PoliticaEquivalencia; porcaoEfetiva: string;
} | { acao: 'desvincular'; aplicacaoId: string; anteriorAplicacaoId: string; fingerprintEsperado: string };
async function ler<T>(r: Response): Promise<T> {
 if (!r.ok) {
  let mensagem = `Não foi possível concluir a operação (HTTP ${r.status}).`;
  try { const erro = await r.json() as { mensagem?: unknown; message?: unknown };
   const texto = erro.mensagem ?? erro.message;
   if (typeof texto === 'string' && texto.length <= 256) mensagem = texto;
  } catch { /* HTML/stack/detalhe técnico não vira mensagem de produto. */ }
  throw new ErroApiPlanoAlimentar(r.status, mensagem);
 }
 return r.json() as Promise<T>;
}
export function preverEquivalenciasPlano(pacienteId: string, planoId: string, pedido: PedidoPreviaEquivalenciasApi, signal?: AbortSignal) {
 return fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/planos-alimentares/${encodeURIComponent(planoId)}/equivalencias/previa`, {
  method: 'POST', cache: 'no-store', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pedido)
 }).then(ler<PreviaEquivalenciasApi>);
}
export function obterPreferenciasEquivalencia(signal?: AbortSignal) {
 return fetch('/api/profissionais/me/preferencias-equivalencia', { cache: 'no-store', signal }).then(ler<PreferenciasEquivalenciaResposta>);
}
export function salvarPreferenciasEquivalencia(pedido: { preferencias: PreferenciasEquivalencia; revisaoEsperada: number }, signal?: AbortSignal) {
 return fetch('/api/profissionais/me/preferencias-equivalencia', {
  method: 'PUT', cache: 'no-store', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pedido)
 }).then(ler<PreferenciasEquivalenciaResposta>);
}

export type FormulaEnergeticaApi =
  | 'mifflin_st_jeor_1990'
  | 'harris_benedict_revisada_1984'
  | 'fao_oms_unu_1985';

export interface NutrientesPor100gApi {
  energiaKcal: number;
  proteinasG: number;
  carboidratosG: number;
  gordurasG: number;
  fibrasG?: number;
  sodioMg?: number;
}

export interface AlimentoComposicaoApi {
  id: string;
  codigoOrigem: string;
  nome: string;
  preparacao?: string;
  nutrientesPor100g?: NutrientesPor100gApi;
  disponivelParaCalculo: boolean;
  fonte?: {
    codigo: string;
    nome: string;
    versao: string;
    baseCodigo?: string;
    licenca?: string;
    urlFonte?: string;
    publicadaEm?: string;
    checksumArquivo?: string;
    esquemaVersao?: string;
    capturadaEm?: string;
  };
}

export interface SubstituicaoPlanoAlimentarEntrada {
  alimentoComposicaoId?: string;
  descricao?: string;
  quantidade: number;
  unidade: string;
  porcaoGramas: number;
  nutrientesPor100g?: NutrientesPor100gApi;
}

export interface ItemPlanoAlimentarEntrada extends SubstituicaoPlanoAlimentarEntrada {
  substituicoes: SubstituicaoPlanoAlimentarEntrada[];
}

export interface RefeicaoPlanoAlimentarEntrada {
  nome: string;
  horarioLocal?: string;
  orientacoes?: string;
  itens: ItemPlanoAlimentarEntrada[];
}

export interface AtualizarRascunhoPlanoAlimentarEntrada {
  avaliacaoAntropometricaId: string;
  formula: FormulaEnergeticaApi;
  fatorAtividade: number;
  ajusteEnergeticoKcal?: number;
  distribuicaoMacros: {
    carboidratosBasisPoints: number;
    proteinasBasisPoints: number;
    gordurasBasisPoints: number;
  };
  possuiCondicaoEspecial: boolean;
  aplicabilidadeFormulaConfirmada: boolean;
  justificativaCondicaoEspecial?: string;
  justificativaDivergenciaClinica?: string;
  objetivos: string;
  observacoes?: string;
  refeicoes: RefeicaoPlanoAlimentarEntrada[];
}

export interface ComposicaoSnapshotApi {
  origem: 'catalogo' | 'manual';
  alimentoComposicaoId?: string;
  codigoOrigem?: string;
  descricao: string;
  preparacao?: string;
  fonte?: {
    codigo: string;
    nome: string;
    versao: string;
    baseCodigo?: string;
    hashConteudo?: string;
    checksumArquivo?: string;
    esquemaVersao?: string;
    publicadaEm?: string;
    capturadaEm?: string;
  };
  nutrientesPor100g: NutrientesPor100gApi;
  nutrientesPorcao: NutrientesPor100gApi;
}

export interface SubstituicaoPlanoAlimentarApi {
  id: string;
  ordem: number;
  alimentoComposicaoId?: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  porcaoGramas: number;
  composicaoSnapshot: ComposicaoSnapshotApi;
}

export interface ItemPlanoAlimentarApi extends SubstituicaoPlanoAlimentarApi {
  substituicoes: SubstituicaoPlanoAlimentarApi[];
}

export interface RefeicaoPlanoAlimentarApi {
  id: string;
  ordem: number;
  nome: string;
  horarioLocal?: string;
  orientacoes?: string;
  itens: ItemPlanoAlimentarApi[];
}

export interface CalculoPlanoAlimentarApi {
  motorCalculoVersao: string;
  avaliacao: {
    id: string;
    avaliadaEm: string;
    sexo: 'masculino' | 'feminino';
    idadeAnos: number;
    pesoKg: number;
    alturaCm: number;
  };
  possuiCondicaoEspecial: boolean;
  justificativaCondicaoEspecial?: string;
  aplicabilidadeFormulaConfirmada: boolean;
  alertasDivergenciaClinica?: string[];
  justificativaDivergenciaClinica?: string;
  fatorAtividade: number;
  estimativa: {
    metabolismoRepousoKcal: number;
    gastoEnergeticoTotalKcal: number;
    formulaCodigo: FormulaEnergeticaApi;
    formulaVersao: string;
    formulaAplicada: string;
    fonte: string;
    aviso: string;
  };
  ajusteEnergeticoKcal: number;
  metaEnergeticaKcal: number;
  distribuicaoMacros: AtualizarRascunhoPlanoAlimentarEntrada['distribuicaoMacros'];
  metasMacronutrientes: {
    carboidratosG: number;
    proteinasG: number;
    gordurasG: number;
  };
}

export interface TotaisPlanoAlimentarApi {
  energiaKcal: number;
  proteinasG: number;
  carboidratosG: number;
  gordurasG: number;
  fibrasG?: number;
  sodioMg?: number;
}

export interface VersaoPlanoAlimentarApi {
  id: string;
  numero: number;
  status: 'rascunho' | 'publicada' | 'descartada';
  avaliacaoAntropometricaId?: string;
  formulaCodigo?: FormulaEnergeticaApi;
  formulaVersao?: string;
  motorCalculoVersao?: string;
  objetivos?: string;
  observacoes?: string;
  calculo?: CalculoPlanoAlimentarApi;
  totais?: TotaisPlanoAlimentarApi;
  hashConteudo?: string;
  revisadaEm?: string;
  revisadaPorUsuarioId?: string;
  publicadaEm?: string;
  descartadaEm?: string;
  criadoEm: string;
  atualizadoEm: string;
  refeicoes: RefeicaoPlanoAlimentarApi[];
}

export interface PlanoAlimentarApi {
  id: string;
  pacienteId: string;
  profissionalId: string;
  titulo: string;
  arquivadoEm?: string;
  criadoEm: string;
  atualizadoEm: string;
  current?: VersaoPlanoAlimentarApi;
  draft?: VersaoPlanoAlimentarApi;
  historico: VersaoPlanoAlimentarResumoApi[];
}

export type VersaoPlanoAlimentarResumoApi = Pick<
  VersaoPlanoAlimentarApi,
  'id' | 'numero' | 'status' | 'revisadaEm' | 'hashConteudo' | 'publicadaEm' | 'descartadaEm' | 'criadoEm' | 'atualizadoEm'
>;

export interface PlanoAlimentarResumoApi {
  id: string;
  pacienteId: string;
  profissionalId: string;
  titulo: string;
  criadoEm: string;
  atualizadoEm: string;
  current?: VersaoPlanoAlimentarResumoApi;
  draft?: VersaoPlanoAlimentarResumoApi;
  historicoQuantidade: number;
}

export interface PaginaApi<T> {
  itens: T[];
  total: number;
  pagina: number;
  limite: number;
}

export interface FonteCatalogoApi {
  codigo: string;
  nome: string;
  versao: string;
  baseCodigo?: string;
}

export interface PaginaAlimentosApi extends PaginaApi<AlimentoComposicaoApi> {
  fontes: FonteCatalogoApi[];
}

export interface ConsultaPaginadaPlanos {
  pagina?: number;
  limite?: number;
}

export interface ConsultaAlimentos extends ConsultaPaginadaPlanos {
  busca: string;
  fonteCodigo?: string;
  versao?: string;
  baseCodigo?: string;
}

export class ErroApiPlanoAlimentar extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiPlanoAlimentar';
  }
}

async function extrairMensagemErro(resposta: Response): Promise<string> {
  const texto = await resposta.text();
  if (!texto) return `Falha HTTP ${resposta.status}`;
  try {
    const corpo = JSON.parse(texto) as { message?: string | string[]; mensagem?: string };
    if (Array.isArray(corpo.message)) return corpo.message.join(' ');
    return corpo.mensagem ?? corpo.message ?? texto;
  } catch {
    return texto;
  }
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, { ...init, cache: 'no-store' });
  if (!resposta.ok) throw new ErroApiPlanoAlimentar(resposta.status, await extrairMensagemErro(resposta));
  if (resposta.status === 204) return undefined as T;
  return resposta.json() as Promise<T>;
}

function basePaciente(pacienteId: string) {
  return `/api/pacientes/${encodeURIComponent(pacienteId)}/planos-alimentares`;
}

function corpoJson(entrada: unknown): RequestInit {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entrada)
  };
}

function montarConsulta(valores: Record<string, string | number | undefined>): string {
  const partes = Object.entries(valores)
    .filter(([, valor]) => valor !== undefined && valor !== '')
    .map(([chave, valor]) => `${chave}=${encodeURIComponent(String(valor))}`);
  return partes.length ? `?${partes.join('&')}` : '';
}

export function listarPlanosAlimentares(
  pacienteId: string,
  consulta: ConsultaPaginadaPlanos = {},
  signal?: AbortSignal
) {
  return requisitar<PaginaApi<PlanoAlimentarResumoApi>>(
    `${basePaciente(pacienteId)}${montarConsulta({ pagina: consulta.pagina, limite: consulta.limite })}`,
    { signal }
  );
}

export function obterVersaoPlanoAlimentar(
  pacienteId: string,
  planoId: string,
  numero: number,
  signal?: AbortSignal
) {
  return requisitar<VersaoPlanoAlimentarApi>(
    `${basePaciente(pacienteId)}/${encodeURIComponent(planoId)}/versoes/${encodeURIComponent(String(numero))}`,
    { signal }
  );
}

export function obterPlanoAlimentar(pacienteId: string, planoId: string, signal?: AbortSignal) {
  return requisitar<PlanoAlimentarApi>(
    `${basePaciente(pacienteId)}/${encodeURIComponent(planoId)}`,
    { signal }
  );
}

export function criarPlanoAlimentar(pacienteId: string, titulo: string) {
  return requisitar<PlanoAlimentarApi>(basePaciente(pacienteId), {
    method: 'POST',
    ...corpoJson({ titulo })
  });
}

export function obterRascunhoPlanoAlimentar(pacienteId: string, planoId: string, signal?: AbortSignal) {
  return requisitar<VersaoPlanoAlimentarApi>(
    `${basePaciente(pacienteId)}/${encodeURIComponent(planoId)}/rascunho`,
    { signal }
  );
}

export function atualizarRascunhoPlanoAlimentar(
  pacienteId: string,
  planoId: string,
  entrada: AtualizarRascunhoPlanoAlimentarEntrada
) {
  return requisitar<VersaoPlanoAlimentarApi>(
    `${basePaciente(pacienteId)}/${encodeURIComponent(planoId)}/rascunho`,
    { method: 'PUT', ...corpoJson(entrada) }
  );
}

export function revisarPlanoAlimentar(pacienteId: string, planoId: string) {
  return requisitar<VersaoPlanoAlimentarApi>(
    `${basePaciente(pacienteId)}/${encodeURIComponent(planoId)}/revisao`,
    { method: 'POST', ...corpoJson({}) }
  );
}

export function publicarPlanoAlimentar(pacienteId: string, planoId: string) {
  return requisitar<PlanoAlimentarApi>(
    `${basePaciente(pacienteId)}/${encodeURIComponent(planoId)}/publicacao`,
    { method: 'POST', ...corpoJson({}) }
  );
}

export function criarNovaVersaoPlanoAlimentar(pacienteId: string, planoId: string) {
  return requisitar<VersaoPlanoAlimentarApi>(
    `${basePaciente(pacienteId)}/${encodeURIComponent(planoId)}/nova-versao`,
    { method: 'POST', ...corpoJson({}) }
  );
}

export function arquivarPlanoAlimentar(pacienteId: string, planoId: string) {
  return requisitar<{ id: string; arquivadoEm: string }>(
    `${basePaciente(pacienteId)}/${encodeURIComponent(planoId)}/arquivamento`,
    { method: 'POST', ...corpoJson({}) }
  );
}

export function buscarAlimentosPlanoAlimentar(
  pacienteId: string,
  consulta: ConsultaAlimentos,
  signal?: AbortSignal
) {
  return requisitar<PaginaAlimentosApi>(
    `${basePaciente(pacienteId)}/alimentos${montarConsulta({ ...consulta })}`,
    { signal }
  );
}

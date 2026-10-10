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
  metadadosOrigem?: Record<string, unknown>;
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

// As duas decisoes do profissional sobre uma alternativa. Nao ficam em
// `SubstituicaoPlanoAlimentarEntrada` porque o item principal estende aquela
// interface e nao e alternativa de nada.
export interface AlternativaPlanoAlimentarEntrada extends SubstituicaoPlanoAlimentarEntrada {
  liberadaParaPaciente: boolean;
  preferida: boolean;
}

export interface ItemPlanoAlimentarEntrada extends SubstituicaoPlanoAlimentarEntrada {
  substituicoes: AlternativaPlanoAlimentarEntrada[];
  /** Ausente significa mostrar todas as liberadas ao paciente. */
  substituicoesVisiveisInicialmente?: number;
}

export interface RefeicaoPlanoAlimentarEntrada {
  nome: string;
  horarioLocal?: string;
  orientacoes?: string;
  itens: ItemPlanoAlimentarEntrada[];
}

export type OrigemMetaPlanoApi = 'formula' | 'manual';
export type MetodoMacrosManualApi = 'percentual' | 'gramas_por_kg';

export interface MacrosGramasPorKgApi {
  carboidratosGPorKg: number;
  proteinasGPorKg: number;
  gordurasGPorKg: number;
}

export interface AtualizarRascunhoPlanoAlimentarEntrada {
  avaliacaoAntropometricaId: string;
  /** `manual` e o caminho do paciente com condicao especial: sem formula. */
  origemMeta: OrigemMetaPlanoApi;
  formula?: FormulaEnergeticaApi;
  fatorAtividade?: number;
  ajusteEnergeticoKcal?: number;
  metodoMacrosManual?: MetodoMacrosManualApi;
  metaEnergeticaManualKcal?: number;
  macrosGramasPorKg?: MacrosGramasPorKgApi;
  distribuicaoMacros?: {
    carboidratosBasisPoints: number;
    proteinasBasisPoints: number;
    gordurasBasisPoints: number;
  };
  possuiCondicaoEspecial: boolean;
  aplicabilidadeFormulaConfirmada?: boolean;
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

export interface AlternativaPlanoAlimentarApi extends SubstituicaoPlanoAlimentarApi {
  liberadaParaPaciente: boolean;
  preferida: boolean;
}

export interface ItemPlanoAlimentarApi extends SubstituicaoPlanoAlimentarApi {
  substituicoes: AlternativaPlanoAlimentarApi[];
  substituicoesVisiveisInicialmente?: number;
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
  /** Ausentes no caminho manual: nenhuma formula preditiva foi aplicada. */
  origemMeta?: OrigemMetaPlanoApi;
  metodoMacrosManual?: MetodoMacrosManualApi;
  macrosGramasPorKg?: MacrosGramasPorKgApi;
  fatorAtividade?: number;
  estimativa?: {
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
  distribuicaoMacros?: AtualizarRascunhoPlanoAlimentarEntrada['distribuicaoMacros'];
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

export interface EscolhaPlanoAlimentarProfissionalApi {
  id: string;
  versaoId: string;
  versaoNumero: number;
  itemId: string;
  refeicaoNome: string;
  itemDescricao: string;
  substituicaoId?: string;
  substituicaoDescricao?: string;
  retornouAoPrincipal: boolean;
  escolhidoPorUsuarioId: string;
  criadoEm: string;
}

export interface CheckinAcompanhamentoPlanoApi {
  id: string;
  adesaoPlano?: number;
  dadoIndisponivel?: boolean;
  registradoEm: string;
  fonte: 'declaracao_paciente';
}

export interface QuestionarioSemRespostaPlanoApi {
  id: string;
  status: 'pendente' | 'enviado' | 'expirado';
  titulo?: string;
  enviadoEm?: string;
  expiraEm?: string;
}

export interface AcompanhamentoVersaoPlanoApi {
  versao: { id: string; numero: number };
  periodo: { inicioEm: string; fimExclusivoEm?: string };
  checkins: PaginaApi<CheckinAcompanhamentoPlanoApi>;
  questionariosSemResposta: PaginaApi<QuestionarioSemRespostaPlanoApi> & {
    semReferenciaTemporal: number;
  };
  escolhas: PaginaApi<EscolhaPlanoAlimentarProfissionalApi>;
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

export interface ConsultaAcompanhamentoVersaoPlano {
  paginaCheckins?: number;
  paginaQuestionarios?: number;
  paginaEscolhas?: number;
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

export function obterAcompanhamentoVersaoPlanoAlimentar(
  pacienteId: string,
  planoId: string,
  numero: number,
  consulta: ConsultaAcompanhamentoVersaoPlano = {},
  signal?: AbortSignal
) {
  return requisitar<AcompanhamentoVersaoPlanoApi>(
    `${basePaciente(pacienteId)}/${encodeURIComponent(planoId)}/versoes/${encodeURIComponent(String(numero))}/acompanhamento${montarConsulta({
      paginaCheckins: consulta.paginaCheckins,
      paginaQuestionarios: consulta.paginaQuestionarios,
      paginaEscolhas: consulta.paginaEscolhas,
      limite: consulta.limite
    })}`,
    { signal }
  );
}

export function obterPlanoAlimentar(pacienteId: string, planoId: string, signal?: AbortSignal) {
  return requisitar<PlanoAlimentarApi>(
    `${basePaciente(pacienteId)}/${encodeURIComponent(planoId)}`,
    { signal }
  );
}

export function listarEscolhasPlanoAlimentar(
  pacienteId: string,
  planoId: string,
  consulta: ConsultaPaginadaPlanos = {},
  signal?: AbortSignal
) {
  return requisitar<PaginaApi<EscolhaPlanoAlimentarProfissionalApi>>(
    `${basePaciente(pacienteId)}/${encodeURIComponent(planoId)}/escolhas-paciente${montarConsulta({
      pagina: consulta.pagina,
      limite: consulta.limite
    })}`,
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

export type OrigemModeloApi = 'pessoal' | 'clinica';

export interface ModeloPlanoAlimentarResumoApi {
  id: string;
  nome: string;
  origem: OrigemModeloApi;
  totalRefeicoes: number;
  totalItens: number;
  versaoAtual: number;
  atualizadoEm: string;
}

/** Busca o catálogo global para editar modelos sem depender de um paciente. */
export function buscarAlimentosParaModelo(consulta: ConsultaAlimentos, signal?: AbortSignal) {
  return requisitar<PaginaAlimentosApi>(
    `/api/planos-alimentares/alimentos${montarConsulta({ ...consulta })}`,
    { signal }
  );
}

export interface ModeloPlanoAlimentarApi extends Omit<ModeloPlanoAlimentarResumoApi, 'atualizadoEm'> {
  refeicoes: RefeicaoPlanoAlimentarEntrada[];
  /** Ids de catalogo do modelo cuja fonte deixou de estar ativa. */
  alimentosIndisponiveis: string[];
}

export interface VersaoModeloPlanoAlimentarResumoApi {
  id: string;
  numero: number;
  nome: string;
  totalRefeicoes: number;
  totalItens: number;
  criadoEm: string;
}

export interface VersaoModeloPlanoAlimentarApi extends VersaoModeloPlanoAlimentarResumoApi {
  refeicoes: RefeicaoPlanoAlimentarEntrada[];
  alimentosIndisponiveis: string[];
}

export interface ConsultaModelos extends ConsultaPaginadaPlanos {
  origem?: OrigemModeloApi;
}

export interface EstruturaInicialPlanoApi {
  id: string;
  nome: string;
  refeicoes: RefeicaoPlanoAlimentarEntrada[];
}

export interface PaginaModelosPlanoApi extends PaginaApi<ModeloPlanoAlimentarResumoApi> {
  estruturasIniciais?: EstruturaInicialPlanoApi[];
}

export type PaginaVersoesModeloPlanoApi = PaginaApi<VersaoModeloPlanoAlimentarResumoApi>;

// Modelos nao pertencem a um paciente: a rota vive fora de `/pacientes/:id`.
const BASE_MODELOS = '/api/planos-alimentares/modelos';

export function listarModelosPlanoAlimentar(consulta: ConsultaModelos = {}, signal?: AbortSignal) {
  return requisitar<PaginaModelosPlanoApi>(
    `${BASE_MODELOS}${montarConsulta({
      pagina: consulta.pagina,
      limite: consulta.limite,
      origem: consulta.origem
    })}`,
    { signal }
  );
}

export function obterModeloPlanoAlimentar(modeloId: string, signal?: AbortSignal) {
  return requisitar<ModeloPlanoAlimentarApi>(`${BASE_MODELOS}/${encodeURIComponent(modeloId)}`, { signal });
}

export function criarModeloPlanoAlimentar(entrada: {
  nome: string;
  origem: OrigemModeloApi;
  refeicoes: RefeicaoPlanoAlimentarEntrada[];
}) {
  return requisitar<ModeloPlanoAlimentarResumoApi>(BASE_MODELOS, { method: 'POST', ...corpoJson(entrada) });
}

export function editarModeloPlanoAlimentar(modeloId: string, entrada: {
  versaoEsperada: number;
  nome: string;
  refeicoes: RefeicaoPlanoAlimentarEntrada[];
}) {
  return requisitar<{ id: string; versaoAtual: number; totalRefeicoes: number; totalItens: number }>(
    `${BASE_MODELOS}/${encodeURIComponent(modeloId)}`,
    { method: 'PUT', ...corpoJson(entrada) }
  );
}

export function listarVersoesModeloPlanoAlimentar(modeloId: string, consulta: ConsultaPaginadaPlanos = {}, signal?: AbortSignal) {
  return requisitar<PaginaVersoesModeloPlanoApi>(
    `${BASE_MODELOS}/${encodeURIComponent(modeloId)}/versoes${montarConsulta({ pagina: consulta.pagina, limite: consulta.limite })}`,
    { signal }
  );
}

export function obterVersaoModeloPlanoAlimentar(modeloId: string, numero: number, signal?: AbortSignal) {
  return requisitar<VersaoModeloPlanoAlimentarApi>(
    `${BASE_MODELOS}/${encodeURIComponent(modeloId)}/versoes/${numero}`,
    { signal }
  );
}

export function restaurarVersaoModeloPlanoAlimentar(modeloId: string, numero: number, versaoEsperada: number) {
  return requisitar<{ id: string; versaoAtual: number; totalRefeicoes: number; totalItens: number }>(
    `${BASE_MODELOS}/${encodeURIComponent(modeloId)}/versoes/${numero}/restaurar`,
    { method: 'POST', ...corpoJson({ versaoEsperada }) }
  );
}

export function arquivarModeloPlanoAlimentar(modeloId: string) {
  return requisitar<{ id: string; arquivadoEm: string }>(`${BASE_MODELOS}/${encodeURIComponent(modeloId)}`, {
    method: 'DELETE'
  });
}

export type TipoReceitaNutricionalApi = 'receita' | 'refeicao_pronta';
export type OrigemReceitaNutricionalApi = 'pessoal' | 'clinica';

export interface ReceitaNutricionalResumoApi {
  id: string;
  nome: string;
  origem: OrigemReceitaNutricionalApi;
  tipo: TipoReceitaNutricionalApi;
  categoria: string | null;
  versaoAtual: number;
  totalItens: number;
  atualizadoEm: string;
}

export interface ReceitaNutricionalApi extends ReceitaNutricionalResumoApi {
  instrucoes?: string;
  itens: ItemPlanoAlimentarEntrada[];
  alimentosIndisponiveis: string[];
}

export interface ConsultaReceitasNutricionais extends ConsultaPaginadaPlanos {
  origem?: OrigemReceitaNutricionalApi;
  tipo?: TipoReceitaNutricionalApi;
  categoria?: string;
}

export interface EntradaReceitaNutricional {
  nome: string;
  origem: OrigemReceitaNutricionalApi;
  tipo: TipoReceitaNutricionalApi;
  categoria: string;
  instrucoes?: string;
  itens: ItemPlanoAlimentarEntrada[];
}

export interface AtualizarReceitaNutricionalEntrada extends EntradaReceitaNutricional {
  versaoEsperada: number;
}

const BASE_RECEITAS = '/api/planos-alimentares/receitas';

export function listarReceitasNutricionais(consulta: ConsultaReceitasNutricionais = {}, signal?: AbortSignal) {
  return requisitar<PaginaApi<ReceitaNutricionalResumoApi>>(
    `${BASE_RECEITAS}${montarConsulta({ pagina: consulta.pagina, limite: consulta.limite, origem: consulta.origem, tipo: consulta.tipo, categoria: consulta.categoria })}`,
    { signal }
  );
}

export function obterReceitaNutricional(receitaId: string, signal?: AbortSignal) {
  return requisitar<ReceitaNutricionalApi>(`${BASE_RECEITAS}/${encodeURIComponent(receitaId)}`, { signal });
}

export function criarReceitaNutricional(entrada: EntradaReceitaNutricional) {
  return requisitar<ReceitaNutricionalResumoApi>(BASE_RECEITAS, { method: 'POST', ...corpoJson(entrada) });
}

export function atualizarReceitaNutricional(receitaId: string, entrada: AtualizarReceitaNutricionalEntrada) {
  return requisitar<ReceitaNutricionalResumoApi>(`${BASE_RECEITAS}/${encodeURIComponent(receitaId)}`, {
    method: 'PUT',
    ...corpoJson(entrada)
  });
}

export function arquivarReceitaNutricional(receitaId: string) {
  return requisitar<{ id: string; arquivadoEm: string }>(`${BASE_RECEITAS}/${encodeURIComponent(receitaId)}`, {
    method: 'DELETE'
  });
}

export interface CompartilharReceitasEntradaApi {
  pacienteId: string;
  chaveIdempotencia: string;
  receitaIds: string[];
  versoesEsperadas: Array<{ receitaId: string; versao: number }>;
  canais: Array<'portal' | 'email' | 'whatsapp' | 'push'>;
  agendadoPara?: string;
  confirmacaoRevisaoManual?: boolean;
}

export interface EnvioReceitaClinicaApi {
  id: string; receitaId: string; nome: string; versao: number;
  status: 'agendado' | 'ativo' | 'substituido' | 'retirado';
  agendadoPara: string | null; enviadoEm: string | null; retiradoEm: string | null; visualizadoEm: string | null;
  entregas: Array<{ canal: 'portal' | 'email' | 'whatsapp' | 'push'; status: string; agendadoPara: string; confirmadoEm: string | null }>;
}

export function listarEnviosReceitaPaciente(pacienteId: string, signal?: AbortSignal) {
  return requisitar<EnvioReceitaClinicaApi[]>(
    `${BASE_RECEITAS}/compartilhamentos/pacientes/${encodeURIComponent(pacienteId)}`, { signal, cache: 'no-store' }
  );
}

export function compartilharReceitasNutricionais(entrada: CompartilharReceitasEntradaApi) {
  return requisitar<{ quantidade: number; agendadoPara: string | null; itens: Array<{ id: string; receitaId: string; status: string }> }>(
    `${BASE_RECEITAS}/compartilhamentos`, { method: 'POST', ...corpoJson(entrada) }
  );
}

export function obterConsentimentoPacienteReceitas(pacienteId: string, signal?: AbortSignal) {
  return requisitar<ConsentimentoReceitaApi>(
    `${BASE_RECEITAS}/compartilhamentos/pacientes/${encodeURIComponent(pacienteId)}/preferencias`, { signal }
  );
}

export function retirarCompartilhamentoReceita(compartilhamentoId: string) {
  return requisitar<{ id: string; status: string; retiradoEm: string }>(
    `${BASE_RECEITAS}/compartilhamentos/${encodeURIComponent(compartilhamentoId)}`, { method: 'DELETE' }
  );
}

export interface ReceitaCompartilhadaPortalApi {
  id: string;
  nome: string;
  enviadoEm?: string;
  visualizadoEm?: string | null;
}

export function listarReceitasCompartilhadasPortal(signal?: AbortSignal) {
  return requisitar<ReceitaCompartilhadaPortalApi[]>('/api/portal/paciente/receitas', { signal, cache: 'no-store' });
}

export function obterReceitaCompartilhadaPortal(id: string) {
  return requisitar<{ id: string; enviadoEm?: string; receita: { nome: string; conteudo: { instrucoes?: string; itens: ItemPlanoAlimentarEntrada[] }; versao: number } }>(
    `/api/portal/paciente/receitas/${encodeURIComponent(id)}`, { cache: 'no-store' }
  );
}

export interface ConsentimentoReceitaApi { email: boolean; whatsapp: boolean; push: boolean }

export function obterConsentimentoReceitasPortal() {
  return requisitar<ConsentimentoReceitaApi>('/api/portal/paciente/preferencias/receitas', { cache: 'no-store' });
}

export function atualizarConsentimentoReceitasPortal(entrada: ConsentimentoReceitaApi) {
  return requisitar<ConsentimentoReceitaApi>('/api/portal/paciente/preferencias/receitas', { method: 'PUT', ...corpoJson(entrada) });
}

export function registrarPushReceitasPortal(pacienteId: string, subscription: PushSubscription) {
  return requisitar<{ id: string }>('/api/portal/paciente/preferencias/receitas/push-subscription', {
    method: 'POST', ...corpoJson({ pacienteId, subscription: subscription.toJSON() })
  });
}

export async function obterChavePublicaPushReceitasPortal() {
  return requisitar<{ chavePublica: string | null }>('/api/portal/paciente/preferencias/receitas/push-public-key', { cache: 'no-store' });
}

export function revogarPushReceitasPortal(endpoint?: string) {
  return requisitar<{ revogado: boolean }>('/api/portal/paciente/preferencias/receitas/push-subscription', {
    method: 'DELETE', ...corpoJson(endpoint ? { endpoint } : {})
  });
}

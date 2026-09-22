import type { PacienteResumo } from './cadastros-api';
import { lancarErroApi } from './erro-api';

export type TipoEventoProntuarioPaciente =
  | 'consulta'
  | 'formulario'
  | 'resposta_formulario'
  | 'checkin_rapido'
  | 'mensagem'
  | 'evolucao_clinica'
  | 'tarefa_acompanhamento'
  | 'plano_alimentar_publicado'
  | 'avaliacao_antropometrica'
  | 'documento_emitido'
  | 'anexo_confirmado'
  | 'exame_laboratorial'
  | 'evolucao_fotografica'
  | 'evento_financeiro';
export type TipoEvolucaoClinicaApi = 'consulta' | 'retorno' | 'observacao' | 'ajuste_plano';
export type CategoriaTarefaAcompanhamentoApi = 'meta' | 'tarefa' | 'checkin' | 'orientacao';
export type PrioridadeTarefaAcompanhamentoApi = 'baixa' | 'media' | 'alta';
export type StatusTarefaAcompanhamentoApi = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';

export interface EventoProntuarioPacienteApi {
  id: string;
  tipo: TipoEventoProntuarioPaciente;
  titulo: string;
  descricao?: string;
  data: string;
  status?: string;
  origemId?: string;
  origem?: string;
  responsavelId?: string;
  autorUsuarioId?: string;
  metadados?: Record<string, unknown>;
}

export interface ProntuarioPacienteApi {
  paciente: PacienteResumo;
  resumo: {
    consultas: number;
    formulariosPendentes: number;
    respostas: number;
    checkinsRapidos: number;
    mensagens: number;
    evolucoes: number;
    tarefasPendentes: number;
    ultimoEventoEm?: string;
    ultimoAtendimento?: { consultaId: string; titulo: string; concluidaEm: string };
    planoAtual?: { planoId: string; versaoId: string; numeroVersao: number; publicadaEm: string };
    tarefaVencida?: { tarefaId: string; titulo: string; vencimentoEm: string };
    falhaComunicacao?: { mensagemId: string; registradaEm: string };
    indicadoresRecentes: Array<{
      tipo: 'adesao' | 'sintomas';
      valor: string;
      fonte: 'Registro de habitos';
      registradoEm: string;
    }>;
    proximaConduta?: {
      tipo: 'falha_comunicacao' | 'tarefa_vencida' | 'formulario_pendente' | 'consulta_agendada';
      titulo: string;
      descricao: string;
      destino: 'mensagens' | 'acompanhamento' | 'formularios' | 'agenda';
      referenciaId?: string;
      dataReferencia?: string;
    };
    leituraClinica: {
      deltaUltimaAvaliacao: DeltaAntropometricoApi[];
      deltaDesdeInicio: DeltaAntropometricoApi[];
      objetivoPlanoVigente?: string;
      condutasVencendo: Array<{
        condutaId: string;
        tipo: 'meta' | 'orientacao' | 'suplemento' | 'produto' | 'formula_manipulada';
        validadeFim: string;
      }>;
    };
    preparacaoConsulta?: {
      desdeAtendimentoEm: string;
      novaAvaliacaoAntropometrica: boolean;
      checkinsRegistrados: number;
      formulariosRespondidos: number;
      mensagensRecebidas: number;
      escolhasSubstituicao?: number;
    };
  };
  linhaDoTempo: EventoProntuarioPacienteApi[];
}

export interface PaginaLinhaDoTempoProntuarioApi {
  itens: EventoProntuarioPacienteApi[];
  proximoCursor?: string;
}

export interface CriarEvolucaoClinicaEntrada {
  titulo: string;
  conteudo: string;
  tipo?: TipoEvolucaoClinicaApi;
  visibilidade?: 'privada';
  /** PB-24 (Fase 275): consulta de origem, opcional. */
  consultaId?: string;
}

export interface EvolucaoClinicaApi extends CriarEvolucaoClinicaEntrada {
  id: string;
  tenantId: string;
  pacienteId: string;
  autorUsuarioId: string;
  tipo: TipoEvolucaoClinicaApi;
  visibilidade: 'privada';
  criadoEm: string;
  atualizadoEm: string;
}

/** PB-24 (Fase 275): item do seletor opcional "Vincular a consulta". */
export interface ConsultaRecenteApi {
  id: string;
  titulo: string;
  inicioEm: string;
  status: string;
}

export async function listarConsultasRecentes(pacienteId: string): Promise<ConsultaRecenteApi[]> {
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/consultas-recentes`, {
    cache: 'no-store'
  });
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<ConsultaRecenteApi[]>;
}

export interface CriarTarefaAcompanhamentoEntrada {
  titulo: string;
  descricao?: string;
  categoria?: CategoriaTarefaAcompanhamentoApi;
  prioridade?: PrioridadeTarefaAcompanhamentoApi;
  vencimentoEm?: string;
}

export interface TarefaAcompanhamentoApi extends CriarTarefaAcompanhamentoEntrada {
  id: string;
  tenantId: string;
  pacienteId: string;
  profissionalId: string;
  categoria: CategoriaTarefaAcompanhamentoApi;
  prioridade: PrioridadeTarefaAcompanhamentoApi;
  status: StatusTarefaAcompanhamentoApi;
  vencimentoEm?: string;
  concluidoEm?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export type FaixaPrioridadeAcompanhamentoApi = 'baixa' | 'media' | 'alta';

export interface PrioridadeAcompanhamentoApi {
  pacienteId: string;
  versaoFormula?: string;
  calculadoEm?: string;
  valorCalculado: {
    score: number;
    faixa: FaixaPrioridadeAcompanhamentoApi;
    fatores: Array<{ codigo: string; pontos: number; quantidade?: number }>;
  };
  valorEfetivo: {
    faixa: FaixaPrioridadeAcompanhamentoApi;
    origem: 'calculado' | 'override';
  };
  override?: {
    faixa: FaixaPrioridadeAcompanhamentoApi;
    codigoMotivo: string;
    expiraEm: string;
    criadoEm: string;
    atorUsuarioId: string;
  };
}

export async function obterPrioridadeAcompanhamento(pacienteId: string): Promise<PrioridadeAcompanhamentoApi> {
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/prioridade-acompanhamento`, {
    cache: 'no-store'
  });
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<PrioridadeAcompanhamentoApi>;
}

/** Vocabulario fechado aprovado na Fase 265.5 -- mesmo enum do backend (`@IsIn`). */
export const CODIGOS_MOTIVO_OVERRIDE_PRIORIDADE_ACOMPANHAMENTO: Array<{
  codigo: CodigoMotivoOverridePrioridadeAcompanhamentoApi;
  rotulo: string;
}> = [
  { codigo: 'evento_recente_nao_capturado', rotulo: 'Evento recente ainda não capturado pelo cálculo' },
  { codigo: 'informacao_externa_relevante', rotulo: 'Informação externa relevante' },
  { codigo: 'acompanhamento_intensificado', rotulo: 'Acompanhamento precisa ser intensificado' },
  { codigo: 'acompanhamento_reduzido', rotulo: 'Acompanhamento pode ser reduzido' },
  { codigo: 'correcao_de_dado', rotulo: 'Correção de dado' },
  { codigo: 'outro', rotulo: 'Outro' }
];

export type CodigoMotivoOverridePrioridadeAcompanhamentoApi =
  | 'evento_recente_nao_capturado'
  | 'informacao_externa_relevante'
  | 'acompanhamento_intensificado'
  | 'acompanhamento_reduzido'
  | 'correcao_de_dado'
  | 'outro';

export interface SolicitarOverridePrioridadeAcompanhamentoEntrada {
  faixa: FaixaPrioridadeAcompanhamentoApi;
  codigoMotivo: CodigoMotivoOverridePrioridadeAcompanhamentoApi;
  justificativa: string;
  expiraEm: string;
}

export async function solicitarOverridePrioridadeAcompanhamento(
  pacienteId: string,
  entrada: SolicitarOverridePrioridadeAcompanhamentoEntrada
): Promise<PrioridadeAcompanhamentoApi> {
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/prioridade-acompanhamento/override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entrada)
  });
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<PrioridadeAcompanhamentoApi>;
}

export async function removerOverridePrioridadeAcompanhamento(pacienteId: string): Promise<PrioridadeAcompanhamentoApi> {
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/prioridade-acompanhamento/override`, {
    method: 'DELETE'
  });
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<PrioridadeAcompanhamentoApi>;
}

export async function obterProntuarioPaciente(pacienteId: string): Promise<ProntuarioPacienteApi> {
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/prontuario`, { cache: 'no-store' });
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<ProntuarioPacienteApi>;
}

export async function listarLinhaDoTempoPaginada(
  pacienteId: string,
  opcoes: {
    cursor?: string;
    limite?: number;
    tipo?: TipoEventoProntuarioPaciente;
    inicio?: string;
    fim?: string;
    responsavelId?: string;
    signal?: AbortSignal;
  } = {}
): Promise<PaginaLinhaDoTempoProntuarioApi> {
  const parametros = new URLSearchParams();
  if (opcoes.cursor) parametros.set('cursor', opcoes.cursor);
  if (opcoes.limite) parametros.set('limite', String(opcoes.limite));
  if (opcoes.tipo) parametros.set('tipo', opcoes.tipo);
  if (opcoes.inicio) parametros.set('inicio', opcoes.inicio);
  if (opcoes.fim) parametros.set('fim', opcoes.fim);
  if (opcoes.responsavelId) parametros.set('responsavelId', opcoes.responsavelId);
  const consulta = parametros.size ? `?${parametros.toString()}` : '';
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/prontuario/timeline${consulta}`, {
    cache: 'no-store',
    signal: opcoes.signal
  });
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<PaginaLinhaDoTempoProntuarioApi>;
}

export async function criarEvolucaoClinica(
  pacienteId: string,
  entrada: CriarEvolucaoClinicaEntrada
): Promise<EvolucaoClinicaApi> {
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/evolucoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entrada)
  });
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<EvolucaoClinicaApi>;
}

export async function listarEvolucoesClinicas(pacienteId: string): Promise<EvolucaoClinicaApi[]> {
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/evolucoes`, { cache: 'no-store' });
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<EvolucaoClinicaApi[]>;
}

export type OrigemModeloEvolucaoApi = 'pessoal' | 'clinica';

export interface ModeloEvolucaoClinicaResumoApi {
  id: string;
  nome: string;
  origem: OrigemModeloEvolucaoApi;
  tipo: TipoEvolucaoClinicaApi;
  tamanhoConteudo: number;
  atualizadoEm: string;
}

export interface ModeloEvolucaoClinicaApi extends Omit<ModeloEvolucaoClinicaResumoApi, 'atualizadoEm'> {
  conteudo: string;
}

// Modelos nao pertencem a um paciente: a rota vive fora de `/pacientes/:id`.
const BASE_MODELOS_EVOLUCAO = '/api/evolucoes/modelos';

export async function listarModelosEvolucaoClinica(): Promise<{ itens: ModeloEvolucaoClinicaResumoApi[]; total: number }> {
  // Limite alto: o seletor ainda carrega tudo de uma vez, mesma decisao ja
  // tomada para os modelos de plano alimentar (Fase 269).
  const resposta = await fetch(`${BASE_MODELOS_EVOLUCAO}?pagina=1&limite=100`, { cache: 'no-store' });
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<{ itens: ModeloEvolucaoClinicaResumoApi[]; total: number }>;
}

export async function obterModeloEvolucaoClinica(modeloId: string): Promise<ModeloEvolucaoClinicaApi> {
  const resposta = await fetch(`${BASE_MODELOS_EVOLUCAO}/${encodeURIComponent(modeloId)}`, { cache: 'no-store' });
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<ModeloEvolucaoClinicaApi>;
}

export async function criarModeloEvolucaoClinica(entrada: {
  nome: string;
  origem: OrigemModeloEvolucaoApi;
  tipo?: TipoEvolucaoClinicaApi;
  conteudo: string;
}): Promise<ModeloEvolucaoClinicaResumoApi> {
  const resposta = await fetch(BASE_MODELOS_EVOLUCAO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entrada)
  });
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<ModeloEvolucaoClinicaResumoApi>;
}

export async function arquivarModeloEvolucaoClinica(modeloId: string): Promise<{ id: string; arquivadoEm: string }> {
  const resposta = await fetch(`${BASE_MODELOS_EVOLUCAO}/${encodeURIComponent(modeloId)}`, { method: 'DELETE' });
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<{ id: string; arquivadoEm: string }>;
}

export async function criarTarefaAcompanhamento(
  pacienteId: string,
  entrada: CriarTarefaAcompanhamentoEntrada
): Promise<TarefaAcompanhamentoApi> {
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/tarefas-acompanhamento`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entrada)
  });
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<TarefaAcompanhamentoApi>;
}

export async function listarTarefasAcompanhamento(pacienteId: string): Promise<TarefaAcompanhamentoApi[]> {
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/tarefas-acompanhamento`, { cache: 'no-store' });
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<TarefaAcompanhamentoApi[]>;
}

export type ProtocoloComposicao = 'nenhum' | 'pollock_3' | 'pollock_7' | 'faulkner' | 'guedes';
export type SexoBiologico = 'masculino' | 'feminino';

export interface MedidasAntropometricasApi {
  pesoKg?: number;
  alturaCm?: number;
  circunferencias?: Record<string, number | undefined>;
  dobras?: Record<string, number | undefined>;
}

export interface ResultadoAntropometricoApi {
  imc?: number;
  classificacaoImc?: string;
  rcq?: number;
  classificacaoRcq?: string;
  circunferenciaCinturaCm?: number;
  classificacaoCircunferenciaCintura?: string;
  percentualGordura?: number;
  massaGordaKg?: number;
  massaMagraKg?: number;
  protocoloAplicado: ProtocoloComposicao;
  formulaAplicada?: string;
  avisos: string[];
}

export interface AvaliacaoAntropometricaApi {
  id: string;
  pacienteId: string;
  avaliadaEm: string;
  protocolo: ProtocoloComposicao;
  sexo?: SexoBiologico;
  idadeAnos?: number;
  medidas: MedidasAntropometricasApi;
  resultado: ResultadoAntropometricoApi;
  formulaAplicada?: string;
  observacoes?: string;
  /** PB-24 (Fase 275): consulta de origem, opcional. */
  consultaId?: string;
  criadoEm: string;
}

export interface DeltaAntropometricoApi {
  campo: string;
  anterior: number;
  atual: number;
  variacao: number;
}

export interface SerieAntropometricaApi {
  avaliacoes: AvaliacaoAntropometricaApi[];
  deltaUltimas: DeltaAntropometricoApi[];
  deltaSelecionado?: DeltaAntropometricoApi[];
}

export interface RegistrarAvaliacaoAntropometricaEntrada {
  avaliadaEm?: string;
  protocolo?: ProtocoloComposicao;
  sexo?: SexoBiologico;
  pesoKg?: number;
  alturaCm?: number;
  circunferencias?: Record<string, number>;
  dobras?: Record<string, number>;
  observacoes?: string;
  /** PB-24 (Fase 275): consulta de origem, opcional. */
  consultaId?: string;
}

export async function listarAvaliacoesAntropometricas(
  pacienteId: string,
  opcoes: { signal?: AbortSignal; avaliacaoAnteriorId?: string; avaliacaoAtualId?: string } = {}
): Promise<SerieAntropometricaApi> {
  const parametros = new URLSearchParams();
  if (opcoes.avaliacaoAnteriorId) parametros.set('avaliacaoAnteriorId', opcoes.avaliacaoAnteriorId);
  if (opcoes.avaliacaoAtualId) parametros.set('avaliacaoAtualId', opcoes.avaliacaoAtualId);
  const query = parametros.toString();
  const resposta = await fetch(
    `/api/pacientes/${encodeURIComponent(pacienteId)}/avaliacoes-antropometricas${query ? `?${query}` : ''}`,
    { cache: 'no-store', signal: opcoes.signal }
  );
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<SerieAntropometricaApi>;
}

export async function registrarAvaliacaoAntropometrica(
  pacienteId: string,
  entrada: RegistrarAvaliacaoAntropometricaEntrada
): Promise<AvaliacaoAntropometricaApi> {
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/avaliacoes-antropometricas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entrada)
  });
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<AvaliacaoAntropometricaApi>;
}

export async function excluirAvaliacaoAntropometrica(
  pacienteId: string,
  avaliacaoId: string
): Promise<{ id: string }> {
  const resposta = await fetch(
    `/api/pacientes/${encodeURIComponent(pacienteId)}/avaliacoes-antropometricas/${encodeURIComponent(avaliacaoId)}`,
    { method: 'DELETE' }
  );
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<{ id: string }>;
}

export type TipoDocumentoClinicoApi = 'declaracao_comparecimento' | 'relatorio_alta' | 'recibo_consulta';

export interface DocumentoClinicoApi {
  id: string;
  tipo: TipoDocumentoClinicoApi;
  titulo: string;
  corpo: string;
  paragrafos: string[];
  cabecalho?: {
    clinicaNome: string;
    clinicaDocumento: string;
    clinicaEndereco: string;
    profissionalNome: string;
    profissionalRegistro: string;
    profissionalEspecialidade: string;
  };
  consultaId?: string;
  emitidoEm: string;
  canceladoEm?: string;
  motivoCancelamento?: string;
  enviadoEm?: string;
  podeEnviarPorEmail: boolean;
  variaveisVazias: string[];
}

export interface EmitirDocumentoClinicoEntrada {
  tipo: TipoDocumentoClinicoApi;
  consultaId?: string;
  conteudo?: string;
  cidadeEmissao?: string;
}

export interface ResultadoEnvioDocumentoApi {
  status: 'pendente' | 'ignorado';
  motivo?: 'contato_ausente' | 'canal_ausente' | 'template_ausente';
  mensagemId?: string;
}

export async function listarDocumentosClinicos(
  pacienteId: string,
  opcoes: { signal?: AbortSignal } = {}
): Promise<DocumentoClinicoApi[]> {
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/documentos`, {
    cache: 'no-store',
    signal: opcoes.signal
  });
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<DocumentoClinicoApi[]>;
}

export async function emitirDocumentoClinico(
  pacienteId: string,
  entrada: EmitirDocumentoClinicoEntrada
): Promise<DocumentoClinicoApi> {
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/documentos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entrada)
  });
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<DocumentoClinicoApi>;
}

export async function cancelarDocumentoClinico(
  pacienteId: string,
  documentoId: string,
  motivo?: string
): Promise<DocumentoClinicoApi> {
  const resposta = await fetch(
    `/api/pacientes/${encodeURIComponent(pacienteId)}/documentos/${encodeURIComponent(documentoId)}/cancelamento`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo })
    }
  );
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<DocumentoClinicoApi>;
}

export async function enviarDocumentoClinicoPorEmail(
  pacienteId: string,
  documentoId: string
): Promise<ResultadoEnvioDocumentoApi> {
  const resposta = await fetch(
    `/api/pacientes/${encodeURIComponent(pacienteId)}/documentos/${encodeURIComponent(documentoId)}/envio`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
  );
  if (!resposta.ok) {
    await lancarErroApi(resposta);
  }

  return resposta.json() as Promise<ResultadoEnvioDocumentoApi>;
}

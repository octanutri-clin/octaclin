import type { PacienteResumo } from './cadastros-api';

export type TipoEventoProntuarioPaciente =
  | 'consulta'
  | 'formulario'
  | 'resposta_formulario'
  | 'checkin_rapido'
  | 'mensagem'
  | 'evolucao_clinica'
  | 'tarefa_acompanhamento';
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
  };
  linhaDoTempo: EventoProntuarioPacienteApi[];
}

export interface CriarEvolucaoClinicaEntrada {
  titulo: string;
  conteudo: string;
  tipo?: TipoEvolucaoClinicaApi;
  visibilidade?: 'privada';
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

class ErroApiProntuario extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiProntuario';
  }
}

export async function obterProntuarioPaciente(pacienteId: string): Promise<ProntuarioPacienteApi> {
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/prontuario`, { cache: 'no-store' });
  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new ErroApiProntuario(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }

  return resposta.json() as Promise<ProntuarioPacienteApi>;
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
    const detalhe = await resposta.text();
    throw new ErroApiProntuario(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }

  return resposta.json() as Promise<EvolucaoClinicaApi>;
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
    const detalhe = await resposta.text();
    throw new ErroApiProntuario(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }

  return resposta.json() as Promise<TarefaAcompanhamentoApi>;
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
}

export async function listarAvaliacoesAntropometricas(
  pacienteId: string,
  opcoes: { signal?: AbortSignal } = {}
): Promise<SerieAntropometricaApi> {
  const resposta = await fetch(
    `/api/pacientes/${encodeURIComponent(pacienteId)}/avaliacoes-antropometricas`,
    { cache: 'no-store', signal: opcoes.signal }
  );
  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new ErroApiProntuario(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
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
    const detalhe = await resposta.text();
    throw new ErroApiProntuario(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
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
    const detalhe = await resposta.text();
    throw new ErroApiProntuario(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
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
    const detalhe = await resposta.text();
    throw new ErroApiProntuario(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
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
    const detalhe = await resposta.text();
    throw new ErroApiProntuario(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
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
    const detalhe = await resposta.text();
    throw new ErroApiProntuario(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
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
    const detalhe = await resposta.text();
    throw new ErroApiProntuario(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }

  return resposta.json() as Promise<ResultadoEnvioDocumentoApi>;
}

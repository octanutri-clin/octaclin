import { criarIdOperacaoPwa, ehFalhaDeRede, enfileirarOperacaoPwa } from './pwa-private-queue';

export type CanalPreferidoComunicacaoPaciente = 'email' | 'whatsapp' | 'qualquer';
export type HumorCheckinRapidoPaciente = 'muito_bem' | 'bem' | 'neutro' | 'mal' | 'muito_mal';

export interface PreferenciasContatoPacienteApi {
  email: boolean;
  whatsapp: boolean;
  canalPreferido: CanalPreferidoComunicacaoPaciente;
  horarioPermitido: {
    inicio: string;
    fim: string;
    timezone: string;
  };
}

export interface PortalPacienteApi {
  paciente: {
    id: string;
    nome: string;
    statusAdesao: string;
    /** `scoreRisco` nao existe aqui: e triagem interna, regra da Fase 161. */
    ultimoCheckinEm?: string;
  };
  /** Peso e data, so. Sem IMC, sem percentual de gordura, sem classificacao. */
  evolucaoPeso?: { data: string; pesoKg: number }[];
  perfil: {
    contato?: string;
    email?: string;
    whatsapp?: string;
    preferenciasContato: PreferenciasContatoPacienteApi;
    dataNascimento?: string;
    profissionalResponsavelId: string;
    ultimoCheckinEm?: string;
  };
  resumo: {
    consultasProximas: number;
    formulariosPendentes: number;
    formulariosRespondidos: number;
    mensagensRecentes: number;
    tarefasPendentes?: number;
    materiaisDisponiveis?: number;
    checkinsRecentes?: number;
    notificacoesPendentes?: number;
    notificacoesHistorico?: number;
  };
  consultasProximas: {
    id: string;
    titulo: string;
    inicioEm: string;
    fimEm: string;
    status: string;
    modalidade: 'presencial' | 'online';
    /** Backend so envia dentro da janela de abertura da sala. */
    linkTeleconsulta?: string;
    local?: string;
    googleEventHtmlLink?: string;
  }[];
  formulariosPendentes: {
    envioId: string;
    questionarioId: string;
    titulo: string;
    status: string;
    expiraEm?: string;
    linkFormulario: string;
  }[];
  formulariosRespondidos: {
    respostaId: string;
    envioId: string;
    questionarioId: string;
    titulo: string;
    status: string;
    respondidoEm?: string;
    finalizadoEm?: string;
    scoreFinal?: string;
  }[];
  mensagensRecentes: {
    id: string;
    titulo: string;
    texto: string;
    status: string;
    criadoEm: string;
    enviadoEm?: string;
  }[];
  notificacoesPaciente?: {
    id: string;
    canal: string;
    titulo: string;
    texto: string;
    status: string;
    evento?: string;
    erro?: string;
    criadoEm: string;
    enviadoEm?: string;
    agendadoPara?: string;
  }[];
  tarefasAcompanhamento?: {
    id: string;
    titulo: string;
    descricao?: string;
    categoria: string;
    prioridade: string;
    status: string;
    vencimentoEm?: string;
    concluidoEm?: string;
    criadoEm: string;
    atualizadoEm: string;
  }[];
  materiaisDisponiveis?: {
    id: string;
    materialId: string;
    titulo: string;
    tipo: string;
    categoria?: string;
    resumo?: string;
    url?: string;
    conteudo?: string;
    observacao?: string;
    status: string;
    enviadoEm?: string;
    visualizadoEm?: string;
    criadoEm: string;
    atualizadoEm: string;
  }[];
  planoAlimentar?: PlanoAlimentarPacienteApi;
  diariosRecentes?: CheckinRapidoPacienteApi[];
  lgpd: LgpdPortalPacienteApi;
}

export interface NutrientesPlanoAlimentarPacienteApi {
  energiaKcal?: number;
  proteinasG?: number;
  carboidratosG?: number;
  gordurasG?: number;
  fibrasG?: number;
  sodioMg?: number;
}

export interface SubstituicaoPlanoAlimentarPacienteApi {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  porcaoGramas: number;
  nutrientes: NutrientesPlanoAlimentarPacienteApi;
}

export interface ItemPlanoAlimentarPacienteApi extends SubstituicaoPlanoAlimentarPacienteApi {
  substituicoes: SubstituicaoPlanoAlimentarPacienteApi[];
}

export interface PlanoAlimentarPacienteApi {
  id: string;
  titulo: string;
  numeroVersao: number;
  publicadoEm: string;
  objetivo?: string;
  orientacoes?: string;
  metaEnergeticaKcal?: number;
  macros?: {
    carboidratosG?: number;
    proteinasG?: number;
    gordurasG?: number;
  };
  refeicoes: {
    id: string;
    nome: string;
    horarioLocal?: string;
    orientacoes?: string;
    itens: ItemPlanoAlimentarPacienteApi[];
  }[];
}

export interface CheckinRapidoPacienteApi {
  id: string;
  pacienteId: string;
  tipo: 'humor';
  humor: HumorCheckinRapidoPaciente;
  adesaoPlano: number;
  sintomas?: string;
  observacoes?: string;
  registradoEm: string;
}

export interface LgpdPortalPacienteApi {
  versaoAtual: string;
  ultimoAceiteEm?: string;
  documentosLegais?: {
    tipo: 'termos_uso' | 'politica_privacidade' | 'consentimento_lgpd' | string;
    titulo: string;
    versao: string;
    perfil: 'paciente' | string;
    resumo: string;
    obrigatorio: boolean;
    aceito: boolean;
    aceitoEm?: string;
  }[];
  consentimentos: {
    id: string;
    tipo: string;
    versao: string;
    aceitoEm: string;
    metadados: Record<string, unknown>;
  }[];
  solicitacoes: {
    protocolo: string;
    pacienteId: string;
    tipo: 'retificacao' | 'exclusao';
    status: 'recebida' | 'em_tratamento' | 'concluida' | 'indeferida';
    detalhes?: string;
    abertoEm: string;
    atualizadoEm: string;
    ultimaTratativa?: string;
    ultimaResposta?: string;
  }[];
}

export interface DetalheFormularioRespondidoApi {
  respostaId: string;
  envioId: string;
  questionarioId: string;
  titulo: string;
  descricao?: string;
  scoreFinal?: string;
  finalizadoEm?: string;
  respostas: {
    perguntaId: string;
    enunciado: string;
    tipo: string;
    obrigatoria: boolean;
    ordem: number;
    valor: unknown;
    scorePonderado?: string;
  }[];
}

export interface AtualizarPerfilPacienteEntrada {
  nome?: string;
  email?: string;
  whatsapp?: string;
  dataNascimento?: string;
  prefereEmail?: boolean;
  prefereWhatsapp?: boolean;
  canalPreferido?: CanalPreferidoComunicacaoPaciente;
  horarioInicio?: string;
  horarioFim?: string;
  timezoneComunicacao?: string;
}

export interface PerfilPacienteAtualizadoApi {
  paciente: PortalPacienteApi['paciente'];
  perfil: PortalPacienteApi['perfil'];
}

export interface RegistrarConsentimentoLgpdEntrada {
  aceiteLgpd: boolean;
  aceiteTermosUso: boolean;
  aceitePoliticaPrivacidade: boolean;
  versaoLgpd?: string;
  versaoTermosUso?: string;
  versaoPoliticaPrivacidade?: string;
  prefereEmail?: boolean;
  prefereWhatsapp?: boolean;
}

export interface RegistrarCheckinRapidoEntrada {
  idLocal?: string;
  pacienteIdEsperado?: string;
  humor: HumorCheckinRapidoPaciente;
  adesaoPlano: number;
  sintomas?: string;
  observacoes?: string;
}

export interface ConsentimentoLgpdRegistradoApi extends PerfilPacienteAtualizadoApi {
  lgpd: LgpdPortalPacienteApi;
}

export interface ExportacaoDadosLgpdApi {
  formato: 'octaclin.lgpd.exportacao_paciente.v1';
  geradoEm: string;
  titular: {
    pacienteId: string;
    nome: string;
    email?: string;
    whatsapp?: string;
  };
  escopo: {
    origem: 'portal_paciente';
    categorias: ('perfil' | 'consultas' | 'formularios' | 'comunicacoes' | 'acompanhamento' | 'lgpd')[];
    observacoes: string[];
  };
  pacote: {
    perfil: {
      paciente: PortalPacienteApi['paciente'];
      perfil: PortalPacienteApi['perfil'];
    };
    consultas: PortalPacienteApi['consultasProximas'];
    formularios: {
      pendentes: PortalPacienteApi['formulariosPendentes'];
      respondidos: DetalheFormularioRespondidoApi[];
    };
    comunicacoes: {
      mensagens: PortalPacienteApi['mensagensRecentes'];
      notificacoes: PortalPacienteApi['notificacoesPaciente'];
    };
    acompanhamento: {
      tarefas: NonNullable<PortalPacienteApi['tarefasAcompanhamento']>;
      materiais: NonNullable<PortalPacienteApi['materiaisDisponiveis']>;
      diarios: NonNullable<PortalPacienteApi['diariosRecentes']>;
    };
    lgpd: LgpdPortalPacienteApi;
  };
  integridade: {
    algoritmo: 'sha256';
    hash: string;
  };
  dados: PortalPacienteApi;
}

export interface SolicitacaoLgpdApi {
  protocolo: string;
  pacienteId: string;
  tipo: 'retificacao' | 'exclusao';
  status: 'recebida';
  criadoEm: string;
}

class ErroApiPortal extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiPortal';
  }
}

async function extrairMensagemErro(resposta: Response): Promise<string> {
  const detalhe = await resposta.text();
  if (!detalhe) return `Falha HTTP ${resposta.status}`;

  try {
    const corpo = JSON.parse(detalhe) as { mensagem?: string; message?: string };
    return corpo.mensagem ?? corpo.message ?? detalhe;
  } catch {
    return detalhe;
  }
}

export async function obterPortalPaciente(): Promise<PortalPacienteApi> {
  const resposta = await fetch('/api/portal/paciente', { cache: 'no-store' });
  if (!resposta.ok) {
    throw new ErroApiPortal(resposta.status, await extrairMensagemErro(resposta));
  }
  return resposta.json() as Promise<PortalPacienteApi>;
}

export async function desmarcarConsultaPaciente(consultaId: string): Promise<void> {
  const resposta = await fetch(`/api/portal/paciente/consultas/${consultaId}/desmarcar`, { method: 'POST' });
  if (!resposta.ok) {
    throw new ErroApiPortal(resposta.status, await extrairMensagemErro(resposta));
  }
}

export async function obterFormularioRespondidoPaciente(
  respostaId: string,
  opcoes?: { signal?: AbortSignal }
): Promise<DetalheFormularioRespondidoApi> {
  const resposta = await fetch(`/api/portal/paciente/formularios-respondidos/${respostaId}`, {
    cache: 'no-store',
    signal: opcoes?.signal
  });
  if (!resposta.ok) {
    throw new ErroApiPortal(resposta.status, await extrairMensagemErro(resposta));
  }
  return resposta.json() as Promise<DetalheFormularioRespondidoApi>;
}

export async function atualizarPerfilPaciente(dados: AtualizarPerfilPacienteEntrada): Promise<PerfilPacienteAtualizadoApi> {
  const resposta = await fetch('/api/portal/paciente/perfil', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados)
  });
  if (!resposta.ok) {
    throw new ErroApiPortal(resposta.status, await extrairMensagemErro(resposta));
  }
  return resposta.json() as Promise<PerfilPacienteAtualizadoApi>;
}

export async function registrarCheckinRapidoPaciente(dados: RegistrarCheckinRapidoEntrada): Promise<CheckinRapidoPacienteApi> {
  const resposta = await fetch('/api/portal/paciente/checkins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados)
  });
  if (!resposta.ok) {
    throw new ErroApiPortal(resposta.status, await extrairMensagemErro(resposta));
  }
  return resposta.json() as Promise<CheckinRapidoPacienteApi>;
}

export async function registrarOuEnfileirarCheckinRapidoPaciente(
  dados: Omit<RegistrarCheckinRapidoEntrada, 'idLocal'>
): Promise<{ estado: 'enviado'; checkin: CheckinRapidoPacienteApi } | { estado: 'pendente' }> {
  const idLocal = criarIdOperacaoPwa('checkin');
  const entrada = { ...dados, idLocal };
  try {
    return { estado: 'enviado', checkin: await registrarCheckinRapidoPaciente(entrada) };
  } catch (erro) {
    if (!ehFalhaDeRede(erro)) throw erro;
    await enfileirarOperacaoPwa({
      id: idLocal,
      tipo: 'checkin',
      endpoint: '/api/portal/paciente/checkins',
      method: 'POST',
      payload: entrada
    });
    return { estado: 'pendente' };
  }
}

export async function registrarConsentimentoLgpdPaciente(
  dados: RegistrarConsentimentoLgpdEntrada
): Promise<ConsentimentoLgpdRegistradoApi> {
  const resposta = await fetch('/api/portal/paciente/lgpd/consentimentos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados)
  });
  if (!resposta.ok) {
    throw new ErroApiPortal(resposta.status, await extrairMensagemErro(resposta));
  }
  return resposta.json() as Promise<ConsentimentoLgpdRegistradoApi>;
}

export async function exportarDadosLgpdPaciente(): Promise<ExportacaoDadosLgpdApi> {
  const resposta = await fetch('/api/portal/paciente/lgpd/exportacao', { cache: 'no-store' });
  if (!resposta.ok) {
    throw new ErroApiPortal(resposta.status, await extrairMensagemErro(resposta));
  }
  return resposta.json() as Promise<ExportacaoDadosLgpdApi>;
}

export async function registrarSolicitacaoLgpdPaciente(dados: {
  tipo: 'retificacao' | 'exclusao';
  detalhes?: string;
}): Promise<SolicitacaoLgpdApi> {
  const resposta = await fetch('/api/portal/paciente/lgpd/solicitacoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados)
  });
  if (!resposta.ok) {
    throw new ErroApiPortal(resposta.status, await extrairMensagemErro(resposta));
  }
  return resposta.json() as Promise<SolicitacaoLgpdApi>;
}

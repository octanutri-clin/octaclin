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
    scoreRisco: string;
    ultimoCheckinEm?: string;
  };
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
  };
  consultasProximas: {
    id: string;
    titulo: string;
    inicioEm: string;
    fimEm: string;
    status: string;
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
  diariosRecentes?: CheckinRapidoPacienteApi[];
  lgpd: LgpdPortalPacienteApi;
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
  versaoLgpd?: string;
  prefereEmail?: boolean;
  prefereWhatsapp?: boolean;
}

export interface RegistrarCheckinRapidoEntrada {
  humor: HumorCheckinRapidoPaciente;
  adesaoPlano: number;
  sintomas?: string;
  observacoes?: string;
}

export interface ConsentimentoLgpdRegistradoApi extends PerfilPacienteAtualizadoApi {
  lgpd: LgpdPortalPacienteApi;
}

export interface ExportacaoDadosLgpdApi {
  geradoEm: string;
  titular: {
    pacienteId: string;
    nome: string;
    email?: string;
    whatsapp?: string;
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

export async function obterFormularioRespondidoPaciente(respostaId: string): Promise<DetalheFormularioRespondidoApi> {
  const resposta = await fetch(`/api/portal/paciente/formularios-respondidos/${respostaId}`, { cache: 'no-store' });
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

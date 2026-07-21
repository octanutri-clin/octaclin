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
    preferenciasContato: {
      email: boolean;
      whatsapp: boolean;
    };
    dataNascimento?: string;
    profissionalResponsavelId: string;
    ultimoCheckinEm?: string;
  };
  resumo: {
    consultasProximas: number;
    formulariosPendentes: number;
    formulariosRespondidos: number;
    mensagensRecentes: number;
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
}

export interface PerfilPacienteAtualizadoApi {
  paciente: PortalPacienteApi['paciente'];
  perfil: PortalPacienteApi['perfil'];
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

export async function obterPortalPaciente(): Promise<PortalPacienteApi> {
  const resposta = await fetch('/api/portal/paciente', { cache: 'no-store' });
  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new ErroApiPortal(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }
  return resposta.json() as Promise<PortalPacienteApi>;
}

export async function obterFormularioRespondidoPaciente(respostaId: string): Promise<DetalheFormularioRespondidoApi> {
  const resposta = await fetch(`/api/portal/paciente/formularios-respondidos/${respostaId}`, { cache: 'no-store' });
  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new ErroApiPortal(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
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
    const detalhe = await resposta.text();
    throw new ErroApiPortal(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }
  return resposta.json() as Promise<PerfilPacienteAtualizadoApi>;
}

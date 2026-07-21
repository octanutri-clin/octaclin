export interface PortalPacienteApi {
  paciente: {
    id: string;
    nome: string;
    statusAdesao: string;
    scoreRisco: string;
    ultimoCheckinEm?: string;
  };
  resumo: {
    consultasProximas: number;
    formulariosPendentes: number;
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
  mensagensRecentes: {
    id: string;
    titulo: string;
    texto: string;
    status: string;
    criadoEm: string;
    enviadoEm?: string;
  }[];
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

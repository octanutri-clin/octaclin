export interface ConvitePacienteApi {
  id: string;
  pacienteId: string;
  email: string;
  status: string;
  expiraEm: string;
  token: string;
  linkAtivacao: string;
}

export interface ConvitePacientePublicoApi {
  pacienteId: string;
  nomePaciente: string;
  email: string;
  status: string;
  expiraEm: string;
}

export interface AtivacaoPacienteApi {
  pacienteId: string;
  usuarioId: string;
  tenantId: string;
  email: string;
  accessToken?: string;
  refreshToken?: string;
  tipoToken?: 'Bearer';
  expiraEmSegundos?: number;
  papel?: string;
  permissoes?: string[];
  escopoDados?: string;
  destinoInicial: string;
}

export class ErroApiConvitePaciente extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiConvitePaciente';
  }
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers
    }
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    let mensagem = detalhe || `Falha HTTP ${resposta.status}`;
    try {
      const corpo = JSON.parse(detalhe) as { mensagem?: string; message?: string };
      mensagem = corpo.mensagem ?? corpo.message ?? mensagem;
    } catch {
      // Mantem a mensagem textual retornada pelo backend.
    }
    throw new ErroApiConvitePaciente(resposta.status, mensagem);
  }

  return resposta.json() as Promise<T>;
}

export async function criarConvitePaciente(pacienteId: string, email: string): Promise<ConvitePacienteApi> {
  return requisitar<ConvitePacienteApi>(`/api/pacientes/${encodeURIComponent(pacienteId)}/convites-acesso`, {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export async function revogarConvitePaciente(pacienteId: string): Promise<{ conviteId: string; revogadoEm: string }> {
  return requisitar(`/api/pacientes/${encodeURIComponent(pacienteId)}/convites-acesso`, { method: 'DELETE' });
}

export async function obterConvitePaciente(token: string): Promise<ConvitePacientePublicoApi> {
  return requisitar<ConvitePacientePublicoApi>(`/api/pacientes/convites-acesso/${encodeURIComponent(token)}`);
}

export async function ativarConvitePaciente(entrada: {
  token: string;
  senha: string;
  aceiteLgpd: boolean;
  aceiteTermosUso: boolean;
  aceitePoliticaPrivacidade: boolean;
  versaoLgpd?: string;
  versaoTermosUso?: string;
  versaoPoliticaPrivacidade?: string;
}): Promise<AtivacaoPacienteApi> {
  return requisitar<AtivacaoPacienteApi>('/api/pacientes/convites-acesso/ativar', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

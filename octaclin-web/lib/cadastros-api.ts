export interface RespostaPaginada<T> {
  itens: T[];
  total: number;
}

export interface PacienteResumo {
  id: string;
  tenantId: string;
  usuarioId?: string;
  profissionalResponsavelId: string;
  nome: string;
  contato?: string;
  dataNascimento?: string;
  statusAdesao: string;
  scoreRisco: string;
  ultimoCheckinEm?: string;
  ultimaConsultaConcluidaEm?: string;
  proximaConsultaEm?: string;
  criadoEm: string;
}

export interface ProfissionalResumo {
  id: string;
  tenantId: string;
  usuarioId: string;
  nome: string;
  registroProfissional?: string;
  especialidade?: string;
  criadoEm: string;
}

export interface SalvarPacienteEntrada {
  profissionalResponsavelId: string;
  nome: string;
  contato?: string;
  dataNascimento?: string;
  statusAdesao?: 'novo' | 'aderente' | 'em_acompanhamento' | 'risco' | 'inativo';
  scoreRisco?: number;
}

export interface SalvarProfissionalEntrada {
  email?: string;
  senhaInicial?: string;
  nome: string;
  registroProfissional?: string;
  especialidade?: string;
}

class ErroApiCadastros extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiCadastros';
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
    throw new ErroApiCadastros(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }

  return resposta.json() as Promise<T>;
}

async function requisitarSemConteudo(caminho: string, init?: RequestInit): Promise<void> {
  const resposta = await fetch(caminho, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers
    }
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new ErroApiCadastros(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }
}

export async function listarPacientes(): Promise<RespostaPaginada<PacienteResumo>> {
  return requisitar<RespostaPaginada<PacienteResumo>>('/api/pacientes?pagina=1&limite=25');
}

export async function criarPaciente(entrada: SalvarPacienteEntrada): Promise<PacienteResumo> {
  return requisitar<PacienteResumo>('/api/pacientes', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function atualizarPaciente(id: string, entrada: SalvarPacienteEntrada): Promise<PacienteResumo> {
  return requisitar<PacienteResumo>(`/api/pacientes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(entrada)
  });
}

export async function arquivarPaciente(id: string): Promise<void> {
  return requisitarSemConteudo(`/api/pacientes/${id}`, { method: 'DELETE' });
}

export async function listarProfissionais(): Promise<RespostaPaginada<ProfissionalResumo>> {
  return requisitar<RespostaPaginada<ProfissionalResumo>>('/api/profissionais?pagina=1&limite=25');
}

export async function criarProfissional(entrada: SalvarProfissionalEntrada): Promise<ProfissionalResumo> {
  return requisitar<ProfissionalResumo>('/api/profissionais', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function atualizarProfissional(id: string, entrada: SalvarProfissionalEntrada): Promise<ProfissionalResumo> {
  return requisitar<ProfissionalResumo>(`/api/profissionais/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(entrada)
  });
}

export async function arquivarProfissional(id: string): Promise<void> {
  return requisitarSemConteudo(`/api/profissionais/${id}`, { method: 'DELETE' });
}

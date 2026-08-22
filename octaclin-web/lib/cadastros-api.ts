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
  arquivadoEm?: string | null;
  criadoEm: string;
}

export interface ProfissionalResumo {
  id: string;
  tenantId: string;
  usuarioId: string;
  nome: string;
  registroProfissional?: string;
  especialidade?: string;
  arquivadoEm?: string | null;
  criadoEm: string;
}

export interface SalvarPacienteEntrada {
  profissionalResponsavelId: string;
  nome: string;
  contato?: string;
  dataNascimento?: string;
  statusAdesao?: 'novo' | 'aderente' | 'em_acompanhamento' | 'risco' | 'inativo';
  scoreRisco?: number;
  candidatosDuplicidadeDispensados?: string[];
}

export type OrigemFiltroSalvoPaciente = 'pessoal' | 'clinica';

export interface CriteriosFiltroSalvoPaciente {
  risco?: 'alto' | 'medio' | 'baixo';
  status?: string;
  profissionalId?: string;
  semProximaConsulta?: boolean;
}

export interface FiltroSalvoPaciente {
  id: string;
  nome: string;
  origem: OrigemFiltroSalvoPaciente;
  criterios: CriteriosFiltroSalvoPaciente;
  atualizadoEm: string;
}

export interface CandidatoDuplicidadePaciente {
  pacienteId: string;
  nome: string;
  motivos: Array<'nome_e_nascimento' | 'contato' | 'nome'>;
}

export interface SalvarProfissionalEntrada {
  email?: string;
  senhaInicial?: string;
  nome: string;
  registroProfissional?: string;
  especialidade?: string;
}

export interface FiltrosPacientes {
  pagina?: number;
  limite?: number;
  busca?: string;
  risco?: 'alto' | 'medio' | 'baixo';
  profissionalId?: string;
  status?: string;
  semProximaConsulta?: boolean;
}

export interface FiltrosPaginacao {
  pagina?: number;
  limite?: number;
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

export type SituacaoLinhaImportacao = 'valido' | 'invalido' | 'duplicado' | 'limite_plano';

export interface LinhaImportacaoPaciente {
  linha: number;
  nome?: string;
  contato?: string;
  dataNascimento?: string;
  anexo?: string;
  pacienteId?: string;
  linkConvite?: string;
  situacao: SituacaoLinhaImportacao;
  erros: string[];
  avisos: string[];
}

export interface RelatorioImportacaoPacientes {
  total: number;
  validos: number;
  duplicados: number;
  invalidos: number;
  bloqueadosPorPlano: number;
  criados: number;
  convitesCriados: number;
  linhas: LinhaImportacaoPaciente[];
}

/** `previa: true` valida e devolve o relatorio sem gravar nada. */
export async function importarPacientes(
  conteudo: string,
  opcoes: { previa?: boolean; profissionalResponsavelId?: string; enviarConvite?: boolean } = {}
): Promise<RelatorioImportacaoPacientes> {
  return requisitar<RelatorioImportacaoPacientes>(`/api/pacientes/importar${opcoes.previa ? '?previa=1' : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conteudo,
      profissionalResponsavelId: opcoes.profissionalResponsavelId,
      enviarConvite: opcoes.enviarConvite
    })
  });
}

export async function listarPacientes(filtros: FiltrosPacientes = {}): Promise<RespostaPaginada<PacienteResumo>> {
  const parametros = new URLSearchParams({
    pagina: String(filtros.pagina ?? 1),
    limite: String(filtros.limite ?? 25)
  });
  if (filtros.busca?.trim()) parametros.set('busca', filtros.busca.trim());
  if (filtros.risco) parametros.set('risco', filtros.risco);
  if (filtros.profissionalId) parametros.set('profissionalId', filtros.profissionalId);
  if (filtros.status) parametros.set('status', filtros.status);
  if (filtros.semProximaConsulta) parametros.set('semProximaConsulta', 'true');
  return requisitar<RespostaPaginada<PacienteResumo>>(`/api/pacientes?${parametros}`);
}

export async function obterPaciente(id: string): Promise<PacienteResumo> {
  return requisitar<PacienteResumo>(`/api/pacientes/${encodeURIComponent(id)}`);
}

export async function criarPaciente(entrada: SalvarPacienteEntrada): Promise<PacienteResumo> {
  return requisitar<PacienteResumo>('/api/pacientes', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function listarFiltrosSalvosPacientes(): Promise<{ itens: FiltroSalvoPaciente[] }> {
  return requisitar<{ itens: FiltroSalvoPaciente[] }>('/api/pacientes/filtros-salvos');
}

export async function criarFiltroSalvoPaciente(entrada: {
  nome: string;
  origem: OrigemFiltroSalvoPaciente;
  criterios: CriteriosFiltroSalvoPaciente;
}): Promise<FiltroSalvoPaciente> {
  return requisitar<FiltroSalvoPaciente>('/api/pacientes/filtros-salvos', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function arquivarFiltroSalvoPaciente(id: string): Promise<void> {
  return requisitarSemConteudo(`/api/pacientes/filtros-salvos/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function verificarDuplicidadePaciente(entrada: {
  nome: string;
  contato?: string;
  dataNascimento?: string;
}, signal?: AbortSignal): Promise<{ candidatos: CandidatoDuplicidadePaciente[] }> {
  return requisitar<{ candidatos: CandidatoDuplicidadePaciente[] }>('/api/pacientes/verificacao-duplicidade', {
    method: 'POST',
    body: JSON.stringify(entrada),
    signal
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

export async function listarPacientesArquivados(filtros: FiltrosPaginacao = {}): Promise<RespostaPaginada<PacienteResumo>> {
  const parametros = new URLSearchParams({ pagina: String(filtros.pagina ?? 1), limite: String(filtros.limite ?? 25) });
  return requisitar<RespostaPaginada<PacienteResumo>>(`/api/pacientes/arquivados?${parametros}`);
}

export async function restaurarPaciente(id: string): Promise<void> {
  return requisitarSemConteudo(`/api/pacientes/${encodeURIComponent(id)}/restaurar`, { method: 'PATCH' });
}

export async function listarProfissionais(filtros: FiltrosPaginacao = {}): Promise<RespostaPaginada<ProfissionalResumo>> {
  const parametros = new URLSearchParams({
    pagina: String(filtros.pagina ?? 1),
    limite: String(filtros.limite ?? 25)
  });
  return requisitar<RespostaPaginada<ProfissionalResumo>>(`/api/profissionais?${parametros}`);
}

export async function obterProfissional(id: string): Promise<ProfissionalResumo | null> {
  try {
    return await requisitar<ProfissionalResumo>(`/api/profissionais/${encodeURIComponent(id)}`);
  } catch (erro) {
    if (erro instanceof ErroApiCadastros && erro.status === 404) return null;
    throw erro;
  }
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

export async function listarProfissionaisArquivados(filtros: FiltrosPaginacao = {}): Promise<RespostaPaginada<ProfissionalResumo>> {
  const parametros = new URLSearchParams({ pagina: String(filtros.pagina ?? 1), limite: String(filtros.limite ?? 25) });
  return requisitar<RespostaPaginada<ProfissionalResumo>>(`/api/profissionais/arquivados?${parametros}`);
}

export async function restaurarProfissional(id: string): Promise<void> {
  return requisitarSemConteudo(`/api/profissionais/${encodeURIComponent(id)}/restaurar`, { method: 'PATCH' });
}

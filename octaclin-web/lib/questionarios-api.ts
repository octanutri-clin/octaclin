import { PacienteResumo, ProfissionalResumo, listarPacientes, listarProfissionais } from './cadastros-api';

export type TipoPergunta =
  | 'likert'
  | 'multipla_escolha'
  | 'linear'
  | 'metrica'
  | 'upload_midia'
  | 'texto_longo'
  | 'sim_nao';

export interface RespostaPaginada<T> {
  itens: T[];
  total: number;
}

export interface CategoriaPerguntaApi {
  id: string;
  tenantId: string;
  nome: string;
  iconeSvg: string;
  corHex: string;
  ordem: number;
}

export interface QuestionarioApi {
  id: string;
  tenantId: string;
  profissionalId: string;
  titulo: string;
  descricao?: string;
  status: 'rascunho' | 'publicado' | 'arquivado';
  versao: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface EnvioQuestionarioApi {
  id: string;
  tenantId: string;
  questionarioId: string;
  pacienteId: string;
  status: 'pendente' | 'enviado' | 'respondido' | 'expirado';
  enviadoEm?: string;
  respondidoEm?: string;
  revisadoEm?: string;
  revisadoPorUsuarioId?: string;
  expiraEm?: string;
  tokenFormulario: string;
  linkFormulario: string;
}

export interface RevisaoEnvioQuestionarioApi {
  id: string;
  status: 'respondido';
  revisadoEm?: string;
  revisadoPorUsuarioId?: string;
}

export interface RespostaQuestionarioRecebidaApi {
  respostaId: string;
  envioId: string;
  pacienteId: string;
  questionarioId: string;
  finalizadoEm?: string;
  totalRespostas: number;
  respostas: {
    perguntaId: string;
    enunciado: string;
    tipo: TipoPergunta;
    valor: unknown;
  }[];
}

export interface LeituraClinicaQuestionarioApi {
  questionarioId: string;
  filtroPacienteId?: string;
  resumo: {
    totalRespostas: number;
    totalPacientes: number;
    totalPerguntas: number;
    mediaRespostasPorEnvio: number;
    ultimaRespostaEm?: string;
  };
  pacientes: {
    pacienteId: string;
    totalRespostas: number;
    totalValoresRespondidos: number;
    mediaRespostasPorEnvio: number;
    ultimaRespostaEm?: string;
  }[];
  perguntas: {
    perguntaId: string;
    enunciado: string;
    tipo: TipoPergunta;
    totalRespostas: number;
    totalSim?: number;
    totalNao?: number;
    mediaNumerica?: number;
    textosRecentes: string[];
    distribuicao: { valor: string; total: number }[];
  }[];
  respostas: RespostaQuestionarioRecebidaApi[];
}

export interface ModeloQuestionarioApi {
  id: string;
  titulo: string;
  descricao: string;
  objetivo: string;
  estimativaMinutos: number;
  totalPerguntas: number;
  secoes: string[];
}

export interface PerguntaApi {
  id: string;
  tenantId: string;
  questionarioId: string;
  categoriaId: string;
  tipo: TipoPergunta;
  enunciado: string;
  peso: string;
  obrigatoria: boolean;
  configuracao: Record<string, unknown>;
  opcoes?: OpcaoPerguntaApi[];
  ordem: number;
  chaveClinica?: string;
  visivelBiblioteca: boolean;
}

export interface OpcaoPerguntaApi {
  id: string;
  tenantId: string;
  perguntaId: string;
  rotulo: string;
  valor: string;
  imagemUrl?: string;
  ordem: number;
}

export interface CriarQuestionarioEntrada {
  profissionalId: string;
  titulo: string;
  descricao?: string;
}

export interface CriarQuestionarioModeloEntrada {
  profissionalId: string;
  titulo?: string;
  descricao?: string;
}

export interface AtualizarQuestionarioEntrada {
  titulo?: string;
  descricao?: string;
  status?: 'rascunho' | 'publicado' | 'arquivado';
}

export interface SalvarPerguntaEntrada {
  categoriaId: string;
  tipo: TipoPergunta;
  enunciado: string;
  peso: number;
  obrigatoria: boolean;
  chaveClinica?: string;
  visivelBiblioteca?: boolean;
  configuracao?: Record<string, unknown>;
  opcoes?: {
    rotulo: string;
    valor: string;
    imagemUrl?: string;
  }[];
}

export interface BootstrapQuestionarios {
  categorias: CategoriaPerguntaApi[];
  profissionais: ProfissionalResumo[];
  pacientes: PacienteResumo[];
  questionarios: RespostaPaginada<QuestionarioApi>;
  modelos: ModeloQuestionarioApi[];
}

const categoriasPadrao = [
  { nome: 'Nutricao', iconeSvg: 'utensils', corHex: '#247BA0', ordem: 1 },
  { nome: 'Sono', iconeSvg: 'moon', corHex: '#6A5ACD', ordem: 2 },
  { nome: 'Atividade fisica', iconeSvg: 'activity', corHex: '#2F9E44', ordem: 3 },
  { nome: 'Emocional', iconeSvg: 'heart', corHex: '#C77D1A', ordem: 4 }
];

export class ErroApiQuestionarios extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiQuestionarios';
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
    throw new ErroApiQuestionarios(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }

  return resposta.json() as Promise<T>;
}

export async function listarCategorias(): Promise<CategoriaPerguntaApi[]> {
  return requisitar<CategoriaPerguntaApi[]>('/api/categorias-pergunta');
}

export async function criarCategoria(entrada: (typeof categoriasPadrao)[number]): Promise<CategoriaPerguntaApi> {
  return requisitar<CategoriaPerguntaApi>('/api/categorias-pergunta', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function garantirCategoriasPadrao(): Promise<CategoriaPerguntaApi[]> {
  const existentes = await listarCategorias();
  if (existentes.length) return existentes;

  await Promise.all(categoriasPadrao.map((categoria) => criarCategoria(categoria)));
  return listarCategorias();
}

export async function listarQuestionarios(): Promise<RespostaPaginada<QuestionarioApi>> {
  return requisitar<RespostaPaginada<QuestionarioApi>>('/api/questionarios?pagina=1&limite=25');
}

export async function listarModelosQuestionario(): Promise<ModeloQuestionarioApi[]> {
  return requisitar<ModeloQuestionarioApi[]>('/api/questionarios/modelos');
}

export async function criarQuestionario(entrada: CriarQuestionarioEntrada): Promise<QuestionarioApi> {
  return requisitar<QuestionarioApi>('/api/questionarios', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function criarQuestionarioAPartirModelo(
  modeloId: string,
  entrada: CriarQuestionarioModeloEntrada
): Promise<QuestionarioApi> {
  return requisitar<QuestionarioApi>(`/api/questionarios/modelos/${modeloId}/criar`, {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function atualizarQuestionario(
  id: string,
  entrada: AtualizarQuestionarioEntrada
): Promise<QuestionarioApi> {
  return requisitar<QuestionarioApi>(`/api/questionarios/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(entrada)
  });
}

export async function duplicarQuestionario(id: string, entrada: { titulo?: string } = {}): Promise<QuestionarioApi> {
  return requisitar<QuestionarioApi>(`/api/questionarios/${id}/duplicar`, {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function listarPerguntas(questionarioId: string): Promise<PerguntaApi[]> {
  return requisitar<PerguntaApi[]>(`/api/questionarios/${questionarioId}/perguntas`);
}

export async function listarBibliotecaPerguntas(filtros: { busca?: string; categoriaId?: string } = {}): Promise<PerguntaApi[]> {
  const parametros = new URLSearchParams();
  if (filtros.busca) parametros.set('busca', filtros.busca);
  if (filtros.categoriaId) parametros.set('categoriaId', filtros.categoriaId);
  const consulta = parametros.toString();
  return requisitar<PerguntaApi[]>(`/api/biblioteca-perguntas${consulta ? `?${consulta}` : ''}`);
}

export async function incluirPerguntaBiblioteca(questionarioId: string, perguntaId: string): Promise<PerguntaApi> {
  return requisitar<PerguntaApi>(`/api/biblioteca-perguntas/${perguntaId}/incluir`, {
    method: 'POST',
    body: JSON.stringify({ questionarioId })
  });
}

export async function criarPergunta(questionarioId: string, entrada: SalvarPerguntaEntrada): Promise<PerguntaApi> {
  return requisitar<PerguntaApi>(`/api/questionarios/${questionarioId}/perguntas`, {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function atualizarPergunta(
  questionarioId: string,
  perguntaId: string,
  entrada: SalvarPerguntaEntrada
): Promise<PerguntaApi> {
  return requisitar<PerguntaApi>(`/api/questionarios/${questionarioId}/perguntas/${perguntaId}`, {
    method: 'PATCH',
    body: JSON.stringify(entrada)
  });
}

export async function reordenarPerguntas(questionarioId: string, perguntas: { id: string; ordem: number }[]) {
  return requisitar<PerguntaApi[]>(`/api/questionarios/${questionarioId}/perguntas/ordem`, {
    method: 'PATCH',
    body: JSON.stringify({ perguntas })
  });
}

export async function criarAgendamentoQuestionario(entrada: {
  questionarioId: string;
  pacienteId: string;
  regraCron?: string;
  dataFixa?: string;
  timezone?: string;
}) {
  return requisitar('/api/agendamentos-questionario', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function criarEnvioQuestionario(
  questionarioId: string,
  entrada: { pacienteId: string; expiraEm?: string }
): Promise<EnvioQuestionarioApi> {
  return requisitar<EnvioQuestionarioApi>(`/api/questionarios/${questionarioId}/envios`, {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function revisarEnvioQuestionario(envioId: string): Promise<RevisaoEnvioQuestionarioApi> {
  return requisitar<RevisaoEnvioQuestionarioApi>(
    `/api/questionarios/envios/${encodeURIComponent(envioId)}/revisar`,
    { method: 'POST' }
  );
}

export async function listarRespostasQuestionario(questionarioId: string): Promise<RespostaQuestionarioRecebidaApi[]> {
  return requisitar<RespostaQuestionarioRecebidaApi[]>(`/api/questionarios/${questionarioId}/respostas`);
}

export async function obterLeituraClinicaQuestionario(
  questionarioId: string,
  filtros: { pacienteId?: string } = {}
): Promise<LeituraClinicaQuestionarioApi> {
  const parametros = new URLSearchParams();
  if (filtros.pacienteId) parametros.set('pacienteId', filtros.pacienteId);
  const consulta = parametros.toString();
  return requisitar<LeituraClinicaQuestionarioApi>(
    `/api/questionarios/${questionarioId}/respostas/leitura-clinica${consulta ? `?${consulta}` : ''}`
  );
}

export async function carregarBootstrapQuestionarios(): Promise<BootstrapQuestionarios> {
  const [categorias, profissionais, pacientes, questionarios, modelos] = await Promise.all([
    garantirCategoriasPadrao(),
    listarProfissionais().then((resposta) => resposta.itens),
    listarPacientes().then((resposta) => resposta.itens),
    listarQuestionarios(),
    listarModelosQuestionario()
  ]);

  return { categorias, profissionais, pacientes, questionarios, modelos };
}

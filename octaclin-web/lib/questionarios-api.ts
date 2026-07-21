import { ProfissionalResumo, listarProfissionais } from './cadastros-api';

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
  regraCron?: string;
  dataFixa?: string;
  timezone?: string;
}) {
  return requisitar('/api/agendamentos-questionario', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function carregarBootstrapQuestionarios(): Promise<BootstrapQuestionarios> {
  const [categorias, profissionais, questionarios, modelos] = await Promise.all([
    garantirCategoriasPadrao(),
    listarProfissionais().then((resposta) => resposta.itens),
    listarQuestionarios(),
    listarModelosQuestionario()
  ]);

  return { categorias, profissionais, questionarios, modelos };
}

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

export interface RevisaoFormularioPendenteApi {
  id: string;
  pacienteId: string;
  pacienteNome: string;
  respondidoEm?: string;
}

export interface PaginaRevisoesFormularioApi {
  pagina: number;
  tamanho: number;
  total: number;
  itens: RevisaoFormularioPendenteApi[];
}

export interface DetalheRevisaoFormularioApi {
  id: string;
  pacienteId: string;
  pacienteNome: string;
  titulo: string;
  respondidoEm?: string;
  finalizadoEm: string;
  proximaConsultaEm?: string;
  revisadoEm?: string;
  versaoHistoricaDisponivel: boolean;
  comprovanteLeitura?: string;
  respostas: { perguntaId: string; enunciado: string; tipo: TipoPergunta; valor: unknown }[];
}

export function listarRevisoesFormulario(pagina: number): Promise<PaginaRevisoesFormularioApi> {
  return requisitar<PaginaRevisoesFormularioApi>(`/api/questionarios/revisoes/pendentes?pagina=${pagina}`);
}

export function obterRevisaoFormulario(envioId: string): Promise<DetalheRevisaoFormularioApi> {
  return requisitar<DetalheRevisaoFormularioApi>(`/api/questionarios/revisoes/${encodeURIComponent(envioId)}`);
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

export interface PaginaRespostasApi extends LeituraClinicaQuestionarioApi {
  filtros: {pacienteId?: string; inicio?: string; fim?: string; tamanho:25|50|100};
  timezone:string; totalConsulta:number; proximoCursor:string|null;
}
export async function obterPaginaRespostas(questionarioId:string, filtros:{pacienteId?:string;inicio?:string;fim?:string;tamanho?:number;cursor?:string}={}):Promise<PaginaRespostasApi> {
  const query=new URLSearchParams(Object.entries(filtros).filter(([,v])=>v!==undefined&&v!=='').map(([k,v])=>[k,String(v)]));
  return requisitar<PaginaRespostasApi>(`/api/questionarios/${encodeURIComponent(questionarioId)}/respostas/pagina?${query}`);
}

export interface MatrizLongitudinalRespostasApi {
  filtros: {
    pacienteId?: string;
    questionarioId?: string;
    categoriaId?: string;
    inicioEm?: string;
    fimEm?: string;
  };
  resumo: {
    totalRespostas: number;
    totalIndicadores: number;
    primeiraRespostaEm?: string;
    ultimaRespostaEm?: string;
  };
  indicadores: {
    pacienteId: string;
    questionarioId: string;
    questionarioTitulo: string;
    perguntaId: string;
    categoriaId: string;
    enunciado: string;
    tipo: Extract<TipoPergunta, 'likert' | 'linear' | 'metrica'>;
    unidade?: string;
    atual: { valor: number; finalizadoEm: string };
    anterior?: { valor: number; finalizadoEm: string };
    delta?: number;
    historico: { valor: number; finalizadoEm: string }[];
  }[];
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

export async function listarQuestionarios(
  filtros: { pagina?: number; limite?: number; busca?: string } = {}
): Promise<RespostaPaginada<QuestionarioApi>> {
  const parametros = new URLSearchParams({
    pagina: String(filtros.pagina ?? 1),
    limite: String(filtros.limite ?? 25)
  });
  if (filtros.busca) parametros.set('busca', filtros.busca);
  return requisitar<RespostaPaginada<QuestionarioApi>>(`/api/questionarios?${parametros.toString()}`);
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

export function criarEnviosQuestionarioLote(questionarioId: string, pacienteIds: string[]): Promise<{ total: number }> {
  return requisitar<{ total: number }>(`/api/questionarios/${encodeURIComponent(questionarioId)}/envios/lote`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pacienteIds })
  });
}

export async function revisarEnvioQuestionario(envioId: string, comprovanteLeitura: string): Promise<RevisaoEnvioQuestionarioApi> {
  return requisitar<RevisaoEnvioQuestionarioApi>(
    `/api/questionarios/envios/${encodeURIComponent(envioId)}/revisar`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comprovanteLeitura }) }
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

export interface PerguntaVersaoQuestionarioApi {
  id: string;
  categoriaId: string;
  tipo: TipoPergunta;
  enunciado: string;
  peso: string;
  obrigatoria: boolean;
  configuracao: Record<string, unknown>;
  ordem: number;
  opcoes: { id: string; rotulo: string; valor: string; imagemUrl?: string; ordem: number }[];
}

export interface VersaoQuestionarioApi {
  versaoQuestionario: number;
  titulo: string;
  descricao?: string;
  perguntas: PerguntaVersaoQuestionarioApi[];
  atual: boolean;
  capturadoEm?: string;
  totalEnvios: number;
}

export async function listarVersoesQuestionario(questionarioId: string): Promise<VersaoQuestionarioApi[]> {
  return requisitar<VersaoQuestionarioApi[]>(`/api/questionarios/${questionarioId}/versoes`);
}

export async function obterMatrizLongitudinalRespostas(filtros: MatrizLongitudinalRespostasApi['filtros']) {
  const parametros = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor) parametros.set(chave, valor);
  });
  const consulta = parametros.toString();
  return requisitar<MatrizLongitudinalRespostasApi>(`/api/questionarios/matriz-longitudinal${consulta ? `?${consulta}` : ''}`);
}

export async function carregarBootstrapQuestionarios(
  filtrosQuestionarios: { pagina?: number; limite?: number; busca?: string } = {}
): Promise<BootstrapQuestionarios> {
  const [categorias, profissionais, pacientes, questionarios, modelos] = await Promise.all([
    garantirCategoriasPadrao(),
    listarProfissionais().then((resposta) => resposta.itens),
    listarPacientes().then((resposta) => resposta.itens),
    listarQuestionarios(filtrosQuestionarios),
    listarModelosQuestionario()
  ]);

  return { categorias, profissionais, pacientes, questionarios, modelos };
}

export interface PreviaCopiaPergunta {
  revisao: string;
  definicao: {
    categoriaId: string; tipo: TipoPergunta; enunciado: string; peso: string;
    obrigatoria: boolean; configuracao: Record<string, unknown>; visivelBiblioteca: false;
    opcoes: { rotulo: string; valor: string; ordem: number; imagemUrl?: string | null }[];
  };
}
export function prepararCopiaPergunta(questionarioId: string, perguntaId: string) {
  return requisitar<PreviaCopiaPergunta>(`/api/questionarios/${encodeURIComponent(questionarioId)}/perguntas/${encodeURIComponent(perguntaId)}/copia`);
}
export function confirmarCopiaPergunta(questionarioId: string, perguntaId: string, revisaoEsperada: string) {
  return requisitar<{ perguntaId: string; versaoQuestionario: number }>(`/api/questionarios/${encodeURIComponent(questionarioId)}/perguntas/${encodeURIComponent(perguntaId)}/duplicar`, {
    method: 'POST', body: JSON.stringify({ revisaoEsperada })
  });
}


export interface ValidacaoEditorApi {
  versao: number;
  problemas: { perguntaId?: string; campo: string; codigo: string }[];
}
export async function consultarVersaoEditor(id: string): Promise<{ versao: number }> {
  return requisitar(`/api/questionarios/${id}/validacao`, { cache: 'no-store' });
}
export async function conferirQuestionario(id: string, entrada: { versaoEsperada: number; titulo: string; perguntas: { id: string; dados: Partial<SalvarPerguntaEntrada> }[] }): Promise<ValidacaoEditorApi> {
  return requisitar(`/api/questionarios/${id}/validacao`, { method: 'POST', body: JSON.stringify(entrada) });
}


export interface CompletudeHistoricaApi {
  respostaId: string;
  completude: {
    estado: 'disponivel' | 'desconhecido';
    motivo?: 'snapshot_ausente' | 'snapshot_invalido' | 'respostas_incompativeis';
    versaoQuestionario: number | null;
    totalPerguntas: number | null;
    respondidas: number | null;
    obrigatorias: number | null;
    obrigatoriasRespondidas: number | null;
  };
}
export async function obterCompletudeHistorica(questionarioId: string, respostaId: string, signal?: AbortSignal): Promise<CompletudeHistoricaApi> {
  return requisitar(`/api/questionarios/${questionarioId}/respostas/${respostaId}/completude`, { cache: 'no-store', signal });
}

export type AgendamentoQuestionarioApi = ReturnType<typeof import('./server/questionarios-agendamentos-bff').projetarAgendaQst>;
export function listarAgendamentosQuestionario(questionarioId:string,pacienteId:string,pagina=1){
  return requisitar<{itens:AgendamentoQuestionarioApi[];pagina:number;temMais:boolean}>(
    `/api/questionarios/${encodeURIComponent(questionarioId)}/agendamentos?${new URLSearchParams({pacienteId,pagina:String(pagina)})}`);
}
export function comandarAgendamentoQuestionario(questionarioId:string,agendamento:AgendamentoQuestionarioApi,acao:'pausar'|'retomar'|'reconfirmar'){
  return requisitar<AgendamentoQuestionarioApi>(`/api/questionarios/${encodeURIComponent(questionarioId)}/agendamentos/${encodeURIComponent(agendamento.id)}/comandos`,{
    method:'POST',body:JSON.stringify({pacienteId:agendamento.pacienteId,acao,revisaoEsperada:agendamento.revisao,confirmar:true}),
  });
}

export type ComparacaoRetornosApi = ReturnType<typeof import('./server/questionarios-comparacao-bff').projetarComparacaoQst>;
export function compararRetornosQuestionario(questionarioId: string, pacienteId: string, respostaIds: string[]) {
  return requisitar<ComparacaoRetornosApi>(`/api/questionarios/${encodeURIComponent(questionarioId)}/respostas/comparacao`, {
    method: 'POST', body: JSON.stringify({ pacienteId, respostaIds }),
  });
}

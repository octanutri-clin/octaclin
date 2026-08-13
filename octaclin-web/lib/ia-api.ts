import { PacienteResumo, RespostaPaginada, listarPacientes } from './cadastros-api';

export interface AnaliseSentimentoApi {
  id: string;
  tenantId: string;
  pacienteId: string;
  respostaCheckinId?: string;
  transcricaoMidiaId?: string;
  modelo: string;
  ansiedadeScore: string;
  frustracaoScore: string;
  motivacaoScore: string;
  confusaoScore: string;
  explicacao: Record<string, unknown>;
  alertaDisparado: boolean;
  revisaoHumana: RevisaoHumanaIaApi;
  criadoEm: string;
}

export interface ReconhecimentoAlimentarApi {
  id: string;
  tenantId: string;
  pacienteId: string;
  arquivoMidiaId: string;
  provedor: string;
  imagemHash: string;
  alimentosDetectados: Array<Record<string, unknown>>;
  pesoEstimadoGramas?: string;
  caloriasEstimadas?: string;
  confiancaMedia?: string;
  limitacoes: string[];
  revisaoHumana: RevisaoHumanaIaApi;
  criadoEm: string;
}

export type DecisaoRevisaoIaApi = 'aceita' | 'editada' | 'rejeitada';

export interface RevisaoHumanaIaApi {
  status: 'pendente' | DecisaoRevisaoIaApi;
  revisadoPor?: string;
  revisadoEm?: string;
  observacao?: string;
  conteudoEditado?: Record<string, unknown>;
}

export interface AnalisarSentimentoEntrada {
  pacienteId: string;
  texto: string;
  respostaCheckinId?: string;
  transcricaoMidiaId?: string;
  contexto?: Record<string, unknown>;
}

export interface ReconhecerAlimentoEntrada {
  pacienteId: string;
  arquivoMidiaId: string;
  contexto?: Record<string, unknown>;
}

export interface BootstrapIa {
  pacientes: RespostaPaginada<PacienteResumo>;
  analises: AnaliseSentimentoApi[];
  reconhecimentos: ReconhecimentoAlimentarApi[];
}

class ErroApiIa extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiIa';
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
    throw new ErroApiIa(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }

  return resposta.json() as Promise<T>;
}

export async function analisarSentimento(entrada: AnalisarSentimentoEntrada): Promise<AnaliseSentimentoApi> {
  return requisitar<AnaliseSentimentoApi>('/api/ia/sentimento', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function listarAnalisesSentimento(): Promise<AnaliseSentimentoApi[]> {
  return requisitar<AnaliseSentimentoApi[]>('/api/ia/sentimento');
}

export async function reconhecerAlimento(entrada: ReconhecerAlimentoEntrada): Promise<ReconhecimentoAlimentarApi> {
  return requisitar<ReconhecimentoAlimentarApi>('/api/ia/reconhecimento-alimentar', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function listarReconhecimentosAlimentares(): Promise<ReconhecimentoAlimentarApi[]> {
  return requisitar<ReconhecimentoAlimentarApi[]>('/api/ia/reconhecimento-alimentar');
}

export async function revisarSugestaoIa<T extends AnaliseSentimentoApi | ReconhecimentoAlimentarApi>(
  tipo: 'sentimento' | 'reconhecimento-alimentar',
  id: string,
  decisao: DecisaoRevisaoIaApi,
  conteudoEditado?: Record<string, unknown>
): Promise<T> {
  return requisitar<T>(`/api/ia/${tipo}/${id}/revisao`, {
    method: 'PATCH',
    body: JSON.stringify({ decisao, conteudoEditado })
  });
}

export async function carregarBootstrapIa(): Promise<BootstrapIa> {
  const [pacientes, analises, reconhecimentos] = await Promise.all([
    listarPacientes(),
    listarAnalisesSentimento(),
    listarReconhecimentosAlimentares()
  ]);
  return { pacientes, analises, reconhecimentos };
}

import { PacienteResumo, RespostaPaginada, listarPacientes } from './cadastros-api';

export type TipoDiarioRapido = 'refeicao' | 'humor' | 'agua' | 'atividade';
export type TipoMidiaMobile = 'imagem' | 'audio' | 'video' | 'documento';
export type TipoItemSincronizacao = 'diario_rapido' | 'midia_captura' | 'midia_audio' | 'acompanhante';

export interface LogDiarioRapidoApi {
  id: string;
  tenantId: string;
  pacienteId: string;
  tipo: TipoDiarioRapido;
  valor: Record<string, unknown>;
  registradoEm: string;
}

export interface ArquivoMidiaApi {
  id: string;
  tenantId: string;
  pacienteId: string;
  tipo: TipoMidiaMobile;
  bucket: string;
  chaveObjeto: string;
  mimeType: string;
  tamanhoBytes: string;
  hashConteudo?: string;
  metadados: Record<string, unknown>;
  criadoEm: string;
}

export interface UploadMidiaApi {
  arquivo: ArquivoMidiaApi;
  uploadUrl: string;
}

export interface AcompanhanteApi {
  id: string;
  tenantId: string;
  pacienteId: string;
  ativo: boolean;
  criadoEm: string;
}

export interface ResultadoSincronizacaoMobile {
  idLocal: string;
  status: 'sincronizado' | 'erro';
  recursoId?: string;
  erro?: string;
}

export interface RespostaSincronizacaoMobile {
  resultados: ResultadoSincronizacaoMobile[];
}

export interface RegistrarDiarioRapidoEntrada {
  pacienteId: string;
  tipo: TipoDiarioRapido;
  valor: Record<string, unknown>;
}

export interface SolicitarUploadMidiaEntrada {
  pacienteId: string;
  tipo: TipoMidiaMobile;
  mimeType: string;
  tamanhoBytes: number;
  duracaoSegundos?: number;
  hashConteudo?: string;
}

export interface CriarAcompanhanteEntrada {
  pacienteId: string;
  nome: string;
  contato?: string;
  pin: string;
}

export interface ItemSincronizacaoMobileEntrada {
  idLocal: string;
  tipo: TipoItemSincronizacao;
  payload: Record<string, unknown>;
}

export interface SincronizarLoteMobileEntrada {
  itens: ItemSincronizacaoMobileEntrada[];
}

export interface BootstrapMobile {
  pacientes: RespostaPaginada<PacienteResumo>;
  diarios: LogDiarioRapidoApi[];
  arquivos: ArquivoMidiaApi[];
  acompanhantes: AcompanhanteApi[];
}

class ErroApiMobile extends Error {
  constructor(
    public readonly status: number,
    mensagem: string
  ) {
    super(mensagem);
    this.name = 'ErroApiMobile';
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
    throw new ErroApiMobile(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }

  return resposta.json() as Promise<T>;
}

export async function registrarDiarioRapido(entrada: RegistrarDiarioRapidoEntrada): Promise<LogDiarioRapidoApi> {
  return requisitar<LogDiarioRapidoApi>('/api/mobile/diario-rapido', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function listarDiariosRapidos(): Promise<LogDiarioRapidoApi[]> {
  return requisitar<LogDiarioRapidoApi[]>('/api/mobile/diario-rapido');
}

export async function solicitarUploadMidia(entrada: SolicitarUploadMidiaEntrada): Promise<UploadMidiaApi> {
  return requisitar<UploadMidiaApi>('/api/mobile/midias/uploads', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function listarArquivosMidia(): Promise<ArquivoMidiaApi[]> {
  return requisitar<ArquivoMidiaApi[]>('/api/mobile/midias/uploads');
}

export async function criarAcompanhante(entrada: CriarAcompanhanteEntrada): Promise<AcompanhanteApi> {
  return requisitar<AcompanhanteApi>('/api/mobile/acompanhantes', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function listarAcompanhantes(): Promise<AcompanhanteApi[]> {
  return requisitar<AcompanhanteApi[]>('/api/mobile/acompanhantes');
}

export async function sincronizarLoteMobile(entrada: SincronizarLoteMobileEntrada): Promise<RespostaSincronizacaoMobile> {
  return requisitar<RespostaSincronizacaoMobile>('/api/mobile/sincronizacao/lote', {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export async function carregarBootstrapMobile(): Promise<BootstrapMobile> {
  const [pacientes, diarios, arquivos, acompanhantes] = await Promise.all([
    listarPacientes(),
    listarDiariosRapidos(),
    listarArquivosMidia(),
    listarAcompanhantes()
  ]);
  return { pacientes, diarios, arquivos, acompanhantes };
}

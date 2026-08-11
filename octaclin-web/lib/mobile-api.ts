import { PacienteResumo, RespostaPaginada, listarPacientes } from './cadastros-api';

export type TipoDiarioRapido = 'refeicao' | 'humor' | 'agua' | 'atividade';
export type TipoMidiaMobile = 'imagem' | 'audio' | 'video' | 'documento';
export type CategoriaAnexoClinico = 'exame' | 'documento' | 'foto' | 'diario';
export type TipoVinculoClinicoAnexo = 'consulta' | 'avaliacao_antropometrica' | 'documento_emitido';
export interface VinculoClinicoAnexoApi {
  tipo: TipoVinculoClinicoAnexo;
  recursoId: string;
}
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
  pacienteId: string;
  tipo: TipoMidiaMobile;
  categoria: CategoriaAnexoClinico;
  nomeArquivo?: string;
  mimeType: string;
  tamanhoBytes: string;
  hashConteudo?: string;
  status: 'pendente' | 'confirmado' | 'excluido';
  vinculoClinico?: VinculoClinicoAnexoApi;
  criadoEm: string;
  confirmadoEm?: string;
}

export interface UploadMidiaApi {
  arquivo: ArquivoMidiaApi;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  expiraEmSegundos: number;
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
  categoria?: CategoriaAnexoClinico;
  nomeArquivo?: string;
  duracaoSegundos?: number;
  hashConteudo?: string;
  vinculoClinico?: VinculoClinicoAnexoApi;
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

export async function listarArquivosMidia(pacienteId?: string): Promise<ArquivoMidiaApi[]> {
  return requisitar<ArquivoMidiaApi[]>(`/api/mobile/midias/uploads${pacienteId ? `?pacienteId=${encodeURIComponent(pacienteId)}` : ''}`);
}

export async function confirmarUploadMidia(arquivoId: string): Promise<ArquivoMidiaApi> {
  return requisitar<ArquivoMidiaApi>(`/api/mobile/midias/uploads/${encodeURIComponent(arquivoId)}/confirmacao`, { method: 'POST' });
}

export async function obterAcessoArquivoMidia(arquivoId: string): Promise<{ url: string; expiraEmSegundos: number }> {
  return requisitar<{ url: string; expiraEmSegundos: number }>(`/api/mobile/midias/uploads/${encodeURIComponent(arquivoId)}/acesso`, {
    method: 'POST'
  });
}

export async function excluirArquivoMidia(arquivoId: string): Promise<void> {
  await requisitar(`/api/mobile/midias/uploads/${encodeURIComponent(arquivoId)}`, { method: 'DELETE' });
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

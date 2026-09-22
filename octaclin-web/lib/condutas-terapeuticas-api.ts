export type TipoCondutaTerapeuticaApi = 'meta' | 'orientacao' | 'suplemento' | 'produto' | 'formula_manipulada';
export type EstadoVersaoCondutaApi = 'rascunho' | 'publicada' | 'descartada';

export interface VersaoCondutaTerapeuticaApi {
  id: string;
  numero: number;
  titulo: string;
  conteudo: string;
  validadeInicio?: string;
  validadeFim?: string;
  estado: EstadoVersaoCondutaApi;
  publicadaEm?: string;
  /** PB-24 (Fase 275): consulta de origem, opcional. */
  consultaId?: string;
  criadoEm: string;
}

export interface CondutaTerapeuticaApi {
  id: string;
  tipo: TipoCondutaTerapeuticaApi;
  arquivadaEm?: string;
  criadoEm: string;
  versoes: VersaoCondutaTerapeuticaApi[];
}

export interface SalvarCondutaTerapeuticaEntrada {
  titulo: string;
  conteudo: string;
  validadeInicio?: string;
  validadeFim?: string;
  /** PB-24 (Fase 275): consulta de origem, opcional. So aceito na criacao. */
  consultaId?: string;
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, { ...init, headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
  if (!resposta.ok) throw new Error((await resposta.text()) || `Falha HTTP ${resposta.status}`);
  return resposta.json() as Promise<T>;
}

const base = (pacienteId: string) => `/api/pacientes/${encodeURIComponent(pacienteId)}/condutas-terapeuticas`;

export function listarCondutasTerapeuticas(pacienteId: string) { return requisitar<CondutaTerapeuticaApi[]>(base(pacienteId)); }
export function criarCondutaTerapeutica(pacienteId: string, entrada: SalvarCondutaTerapeuticaEntrada & { tipo: TipoCondutaTerapeuticaApi }) {
  return requisitar<CondutaTerapeuticaApi>(base(pacienteId), { method: 'POST', body: JSON.stringify(entrada) });
}
export function atualizarRascunhoCondutaTerapeutica(pacienteId: string, condutaId: string, entrada: SalvarCondutaTerapeuticaEntrada) {
  return requisitar<CondutaTerapeuticaApi>(`${base(pacienteId)}/${encodeURIComponent(condutaId)}/rascunho`, { method: 'PUT', body: JSON.stringify(entrada) });
}
export function publicarCondutaTerapeutica(pacienteId: string, condutaId: string) { return requisitar<CondutaTerapeuticaApi>(`${base(pacienteId)}/${encodeURIComponent(condutaId)}/publicacao`, { method: 'POST' }); }
export function criarNovaVersaoCondutaTerapeutica(pacienteId: string, condutaId: string, consultaId?: string) {
  return requisitar<CondutaTerapeuticaApi>(`${base(pacienteId)}/${encodeURIComponent(condutaId)}/nova-versao`, {
    method: 'POST',
    body: consultaId ? JSON.stringify({ consultaId }) : undefined
  });
}
export function arquivarCondutaTerapeutica(pacienteId: string, condutaId: string) { return requisitar<{ id: string; arquivadaEm: string }>(`${base(pacienteId)}/${encodeURIComponent(condutaId)}/arquivamento`, { method: 'POST' }); }

export interface BibliotecaCondutaResumoApi {
  id: string;
  nome: string;
  tipo: TipoCondutaTerapeuticaApi;
  tamanhoConteudo: number;
  atualizadoEm: string;
}

export interface BibliotecaCondutaApi extends Omit<BibliotecaCondutaResumoApi, 'atualizadoEm'> {
  conteudo: string;
}

// Item de biblioteca nao pertence a um paciente: a rota vive fora de
// `/pacientes/:id`, mesmo padrao dos modelos de evolucao clinica (Fase 271).
const baseBiblioteca = '/api/biblioteca-condutas';

export function listarBibliotecaCondutas(): Promise<{ itens: BibliotecaCondutaResumoApi[]; total: number }> {
  // Limite alto: o seletor ainda carrega tudo de uma vez, mesma decisao ja
  // tomada para os modelos de plano alimentar/evolucao clinica.
  return requisitar(`${baseBiblioteca}?pagina=1&limite=100`);
}
export function obterBibliotecaConduta(itemId: string) {
  return requisitar<BibliotecaCondutaApi>(`${baseBiblioteca}/${encodeURIComponent(itemId)}`);
}
export function criarBibliotecaConduta(entrada: { nome: string; tipo: TipoCondutaTerapeuticaApi; conteudo: string }) {
  return requisitar<BibliotecaCondutaResumoApi>(baseBiblioteca, { method: 'POST', body: JSON.stringify(entrada) });
}
export function arquivarBibliotecaConduta(itemId: string) {
  return requisitar<{ id: string; arquivadoEm: string }>(`${baseBiblioteca}/${encodeURIComponent(itemId)}`, {
    method: 'DELETE'
  });
}

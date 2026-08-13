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
export function criarNovaVersaoCondutaTerapeutica(pacienteId: string, condutaId: string) { return requisitar<CondutaTerapeuticaApi>(`${base(pacienteId)}/${encodeURIComponent(condutaId)}/nova-versao`, { method: 'POST' }); }
export function arquivarCondutaTerapeutica(pacienteId: string, condutaId: string) { return requisitar<{ id: string; arquivadaEm: string }>(`${base(pacienteId)}/${encodeURIComponent(condutaId)}/arquivamento`, { method: 'POST' }); }

import { confirmarUploadMidia, obterAcessoArquivoMidia, type UploadMidiaApi } from './mobile-api';

export interface EvolucaoFotograficaApi {
  id: string;
  consentimentoId: string;
  protocolo: string;
  capturadaEm: string;
  observacoes?: string;
  arquivos: Array<{ id: string; nomeArquivo?: string; mimeType: string; tamanhoBytes: string }>;
}

export interface SolicitarEvolucaoFotograficaEntrada {
  consentimentoId: string;
  protocolo: string;
  capturadaEm: string;
  observacoes?: string;
  mimeType: string;
  tamanhoBytes: number;
  nomeArquivo?: string;
}

class ErroApiEvolucoesFotograficas extends Error {
  constructor(public readonly status: number, mensagem: string) { super(mensagem); this.name = 'ErroApiEvolucoesFotograficas'; }
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, { ...init, headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
  if (!resposta.ok) throw new ErroApiEvolucoesFotograficas(resposta.status, (await resposta.text()) || `Falha HTTP ${resposta.status}`);
  return resposta.json() as Promise<T>;
}

const base = (pacienteId: string) => `/api/pacientes/${encodeURIComponent(pacienteId)}/evolucoes-fotograficas`;

export function listarEvolucoesFotograficas(pacienteId: string) {
  return requisitar<EvolucaoFotograficaApi[]>(base(pacienteId));
}

export function solicitarEvolucaoFotografica(pacienteId: string, entrada: SolicitarEvolucaoFotograficaEntrada) {
  return requisitar<{ evolucaoId: string; upload: UploadMidiaApi }>(`${base(pacienteId)}/uploads`, { method: 'POST', body: JSON.stringify(entrada) });
}

export function excluirEvolucaoFotografica(pacienteId: string, evolucaoId: string) {
  return requisitar<{ status: 'excluida' }>(`${base(pacienteId)}/${encodeURIComponent(evolucaoId)}`, { method: 'DELETE' });
}

export { confirmarUploadMidia as confirmarUploadEvolucaoFotografica, obterAcessoArquivoMidia as obterAcessoEvolucaoFotografica };

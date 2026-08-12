export interface ConsentimentoFotograficoApi {
  id: string;
  versao: string;
  consentidoEm: string;
  retencaoAte: string;
  revogadoEm?: string;
  ativo: boolean;
}

export interface RegistrarConsentimentoFotograficoEntrada {
  versao: string;
  retencaoAte: string;
  evidencia?: string;
}

export class ErroApiConsentimentosFotograficos extends Error {
  constructor(public readonly status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApiConsentimentosFotograficos';
  }
}

async function lerResposta<T>(resposta: Response): Promise<T> {
  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new ErroApiConsentimentosFotograficos(resposta.status, detalhe || `Falha HTTP ${resposta.status}`);
  }
  return resposta.json() as Promise<T>;
}

const base = (pacienteId: string) => `/api/pacientes/${encodeURIComponent(pacienteId)}/evolucoes-fotograficas/consentimentos`;

export async function listarConsentimentosFotograficos(pacienteId: string): Promise<ConsentimentoFotograficoApi[]> {
  return lerResposta(await fetch(base(pacienteId), { cache: 'no-store' }));
}

export async function registrarConsentimentoFotografico(pacienteId: string, entrada: RegistrarConsentimentoFotograficoEntrada): Promise<ConsentimentoFotograficoApi> {
  return lerResposta(await fetch(base(pacienteId), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entrada) }));
}

export async function revogarConsentimentoFotografico(pacienteId: string, consentimentoId: string): Promise<ConsentimentoFotograficoApi> {
  return lerResposta(await fetch(`${base(pacienteId)}/${encodeURIComponent(consentimentoId)}/revogacao`, { method: 'POST' }));
}

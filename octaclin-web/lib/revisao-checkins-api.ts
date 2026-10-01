export interface CheckinPendenteApi {
  id: string;
  pacienteId: string;
  pacienteNome: string;
  registradoEm: string;
}

export interface PaginaCheckinsPendentesApi {
  pagina: number;
  tamanho: number;
  total: number;
  itens: CheckinPendenteApi[];
}

export interface DetalheRevisaoCheckinApi extends CheckinPendenteApi {
  humor?: string;
  adesaoPlano?: number;
  sintomas?: string;
  observacoes?: string;
  revisadoEm?: string;
  comprovanteLeitura?: string;
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, { ...init, cache: 'no-store' });
  if (!resposta.ok) throw new Error('Não foi possível carregar ou salvar a revisão.');
  return resposta.json() as Promise<T>;
}

export function listarCheckinsPendentes(pagina: number): Promise<PaginaCheckinsPendentesApi> {
  return requisitar(`/api/checkins/revisoes/pendentes?pagina=${pagina}`);
}

export function obterCheckinParaRevisao(id: string): Promise<DetalheRevisaoCheckinApi> {
  return requisitar(`/api/checkins/revisoes/${encodeURIComponent(id)}`);
}

export function revisarCheckin(id: string, comprovanteLeitura: string): Promise<{ id: string; revisadoEm: string }> {
  return requisitar(`/api/checkins/revisoes/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comprovanteLeitura })
  });
}

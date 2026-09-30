export interface ItemRetornoApi {
  pacienteId: string;
  elegivel: boolean;
  motivo?: string;
  intervaloDias?: number;
  dataSugerida?: string;
}

async function post<T>(rota: string, dados: object): Promise<T> {
  const resposta = await fetch(rota, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
  if (!resposta.ok) throw new Error('Não foi possível processar o lote. Atualize a lista e tente novamente.');
  return resposta.json() as Promise<T>;
}

export function simularRetornos(pacienteIds: string[]) {
  return post<{ itens: ItemRetornoApi[] }>('/api/pacientes/retornos/simulacoes', { pacienteIds });
}

export function aprovarRetornos(pacienteIds: string[], loteId: string) {
  return post<{ totalEnfileirado: number; resultados: Array<{ pacienteId: string; status: 'enfileirada' | 'ignorada'; motivo?: string }> }>('/api/pacientes/retornos/aprovacoes', { pacienteIds, loteId });
}

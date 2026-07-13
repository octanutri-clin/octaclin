import { listarPendentes, marcarSincronizado } from './banco-local';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

interface ResultadoSincronizacao {
  idLocal: string;
  status: 'sincronizado' | 'erro';
  recursoId?: string;
  erro?: string;
}

export async function sincronizarPendentes(token: string) {
  const pendentes = await listarPendentes();
  if (pendentes.length === 0) return { total: 0, erros: [] as ResultadoSincronizacao[] };

  const resposta = await fetch(`${API_URL}/mobile/sincronizacao/lote`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      itens: pendentes.map((item) => ({
        idLocal: item.id,
        tipo: item.tipo,
        payload: JSON.parse(item.payload) as Record<string, unknown>
      }))
    })
  });

  if (!resposta.ok) {
    throw new Error(`Falha ao sincronizar: ${resposta.status}`);
  }

  const corpo = (await resposta.json()) as { resultados: ResultadoSincronizacao[] };
  const erros: ResultadoSincronizacao[] = [];
  for (const resultado of corpo.resultados) {
    if (resultado.status === 'sincronizado') {
      await marcarSincronizado(resultado.idLocal);
    } else {
      erros.push(resultado);
    }
  }

  return { total: corpo.resultados.length - erros.length, erros };
}

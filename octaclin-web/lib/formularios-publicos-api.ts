import type { TipoPergunta } from './questionarios-api';

export interface OpcaoFormularioPublico {
  id: string;
  rotulo: string;
  valor: string;
  imagemUrl?: string;
  ordem: number;
}

export interface PerguntaFormularioPublico {
  id: string;
  tipo: TipoPergunta;
  enunciado: string;
  obrigatoria: boolean;
  configuracao: Record<string, unknown>;
  opcoes: OpcaoFormularioPublico[];
  ordem: number;
}

export interface FormularioPublico {
  envioId: string;
  titulo: string;
  descricao?: string;
  status: string;
  expiraEm?: string;
  perguntas: PerguntaFormularioPublico[];
}

export interface RespostaFormularioPublico {
  perguntaId: string;
  valor: unknown;
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
    throw new Error(detalhe || `Falha HTTP ${resposta.status}`);
  }

  return resposta.json() as Promise<T>;
}

export function carregarFormularioPublico(token: string) {
  return requisitar<FormularioPublico>(`/api/formularios/${encodeURIComponent(token)}`);
}

export function enviarFormularioPublico(token: string, respostas: RespostaFormularioPublico[]) {
  return requisitar<{ envioId: string; status: string; respondidoEm: string }>(`/api/formularios/${encodeURIComponent(token)}/respostas`, {
    method: 'POST',
    body: JSON.stringify({ respostas })
  });
}

import type { TipoPergunta } from './questionarios-api';
import { criarIdOperacaoPwa, ehFalhaDeRede, enfileirarOperacaoPwa } from './pwa-private-queue';

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
  respostasRascunho?: RespostaFormularioPublico[];
  rascunhoAtualizadoEm?: string;
  rascunhoVersao: number;
}

export interface RespostaFormularioPublico {
  perguntaId: string;
  valor: unknown;
}

interface UploadFormularioPublico {
  arquivo: { id: string };
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
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
    try {
      const corpo = JSON.parse(detalhe) as { message?: string; mensagem?: string };
      throw new Error(corpo.mensagem ?? corpo.message ?? detalhe);
    } catch (erro) {
      if (erro instanceof SyntaxError) throw new Error(detalhe || `Falha HTTP ${resposta.status}`);
      throw erro;
    }
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

export async function enviarOuEnfileirarFormularioPublico(
  token: string,
  respostas: RespostaFormularioPublico[],
  permitirFilaOffline: boolean
): Promise<'enviado' | 'pendente'> {
  try {
    await enviarFormularioPublico(token, respostas);
    return 'enviado';
  } catch (erro) {
    if (!ehFalhaDeRede(erro)) throw erro;
    if (!permitirFilaOffline) {
      throw new Error('Reconecte-se antes de enviar um formulario com anexos.');
    }
    const id = criarIdOperacaoPwa('formulario');
    await enfileirarOperacaoPwa({
      id,
      tipo: 'formulario',
      endpoint: `/api/formularios/${encodeURIComponent(token)}/respostas`,
      method: 'POST',
      payload: { respostas }
    });
    return 'pendente';
  }
}

export function salvarRascunhoFormularioPublico(
  token: string,
  versaoBase: number,
  respostas: RespostaFormularioPublico[]
) {
  return requisitar<{ rascunhoVersao: number; rascunhoAtualizadoEm: string }>(
    `/api/formularios/${encodeURIComponent(token)}/rascunho`,
    {
      method: 'PATCH',
      body: JSON.stringify({ versaoBase, respostas })
    }
  );
}

export function solicitarUploadFormularioPublico(
  token: string,
  entrada: { perguntaId: string; nomeArquivo: string; mimeType: string; tamanhoBytes: number }
) {
  return requisitar<UploadFormularioPublico>(`/api/formularios/${encodeURIComponent(token)}/anexos`, {
    method: 'POST',
    body: JSON.stringify(entrada)
  });
}

export function confirmarUploadFormularioPublico(token: string, arquivoId: string, perguntaId: string) {
  return requisitar<{ id: string }>(
    `/api/formularios/${encodeURIComponent(token)}/anexos/${encodeURIComponent(arquivoId)}/confirmacao`,
    { method: 'POST', body: JSON.stringify({ perguntaId }) }
  );
}

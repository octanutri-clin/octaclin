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

// Carrega o status HTTP junto da mensagem para que quem trata o erro possa
// decidir se a mensagem e uma resposta de negocio segura do backend (4xx, ja
// em portugues e pensada para o paciente, como "Formulario expirado.") ou uma
// falha opaca (5xx) cujo corpo nao deve ser repassado como esta.
export class ErroFormularioPublico extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
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
    let mensagem = detalhe || `Falha HTTP ${resposta.status}`;
    try {
      const corpo = JSON.parse(detalhe) as { message?: string; mensagem?: string };
      mensagem = corpo.mensagem ?? corpo.message ?? mensagem;
    } catch (erro) {
      if (!(erro instanceof SyntaxError)) throw erro;
    }
    throw new ErroFormularioPublico(mensagem, resposta.status);
  }

  return resposta.json() as Promise<T>;
}

// Uma mensagem de erro so e segura para mostrar ao paciente sem sessao quando
// vem de uma resposta de negocio (4xx) do proprio backend do formulario; uma
// falha 5xx ou uma excecao sem status HTTP (rede, parsing) usa sempre o texto
// generico do chamador.
export function mensagemSeguraOuGenerica(erro: unknown, mensagemGenerica: string): string {
  if (erro instanceof ErroFormularioPublico && erro.status < 500) return erro.message;
  return mensagemGenerica;
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
      throw new ErroFormularioPublico('Reconecte-se antes de enviar um formulario com anexos.', 400);
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

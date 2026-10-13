export interface FonteIa318 {
  ref: string;
  tipo: "preparacao" | "evolucao" | "medida";
  data: string;
  texto: string;
}
export interface ModeloIa318 {
  id: string;
  nome: string;
  versao: string;
  padrao: boolean;
  maxOutputTokens: number;
  precoEntradaMilhaoUsd: number;
  precoSaidaMilhaoUsd: number;
  precoEm: string;
}
export interface ConfigIa318 {
  habilitada: boolean;
  versao: number;
  operacaoAprovada: boolean;
  maxChamadas15min: number;
  maxTokensSaida: number;
}
export interface PreviaIa318 {
  modalidade: "pre_consulta" | "evolucao";
  texto: string;
  provaRevisao: string;
  expiraEm: string;
  itens: {
    texto: string;
    refs: string[];
  }[];
  limitacoes: string[];
  referencias: {
    ref: string;
    tipo: string;
    data: string;
  }[];
  modeloId: string;
  versaoModelo: string;
}
export async function requisitarIa318<T>(
  acao: string,
  dados: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<T> {
  const r = await fetch("/api/ia/rascunhos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acao, ...dados }),
    cache: "no-store",
    signal,
  });
  const v = await r.json();
  if (!r.ok)
    throw new Error(
      typeof v.mensagem === "string" ? v.mensagem : "Função indisponível.",
    );
  return v as T;
}

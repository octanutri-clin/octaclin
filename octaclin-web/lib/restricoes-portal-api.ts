/**
 * Cliente do navegador para o BFF do portal de restrições (FOOD06 P3). Só fala com `/api/portal/paciente/restricoes/*`,
 * sem cache e sem guardar nada em armazenamento do navegador. Erros viram um tipo fechado; o texto vem de
 * `lib/textos-restricoes.ts`, nunca da resposta.
 */
import type {
  PedidoPortalTela,
  PedidosPortalTela,
  ResumoPortalTela,
  SeletorPortalTela,
  TipoDeclaracaoPortal,
} from "./restricoes-portal";

export type FalhaRestricoesPortal = "indisponivel" | "sessao" | "semAcesso" | "mudou" | "invalida" | "leitura" | "incerto";

export class ErroRestricoesPortal extends Error {
  constructor(readonly tipo: FalhaRestricoesPortal) {
    super(tipo);
  }
}

const BASE = "/api/portal/paciente/restricoes";

function tipoDoStatus(status: number): FalhaRestricoesPortal {
  if (status === 404) return "indisponivel";
  if (status === 401) return "sessao";
  if (status === 403) return "semAcesso";
  if (status === 409) return "mudou";
  if (status === 400) return "invalida";
  return "leitura";
}

async function pedir<T>(caminho: string, metodo: "GET" | "POST", signal?: AbortSignal): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      method: metodo,
      credentials: "same-origin",
      cache: "no-store",
      headers: metodo === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: metodo === "POST" ? "{}" : undefined,
      signal,
    });
  } catch (falha) {
    if (signal?.aborted) throw falha;
    throw new ErroRestricoesPortal("leitura");
  }
  if (!resposta.ok) throw new ErroRestricoesPortal(tipoDoStatus(resposta.status));
  try {
    return (await resposta.json()) as T;
  } catch {
    throw new ErroRestricoesPortal("leitura");
  }
}

export async function restricoesDisponiveisNoPortal(signal?: AbortSignal): Promise<boolean> {
  const r = await pedir<{ habilitada?: unknown }>("/disponibilidade", "GET", signal);
  return r.habilitada === true;
}

export const listarPessoasRestricoesPortal = (signal?: AbortSignal) =>
  pedir<SeletorPortalTela>("/pacientes", "POST", signal);

export const obterResumoRestricoesPortal = (pacienteId: string, signal?: AbortSignal) =>
  pedir<ResumoPortalTela>(`/${encodeURIComponent(pacienteId)}/resumo`, "POST", signal);

export const listarPedidosRestricoesPortal = (pacienteId: string, signal?: AbortSignal) =>
  pedir<PedidosPortalTela>(`/${encodeURIComponent(pacienteId)}/pedidos`, "POST", signal);

// ---------------------------------------------------------------------------------------------------------------
// Escrita (P3-2). Falha de rede ou 5xx depois de enviar é "incerto": a ação pode ter sido gravada. A tela repete com a
// MESMA chave de criação (o backend é idempotente por chave), então repetir não duplica.

async function enviar<T>(caminho: string, corpo: unknown): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new ErroRestricoesPortal("incerto");
  }
  if (!resposta.ok) {
    const tipo = tipoDoStatus(resposta.status);
    throw new ErroRestricoesPortal(tipo === "leitura" ? "incerto" : tipo);
  }
  try {
    return (await resposta.json()) as T;
  } catch {
    throw new ErroRestricoesPortal("incerto");
  }
}

export const declararRestricaoPortal = (
  pacienteId: string,
  entrada: { chaveCriacao: string; tipo: TipoDeclaracaoPortal; alimento: string },
) => enviar<{ id: string; chaveSelo: string }>(`/${encodeURIComponent(pacienteId)}/declarar`, entrada);

export const criarPedidoRestricaoPortal = (
  pacienteId: string,
  entrada: { chaveCriacao: string; tipo: "correcao" | "remocao"; restricaoId: string; texto: string },
) => enviar<PedidoPortalTela>(`/${encodeURIComponent(pacienteId)}/pedidos/criar`, entrada);

export const cancelarPedidoRestricaoPortal = (pacienteId: string, solicitacaoId: string) =>
  enviar<PedidoPortalTela>(`/${encodeURIComponent(pacienteId)}/pedidos/${encodeURIComponent(solicitacaoId)}/cancelar`, {});

/**
 * Cliente do navegador para o BFF do portal de restrições (FOOD06 P3). Só fala com `/api/portal/paciente/restricoes/*`,
 * sem cache e sem guardar nada em armazenamento do navegador. Erros viram um tipo fechado; o texto vem de
 * `lib/textos-restricoes.ts`, nunca da resposta.
 */
import type { PedidosPortalTela, ResumoPortalTela, SeletorPortalTela } from "./restricoes-portal";

export type FalhaRestricoesPortal = "indisponivel" | "sessao" | "semAcesso" | "mudou" | "invalida" | "leitura";

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

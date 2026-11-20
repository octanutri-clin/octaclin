/**
 * Cliente do navegador para o BFF das telas de equipe (FOOD06 P3-6). Sem cache e sem armazenamento no navegador; o
 * e-mail da busca vai só no corpo. Erros viram um tipo fechado e o texto vem de `lib/textos-equipe-restricoes.ts`.
 */
import type { CandidatoDelegacaoTela, DelegacaoTela, IdentificacaoTela, RepresentanteTela, TipoVerificacao } from "./restricoes-equipe";

export type FalhaEquipe = "indisponivel" | "sessao" | "semAcesso" | "mudou" | "invalida" | "muitas" | "leitura" | "incerto";

export class ErroEquipe extends Error {
  constructor(readonly tipo: FalhaEquipe) {
    super(tipo);
  }
}

function tipoDoStatus(status: number): FalhaEquipe {
  if (status === 404) return "indisponivel";
  if (status === 401) return "sessao";
  if (status === 403) return "semAcesso";
  if (status === 409) return "mudou";
  if (status === 400) return "invalida";
  if (status === 429) return "muitas";
  return "leitura";
}

/** `escrita`: falha de rede ou 5xx depois de enviar vira "incerto" (a ação pode ter sido gravada). */
async function pedir<T>(url: string, corpo: unknown, escrita: boolean, signal?: AbortSignal): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal,
    });
  } catch (falha) {
    if (signal?.aborted) throw falha;
    throw new ErroEquipe(escrita ? "incerto" : "leitura");
  }
  if (!resposta.ok) {
    const tipo = tipoDoStatus(resposta.status);
    throw new ErroEquipe(escrita && tipo === "leitura" ? "incerto" : tipo);
  }
  try {
    return (await resposta.json()) as T;
  } catch {
    throw new ErroEquipe(escrita ? "incerto" : "leitura");
  }
}

export async function equipeRestricoesDisponivel(signal?: AbortSignal): Promise<boolean> {
  try {
    const r = await fetch("/api/restricoes/equipe/disponibilidade", { credentials: "same-origin", cache: "no-store", signal });
    if (!r.ok) return false;
    const v = (await r.json()) as { habilitada?: unknown };
    return v.habilitada === true;
  } catch {
    return false;
  }
}

const DELEGACOES = "/api/profissional/delegacoes-carteira";
export const listarDelegacoes = (signal?: AbortSignal) => pedir<{ itens: DelegacaoTela[] }>(`${DELEGACOES}/listar`, {}, false, signal);
export const listarCandidatosDelegacao = (signal?: AbortSignal) =>
  pedir<{ itens: CandidatoDelegacaoTela[]; noLimite: boolean }>(`${DELEGACOES}/candidatos`, {}, false, signal);
export const concederDelegacao = (colaboradorUsuarioId: string) => pedir<DelegacaoTela>(`${DELEGACOES}/conceder`, { colaboradorUsuarioId }, true);
export const revogarDelegacao = (delegacaoId: string) =>
  pedir<{ id: string; revogada: true }>(`${DELEGACOES}/${encodeURIComponent(delegacaoId)}/revogar`, {}, true);

const representantes = (pacienteId: string) => `/api/pacientes/${encodeURIComponent(pacienteId)}/representantes`;
export const listarRepresentantes = (pacienteId: string, signal?: AbortSignal) =>
  pedir<{ itens: RepresentanteTela[] }>(`${representantes(pacienteId)}/listar`, {}, false, signal);
/** Busca é leitura: uma falha de rede não grava nada, então não é "incerto". */
export const buscarRepresentante = (pacienteId: string, email: string) =>
  pedir<{ candidato: { usuarioId: string; identificacao: IdentificacaoTela } | null }>(`${representantes(pacienteId)}/buscar`, { email }, false);
export const registrarRepresentante = (pacienteId: string, representanteUsuarioId: string, tipoVerificacao: TipoVerificacao) =>
  pedir<RepresentanteTela>(`${representantes(pacienteId)}/registrar`, { representanteUsuarioId, tipoVerificacao }, true);
export const revogarRepresentante = (pacienteId: string, vinculoId: string) =>
  pedir<{ id: string; revogado: true }>(`${representantes(pacienteId)}/${encodeURIComponent(vinculoId)}/revogar`, {}, true);

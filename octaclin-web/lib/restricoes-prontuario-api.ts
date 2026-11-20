/**
 * Cliente do navegador para o BFF da aba "Restrições" (FOOD06 P3-3). Sem cache e sem armazenamento no navegador.
 * A rota de colaborador é escolhida pelo papel da sessão só como indicação; o backend decide.
 */
import type { AvaliacaoProntuario, ListaProntuario } from "./restricoes-prontuario";

export type FalhaProntuario = "indisponivel" | "sessao" | "semAcesso" | "mudou" | "invalida" | "leitura" | "incerto";

export class ErroRestricoesProntuario extends Error {
  constructor(readonly tipo: FalhaProntuario) {
    super(tipo);
  }
}

function tipoDoStatus(status: number): FalhaProntuario {
  if (status === 404) return "indisponivel";
  if (status === 401) return "sessao";
  if (status === 403) return "semAcesso";
  if (status === 409) return "mudou";
  if (status === 400) return "invalida";
  return "leitura";
}

async function pedir<T>(url: string, corpo: unknown, escrita: boolean, signal?: AbortSignal): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(url, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo), signal });
  } catch (falha) {
    if (signal?.aborted) throw falha;
    throw new ErroRestricoesProntuario(escrita ? "incerto" : "leitura");
  }
  if (!resposta.ok) {
    const tipo = tipoDoStatus(resposta.status);
    throw new ErroRestricoesProntuario(escrita && tipo === "leitura" ? "incerto" : tipo);
  }
  try {
    return (await resposta.json()) as T;
  } catch {
    throw new ErroRestricoesProntuario(escrita ? "incerto" : "leitura");
  }
}

const base = (pacienteId: string, colaborador: boolean) =>
  `/api/${colaborador ? "colaborador/" : ""}pacientes/${encodeURIComponent(pacienteId)}/restricoes`;

export const listarRestricoesProntuario = (pacienteId: string, colaborador: boolean, signal?: AbortSignal) =>
  pedir<ListaProntuario>(`${base(pacienteId, colaborador)}/listar`, {}, false, signal);
export const consultarAvaliacaoProntuario = (pacienteId: string, signal?: AbortSignal) =>
  pedir<{ avaliacao: AvaliacaoProntuario | null }>(`${base(pacienteId, false)}/avaliacao`, {}, false, signal);
export const iniciarAvaliacaoProntuario = (pacienteId: string) => pedir<{ id: string }>(`${base(pacienteId, false)}/avaliacao/iniciar`, {}, true);
export const registrarRestricaoProntuario = (pacienteId: string, colaborador: boolean,
  entrada: { chaveCriacao: string; tipo: string; alimento: string; gravidade: string; observacao: string }) =>
  pedir<{ id: string }>(`${base(pacienteId, colaborador)}/registrar`, entrada, true);
export const confirmarRestricaoProntuario = (pacienteId: string, restricaoId: string, revisao: number) =>
  pedir<{ id: string }>(`${base(pacienteId, false)}/${encodeURIComponent(restricaoId)}/confirmar`, { revisao }, true);
export const rejeitarRestricaoProntuario = (pacienteId: string, restricaoId: string, revisao: number, justificativa: string) =>
  pedir<{ id: string }>(`${base(pacienteId, false)}/${encodeURIComponent(restricaoId)}/rejeitar`, { revisao, justificativa }, true);

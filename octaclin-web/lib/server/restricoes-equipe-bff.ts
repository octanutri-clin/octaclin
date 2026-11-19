import {
  montarBuscaRepresentante,
  montarConcessaoDelegacao,
  montarRegistroRepresentante,
  projetarCandidatoRepresentante,
  projetarCandidatosDelegacao,
  projetarDelegacaoUnica,
  projetarDelegacoes,
  projetarRepresentanteUnico,
  projetarRepresentantes,
} from "../restricoes-equipe";
import { restricoesClinicasHabilitadasNaWeb } from "./funcionalidades-web-bff";
import { obterSessaoValidaBff, requisitarBackendAutenticado } from "./sessao-bff";
import {
  UUID_RESTRICOES,
  erroRestricoes,
  exigirCorpoVazio,
  lerTextoLimitado,
  repassarRestricoes,
  responderRestricoes,
} from "./restricoes-bff-comum";

/**
 * BFF das telas de equipe (FOOD06 P3-6): delegação da carteira (titular) e representantes no portal (equipe do
 * paciente). Só a permissão grossa aqui: `pacientes.ler` para ler e `pacientes.gerenciar` para mudar a delegação.
 * Titular, carteira atual, delegação vigente, elegibilidade e cota de busca são do backend, sob lock. O e-mail da busca
 * só viaja no corpo; nunca na URL, em log ou em resposta de erro.
 */

const BASE_DELEGACOES = "/profissional/delegacoes-carteira";
/** Igual à guarda do backend (P3-0b): ler E gerenciar para mudar a delegação. */
const GERENCIAR_DELEGACAO = ["pacientes.ler", "pacientes.gerenciar"] as const;
const caminhoRepresentantes = (pacienteId: string, sufixo: string) =>
  `/pacientes/${encodeURIComponent(pacienteId)}/representantes/${sufixo}`;

export const tratarListarDelegacoes = (request: Request) =>
  repassarRestricoes(request, { caminho: `${BASE_DELEGACOES}/listar`, permissao: "pacientes.ler", montarCorpo: exigirCorpoVazio, projetar: projetarDelegacoes });

export const tratarCandidatosDelegacao = (request: Request) =>
  repassarRestricoes(request, { caminho: `${BASE_DELEGACOES}/candidatos/listar`, permissao: GERENCIAR_DELEGACAO, montarCorpo: exigirCorpoVazio,
    projetar: projetarCandidatosDelegacao });

export const tratarConcederDelegacao = (request: Request) =>
  repassarRestricoes(request, { caminho: `${BASE_DELEGACOES}/conceder`, permissao: GERENCIAR_DELEGACAO, montarCorpo: montarConcessaoDelegacao,
    projetar: projetarDelegacaoUnica });

export async function tratarRevogarDelegacao(request: Request, delegacaoId: string): Promise<Response> {
  if (!restricoesClinicasHabilitadasNaWeb()) return erroRestricoes(404);
  if (!UUID_RESTRICOES.test(delegacaoId)) return erroRestricoes(400);
  const id = delegacaoId.toLowerCase();
  return repassarRestricoes(request, { caminho: `${BASE_DELEGACOES}/${encodeURIComponent(id)}/revogar`, permissao: GERENCIAR_DELEGACAO,
    montarCorpo: exigirCorpoVazio, projetar: (v) => (projetarRevogacao(v, id, "revogada") ? { id, revogada: true } : null) });
}

function projetarRevogacao(v: unknown, id: string, campo: "revogada" | "revogado"): boolean {
  return typeof v === "object" && v !== null && (v as Record<string, unknown>).id === id && (v as Record<string, unknown>)[campo] === true;
}

async function representantes(request: Request, pacienteId: string, sufixo: string, montarCorpo: (v: unknown) => unknown | null,
  projetar: (v: unknown) => unknown): Promise<Response> {
  if (!restricoesClinicasHabilitadasNaWeb()) return erroRestricoes(404);
  if (!UUID_RESTRICOES.test(pacienteId)) return erroRestricoes(400);
  return repassarRestricoes(request, { caminho: caminhoRepresentantes(pacienteId, sufixo), permissao: "pacientes.ler", montarCorpo, projetar });
}

export const tratarListarRepresentantes = (request: Request, pacienteId: string) =>
  representantes(request, pacienteId, "listar", exigirCorpoVazio, projetarRepresentantes);

export const tratarBuscarRepresentante = (request: Request, pacienteId: string) =>
  representantes(request, pacienteId, "candidato/buscar", montarBuscaRepresentante, projetarCandidatoRepresentante);

export const tratarRegistrarRepresentante = (request: Request, pacienteId: string) =>
  representantes(request, pacienteId, "registrar", montarRegistroRepresentante, projetarRepresentanteUnico);

export async function tratarRevogarRepresentante(request: Request, pacienteId: string, vinculoId: string): Promise<Response> {
  if (!restricoesClinicasHabilitadasNaWeb()) return erroRestricoes(404);
  if (!UUID_RESTRICOES.test(vinculoId)) return erroRestricoes(400);
  const id = vinculoId.toLowerCase();
  return representantes(request, pacienteId, `${encodeURIComponent(id)}/revogar`, exigirCorpoVazio,
    (v) => (projetarRevogacao(v, id, "revogado") ? { id, revogado: true } : null));
}

/**
 * A área de equipe existe quando a web E o tenant estão com a flag ligada (condição de ativação da P3-1: a entrada não
 * pode aparecer e depois dar "sem acesso"). Pergunta ao backend só com a sessão; qualquer falha responde `false`.
 */
export async function tratarDisponibilidadeEquipe(): Promise<Response> {
  try {
    await obterSessaoValidaBff();
  } catch {
    return erroRestricoes(401);
  }
  if (!restricoesClinicasHabilitadasNaWeb()) return responderRestricoes({ habilitada: false });
  try {
    const resposta = await requisitarBackendAutenticado("/restricoes/disponibilidade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (resposta.status !== 200) {
      await resposta.body?.cancel();
      return responderRestricoes({ habilitada: false });
    }
    const texto = await lerTextoLimitado(resposta, 1024);
    const valor = texto ? (JSON.parse(texto) as { habilitada?: unknown }) : null;
    return responderRestricoes({ habilitada: valor?.habilitada === true });
  } catch {
    return responderRestricoes({ habilitada: false });
  }
}

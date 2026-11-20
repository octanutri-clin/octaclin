import {
  montarConfirmacaoRestricao,
  montarRegistroProntuario,
  montarRejeicaoRestricao,
  projetarAcaoRestricao,
  projetarAvaliacaoInicial,
  projetarAvaliacaoProntuario,
  projetarListaProntuario,
  projetarRegistroProntuario,
} from "../restricoes-prontuario";
import { restricoesClinicasHabilitadasNaWeb } from "./funcionalidades-web-bff";
import { UUID_RESTRICOES, erroRestricoes, exigirCorpoVazio, repassarRestricoes } from "./restricoes-bff-comum";

/**
 * BFF da aba "Restrições" do prontuário (FOOD06 P3-3). Permissão grossa igual à guarda do backend: ler para ler;
 * ler + gerenciar para as escritas do profissional; o colaborador registra com ler. Papel, carteira, delegação e a
 * concessão `restricoes.confirmar` são do backend, sob lock; a tela escolhe a rota de colaborador só como indicação.
 * A observação da equipe passa (é a equipe que lê); nada de autor, tenant ou campo interno.
 */
const LER = "pacientes.ler";
const ESCREVER = ["pacientes.ler", "pacientes.gerenciar"] as const;

async function paciente(request: Request, pacienteId: string, base: "" | "/colaborador", sufixo: string, permissao: string | readonly string[],
  montarCorpo: (v: unknown) => unknown | null, projetar: (v: unknown) => unknown): Promise<Response> {
  if (!restricoesClinicasHabilitadasNaWeb()) return erroRestricoes(404);
  if (!UUID_RESTRICOES.test(pacienteId)) return erroRestricoes(400);
  const caminho = `${base}/pacientes/${encodeURIComponent(pacienteId.toLowerCase())}/restricoes/${sufixo}`;
  return repassarRestricoes(request, { caminho, permissao, montarCorpo, projetar });
}

export const tratarListarRestricoesProntuario = (request: Request, pacienteId: string) =>
  paciente(request, pacienteId, "", "listar", LER, exigirCorpoVazio, projetarListaProntuario);

export const tratarAvaliacaoProntuario = (request: Request, pacienteId: string) =>
  paciente(request, pacienteId, "", "avaliacao/consultar", LER, exigirCorpoVazio, projetarAvaliacaoProntuario);

export const tratarIniciarAvaliacao = (request: Request, pacienteId: string) =>
  paciente(request, pacienteId, "", "avaliacao/inicial", ESCREVER, exigirCorpoVazio, projetarAvaliacaoInicial);

export const tratarRegistrarRestricaoProntuario = (request: Request, pacienteId: string) =>
  paciente(request, pacienteId, "", "registrar", ESCREVER, montarRegistroProntuario, projetarRegistroProntuario);

export const tratarListarRestricoesColaborador = (request: Request, pacienteId: string) =>
  paciente(request, pacienteId, "/colaborador", "listar", LER, exigirCorpoVazio, projetarListaProntuario);

export const tratarRegistrarRestricaoColaborador = (request: Request, pacienteId: string) =>
  paciente(request, pacienteId, "/colaborador", "registrar", LER, montarRegistroProntuario, projetarRegistroProntuario);

async function decidir(request: Request, pacienteId: string, restricaoId: string, acao: "confirmar" | "rejeitar"): Promise<Response> {
  if (!restricoesClinicasHabilitadasNaWeb()) return erroRestricoes(404);
  if (!UUID_RESTRICOES.test(restricaoId)) return erroRestricoes(400);
  const id = restricaoId.toLowerCase();
  // A revisão enviada é guardada para conferir a resposta (mesma restrição, revisão seguinte).
  let enviada = 0;
  const montar = (v: unknown) => {
    const corpo = acao === "confirmar" ? montarConfirmacaoRestricao(v) : montarRejeicaoRestricao(v);
    if (corpo) enviada = corpo.revisao;
    return corpo;
  };
  return paciente(request, pacienteId, "", `${encodeURIComponent(id)}/${acao}`, ESCREVER, montar,
    (v) => projetarAcaoRestricao(v, id, enviada, acao === "confirmar" ? "confirmada" : "rejeitada"));
}

export const tratarConfirmarRestricao = (request: Request, pacienteId: string, restricaoId: string) => decidir(request, pacienteId, restricaoId, "confirmar");
export const tratarRejeitarRestricao = (request: Request, pacienteId: string, restricaoId: string) => decidir(request, pacienteId, restricaoId, "rejeitar");

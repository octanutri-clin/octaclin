import {
  montarDeclaracaoPortal,
  montarPedidoPortal,
  projetarDeclaracaoPortal,
  projetarPedidoUnicoPortal,
  projetarPedidosPortal,
  projetarResumoPortal,
  projetarSeletorPortal,
} from "../restricoes-portal";
import { restricoesClinicasHabilitadasNaWeb } from "./funcionalidades-web-bff";
import { obterSessaoValidaBff } from "./sessao-bff";
import { UUID_RESTRICOES, erroRestricoes, exigirCorpoVazio, repassarRestricoes, responderRestricoes } from "./restricoes-bff-comum";

/**
 * BFF do portal de restrições (FOOD06 P3-1 leitura, P3-2 escrita).
 *
 * O BFF não decide autorização: exige sessão e a permissão grossa `portal.acessar`, valida a forma da entrada e
 * repassa (`restricoes-bff-comum.ts`). Quem prova tenant, conta própria ou vínculo de representação, sob lock, é o backend; o `pacienteId` da
 * rota é só seletor. Respostas: `private, no-store`, mensagem fixa em erro (o corpo do backend nunca é repassado) e
 * resposta 200 projetada por allowlist (`lib/restricoes-portal.ts`).
 */

const UUID = UUID_RESTRICOES;
const erro = erroRestricoes;
const responder = responderRestricoes;
const exigirVazio = exigirCorpoVazio;
const repassar = (request: Request, caminho: string, montarCorpo: (v: unknown) => unknown | null, projetar: (v: unknown) => unknown) =>
  repassarRestricoes(request, { caminho, permissao: "portal.acessar", montarCorpo, projetar });

const caminhoPaciente = (pacienteId: string, sufixo: string) =>
  `/portal/pacientes/${encodeURIComponent(pacienteId)}/restricoes/${sufixo}`;

export function tratarSeletorRestricoesPortal(request: Request): Promise<Response> {
  return repassar(request, "/portal/restricoes/pacientes/listar", exigirVazio, projetarSeletorPortal);
}

export async function tratarResumoRestricoesPortal(request: Request, pacienteId: string): Promise<Response> {
  if (!restricoesClinicasHabilitadasNaWeb()) return erro(404);
  if (!UUID.test(pacienteId)) return erro(400);
  return repassar(request, caminhoPaciente(pacienteId, "resumo"), exigirVazio, projetarResumoPortal);
}

export async function tratarPedidosRestricoesPortal(request: Request, pacienteId: string): Promise<Response> {
  if (!restricoesClinicasHabilitadasNaWeb()) return erro(404);
  if (!UUID.test(pacienteId)) return erro(400);
  return repassar(request, caminhoPaciente(pacienteId, "pedidos/listar"), exigirVazio, projetarPedidosPortal);
}

/** Declarar restrição nova (vira pendência `declaracao_paciente`). O BFF monta o conteúdo; ver `montarDeclaracaoPortal`. */
export async function tratarDeclararRestricaoPortal(request: Request, pacienteId: string): Promise<Response> {
  if (!restricoesClinicasHabilitadasNaWeb()) return erro(404);
  if (!UUID.test(pacienteId)) return erro(400);
  return repassar(request, caminhoPaciente(pacienteId, "declarar"), montarDeclaracaoPortal, projetarDeclaracaoPortal);
}

/** Pedir correção ou remoção de uma restrição que o portal mostra. O pedido nunca altera a restrição. */
export async function tratarCriarPedidoPortal(request: Request, pacienteId: string): Promise<Response> {
  if (!restricoesClinicasHabilitadasNaWeb()) return erro(404);
  if (!UUID.test(pacienteId)) return erro(400);
  return repassar(request, caminhoPaciente(pacienteId, "pedidos/criar"), montarPedidoPortal, projetarPedidoUnicoPortal);
}

/** Cancelar o próprio pedido aberto. Quem é o autor e se ainda está aberto, o backend decide sob lock. */
export async function tratarCancelarPedidoPortal(request: Request, pacienteId: string, solicitacaoId: string): Promise<Response> {
  if (!restricoesClinicasHabilitadasNaWeb()) return erro(404);
  if (!UUID.test(pacienteId) || !UUID.test(solicitacaoId)) return erro(400);
  return repassar(
    request,
    caminhoPaciente(pacienteId, `pedidos/${encodeURIComponent(solicitacaoId)}/cancelar`),
    exigirVazio,
    projetarPedidoUnicoPortal,
  );
}

/** Diz à tela se a área existe nesta instalação da web. Exige sessão; não consulta o backend nem dado clínico. */
export async function tratarDisponibilidadeRestricoes(): Promise<Response> {
  try {
    await obterSessaoValidaBff();
  } catch {
    return erro(401);
  }
  return responder({ habilitada: restricoesClinicasHabilitadasNaWeb() });
}

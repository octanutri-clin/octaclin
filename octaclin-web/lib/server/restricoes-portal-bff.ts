import { NextResponse } from "next/server";
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
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  obterSessaoValidaBff,
  requisitarBackendAutenticado,
} from "./sessao-bff";
import { origemMutacaoPermitida } from "./seguranca-bff";

/**
 * BFF do portal de restrições (FOOD06 P3-1 leitura, P3-2 escrita).
 *
 * O BFF não decide autorização: exige sessão e a permissão grossa `portal.acessar`, valida a forma da entrada e
 * repassa. Quem prova tenant, conta própria ou vínculo de representação, sob lock, é o backend; o `pacienteId` da
 * rota é só seletor. Respostas: `private, no-store`, mensagem fixa em erro (o corpo do backend nunca é repassado) e
 * resposta 200 projetada por allowlist (`lib/restricoes-portal.ts`).
 */

const CABECALHOS = { "Content-Type": "application/json", "Cache-Control": "private, no-store", Vary: "Cookie" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE_CORPO_ENTRADA = 4096;
const LIMITE_CORPO_RESPOSTA = 512 * 1024;

const MENSAGENS: Readonly<Record<number, string>> = Object.freeze({
  400: "Solicitação inválida.",
  401: "Sessão necessária.",
  403: "Operação não autorizada.",
  404: "Recurso indisponível.",
  409: "Dados alterados ou limite atingido.",
  503: "Serviço indisponível.",
});

const responder = (corpo: unknown, status = 200) => NextResponse.json(corpo, { status, headers: CABECALHOS });
const erro = (status: number) => responder({ mensagem: MENSAGENS[status] ?? MENSAGENS[503] }, status);

async function lerTextoLimitado(fonte: Request | Response, limite: number): Promise<string | null> {
  const declarado = Number(fonte.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > limite) return null;
  if (!fonte.body) return "";
  const leitor = fonte.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > limite) {
      await leitor.cancel();
      return null;
    }
    partes.push(value);
  }
  const unido = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) {
    unido.set(parte, posicao);
    posicao += parte.byteLength;
  }
  return new TextDecoder().decode(unido);
}

/** Lê o corpo (limitado) como JSON; `undefined` quando não é JSON ou passa do limite. */
async function lerJson(request: Request): Promise<unknown> {
  const bruto = await lerTextoLimitado(request, LIMITE_CORPO_ENTRADA);
  if (bruto === null) return undefined;
  try {
    return JSON.parse(bruto);
  } catch {
    return undefined;
  }
}

/** As rotas de leitura e o cancelamento aceitam exatamente `{}`: nada do navegador chega ao backend. */
const exigirVazio = (valor: unknown): Record<string, never> | null =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor) && Object.keys(valor).length === 0 ? {} : null;

async function repassar(
  request: Request,
  caminho: string,
  montarCorpo: (valor: unknown) => unknown | null,
  projetar: (valor: unknown) => unknown,
): Promise<Response> {
  if (!restricoesClinicasHabilitadasNaWeb()) return erro(404);
  try {
    if (!origemMutacaoPermitida(request)) return erro(403);
    await exigirPermissaoBff("portal.acessar");
    const corpo = montarCorpo(await lerJson(request));
    if (corpo === null) return erro(400);
    const resposta = await requisitarBackendAutenticado(caminho, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal: request.signal,
    });
    if (resposta.status !== 200 && resposta.status !== 201) {
      await resposta.body?.cancel();
      return erro([400, 401, 403, 409].includes(resposta.status) ? resposta.status : 503);
    }
    const texto = await lerTextoLimitado(resposta, LIMITE_CORPO_RESPOSTA);
    if (texto === null) return erro(503);
    let valor: unknown;
    try {
      valor = JSON.parse(texto);
    } catch {
      return erro(503);
    }
    const projetado = projetar(valor);
    return projetado === null ? erro(503) : responder(projetado);
  } catch (falha) {
    if (falha instanceof ErroSessaoAusente) return erro(401);
    if (falha instanceof ErroPermissaoAusente) return erro(403);
    return erro(503);
  }
}

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

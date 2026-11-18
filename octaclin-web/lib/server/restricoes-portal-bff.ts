import { NextResponse } from "next/server";
import {
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
 * BFF do portal de restrições (FOOD06 P3-1). Só leitura nesta fatia.
 *
 * O BFF não decide autorização: exige sessão e a permissão grossa `portal.acessar`, valida a forma da entrada e
 * repassa. Quem prova tenant, conta própria ou vínculo de representação, sob lock, é o backend; o `pacienteId` da
 * rota é só seletor. Respostas: `private, no-store`, mensagem fixa em erro (o corpo do backend nunca é repassado) e
 * resposta 200 projetada por allowlist (`lib/restricoes-portal.ts`).
 */

const CABECALHOS = { "Content-Type": "application/json", "Cache-Control": "private, no-store", Vary: "Cookie" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE_CORPO_ENTRADA = 1024;
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

/** As rotas de leitura do portal aceitam exatamente `{}`: nada do navegador chega ao backend. */
async function corpoVazio(request: Request): Promise<boolean> {
  const bruto = await lerTextoLimitado(request, LIMITE_CORPO_ENTRADA);
  if (bruto === null) return false;
  try {
    const valor: unknown = JSON.parse(bruto);
    return typeof valor === "object" && valor !== null && !Array.isArray(valor) && Object.keys(valor).length === 0;
  } catch {
    return false;
  }
}

async function repassarLeitura(
  request: Request,
  caminho: string,
  projetar: (valor: unknown) => unknown,
): Promise<Response> {
  if (!restricoesClinicasHabilitadasNaWeb()) return erro(404);
  try {
    if (!origemMutacaoPermitida(request)) return erro(403);
    await exigirPermissaoBff("portal.acessar");
    if (!(await corpoVazio(request))) return erro(400);
    const resposta = await requisitarBackendAutenticado(caminho, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: request.signal,
    });
    if (resposta.status !== 200) {
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
  return repassarLeitura(request, "/portal/restricoes/pacientes/listar", projetarSeletorPortal);
}

export async function tratarResumoRestricoesPortal(request: Request, pacienteId: string): Promise<Response> {
  if (!restricoesClinicasHabilitadasNaWeb()) return erro(404);
  if (!UUID.test(pacienteId)) return erro(400);
  return repassarLeitura(request, caminhoPaciente(pacienteId, "resumo"), projetarResumoPortal);
}

export async function tratarPedidosRestricoesPortal(request: Request, pacienteId: string): Promise<Response> {
  if (!restricoesClinicasHabilitadasNaWeb()) return erro(404);
  if (!UUID.test(pacienteId)) return erro(400);
  return repassarLeitura(request, caminhoPaciente(pacienteId, "pedidos/listar"), projetarPedidosPortal);
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

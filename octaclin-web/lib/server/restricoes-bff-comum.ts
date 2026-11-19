import { NextResponse } from "next/server";
import { restricoesClinicasHabilitadasNaWeb } from "./funcionalidades-web-bff";
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from "./sessao-bff";
import { origemMutacaoPermitida } from "./seguranca-bff";

/**
 * Repasse comum dos BFFs de restrições (portal P3-1/P3-2 e equipe P3-6).
 *
 * O BFF não decide autorização: exige sessão, a permissão grossa da superfície, Origin da própria web, valida a forma da
 * entrada (montador exato) e repassa. Tenant, papel, carteira, delegação e vínculo são provados pelo backend sob lock.
 * Respostas `private, no-store`; erro com mensagem fixa (o corpo do backend nunca é repassado); 200 projetado por
 * allowlist. Flag da web desligada responde 404 sem tocar o backend.
 */
export const CABECALHOS_RESTRICOES = { "Content-Type": "application/json", "Cache-Control": "private, no-store", Vary: "Cookie" };
export const UUID_RESTRICOES = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE_CORPO_ENTRADA = 4096;
const LIMITE_CORPO_RESPOSTA = 512 * 1024;

const MENSAGENS: Readonly<Record<number, string>> = Object.freeze({
  400: "Solicitação inválida.",
  401: "Sessão necessária.",
  403: "Operação não autorizada.",
  404: "Recurso indisponível.",
  409: "Dados alterados ou limite atingido.",
  429: "Muitas tentativas. Tente novamente em alguns minutos.",
  503: "Serviço indisponível.",
});
const REPASSADOS = [400, 401, 403, 409, 429];

export const responderRestricoes = (corpo: unknown, status = 200) => NextResponse.json(corpo, { status, headers: CABECALHOS_RESTRICOES });
export const erroRestricoes = (status: number) => responderRestricoes({ mensagem: MENSAGENS[status] ?? MENSAGENS[503] }, status);

export async function lerTextoLimitado(fonte: Request | Response, limite: number): Promise<string | null> {
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
export async function lerJsonLimitado(request: Request): Promise<unknown> {
  const bruto = await lerTextoLimitado(request, LIMITE_CORPO_ENTRADA);
  if (bruto === null) return undefined;
  try {
    return JSON.parse(bruto);
  } catch {
    return undefined;
  }
}

/** Rotas que aceitam exatamente `{}`: nada do navegador chega ao backend. */
export const exigirCorpoVazio = (valor: unknown): Record<string, never> | null =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor) && Object.keys(valor).length === 0 ? {} : null;

export interface RepasseRestricoes {
  caminho: string;
  /** Uma permissão ou todas as de uma lista (espelhando a guarda do backend). */
  permissao: string | readonly string[];
  montarCorpo: (valor: unknown) => unknown | null;
  projetar: (valor: unknown) => unknown;
}

export async function repassarRestricoes(request: Request, { caminho, permissao, montarCorpo, projetar }: RepasseRestricoes): Promise<Response> {
  if (!restricoesClinicasHabilitadasNaWeb()) return erroRestricoes(404);
  try {
    if (!origemMutacaoPermitida(request)) return erroRestricoes(403);
    for (const p of typeof permissao === "string" ? [permissao] : permissao) await exigirPermissaoBff(p);
    const corpo = montarCorpo(await lerJsonLimitado(request));
    if (corpo === null) return erroRestricoes(400);
    const resposta = await requisitarBackendAutenticado(caminho, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal: request.signal,
    });
    if (resposta.status !== 200 && resposta.status !== 201) {
      await resposta.body?.cancel();
      return erroRestricoes(REPASSADOS.includes(resposta.status) ? resposta.status : 503);
    }
    const texto = await lerTextoLimitado(resposta, LIMITE_CORPO_RESPOSTA);
    if (texto === null) return erroRestricoes(503);
    let valor: unknown;
    try {
      valor = JSON.parse(texto);
    } catch {
      return erroRestricoes(503);
    }
    const projetado = projetar(valor);
    return projetado === null ? erroRestricoes(503) : responderRestricoes(projetado);
  } catch (falha) {
    if (falha instanceof ErroSessaoAusente) return erroRestricoes(401);
    if (falha instanceof ErroPermissaoAusente) return erroRestricoes(403);
    return erroRestricoes(503);
  }
}

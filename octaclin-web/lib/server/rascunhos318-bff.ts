import { NextResponse } from "next/server";
import {
  ErroSessaoAusente,
  ErroPermissaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado,
} from "./sessao-bff";
import { origemMutacaoPermitida } from "./seguranca-bff";
const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};
const reply = (v: unknown, status = 200) =>
  NextResponse.json(v, { status, headers: HEADERS });
const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const pick = (o: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(
    keys
      .filter(
        (k) =>
          o &&
          (o[k] === null ||
            ["string", "boolean", "number"].includes(typeof o[k])),
      )
      .map((k) => [k, o[k]]),
  );
const ops: Record<
  string,
  {
    method: string;
    keys: string[];
    suffix: string;
  }
> = {
  modelos: { method: "GET", keys: [], suffix: "modelos" },
  credencial: { method: "GET", keys: [], suffix: "credencial" },
  "definir-credencial": {
    method: "PUT",
    keys: ["chave", "versaoEsperada", "contextoSessao"],
    suffix: "credencial",
  },
  "remover-credencial": {
    method: "DELETE",
    keys: ["versaoEsperada", "contextoSessao"],
    suffix: "credencial",
  },
  configuracao: { method: "GET", keys: [], suffix: "configuracao" },
  configurar: {
    method: "PATCH",
    keys: [
      "habilitada",
      "versaoEsperada",
      "maxChamadas15min",
      "maxTokensSaida",
    ],
    suffix: "configuracao",
  },
  fontes: { method: "GET", keys: ["pacienteId"], suffix: "fontes" },
  "pre-consulta": {
    method: "POST",
    keys: ["pacienteId", "chaveComando", "modeloId", "selecoes"],
    suffix: "pre-consulta",
  },
  evolucao: {
    method: "POST",
    keys: [
      "pacienteId",
      "chaveComando",
      "modeloId",
      "selecoes",
      "textoProfissional",
    ],
    suffix: "evolucao",
  },
  confirmar: {
    method: "POST",
    keys: [
      "pacienteId",
      "chaveComando",
      "provaRevisao",
      "titulo",
      "conteudo",
      "tipo",
      "consultaId",
      "confirmado",
      "textoProfissional",
    ],
    suffix: "confirmar",
  },
};
function projetar(acao: string, v: Record<string, unknown>) {
  const config = (c: Record<string, unknown>) =>
    pick(c, [
      "habilitada",
      "versao",
      "operacaoAprovada",
      "maxChamadas15min",
      "maxTokensSaida",
    ]);
  if (acao === "modelos")
    return {
      contextoSessao:
        typeof v.contextoSessao === "string" &&
        /^[a-f0-9]{64}$/.test(v.contextoSessao)
          ? v.contextoSessao
          : undefined,
      modelos: Array.isArray(v.modelos)
        ? v.modelos.map((m) =>
            pick(m, [
              "id",
              "versao",
              "nome",
              "padrao",
              "maxOutputTokens",
              "precoEntradaMilhaoUsd",
              "precoSaidaMilhaoUsd",
              "precoEm",
            ]),
          )
        : [],
      configuracao: config((v.configuracao ?? {}) as Record<string, unknown>),
    };
  if (acao.includes("credencial")) return pick(v, ["estado", "versao"]);
  if (acao === "configuracao" || acao === "configurar") return config(v);
  if (acao === "fontes")
    return {
      fontes: Array.isArray(v.fontes)
        ? v.fontes.map((f) => pick(f, ["ref", "tipo", "data", "texto"]))
        : [],
      cobertura: pick((v.cobertura ?? {}) as Record<string, unknown>, [
        "evolucoes",
        "medidas",
        "examesIncluidos",
      ]),
    };
  if (acao === "confirmar")
    return pick(v, [
      "id",
      "titulo",
      "conteudo",
      "tipo",
      "visibilidade",
      "consultaId",
      "criadoEm",
      "atualizadoEm",
    ]);
  return {
    ...pick(v, [
      "modalidade",
      "texto",
      "modeloId",
      "versaoModelo",
      "provaRevisao",
      "expiraEm",
      "revisaoHumanaObrigatoria",
    ]),
    itens: Array.isArray(v.itens)
      ? v.itens.map((i) => ({
          ...pick(i, ["texto"]),
          refs: Array.isArray(i.refs)
            ? i.refs.filter((r: unknown) => typeof r === "string")
            : [],
        }))
      : [],
    limitacoes: Array.isArray(v.limitacoes)
      ? v.limitacoes.filter((l) => typeof l === "string")
      : [],
    referencias: Array.isArray(v.referencias)
      ? v.referencias.map((r) => pick(r, ["ref", "tipo", "data"]))
      : [],
    cobertura: pick((v.cobertura ?? {}) as Record<string, unknown>, [
      "fontesSelecionadas",
      "limiteEvolucoes",
      "limiteMedidas",
      "examesIncluidos",
    ]),
  };
}
async function lerCorpoLimitado318(
  request: Request,
  maxBytes: number,
): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0,
    text = "";
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maxBytes) return null;
      text += decoder.decode(part.value, { stream: true });
    }
    return text + decoder.decode();
  } catch {
    return null;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
export async function tratarRascunhos318(request: Request): Promise<Response> {
  try {
    const sessao = await exigirPermissaoBff("ia.executar").catch(async (e) => {
      if (e instanceof ErroPermissaoAusente)
        return exigirPermissaoBff("cliente.configuracoes.gerenciar");
      throw e;
    });
    if (!origemMutacaoPermitida(request))
      return reply({ mensagem: "Origem não permitida." }, 403);
    const text = await lerCorpoLimitado318(request, 128 * 1024);
    if (text === null || text.length > 45000)
      return reply({ mensagem: "Limite de solicitação excedido." }, 400);
    let b: Record<string, unknown>;
    try {
      b = JSON.parse(text);
    } catch {
      return reply({ mensagem: "Solicitação inválida." }, 400);
    }
    if (!b || Array.isArray(b) || typeof b.acao !== "string")
      return reply({ mensagem: "Solicitação inválida." }, 400);
    const op = ops[b.acao];
    if (!op || Object.keys(b).some((k) => k !== "acao" && !op.keys.includes(k)))
      return reply({ mensagem: "Solicitação inválida." }, 400);
    const isConfig = b.acao === "configuracao" || b.acao === "configurar";
    if (isConfig) {
      if (sessao.papel !== "Client")
        return reply({ mensagem: "Acesso indisponível." }, 403);
      await exigirPermissaoBff("cliente.configuracoes.gerenciar");
    } else {
      if (sessao.papel !== "Professional")
        return reply({ mensagem: "Acesso indisponível." }, 403);
      await exigirPermissaoBff("ia.executar");
      await exigirPermissaoBff("pacientes.gerenciar");
    }
    let path = "/ia/rascunhos/" + op.suffix;
    if (op.keys.includes("pacienteId")) {
      if (typeof b.pacienteId !== "string" || !UUID.test(b.pacienteId))
        return reply({ mensagem: "Paciente inválido." }, 400);
      path =
        "/ia/rascunhos/pacientes/" +
        encodeURIComponent(b.pacienteId) +
        "/" +
        op.suffix;
    }
    const payload = Object.fromEntries(
      op.keys
        .filter((k) => k !== "pacienteId" && b[k] !== undefined)
        .map((k) => [k, b[k]]),
    );
    const r = await requisitarBackendAutenticado(path, {
      method: op.method,
      ...(op.method === "GET" ? {} : { body: JSON.stringify(payload) }),
    });
    if (!r.ok)
      return reply(
        {
          mensagem:
            r.status === 409
              ? "Contexto ou comando mudou. Confira novamente."
              : r.status === 403
                ? "Função indisponível: confira vínculo e liberações."
                : "Não foi possível concluir. O registro manual continua disponível.",
        },
        r.status,
      );
    return reply(projetar(b.acao, await r.json()));
  } catch (e) {
    if (e instanceof ErroSessaoAusente)
      return reply({ mensagem: "Sessão indisponível." }, 401);
    if (e instanceof ErroPermissaoAusente)
      return reply({ mensagem: "Acesso indisponível." }, 403);
    return reply({ mensagem: "Serviço indisponível." }, 502);
  }
}

export async function tratarConfigIa318Operacoes(
  request: Request,
  tenantId: string,
  method: "GET" | "PATCH",
): Promise<Response> {
  try {
    const sessao = await exigirPermissaoBff("operacoes.tenants.gerenciar");
    if (sessao.papel !== "SuperAdmin" || !origemMutacaoPermitida(request))
      return reply({ mensagem: "Acesso indisponível." }, 403);
    if (!UUID.test(tenantId))
      return reply({ mensagem: "Clínica inválida." }, 400);
    let body: Record<string, unknown> | undefined;
    if (method === "PATCH") {
      const text = await lerCorpoLimitado318(request, 2048);
      if (text === null || text.length > 2000)
        return reply({ mensagem: "Solicitação inválida." }, 400);
      body = JSON.parse(text);
      if (
        !body ||
        Array.isArray(body) ||
        Object.keys(body).some(
          (k) =>
            ![
              "habilitada",
              "versaoEsperada",
              "maxChamadas15min",
              "maxTokensSaida",
            ].includes(k),
        )
      )
        return reply({ mensagem: "Solicitação inválida." }, 400);
    }
    const r = await requisitarBackendAutenticado(
      `/operacoes/tenants/${encodeURIComponent(tenantId)}/ia-rascunhos`,
      { method, ...(body ? { body: JSON.stringify(body) } : {}) },
    );
    if (!r.ok)
      return reply(
        {
          mensagem:
            "Configuração indisponível. Confira vínculo, versão e liberações.",
        },
        r.status,
      );
    return reply(
      pick(await r.json(), [
        "habilitada",
        "versao",
        "operacaoAprovada",
        "maxChamadas15min",
        "maxTokensSaida",
      ]),
    );
  } catch (e) {
    if (e instanceof ErroSessaoAusente)
      return reply({ mensagem: "Sessão indisponível." }, 401);
    if (e instanceof ErroPermissaoAusente)
      return reply({ mensagem: "Acesso indisponível." }, 403);
    return reply({ mensagem: "Configuração indisponível." }, 502);
  }
}

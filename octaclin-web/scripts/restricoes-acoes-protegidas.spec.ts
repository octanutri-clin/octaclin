import assert from "node:assert/strict";
import test from "node:test";
import * as nextHeaders from "next/headers";
import {
  formularioCorrecao,
  montarInativacaoRestricao,
  montarReavaliacaoRestricao,
  projetarEstadoRestricao,
  type RestricaoProntuario,
} from "../lib/restricoes-prontuario";
import { tratarInativarRestricao, tratarReavaliarRestricao } from "../lib/server/restricoes-prontuario-bff";
import { salvarSessaoBff } from "../lib/server/sessao-bff";
import { OPCOES_MOTIVO_INATIVACAO, TEXTOS_RESTRICOES_PRONTUARIO as T } from "../lib/textos-restricoes-prontuario";

/** FOOD06 P3-4a: reavaliar, inativar em dois passos e "Corrigir registro" (NUX-01). Dados sintéticos; canários provam o que não passa. */
const { __clearCookies } = nextHeaders as typeof nextHeaders & { __clearCookies: () => void };
const PACIENTE = "33333333-3333-4333-8333-333333333333";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const inativar = (sobre: Record<string, unknown> = {}) =>
  ({ revisao: 4, motivo: "registro_incorreto", justificativa: "Registro sintético duplicado.", confirmacaoEmDoisPassos: true, ...sobre });

test("inativar: corpo exato; motivo da lista; justificativa sem quebra de linha e com até 1000 caracteres (regra do backend)", () => {
  assert.deepEqual(montarInativacaoRestricao(inativar()), inativar());
  // Quebra de linha e tabulação viram espaço (o backend recusa controle); espaços nas pontas saem.
  assert.deepEqual(montarInativacaoRestricao(inativar({ justificativa: "  Linha 1\nLinha\t2  " })), inativar({ justificativa: "Linha 1 Linha 2" }));
  assert.deepEqual(montarInativacaoRestricao(inativar({ justificativa: "é".repeat(1000) })), inativar({ justificativa: "é".repeat(1000) }));
  for (const ruim of [
    inativar({ justificativa: "a".repeat(1001) }), inativar({ justificativa: " \n " }), inativar({ motivo: "CANARIO" }),
    inativar({ confirmacaoEmDoisPassos: false }), inativar({ revisao: 0 }), inativar({ tenantId: "CANARIO" }),
    { revisao: 4, motivo: "outro", justificativa: "ok" }, inativar({ justificativa: "a\u0000b" }),
  ]) assert.equal(montarInativacaoRestricao(ruim), null);
});

test("reavaliar: corpo exato; só os dois destinos do contrato", () => {
  assert.deepEqual(montarReavaliacaoRestricao({ revisao: 3, destino: "em_reavaliacao" }), { revisao: 3, destino: "em_reavaliacao" });
  assert.deepEqual(montarReavaliacaoRestricao({ revisao: 3, destino: "ativa" }), { revisao: 3, destino: "ativa" });
  for (const ruim of [{ revisao: 3, destino: "inativa" }, { revisao: 3 }, { revisao: 3, destino: "ativa", x: 1 }, { revisao: -1, destino: "ativa" }])
    assert.equal(montarReavaliacaoRestricao(ruim), null);
});

test("resposta de estado: mesma restrição, revisão seguinte e estado esperado; nada mais passa", () => {
  assert.deepEqual(projetarEstadoRestricao({ id: A, revisao: 5, estado: "inativa", motivo: "CANARIO" }, A, 4, "inativa"), { id: A, revisao: 5, estado: "inativa" });
  assert.equal(projetarEstadoRestricao({ id: B, revisao: 5, estado: "inativa" }, A, 4, "inativa"), null);
  assert.equal(projetarEstadoRestricao({ id: A, revisao: 6, estado: "inativa" }, A, 4, "inativa"), null);
  assert.equal(projetarEstadoRestricao({ id: A, revisao: 5, estado: "ativa" }, A, 4, "inativa"), null);
});

const confirmada = (conteudo: Partial<RestricaoProntuario["conteudo"]> = {}): RestricaoProntuario => ({
  id: A, revisao: 4, origem: "profissional", estado: "ativa", confirmacao: "confirmada", criadoEm: "2026-11-10T10:00:00.000Z",
  conteudo: { natureza: "clinica", subtipoClinico: "alergia_alimentar", alvo: { tipo: "nao_catalogado" }, alvoDeclarado: "Amendoim", gravidade: "grave",
    observacao: "Obs sintética", ...conteudo },
});

test("corrigir registro (NUX-01): o formulário parte da restrição antiga; 'não sei dizer' não vira tipo afirmado", () => {
  assert.deepEqual(formularioCorrecao(confirmada()), { tipo: "alergia", alimento: "Amendoim", gravidade: "grave", observacao: "Obs sintética" });
  assert.deepEqual(formularioCorrecao(confirmada({ natureza: "escolha", subtipoClinico: undefined, gravidade: undefined, observacao: undefined })),
    { tipo: "escolha", alimento: "Amendoim", gravidade: "nao_informada", observacao: "" });
  assert.deepEqual(formularioCorrecao(confirmada({ subtipoClinico: "outra_restricao_clinica", classificacaoPeloPaciente: "nao_sabe", gravidade: "nao_informada" })),
    { tipo: "", alimento: "Amendoim", gravidade: "nao_informada", observacao: "Obs sintética" });
});

test("textos: motivos humanos; inativar repete tipo e alimento e diz que o histórico fica; correção diz onde parou", () => {
  assert.deepEqual(OPCOES_MOTIVO_INATIVACAO.map((o) => o.valor), ["registro_incorreto", "informacao_clinica_revisada", "solicitacao_fundamentada", "outro"]);
  for (const o of OPCOES_MOTIVO_INATIVACAO) assert.doesNotMatch(o.rotulo, /_/);
  assert.equal(T.inativarConfirmacao("alergia alimentar", "Amendoim"), "Você está inativando alergia alimentar confirmada: Amendoim. O histórico é preservado.");
  assert.match(T.correcaoParouRegistro, /antiga continua/);
  assert.match(T.correcaoParouConfirmacao, /antiga continua/);
  assert.match(T.correcaoParouInativacao, /nova já está confirmada/);
  for (const t of [T.ajudaReavaliar, T.ajudaManterConfirmada, T.ajudaCorrigir, T.ajudaJustificativaInativar])
    assert.doesNotMatch(t, /_|uuid|revis[aã]o \d|409|seguro|liberad/i);
});

// ---------------------------------------------------------------- BFF
const req = (body: unknown = {}, origin = "http://localhost") =>
  new Request("http://localhost/api/restricoes", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
async function login(permissoes = ["pacientes.ler", "pacientes.gerenciar"]) {
  await salvarSessaoBff({ apiUrl: "http://backend.octaclin.local", tenantSlug: "sintetica", email: "s@example.test" },
    { accessToken: "sintetico", refreshToken: "sintetico", tipoToken: "Bearer", expiraEmSegundos: 3600, papel: "Professional", permissoes });
}
type Chamada = { url: string; init?: RequestInit };
async function comBackend(resposta: (c: Chamada) => Response, corpo: (chamadas: Chamada[]) => Promise<void>, flag = "true") {
  const antigo = global.fetch;
  const flagAntiga = process.env.OCTACLIN_WEB_RESTRICOES_CLINICAS;
  process.env.OCTACLIN_WEB_RESTRICOES_CLINICAS = flag;
  const chamadas: Chamada[] = [];
  global.fetch = (async (url: string, init?: RequestInit) => { const c = { url: String(url), init }; chamadas.push(c); return resposta(c); }) as typeof fetch;
  try { await corpo(chamadas); } finally {
    global.fetch = antigo;
    if (flagAntiga === undefined) delete process.env.OCTACLIN_WEB_RESTRICOES_CLINICAS; else process.env.OCTACLIN_WEB_RESTRICOES_CLINICAS = flagAntiga;
    __clearCookies();
  }
}

test("BFF ações protegidas: flag desligada 404; sem sessão 401; Origin hostil 403; exige ler E gerenciar; nada chega ao backend", async () => {
  await comBackend(() => Response.json({}), async (chamadas) => {
    await login();
    assert.equal((await tratarInativarRestricao(req(inativar()), PACIENTE, A)).status, 404);
    assert.equal((await tratarReavaliarRestricao(req({ revisao: 3, destino: "ativa" }), PACIENTE, A)).status, 404);
    assert.equal(chamadas.length, 0);
  }, "false");
  await comBackend(() => Response.json({}), async (chamadas) => {
    assert.equal((await tratarInativarRestricao(req(inativar()), PACIENTE, A)).status, 401);
    await login();
    assert.equal((await tratarInativarRestricao(req(inativar(), "https://hostil.example"), PACIENTE, A)).status, 403);
    __clearCookies();
    await login(["pacientes.ler"]);
    assert.equal((await tratarInativarRestricao(req(inativar()), PACIENTE, A)).status, 403);
    assert.equal((await tratarReavaliarRestricao(req({ revisao: 3, destino: "ativa" }), PACIENTE, A)).status, 403);
    __clearCookies();
    await login();
    assert.equal((await tratarInativarRestricao(req(inativar()), PACIENTE, "nao-e-uuid")).status, 400);
    assert.equal((await tratarInativarRestricao(req(inativar()), "nao-e-uuid", A)).status, 400);
    assert.equal((await tratarReavaliarRestricao(req({ revisao: 3, destino: "ativa" }), "../outro", A)).status, 400);
    assert.equal((await tratarInativarRestricao(req(inativar({ motivo: "CANARIO" })), PACIENTE, A)).status, 400);
    assert.equal((await tratarReavaliarRestricao(req({ revisao: 3, destino: "inativa" }), PACIENTE, A)).status, 400);
    assert.equal(chamadas.length, 0);
  });
});

test("BFF ações protegidas: caminho e corpo exatos; resposta conferida; erro do backend nunca repassado", async () => {
  await comBackend((c) => {
    const p = new URL(c.url).pathname;
    if (p.endsWith("/inativar")) return Response.json({ id: A, revisao: 5, estado: "inativa", justificativa: "CANARIO" });
    return Response.json({ id: A, revisao: 4, estado: "em_reavaliacao" });
  }, async (chamadas) => {
    await login();
    const i = await tratarInativarRestricao(req(inativar({ justificativa: "Linha 1\nLinha 2" })), PACIENTE, A.toUpperCase());
    assert.equal(i.status, 200);
    const texto = await i.text();
    assert.doesNotMatch(texto, /CANARIO/);
    assert.deepEqual(JSON.parse(texto), { id: A, revisao: 5, estado: "inativa" });
    assert.match(i.headers.get("cache-control") ?? "", /private, no-store/);
    const r = await tratarReavaliarRestricao(req({ revisao: 3, destino: "em_reavaliacao" }), PACIENTE, A);
    assert.equal(r.status, 200);
    assert.deepEqual(chamadas.map((c) => new URL(c.url).pathname), [`/pacientes/${PACIENTE}/restricoes/${A}/inativar`, `/pacientes/${PACIENTE}/restricoes/${A}/reavaliar`]);
    assert.deepEqual(JSON.parse(String(chamadas[0].init!.body)), inativar({ justificativa: "Linha 1 Linha 2" }));
    assert.deepEqual(JSON.parse(String(chamadas[1].init!.body)), { revisao: 3, destino: "em_reavaliacao" });
  });
  // Destino diferente do pedido, revisão errada e erro do backend: nunca passam.
  await comBackend(() => Response.json({ id: A, revisao: 4, estado: "ativa" }), async () => {
    await login();
    assert.equal((await tratarReavaliarRestricao(req({ revisao: 3, destino: "em_reavaliacao" }), PACIENTE, A)).status, 503);
  });
  for (const status of [403, 409, 500]) {
    await comBackend(() => Response.json({ message: "CANARIO" }, { status }), async () => {
      await login();
      const r = await tratarInativarRestricao(req(inativar()), PACIENTE, A);
      assert.equal(r.status, status === 500 ? 503 : status);
      assert.doesNotMatch(await r.text(), /CANARIO/);
    });
  }
});

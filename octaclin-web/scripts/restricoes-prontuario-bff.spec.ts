import assert from "node:assert/strict";
import test from "node:test";
import * as nextHeaders from "next/headers";
import {
  tratarAvaliacaoProntuario,
  tratarConfirmarRestricao,
  tratarIniciarAvaliacao,
  tratarListarRestricoesColaborador,
  tratarListarRestricoesProntuario,
  tratarRegistrarRestricaoColaborador,
  tratarRegistrarRestricaoProntuario,
  tratarRejeitarRestricao,
} from "../lib/server/restricoes-prontuario-bff";
import { salvarSessaoBff } from "../lib/server/sessao-bff";

/** FOOD06 P3-3: BFF da aba "Restrições". O BFF não decide papel, carteira nem concessão: quem nega é o backend simulado. */
const { __clearCookies } = nextHeaders as typeof nextHeaders & { __clearCookies: () => void };
const PACIENTE = "33333333-3333-4333-8333-333333333333";
const R = "11111111-1111-4111-8111-111111111111";
const CHAVE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ISO = "2026-11-10T10:00:00.000Z";
const req = (body: unknown = {}, origin = "http://localhost") =>
  new Request("http://localhost/api/restricoes", { method: "POST", headers: { origin, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body) });
const registro = { chaveCriacao: CHAVE, tipo: "alergia", alimento: "Amendoim", gravidade: "grave", observacao: "" };

async function login(papel = "Professional", permissoes = ["pacientes.ler", "pacientes.gerenciar"]) {
  await salvarSessaoBff({ apiUrl: "http://backend.octaclin.local", tenantSlug: "sintetica", email: "s@example.test" },
    { accessToken: "sintetico", refreshToken: "sintetico", tipoToken: "Bearer", expiraEmSegundos: 3600, papel, permissoes });
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
const caminhos = (c: Chamada[]) => c.map((x) => new URL(x.url).pathname);
const profissional = () => [
  tratarListarRestricoesProntuario(req(), PACIENTE), tratarAvaliacaoProntuario(req(), PACIENTE), tratarIniciarAvaliacao(req(), PACIENTE),
  tratarRegistrarRestricaoProntuario(req(registro), PACIENTE), tratarConfirmarRestricao(req({ revisao: 2 }), PACIENTE, R),
  tratarRejeitarRestricao(req({ revisao: 2, justificativa: "Motivo sintético" }), PACIENTE, R),
];
const todas = () => [...profissional(), tratarListarRestricoesColaborador(req(), PACIENTE), tratarRegistrarRestricaoColaborador(req(registro), PACIENTE)];

test("aba: flag da web desligada responde 404 sem tocar o backend", async () => {
  await comBackend(() => Response.json({}), async (chamadas) => {
    await login();
    for (const r of await Promise.all(todas())) assert.equal(r.status, 404);
    assert.equal(chamadas.length, 0);
  }, "false");
});

test("aba: sem sessão 401; Origin hostil 403; escrita do profissional exige ler E gerenciar; colaborador registra com ler", async () => {
  await comBackend(() => Response.json({}), async (chamadas) => {
    __clearCookies();
    assert.equal((await tratarListarRestricoesProntuario(req(), PACIENTE)).status, 401);
    await login("Professional", ["pacientes.ler"]);
    assert.equal((await tratarConfirmarRestricao(req({ revisao: 2 }), PACIENTE, R)).status, 403);
    assert.equal((await tratarRegistrarRestricaoProntuario(req(registro), PACIENTE)).status, 403);
    assert.equal((await tratarIniciarAvaliacao(req(), PACIENTE)).status, 403);
    await login("Professional", ["pacientes.gerenciar"]);
    assert.equal((await tratarRejeitarRestricao(req({ revisao: 2, justificativa: "x" }), PACIENTE, R)).status, 403);
    await login();
    assert.equal((await tratarListarRestricoesProntuario(req({}, "https://attacker.invalid"), PACIENTE)).status, 403);
    assert.equal(chamadas.length, 0);
  });
  await comBackend(() => Response.json({ id: R, revisao: 1, estado: "ativa", confirmacao: "pendente" }), async (chamadas) => {
    await login("Collaborator", ["pacientes.ler"]);
    assert.equal((await tratarRegistrarRestricaoColaborador(req(registro), PACIENTE)).status, 200);
    assert.deepEqual(caminhos(chamadas), [`/colaborador/pacientes/${PACIENTE}/restricoes/registrar`]);
  });
});

test("aba: entrada fechada (ids, corpo exato, conteúdo montado pelo BFF); nada chega ao backend", async () => {
  await comBackend(() => Response.json({}), async (chamadas) => {
    await login();
    for (const p of [
      tratarListarRestricoesProntuario(req({ tenantId: "x" }), PACIENTE), tratarListarRestricoesProntuario(req(), "../x"),
      tratarConfirmarRestricao(req({ revisao: 2 }), PACIENTE, "%2e%2e"), tratarConfirmarRestricao(req({ revisao: "2" }), PACIENTE, R),
      tratarRejeitarRestricao(req({ revisao: 2, justificativa: " " }), PACIENTE, R),
      tratarRegistrarRestricaoProntuario(req({ ...registro, conteudo: { natureza: "preferencia" } }), PACIENTE),
      tratarRegistrarRestricaoProntuario(req({ ...registro, tipo: "preferencia" }), PACIENTE),
      tratarIniciarAvaliacao(req({ situacao: "restricoes_registradas" }), PACIENTE),
      tratarRegistrarRestricaoColaborador(req("x".repeat(5000)), PACIENTE),
    ]) {
      const r = await p;
      assert.equal(r.status, 400);
    }
    assert.equal(chamadas.length, 0);
  });
});

test("aba: repasse com caminho exato; o BFF monta o conteúdo do contrato e manda a revisão", async () => {
  await comBackend((c) => {
    const p = new URL(c.url).pathname;
    if (p.endsWith("/restricoes/listar")) return Response.json({ escopo: "completo", itens: [] });
    if (p.endsWith("/avaliacao/consultar")) return Response.json({ avaliacao: null });
    if (p.endsWith("/avaliacao/inicial")) return Response.json({ id: R, revisao: 1, situacao: "nao_informado" });
    if (p.endsWith("/registrar")) return Response.json({ id: R, revisao: 1, estado: "ativa", confirmacao: "pendente" });
    if (p.endsWith("/confirmar")) return Response.json({ id: R, revisao: 3, confirmacao: "confirmada" });
    return Response.json({ id: R, revisao: 3, confirmacao: "rejeitada" });
  }, async (chamadas) => {
    await login();
    for (const r of await Promise.all(profissional())) assert.equal(r.status, 200);
    assert.deepEqual(caminhos(chamadas).sort(), [
      `/pacientes/${PACIENTE}/restricoes/listar`, `/pacientes/${PACIENTE}/restricoes/avaliacao/consultar`, `/pacientes/${PACIENTE}/restricoes/avaliacao/inicial`,
      `/pacientes/${PACIENTE}/restricoes/registrar`, `/pacientes/${PACIENTE}/restricoes/${R}/confirmar`, `/pacientes/${PACIENTE}/restricoes/${R}/rejeitar`,
    ].sort());
    const corpo = (fim: string) => JSON.parse(String(chamadas.find((c) => c.url.endsWith(fim))!.init!.body));
    assert.deepEqual(corpo("/registrar"), { chaveCriacao: CHAVE, conteudo: { schemaVersao: 1, natureza: "clinica", subtipoClinico: "alergia_alimentar",
      alvo: { tipo: "nao_catalogado" }, alvoDeclarado: "Amendoim", gravidade: "grave" } });
    assert.deepEqual(corpo("/confirmar"), { revisao: 2 });
    assert.deepEqual(corpo("/rejeitar"), { revisao: 2, justificativa: "Motivo sintético" });
    assert.deepEqual(corpo("/avaliacao/inicial"), {});
  });
});

test("aba: resposta projetada (observação passa para a equipe; campos internos não); erros fixos; revisão errada vira 503", async () => {
  await comBackend(() => Response.json({ escopo: "completo", itens: [{ id: R, revisao: 2, origem: "profissional", estado: "ativa", confirmacao: "pendente",
    criadoEm: ISO, autorUsuarioId: "CANARIO", conteudo: { schemaVersao: 1, natureza: "clinica", subtipoClinico: "alergia_alimentar",
      alvo: { tipo: "nao_catalogado" }, alvoDeclarado: "Amendoim", observacao: "Obs sintética" } }] }), async () => {
    await login();
    const r = await tratarListarRestricoesProntuario(req(), PACIENTE);
    const texto = await r.text();
    assert.equal(r.status, 200);
    assert.doesNotMatch(texto, /CANARIO|schemaVersao/);
    assert.match(texto, /Obs sintética/);
    assert.match(r.headers.get("cache-control") ?? "", /private, no-store/);
  });
  for (const status of [403, 409, 500]) {
    await comBackend(() => Response.json({ message: "CANARIO" }, { status }), async () => {
      await login();
      const r = await tratarConfirmarRestricao(req({ revisao: 2 }), PACIENTE, R);
      assert.equal(r.status, status === 500 ? 503 : status);
      assert.doesNotMatch(await r.text(), /CANARIO/);
    });
  }
  await comBackend(() => Response.json({ id: R, revisao: 9, confirmacao: "confirmada" }), async () => {
    await login();
    assert.equal((await tratarConfirmarRestricao(req({ revisao: 2 }), PACIENTE, R)).status, 503);
  });
});

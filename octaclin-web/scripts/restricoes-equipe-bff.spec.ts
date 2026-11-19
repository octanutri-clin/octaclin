import assert from "node:assert/strict";
import test from "node:test";
import * as nextHeaders from "next/headers";
import {
  tratarBuscarRepresentante,
  tratarCandidatosDelegacao,
  tratarConcederDelegacao,
  tratarDisponibilidadeEquipe,
  tratarListarDelegacoes,
  tratarListarRepresentantes,
  tratarRegistrarRepresentante,
  tratarRevogarDelegacao,
  tratarRevogarRepresentante,
} from "../lib/server/restricoes-equipe-bff";
import { salvarSessaoBff } from "../lib/server/sessao-bff";

/** FOOD06 P3-6: BFF das telas de equipe. O BFF não decide papel nem carteira: quem nega é o backend simulado. */
const { __clearCookies } = nextHeaders as typeof nextHeaders & { __clearCookies: () => void };
const PACIENTE = "33333333-3333-4333-8333-333333333333";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const ISO = "2026-11-10T10:00:00.000Z";
const EMAIL = "canario.busca@example.test";
const ORIGEM = "http://localhost";

const req = (body: unknown = {}, origin = ORIGEM) =>
  new Request("http://localhost/api/equipe", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

async function login(papel = "Professional", permissoes = ["pacientes.ler", "pacientes.gerenciar"]) {
  await salvarSessaoBff(
    { apiUrl: "http://backend.octaclin.local", tenantSlug: "sintetica", email: "s@example.test" },
    { accessToken: "sintetico", refreshToken: "sintetico", tipoToken: "Bearer", expiraEmSegundos: 3600, papel, permissoes },
  );
}

type Chamada = { url: string; init?: RequestInit };
async function comBackend(resposta: (c: Chamada) => Response, corpo: (chamadas: Chamada[]) => Promise<void>, flag = "true") {
  const antigo = global.fetch;
  const flagAntiga = process.env.OCTACLIN_WEB_RESTRICOES_CLINICAS;
  process.env.OCTACLIN_WEB_RESTRICOES_CLINICAS = flag;
  const chamadas: Chamada[] = [];
  global.fetch = (async (url: string, init?: RequestInit) => {
    const c = { url: String(url), init };
    chamadas.push(c);
    return resposta(c);
  }) as typeof fetch;
  try {
    await corpo(chamadas);
  } finally {
    global.fetch = antigo;
    if (flagAntiga === undefined) delete process.env.OCTACLIN_WEB_RESTRICOES_CLINICAS;
    else process.env.OCTACLIN_WEB_RESTRICOES_CLINICAS = flagAntiga;
    __clearCookies();
  }
}
const json = async (r: Response) => JSON.parse(await r.text());
const semCache = (r: Response) => assert.match(r.headers.get("cache-control") ?? "", /private, no-store/);
const caminhos = (chamadas: Chamada[]) => chamadas.map((c) => new URL(c.url).pathname);

const todas = () => [
  tratarListarDelegacoes(req()), tratarCandidatosDelegacao(req()), tratarConcederDelegacao(req({ colaboradorUsuarioId: A })),
  tratarRevogarDelegacao(req(), A), tratarListarRepresentantes(req(), PACIENTE), tratarBuscarRepresentante(req({ email: EMAIL }), PACIENTE),
  tratarRegistrarRepresentante(req({ representanteUsuarioId: A, tipoVerificacao: "presencial" }), PACIENTE), tratarRevogarRepresentante(req(), PACIENTE, B),
];

test("equipe: flag da web desligada responde 404 sem backend; disponibilidade false sem perguntar ao backend", async () => {
  await comBackend(() => Response.json({ habilitada: true }), async (chamadas) => {
    await login();
    for (const r of await Promise.all(todas())) { assert.equal(r.status, 404); semCache(r); }
    assert.deepEqual(await json(await tratarDisponibilidadeEquipe()), { habilitada: false });
    assert.equal(chamadas.length, 0);
  }, "false");
});

test("equipe: disponibilidade exige web E tenant; falha do backend vira false", async () => {
  for (const [backend, esperado] of [[() => Response.json({ habilitada: true }), true], [() => Response.json({ habilitada: false }), false],
    [() => new Response("x", { status: 500 }), false], [() => Response.json({ habilitada: "true" }), false]] as const) {
    await comBackend(backend, async (chamadas) => {
      await login("Collaborator", ["pacientes.ler"]);
      const r = await tratarDisponibilidadeEquipe();
      semCache(r);
      assert.deepEqual(await json(r), { habilitada: esperado });
      assert.deepEqual(caminhos(chamadas), ["/restricoes/disponibilidade"]);
      assert.equal(chamadas[0].init?.body, "{}");
    });
  }
  await comBackend(() => Response.json({}), async (chamadas) => {
    __clearCookies();
    assert.equal((await tratarDisponibilidadeEquipe()).status, 401);
    assert.equal(chamadas.length, 0);
  });
});

test("equipe: sem sessão 401, origem hostil 403, permissão grossa ausente 403, sem backend", async () => {
  await comBackend(() => Response.json({}), async (chamadas) => {
    __clearCookies();
    assert.equal((await tratarListarDelegacoes(req())).status, 401);
    await login("Professional", ["pacientes.ler"]);
    // Mudar a delegação exige pacientes.gerenciar; ler não basta.
    assert.equal((await tratarCandidatosDelegacao(req())).status, 403);
    assert.equal((await tratarConcederDelegacao(req({ colaboradorUsuarioId: A }))).status, 403);
    assert.equal((await tratarRevogarDelegacao(req(), A)).status, 403);
    await login("Patient", ["portal.acessar"]);
    assert.equal((await tratarListarRepresentantes(req(), PACIENTE)).status, 403);
    await login();
    assert.equal((await tratarListarRepresentantes(req({}, "https://attacker.invalid"), PACIENTE)).status, 403);
    assert.equal(chamadas.length, 0);
  });
});

test("equipe: entrada fechada (corpo exato, ids UUID, e-mail válido); nada chega ao backend", async () => {
  await comBackend(() => Response.json({}), async (chamadas) => {
    await login();
    for (const r of [
      tratarListarDelegacoes(req({ tenantId: A })), tratarConcederDelegacao(req({ colaboradorUsuarioId: A, profissionalId: B })),
      tratarConcederDelegacao(req({ colaboradorUsuarioId: "x" })), tratarRevogarDelegacao(req(), "../x"),
      tratarListarRepresentantes(req(), "id/forjado"), tratarBuscarRepresentante(req({ email: "sem-arroba" }), PACIENTE),
      tratarBuscarRepresentante(req({ email: EMAIL, pacienteId: B }), PACIENTE),
      tratarRegistrarRepresentante(req({ representanteUsuarioId: A, tipoVerificacao: "CANARIO" }), PACIENTE),
      tratarRevogarRepresentante(req({ motivo: "x" }), PACIENTE, B), tratarRevogarRepresentante(req(), PACIENTE, "%2e%2e"),
      tratarBuscarRepresentante(req("x".repeat(5000)), PACIENTE),
    ]) {
      const resposta = await r;
      assert.equal(resposta.status, 400);
      assert.doesNotMatch(await resposta.text(), /canario|example/i);
    }
    assert.equal(chamadas.length, 0);
  });
});

test("equipe: repasse com caminho exato, corpo exato e e-mail só no corpo normalizado", async () => {
  await comBackend((c) => {
    const p = new URL(c.url).pathname;
    if (p.endsWith("/delegacoes-carteira/listar")) return Response.json({ itens: [] });
    if (p.endsWith("/candidatos/listar")) return Response.json({ itens: [], noLimite: false });
    if (p.endsWith("/conceder")) return Response.json({ id: B, colaboradorUsuarioId: A, colaboradorEmail: "carla@example.test", concedidaEm: ISO });
    if (p.endsWith(`/delegacoes-carteira/${A}/revogar`)) return Response.json({ id: A, revogada: true });
    if (p.endsWith("/representantes/listar")) return Response.json({ itens: [] });
    if (p.endsWith("/candidato/buscar")) return Response.json({ candidato: null });
    if (p.endsWith("/registrar")) return Response.json({ id: B, representanteUsuarioId: A, tipoVerificacao: "presencial", verificadoEm: ISO,
      identificacao: { tipo: "email_mascarado", email: "c***@e***.test" } });
    return Response.json({ id: B, revogado: true });
  }, async (chamadas) => {
    await login();
    for (const r of await Promise.all(todas().map((p) => p))) assert.equal(r.status, 200);
    assert.deepEqual(caminhos(chamadas).sort(), [
      "/profissional/delegacoes-carteira/listar", "/profissional/delegacoes-carteira/candidatos/listar",
      "/profissional/delegacoes-carteira/conceder", `/profissional/delegacoes-carteira/${A}/revogar`,
      `/pacientes/${PACIENTE}/representantes/listar`, `/pacientes/${PACIENTE}/representantes/candidato/buscar`,
      `/pacientes/${PACIENTE}/representantes/registrar`, `/pacientes/${PACIENTE}/representantes/${B}/revogar`,
    ].sort());
    const busca = chamadas.find((c) => c.url.endsWith("/candidato/buscar"))!;
    assert.equal(busca.init?.body, JSON.stringify({ email: EMAIL }));
    for (const c of chamadas) { assert.equal(c.init?.method, "POST"); assert.doesNotMatch(c.url, /canario|example|@/i); }
    const busca2 = await tratarBuscarRepresentante(req({ email: `  ${EMAIL.toUpperCase()} ` }), PACIENTE);
    assert.equal(busca2.status, 200);
    assert.equal(chamadas.at(-1)?.init?.body, JSON.stringify({ email: EMAIL }));
  });
});

test("equipe: erros do backend viram mensagem fixa (429 inclusive), sem eco; resposta malformada vira 503", async () => {
  for (const status of [400, 401, 403, 409, 429, 404, 500]) {
    await comBackend(() => Response.json({ message: `CANARIO_${EMAIL}` }, { status }), async () => {
      await login();
      const r = await tratarBuscarRepresentante(req({ email: EMAIL }), PACIENTE);
      const esperado = [400, 401, 403, 409, 429].includes(status) ? status : 503;
      assert.equal(r.status, esperado, String(status));
      semCache(r);
      assert.doesNotMatch(await r.text(), /CANARIO|example/);
    });
  }
  await comBackend(() => Response.json({ candidato: { usuarioId: A, identificacao: { tipo: "email", email: EMAIL } } }), async () => {
    await login();
    const r = await tratarBuscarRepresentante(req({ email: EMAIL }), PACIENTE);
    assert.equal(r.status, 503);
    assert.doesNotMatch(await r.text(), /example/);
  });
  await comBackend(() => Response.json({ id: B, revogada: true }), async () => {
    await login();
    assert.equal((await tratarRevogarDelegacao(req(), A)).status, 503, "revogação de outro id");
  });
});

test("equipe: projeção remove campos internos e o e-mail completo nunca vai para representante", async () => {
  await comBackend(() => Response.json({ itens: [{ id: A, representanteUsuarioId: B, tipoVerificacao: "presencial", verificadoEm: ISO,
    identificacao: { tipo: "email_mascarado", email: "c***@e***.test", emailCompleto: EMAIL }, revogadoPor: "CANARIO" }] }), async () => {
    await login("Collaborator", ["pacientes.ler"]);
    const r = await tratarListarRepresentantes(req(), PACIENTE);
    assert.equal(r.status, 200);
    const corpo = await r.text();
    assert.doesNotMatch(corpo, /CANARIO|canario\.busca/);
    assert.deepEqual(JSON.parse(corpo).itens[0].identificacao, { tipo: "email_mascarado", email: "c***@e***.test" });
  });
});

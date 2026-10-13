import assert from "node:assert/strict";
import test from "node:test";
import * as nextHeaders from "next/headers";
import {
  tratarRascunhos318,
  tratarConfigIa318Operacoes,
} from "../lib/server/rascunhos318-bff";
import { salvarSessaoBff } from "../lib/server/sessao-bff";
const { __clearCookies } = nextHeaders as typeof nextHeaders & {
  __clearCookies: () => void;
};
const req = (body: unknown, origin = "http://localhost") =>
  new Request("http://localhost/api/ia/rascunhos", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
async function login(papel = "Professional") {
  await salvarSessaoBff(
    {
      apiUrl: "http://backend.octaclin.local",
      tenantSlug: "sintetica",
      email: "s@example.test",
    },
    {
      accessToken: "sintetico",
      refreshToken: "sintetico",
      tipoToken: "Bearer",
      expiraEmSegundos: 3600,
      papel,
      permissoes: ["ia.executar", "pacientes.gerenciar"],
    },
  );
}
test("318 nega sessao/papel/origem sem backend", async () => {
  const old = global.fetch;
  let calls = 0;
  global.fetch = (async () => {
    calls++;
    return Response.json({});
  }) as typeof fetch;
  try {
    __clearCookies();
    assert.equal(
      (await tratarRascunhos318(req({ acao: "modelos" }))).status,
      401,
    );
    await login("SuperAdmin");
    assert.equal(
      (await tratarRascunhos318(req({ acao: "modelos" }))).status,
      403,
    );
    await login();
    assert.equal(
      (
        await tratarRascunhos318(
          req({ acao: "modelos" }, "https://attacker.invalid"),
        )
      ).status,
      403,
    );
    assert.equal(calls, 0);
  } finally {
    global.fetch = old;
    __clearCookies();
  }
});
test("318 rejeita campo arbitrario e nao projeta segredo ou erro externo", async () => {
  const old = global.fetch;
  await login();
  global.fetch = (async () =>
    Response.json({
      estado: "cadastrada",
      versao: 1,
      chave: "segredo",
      chave_criptografada: "segredo",
    })) as typeof fetch;
  try {
    assert.equal(
      (await tratarRascunhos318(req({ acao: "credencial", tenantId: "x" })))
        .status,
      400,
    );
    const r = await tratarRascunhos318(req({ acao: "credencial" }));
    assert.equal(r.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await r.json(), { estado: "cadastrada", versao: 1 });
    global.fetch = (async () =>
      Response.json(
        { message: "segredo PHI" },
        { status: 500 },
      )) as typeof fetch;
    assert(
      !JSON.stringify(
        await (await tratarRascunhos318(req({ acao: "credencial" }))).json(),
      ).includes("segredo"),
    );
  } finally {
    global.fetch = old;
    __clearCookies();
  }
});

test("operacoes318 nao concede acesso clinico nem aceita alvo/campos livres", async () => {
  const old = global.fetch;
  await salvarSessaoBff(
    {
      apiUrl: "http://backend.octaclin.local",
      tenantSlug: "sintetica",
      email: "s@example.test",
    },
    {
      accessToken: "sintetico",
      refreshToken: "sintetico",
      tipoToken: "Bearer",
      expiraEmSegundos: 3600,
      papel: "SuperAdmin",
      permissoes: ["operacoes.tenants.gerenciar"],
    },
  );
  let url = "";
  global.fetch = (async (input) => {
    url = String(input);
    return Response.json({
      habilitada: false,
      versao: 0,
      operacaoAprovada: false,
      chave: "segredo",
    });
  }) as typeof fetch;
  try {
    const id = "10000000-0000-4000-8000-000000000001";
    const r = await tratarConfigIa318Operacoes(
      new Request("http://localhost/ops"),
      id,
      "GET",
    );
    assert.equal(r.status, 200);
    assert(!JSON.stringify(await r.json()).includes("segredo"));
    assert(url.endsWith(`/operacoes/tenants/${id}/ia-rascunhos`));
    assert.equal(
      (await tratarConfigIa318Operacoes(req({ chave: "x" }), id, "PATCH"))
        .status,
      400,
    );
  } finally {
    global.fetch = old;
    __clearCookies();
  }
});

test("318 limita leitura do corpo antes de alocar todo o stream", async () => {
  await login();
  let lidas = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      lidas++;
      if (lidas > 8) c.close();
      else c.enqueue(new Uint8Array(100000).fill(120));
    },
  });
  const r = new Request("http://localhost/api/ia/rascunhos", {
    method: "POST",
    headers: { origin: "http://localhost", "content-type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit);
  try {
    assert.equal((await tratarRascunhos318(r)).status, 400);
    assert(lidas < 8);
  } finally {
    __clearCookies();
  }
});

test("318 encaminha marcador no corpo das fontes e da geracao, sem URL", async () => {
  const old = global.fetch;
  await login();
  const calls: { url: string; method: string; body: Record<string, unknown> }[] = [];
  global.fetch = (async (url, init) => {
    calls.push({
      url: String(url),
      method: String(init?.method),
      body: JSON.parse(String(init?.body)),
    });
    return Response.json({ fontes: [], cobertura: {} });
  }) as typeof fetch;
  try {
    const pacienteId = "11111111-1111-4111-8111-111111111111";
    for (const acao of ["fontes", "evolucao", "pre-consulta"]) {
      const body = {
        acao,
        pacienteId,
        contextoSessao: "a".repeat(64),
        ...(acao === "fontes"
          ? {}
          : { chaveComando: pacienteId, modeloId: "fixture", selecoes: [] }),
      };
      assert.equal((await tratarRascunhos318(req(body))).status, 200);
    }
    for (const c of calls) {
      assert.equal(c.method, "POST");
      assert.equal(c.body.contextoSessao, "a".repeat(64));
      assert(!c.url.includes("a".repeat(64)));
    }
    assert.equal(calls.length, 3);
  } finally {
    global.fetch = old;
    __clearCookies();
  }
});

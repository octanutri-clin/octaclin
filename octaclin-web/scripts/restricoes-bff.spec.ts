import assert from "node:assert/strict";
import test from "node:test";
import * as nextHeaders from "next/headers";
import {
  tratarDisponibilidadeRestricoes,
  tratarPedidosRestricoesPortal,
  tratarResumoRestricoesPortal,
  tratarSeletorRestricoesPortal,
} from "../lib/server/restricoes-portal-bff";
import { salvarSessaoBff } from "../lib/server/sessao-bff";

const { __clearCookies } = nextHeaders as typeof nextHeaders & { __clearCookies: () => void };
const PACIENTE = "33333333-3333-4333-8333-333333333333";
const ORIGEM = "http://localhost";

const req = (body: unknown = {}, origin = ORIGEM) =>
  new Request("http://localhost/api/portal/paciente/restricoes", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

async function login(papel = "Patient", permissoes = ["portal.acessar"]) {
  await salvarSessaoBff(
    { apiUrl: "http://backend.octaclin.local", tenantSlug: "sintetica", email: "s@example.test" },
    { accessToken: "sintetico", refreshToken: "sintetico", tipoToken: "Bearer", expiraEmSegundos: 3600, papel, permissoes },
  );
}

type Chamada = { url: string; init?: RequestInit };
async function comBackend(
  resposta: (c: Chamada) => Response,
  corpo: (chamadas: Chamada[]) => Promise<void>,
  flag = "true",
) {
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

test("flag da web desligada: 404 genérico sem chamar o backend, em todas as rotas", async () => {
  for (const flag of ["", "false", "TRUE", "1"]) {
    await comBackend(() => Response.json({}), async (chamadas) => {
      await login();
      for (const r of [
        await tratarSeletorRestricoesPortal(req()),
        await tratarResumoRestricoesPortal(req(), PACIENTE),
        await tratarPedidosRestricoesPortal(req(), PACIENTE),
      ]) {
        assert.equal(r.status, 404);
        semCache(r);
      }
      const d = await tratarDisponibilidadeRestricoes();
      assert.equal(d.status, 200);
      assert.deepEqual(await json(d), { habilitada: false });
      assert.equal(chamadas.length, 0);
    }, flag);
  }
});

test("sem sessão 401, sem permissão 403 e origem hostil 403, sem chamar o backend", async () => {
  await comBackend(() => Response.json({}), async (chamadas) => {
    __clearCookies();
    assert.equal((await tratarResumoRestricoesPortal(req(), PACIENTE)).status, 401);
    assert.equal((await tratarDisponibilidadeRestricoes()).status, 401);
    await login("Professional", ["pacientes.ler"]);
    assert.equal((await tratarResumoRestricoesPortal(req(), PACIENTE)).status, 403);
    await login();
    assert.equal((await tratarResumoRestricoesPortal(req({}, "https://attacker.invalid"), PACIENTE)).status, 403);
    assert.equal(chamadas.length, 0);
  });
});

test("entrada fechada: corpo precisa ser {}, pacienteId precisa ser UUID; nada chega ao backend", async () => {
  await comBackend(() => Response.json({}), async (chamadas) => {
    await login();
    for (const corpo of [{ tenantId: "x" }, { pacienteId: PACIENTE }, [], "nao-json", "null"])
      assert.equal((await tratarResumoRestricoesPortal(req(corpo), PACIENTE)).status, 400, JSON.stringify(corpo));
    for (const id of ["../x", "id/forjado", "", "%2e%2e"])
      assert.equal((await tratarPedidosRestricoesPortal(req(), id)).status, 400, id);
    assert.equal((await tratarSeletorRestricoesPortal(req("x".repeat(5000)))).status, 400);
    assert.equal(chamadas.length, 0);
  });
});

test("repasse: caminho exato, POST com corpo {} e sem tenant", async () => {
  await comBackend(
    (c) =>
      c.url.endsWith("/portal/restricoes/pacientes/listar")
        ? Response.json({ itens: [] })
        : c.url.endsWith("/resumo")
          ? Response.json({ restricoes: [] })
          : Response.json({ itens: [], maisAntigos: false }),
    async (chamadas) => {
      await login();
      assert.equal((await tratarSeletorRestricoesPortal(req())).status, 200);
      assert.equal((await tratarResumoRestricoesPortal(req(), PACIENTE)).status, 200);
      assert.equal((await tratarPedidosRestricoesPortal(req(), PACIENTE)).status, 200);
      assert.deepEqual(
        chamadas.map((c) => new URL(c.url).pathname),
        [
          "/portal/restricoes/pacientes/listar",
          `/portal/pacientes/${PACIENTE}/restricoes/resumo`,
          `/portal/pacientes/${PACIENTE}/restricoes/pedidos/listar`,
        ],
      );
      for (const c of chamadas) {
        assert.equal(c.init?.method, "POST");
        assert.equal(c.init?.body, "{}");
      }
    },
  );
});

test("resposta projetada: nunca repassa gravidade, observação, autor, revisão nem campos extras", async () => {
  await comBackend(
    () =>
      Response.json({
        restricoes: [
          { id: PACIENTE, selo: "restricoes.portal.registrada", natureza: "clinica", subtipoClinico: "alergia_alimentar", alvo: { tipo: "nao_catalogado" }, alvoDeclarado: "Amendoim", gravidade: "grave", observacao: "CANARIO_OBS", revisao: 3 },
        ],
        segredo: "CANARIO_SEGREDO",
      }),
    async () => {
      await login();
      const r = await tratarResumoRestricoesPortal(req(), PACIENTE);
      assert.equal(r.status, 200);
      semCache(r);
      const texto = await r.text();
      for (const proibido of ["CANARIO", "grave", "revisao", "alergia_alimentar", "clinica"])
        assert.ok(!texto.includes(proibido), `vazou ${proibido}`);
    },
  );
});

test("erros do backend viram mensagens fixas; corpo do backend nunca é repassado", async () => {
  for (const [status, esperado] of [
    [400, 400],
    [401, 401],
    [403, 403],
    [409, 409],
    [404, 503],
    [500, 503],
    [429, 503],
  ] as const) {
    await comBackend(
      () => Response.json({ message: "CANARIO_PRIVADO", detalhe: "CANARIO_PRIVADO" }, { status }),
      async () => {
        await login();
        const r = await tratarResumoRestricoesPortal(req(), PACIENTE);
        assert.equal(r.status, esperado, String(status));
        semCache(r);
        const corpo = await r.text();
        assert.ok(!corpo.includes("CANARIO"), `eco no ${status}`);
        assert.ok(typeof JSON.parse(corpo).mensagem === "string");
      },
    );
  }
});

test("resposta 200 malformada falha fechado (503), sem repassar o corpo", async () => {
  await comBackend(
    () => new Response("CANARIO_PRIVADO não é json", { status: 200 }),
    async () => {
      await login();
      const r = await tratarResumoRestricoesPortal(req(), PACIENTE);
      assert.equal(r.status, 503);
      assert.ok(!(await r.text()).includes("CANARIO"));
    },
  );
  await comBackend(
    () => Response.json({ restricoes: "x" }),
    async () => {
      await login();
      assert.equal((await tratarResumoRestricoesPortal(req(), PACIENTE)).status, 503);
    },
  );
});

test("o BFF não decide papel: um Patient sem vínculo recebe exatamente o 403 do backend", async () => {
  await comBackend(
    () => Response.json({ statusCode: 403, message: "Operação não autorizada." }, { status: 403 }),
    async (chamadas) => {
      await login();
      const r = await tratarResumoRestricoesPortal(req(), PACIENTE);
      assert.equal(r.status, 403);
      assert.equal(chamadas.length, 1);
    },
  );
});

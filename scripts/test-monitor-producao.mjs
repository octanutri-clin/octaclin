import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  monitorarProducao,
  validarBaseUrl,
  validarHealthDetalhado,
  validarHealthPronto,
} from "./monitor-producao.mjs";

const pronto = {
  status: "ok",
  checks: { banco: { status: "ok" }, migracoes: { status: "ok" } },
};
const detalhado = {
  status: "ok",
  checks: Object.fromEntries(
    [
      "backend",
      "banco",
      "migracoes",
      "redis",
      "email",
      "whatsapp",
      "googleCalendar",
    ].map((nome) => [nome, { status: "ok" }]),
  ),
};

assert.equal(
  validarBaseUrl("https://octaclin-backend-producao.onrender.com", "backend"),
  "https://octaclin-backend-producao.onrender.com",
);
assert.throws(
  () => validarBaseUrl("http://127.0.0.1:3000", "backend"),
  /Render oficial/,
);
assert.throws(
  () => validarBaseUrl("https://usuario:senha@exemplo.onrender.com", "backend"),
  /sem credenciais/,
);
assert.equal(validarHealthPronto(pronto), true);
assert.equal(validarHealthPronto({ ...pronto, status: "falha" }), false);
assert.equal(validarHealthDetalhado(detalhado), true);
assert.equal(
  validarHealthDetalhado({
    ...detalhado,
    checks: { ...detalhado.checks, redis: { status: "falha" } },
  }),
  false,
);

const chamadas = [];
const fetchImpl = async (url) => {
  chamadas.push(url);
  if (url.endsWith("/health/pronto"))
    return new Response(JSON.stringify(pronto), { status: 200 });
  if (url.endsWith("/health/detalhado"))
    return new Response(JSON.stringify(detalhado), { status: 200 });
  return new Response("<html><title>OctaClin</title></html>", { status: 200 });
};
const resultado = await monitorarProducao(
  {
    OCTACLIN_MONITOR_BACKEND_URL: "https://backend.onrender.com",
    OCTACLIN_MONITOR_WEB_URL: "https://web.onrender.com",
  },
  { fetchImpl, tentativas: 1, timeoutMs: 1000 },
);
assert.equal(resultado.status, "ok");
assert.deepEqual(chamadas, [
  "https://backend.onrender.com/health/pronto",
  "https://backend.onrender.com/health/detalhado",
  "https://web.onrender.com/login",
]);

let tentativas = 0;
await assert.rejects(
  () =>
    monitorarProducao(
      {
        OCTACLIN_MONITOR_BACKEND_URL: "https://backend.onrender.com",
        OCTACLIN_MONITOR_WEB_URL: "https://web.onrender.com",
      },
      {
        tentativas: 2,
        timeoutMs: 1000,
        sleepImpl: async () => {},
        fetchImpl: async () => {
          tentativas += 1;
          return new Response("falha", { status: 503 });
        },
      },
    ),
  /Falha apos 2 tentativas/,
);
assert.equal(tentativas, 2);

const workflow = await readFile(
  new URL("../.github/workflows/monitor-producao.yml", import.meta.url),
  "utf8",
);
assert.match(workflow, /OCTACLIN_MONITOR_AUTOMATICO_HABILITADO == 'true'/);
assert.match(workflow, /permissions:\s+contents: read\s+issues: write/);
assert.doesNotMatch(workflow, /pull-requests: write|actions: write/);

console.log("Contrato do monitor externo de producao validado.");

import { fileURLToPath } from "node:url";

const HOST_RENDER = /(^|\.)onrender\.com$/i;

export function validarBaseUrl(valor, rotulo) {
  if (!valor) throw new Error(`${rotulo} e obrigatoria.`);
  const url = new URL(valor);
  if (url.protocol !== "https:" || !HOST_RENDER.test(url.hostname)) {
    throw new Error(`${rotulo} deve usar HTTPS em um host Render oficial.`);
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error(
      `${rotulo} deve ser uma URL base sem credenciais, query, fragmento ou caminho.`,
    );
  }
  return url.origin;
}

export function validarHealthPronto(payload) {
  return (
    payload?.status === "ok" &&
    payload?.checks?.banco?.status === "ok" &&
    payload?.checks?.migracoes?.status === "ok"
  );
}

export function validarHealthDetalhado(payload) {
  const checks = payload?.checks;
  return (
    payload?.status === "ok" &&
    checks &&
    typeof checks === "object" &&
    [
      "backend",
      "banco",
      "migracoes",
      "redis",
      "email",
      "whatsapp",
      "googleCalendar",
    ].every((nome) => checks[nome]?.status === "ok")
  );
}

async function requisitar(
  url,
  {
    tentativas = 3,
    timeoutMs = 70000,
    fetchImpl = fetch,
    sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  let ultimoErro;
  for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
    const inicio = Date.now();
    try {
      const resposta = await fetchImpl(url, {
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "user-agent": "OctaClin-Production-Monitor/1.0" },
      });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      return { resposta, latenciaMs: Date.now() - inicio, tentativa };
    } catch (erro) {
      ultimoErro = erro;
      if (tentativa < tentativas) await sleepImpl(tentativa * 5000);
    }
  }
  throw new Error(
    `Falha apos ${tentativas} tentativas: ${ultimoErro instanceof Error ? ultimoErro.message : String(ultimoErro)}`,
  );
}

export async function monitorarProducao(env = process.env, opcoes = {}) {
  const backend = validarBaseUrl(
    env.OCTACLIN_MONITOR_BACKEND_URL?.trim(),
    "OCTACLIN_MONITOR_BACKEND_URL",
  );
  const web = validarBaseUrl(
    env.OCTACLIN_MONITOR_WEB_URL?.trim(),
    "OCTACLIN_MONITOR_WEB_URL",
  );

  const pronto = await requisitar(`${backend}/health/pronto`, opcoes);
  const prontoPayload = await pronto.resposta.json();
  if (!validarHealthPronto(prontoPayload))
    throw new Error("Readiness retornou contrato nao saudavel.");

  const detalhado = await requisitar(`${backend}/health/detalhado`, opcoes);
  const detalhadoPayload = await detalhado.resposta.json();
  if (!validarHealthDetalhado(detalhadoPayload))
    throw new Error("Health detalhado retornou dependencia nao saudavel.");

  const login = await requisitar(`${web}/login`, opcoes);
  const html = await login.resposta.text();
  if (!/OctaClin/i.test(html))
    throw new Error("Login web respondeu sem a identidade OctaClin.");

  return {
    status: "ok",
    checks: {
      readiness: {
        status: "ok",
        latenciaMs: pronto.latenciaMs,
        tentativa: pronto.tentativa,
      },
      dependencias: {
        status: "ok",
        latenciaMs: detalhado.latenciaMs,
        tentativa: detalhado.tentativa,
      },
      web: {
        status: "ok",
        latenciaMs: login.latenciaMs,
        tentativa: login.tentativa,
      },
    },
  };
}

async function executarCli() {
  const resultado = await monitorarProducao();
  console.log(JSON.stringify(resultado));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  executarCli().catch((erro) => {
    console.error(erro instanceof Error ? erro.message : String(erro));
    process.exitCode = 1;
  });
}

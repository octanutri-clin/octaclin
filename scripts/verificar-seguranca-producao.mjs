import { fileURLToPath } from "node:url";
import tls from "node:tls";
import { validarBaseUrl } from "./monitor-producao.mjs";

/**
 * Verificacao de seguranca de producao (Fase 261), deliberadamente separada
 * do monitor de saude (`monitor-producao.mjs`): sonda passiva de TLS,
 * headers, cookies e CORS -- nunca disponibilidade de dependencia. Nada
 * aqui cria, altera ou apaga dado real, nem tenta explorar uma falha; e o
 * escopo explicitamente autorizado para producao nesta fase. Fuzzing
 * agressivo, SQLi/XSS ativos, brute force e DAST autenticado ficam para uma
 * fase futura, de preferencia primeiro contra staging.
 */

const CABECALHOS_SEGURANCA_OBRIGATORIOS = [
  "strict-transport-security",
  "content-security-policy",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
];

const CABECALHOS_INFORMACAO_PROIBIDOS = ["x-powered-by"];

export function validarRedirecionamentoHttps(resposta, origemHttps) {
  if (![301, 302, 307, 308].includes(resposta.status)) {
    throw new Error(`HTTP nao redireciona para HTTPS (status ${resposta.status}).`);
  }
  const destino = resposta.headers.get("location") ?? "";
  if (!destino.startsWith(origemHttps)) {
    throw new Error(`Redirecionamento HTTP nao aponta para o host HTTPS esperado: ${destino || "(vazio)"}`);
  }
}

export function validarHsts(resposta) {
  const valor = resposta.headers.get("strict-transport-security");
  if (!valor) throw new Error("Strict-Transport-Security ausente.");
  const maxAge = Number(valor.match(/max-age=(\d+)/i)?.[1] ?? 0);
  if (!Number.isFinite(maxAge) || maxAge < 15552000) {
    throw new Error(`Strict-Transport-Security com max-age insuficiente (${maxAge}s, minimo 15552000s/180 dias).`);
  }
}

export function validarCabecalhosSeguranca(resposta) {
  const faltando = CABECALHOS_SEGURANCA_OBRIGATORIOS.filter((nome) => !resposta.headers.get(nome));
  if (faltando.length > 0) throw new Error(`Header(s) de seguranca ausente(s): ${faltando.join(", ")}.`);

  const csp = resposta.headers.get("content-security-policy") ?? "";
  if (/unsafe-eval/.test(csp)) throw new Error("CSP de producao permite unsafe-eval.");
  const scriptSrc = csp.split(";").find((diretiva) => diretiva.trim().startsWith("script-src")) ?? "";
  if (/unsafe-inline/.test(scriptSrc)) throw new Error("script-src de producao permite unsafe-inline.");
}

export function validarAusenciaExposicaoInformacao(resposta) {
  const presentes = CABECALHOS_INFORMACAO_PROIBIDOS.filter((nome) => resposta.headers.get(nome));
  if (presentes.length > 0) throw new Error(`Header(s) que expoe implementacao presente(s): ${presentes.join(", ")}.`);
}

/**
 * `headers.getSetCookie()` (undici/Node >=18.14) preserva cada
 * `Set-Cookie` como entrada propria; `headers.get()` colapsaria tudo numa
 * string so, inutilizavel para inspecionar flags por cookie.
 */
export function validarCookies(resposta) {
  const bruto = resposta.headers.getSetCookie?.() ?? [];
  for (const cookie of bruto) {
    const semSecure = !/;\s*secure/i.test(cookie);
    const semHttpOnly = !/;\s*httponly/i.test(cookie);
    const semSameSite = !/;\s*samesite=/i.test(cookie);
    if (semSecure || semHttpOnly || semSameSite) {
      const nome = cookie.split("=")[0];
      throw new Error(
        `Cookie "${nome}" sem flag obrigatoria (Secure=${!semSecure}, HttpOnly=${!semHttpOnly}, SameSite=${!semSameSite}).`,
      );
    }
  }
}

export function validarCorsNaoReflete(resposta) {
  const valor = resposta.headers.get("access-control-allow-origin");
  if (valor === "https://origem-nao-autorizada.exemplo-verificacao.invalid") {
    throw new Error("CORS reflete uma origem arbitraria nao autorizada.");
  }
}

export function validarRotaProtegidaNaoServeCache(resposta) {
  if (![307, 308, 401, 403].includes(resposta.status)) {
    throw new Error(`Rota protegida respondeu ${resposta.status} sem autenticacao (esperado redirect ou 401/403).`);
  }
  const cache = resposta.headers.get("cache-control") ?? "";
  if (resposta.status < 400 && !/no-store/.test(cache)) {
    throw new Error("Resposta de rota protegida nao declara Cache-Control: no-store.");
  }
}

export function validarTlsMinimo(protocolo) {
  if (!["TLSv1.2", "TLSv1.3"].includes(protocolo)) {
    throw new Error(`Protocolo TLS abaixo do minimo aceitavel: ${protocolo}.`);
  }
}

export function validarCertificadoValido(certificado, agora = new Date()) {
  if (!certificado || Object.keys(certificado).length === 0) {
    throw new Error("Nao foi possivel obter o certificado do peer.");
  }
  const validoAte = new Date(certificado.valid_to);
  if (Number.isNaN(validoAte.getTime()) || validoAte.getTime() <= agora.getTime()) {
    throw new Error(`Certificado TLS vencido ou com data invalida: ${certificado.valid_to}.`);
  }
}

async function verificarTls(hostname, { tlsConnectImpl = tls.connect } = {}) {
  return new Promise((resolvePromise, reject) => {
    const socket = tlsConnectImpl(
      { host: hostname, port: 443, servername: hostname, timeout: 10_000 },
      () => {
        try {
          validarTlsMinimo(socket.getProtocol());
          validarCertificadoValido(socket.getPeerCertificate());
          socket.end();
          resolvePromise({ protocolo: socket.getProtocol() });
        } catch (falha) {
          socket.end();
          reject(falha);
        }
      },
    );
    socket.once("error", reject);
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("Timeout no handshake TLS."));
    });
  });
}

export async function verificarSegurancaProducao(env = process.env, opcoes = {}) {
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const web = validarBaseUrl(env.OCTACLIN_MONITOR_WEB_URL?.trim(), "OCTACLIN_MONITOR_WEB_URL");
  const backend = validarBaseUrl(env.OCTACLIN_MONITOR_BACKEND_URL?.trim(), "OCTACLIN_MONITOR_BACKEND_URL");

  const { protocolo } = await verificarTls(new URL(web).hostname, opcoes);

  const urlHttp = `http://${new URL(web).hostname}/`;
  const redirecionamento = await fetchImpl(urlHttp, { redirect: "manual" });
  validarRedirecionamentoHttps(redirecionamento, web);

  const login = await fetchImpl(`${web}/login`, { redirect: "manual" });
  if (!login.ok) throw new Error(`Login web respondeu ${login.status}.`);
  validarHsts(login);
  validarCabecalhosSeguranca(login);
  validarAusenciaExposicaoInformacao(login);
  validarCookies(login);

  const dashboard = await fetchImpl(`${web}/dashboard`, { redirect: "manual" });
  validarRotaProtegidaNaoServeCache(dashboard);

  const corsHostil = await fetchImpl(`${backend}/health/pronto`, {
    headers: { Origin: "https://origem-nao-autorizada.exemplo-verificacao.invalid" },
  });
  validarCorsNaoReflete(corsHostil);

  return {
    status: "ok",
    checks: {
      tls: { status: "ok", protocolo },
      redirecionamentoHttps: { status: "ok" },
      headers: { status: "ok" },
      cookies: { status: "ok" },
      cors: { status: "ok" },
      cacheRotaProtegida: { status: "ok" },
    },
  };
}

async function executarCli() {
  const resultado = await verificarSegurancaProducao();
  console.log(JSON.stringify(resultado));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  executarCli().catch((erro) => {
    console.error(erro instanceof Error ? erro.message : String(erro));
    process.exitCode = 1;
  });
}

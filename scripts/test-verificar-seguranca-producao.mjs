import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import {
  validarAusenciaExposicaoInformacao,
  validarCabecalhosSeguranca,
  validarCertificadoValido,
  validarCookies,
  validarCorsNaoReflete,
  validarHsts,
  validarRedirecionamentoHttps,
  validarRotaProtegidaNaoServeCache,
  validarTlsMinimo,
  verificarSegurancaProducao,
} from "./verificar-seguranca-producao.mjs";

function respostaComHeaders(status, cabecalhos = {}, setCookies = []) {
  const resposta = new Response(null, { status, headers: cabecalhos });
  resposta.headers.getSetCookie = () => setCookies;
  return resposta;
}

// validarRedirecionamentoHttps
validarRedirecionamentoHttps(
  respostaComHeaders(301, { location: "https://web.onrender.com/" }),
  "https://web.onrender.com",
);
assert.throws(
  () => validarRedirecionamentoHttps(respostaComHeaders(200), "https://web.onrender.com"),
  /nao redireciona/,
);
assert.throws(
  () =>
    validarRedirecionamentoHttps(
      respostaComHeaders(301, { location: "https://outro-host.exemplo/" }),
      "https://web.onrender.com",
    ),
  /nao aponta para o host HTTPS esperado/,
);

// validarHsts
validarHsts(respostaComHeaders(200, { "strict-transport-security": "max-age=31536000; includeSubDomains" }));
assert.throws(() => validarHsts(respostaComHeaders(200)), /ausente/);
assert.throws(
  () => validarHsts(respostaComHeaders(200, { "strict-transport-security": "max-age=60" })),
  /insuficiente/,
);

// validarCabecalhosSeguranca
const headersCompletos = {
  "strict-transport-security": "max-age=31536000",
  "content-security-policy": "default-src 'self'; script-src 'self' 'nonce-abc'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
};
validarCabecalhosSeguranca(respostaComHeaders(200, headersCompletos));
const { "x-frame-options": _omitido, ...headersSemFrameOptions } = headersCompletos;
assert.throws(
  () => validarCabecalhosSeguranca(respostaComHeaders(200, headersSemFrameOptions)),
  /ausente/,
);
assert.throws(
  () =>
    validarCabecalhosSeguranca(
      respostaComHeaders(200, { ...headersCompletos, "content-security-policy": "script-src 'unsafe-eval'" }),
    ),
  /unsafe-eval/,
);
assert.throws(
  () =>
    validarCabecalhosSeguranca(
      respostaComHeaders(200, { ...headersCompletos, "content-security-policy": "script-src 'unsafe-inline'" }),
    ),
  /unsafe-inline/,
);

// validarAusenciaExposicaoInformacao
validarAusenciaExposicaoInformacao(respostaComHeaders(200, {}));
assert.throws(
  () => validarAusenciaExposicaoInformacao(respostaComHeaders(200, { "x-powered-by": "Express" })),
  /expoe implementacao/,
);

// validarCookies
validarCookies(respostaComHeaders(200, {}, ["sessao=abc; Secure; HttpOnly; SameSite=Strict"]));
assert.throws(
  () => validarCookies(respostaComHeaders(200, {}, ["sessao=abc; HttpOnly; SameSite=Strict"])),
  /Secure=false/,
);
assert.throws(
  () => validarCookies(respostaComHeaders(200, {}, ["sessao=abc; Secure; SameSite=Strict"])),
  /HttpOnly=false/,
);

// validarCorsNaoReflete
validarCorsNaoReflete(respostaComHeaders(200, {}));
assert.throws(
  () =>
    validarCorsNaoReflete(
      respostaComHeaders(200, {
        "access-control-allow-origin": "https://origem-nao-autorizada.exemplo-verificacao.invalid",
      }),
    ),
  /reflete uma origem arbitraria/,
);

// validarRotaProtegidaNaoServeCache
validarRotaProtegidaNaoServeCache(respostaComHeaders(307, { "cache-control": "no-store" }));
validarRotaProtegidaNaoServeCache(respostaComHeaders(401));
assert.throws(() => validarRotaProtegidaNaoServeCache(respostaComHeaders(200)), /sem autenticacao/);
assert.throws(
  () => validarRotaProtegidaNaoServeCache(respostaComHeaders(307)),
  /nao declara Cache-Control/,
);

// validarTlsMinimo / validarCertificadoValido
validarTlsMinimo("TLSv1.3");
assert.throws(() => validarTlsMinimo("TLSv1.1"), /abaixo do minimo/);
validarCertificadoValido({ valid_to: "Dec 31 23:59:59 2099 GMT" }, new Date("2026-01-01"));
assert.throws(() => validarCertificadoValido({}), /Nao foi possivel obter/);
assert.throws(
  () => validarCertificadoValido({ valid_to: "Dec 31 23:59:59 2020 GMT" }, new Date("2026-01-01")),
  /vencido/,
);

// verificarSegurancaProducao (orquestracao fim a fim com fetch/tls simulados)
function socketTlsFake({ falharProtocolo = false, falharCertificado = false } = {}) {
  const socket = new EventEmitter();
  socket.getProtocol = () => (falharProtocolo ? "TLSv1.1" : "TLSv1.3");
  socket.getPeerCertificate = () =>
    falharCertificado ? {} : { valid_to: "Dec 31 23:59:59 2099 GMT" };
  socket.end = () => {};
  socket.destroy = () => {};
  return socket;
}

const chamadasFetch = [];
const fetchImplOk = async (url, opcoes = {}) => {
  chamadasFetch.push(url);
  if (url.startsWith("http://")) {
    return respostaComHeaders(301, { location: "https://web.onrender.com/" });
  }
  if (url.endsWith("/login")) {
    return respostaComHeaders(200, headersCompletos, ["sessao=abc; Secure; HttpOnly; SameSite=Strict"]);
  }
  if (url.endsWith("/dashboard")) {
    return respostaComHeaders(307, {
      location: "https://web.onrender.com/login",
      "cache-control": "no-store",
    });
  }
  if (url.endsWith("/health/pronto")) {
    assert.equal(
      opcoes.headers?.Origin,
      "https://origem-nao-autorizada.exemplo-verificacao.invalid",
    );
    return respostaComHeaders(200, {});
  }
  throw new Error(`URL inesperada no teste: ${url}`);
};

const resultado = await verificarSegurancaProducao(
  {
    OCTACLIN_MONITOR_BACKEND_URL: "https://backend.onrender.com",
    OCTACLIN_MONITOR_WEB_URL: "https://web.onrender.com",
  },
  {
    fetchImpl: fetchImplOk,
    tlsConnectImpl: (_opcoes, callback) => {
      const socket = socketTlsFake();
      queueMicrotask(callback);
      return socket;
    },
  },
);
assert.equal(resultado.status, "ok");
assert.equal(resultado.checks.tls.protocolo, "TLSv1.3");
assert.deepEqual(chamadasFetch, [
  "http://web.onrender.com/",
  "https://web.onrender.com/login",
  "https://web.onrender.com/dashboard",
  "https://backend.onrender.com/health/pronto",
]);

await assert.rejects(
  () =>
    verificarSegurancaProducao(
      {
        OCTACLIN_MONITOR_BACKEND_URL: "https://backend.onrender.com",
        OCTACLIN_MONITOR_WEB_URL: "https://web.onrender.com",
      },
      {
        fetchImpl: fetchImplOk,
        tlsConnectImpl: (_opcoes, callback) => {
          const socket = socketTlsFake({ falharProtocolo: true });
          queueMicrotask(callback);
          return socket;
        },
      },
    ),
  /abaixo do minimo/,
);

const workflow = await readFile(
  new URL("../.github/workflows/verificacao-seguranca-producao.yml", import.meta.url),
  "utf8",
);
assert.match(workflow, /OCTACLIN_VERIFICACAO_SEGURANCA_AUTOMATICA_HABILITADA == 'true'/);
assert.match(workflow, /permissions:\s+contents: read\s+issues: write/);
assert.doesNotMatch(workflow, /pull-requests: write|actions: write/);
assert.match(workflow, /scripts\/verificar-seguranca-producao\.mjs/);

console.log("Verificacao passiva de seguranca de producao validada.");

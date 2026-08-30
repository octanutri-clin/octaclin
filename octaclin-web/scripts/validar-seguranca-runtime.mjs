import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function obterPortaLivre() {
  const servidor = net.createServer();
  await new Promise((resolvePromise, reject) => {
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', resolvePromise);
  });
  const endereco = servidor.address();
  assert.ok(endereco && typeof endereco === 'object');
  const porta = endereco.port;
  await new Promise((resolvePromise) => servidor.close(resolvePromise));
  return porta;
}

async function esperarServidor(url, processo) {
  for (let tentativa = 0; tentativa < 40; tentativa += 1) {
    if (processo.exitCode !== null) break;
    try {
      const resposta = await fetch(url);
      if (resposta.ok) return resposta;
    } catch {
      // O servidor ainda esta iniciando.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error('O servidor Next nao ficou pronto para o smoke de seguranca.');
}

const porta = await obterPortaLivre();
const origem = `http://127.0.0.1:${porta}`;
let saida = '';
let erro = '';
const processo = spawn(
  process.execPath,
  [join(raiz, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-H', '127.0.0.1', '-p', String(porta)],
  {
    cwd: raiz,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      OCTACLIN_COOKIE_SECURE: 'true',
      OCTACLIN_API_ORIGENS_PERMITIDAS: 'https://api.example.test',
      OCTACLIN_WEB_ORIGENS_PERMITIDAS: origem,
      OCTACLIN_BACKEND_URL: 'https://api.example.test',
      OCTACLIN_TENANT_SLUG: 'tenant-sintetico'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  }
);
processo.stdout.on('data', (trecho) => {
  saida += trecho.toString();
});
processo.stderr.on('data', (trecho) => {
  erro += trecho.toString();
});

try {
  const login = await esperarServidor(`${origem}/login`, processo);
  for (const cabecalho of [
    'content-security-policy',
    'strict-transport-security',
    'x-content-type-options',
    'x-frame-options',
    'cross-origin-opener-policy',
    'cross-origin-resource-policy',
    'x-permitted-cross-domain-policies',
    'referrer-policy',
    'permissions-policy'
  ]) {
    assert.ok(login.headers.get(cabecalho), `Header ausente no runtime: ${cabecalho}`);
  }
  assert.doesNotMatch(
    login.headers.get('content-security-policy'),
    /unsafe-eval/,
    'Build de producao nao pode permitir unsafe-eval.'
  );
  const politica = login.headers.get('content-security-policy') ?? '';
  const scriptSrc = politica.split(';').find((diretiva) => diretiva.trim().startsWith('script-src')) ?? '';
  const nonce = scriptSrc.match(/'nonce-([^']+)'/)?.[1];
  assert.ok(nonce, 'CSP de producao precisa declarar nonce por requisicao.');
  assert.doesNotMatch(scriptSrc, /unsafe-inline/, 'script-src de producao nao pode permitir unsafe-inline.');
  assert.match(scriptSrc, /'self'/, 'script-src deve restringir arquivos externos ao proprio host.');

  const htmlLogin = await login.text();
  const scriptsInline = [...htmlLogin.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/gi)];
  assert.ok(scriptsInline.length > 0, 'Login deve conter bootstrap inline do Next para provar o nonce.');
  for (const script of scriptsInline) {
    assert.match(script[1], new RegExp(`\\bnonce=["']${nonce}["']`), 'Todo script inline deve carregar o nonce da resposta.');
  }

  const paginaProtegida = await fetch(`${origem}/dashboard`, { redirect: 'manual' });
  assert.ok([307, 308].includes(paginaProtegida.status), 'Visitante deve ser redirecionado antes de acessar dashboard.');
  assert.match(
    paginaProtegida.headers.get('cache-control') ?? '',
    /no-store/,
    'Resposta de tela autenticada nao pode entrar em cache.'
  );

  const mutacaoMesmaOrigem = await fetch(`${origem}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origem,
      'Sec-Fetch-Site': 'same-origin'
    },
    body: '{}'
  });
  assert.equal(mutacaoMesmaOrigem.status, 400, 'Mutacao same-origin valida deve alcancar a rota BFF.');

  const mutacaoOutraOrigem = await fetch(`${origem}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://origem-nao-autorizada.example',
      'Sec-Fetch-Site': 'cross-site'
    },
    body: '{}'
  });
  assert.equal(mutacaoOutraOrigem.status, 403);

  const mutacaoSemOrigem = await fetch(`${origem}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(mutacaoSemOrigem.status, 403);

  const sessaoAnonima = await fetch(`${origem}/api/auth/session`);
  assert.equal(sessaoAnonima.status, 401);
  assert.match(sessaoAnonima.headers.get('cache-control') ?? '', /no-store/);
  assert.equal(sessaoAnonima.headers.get('access-control-allow-origin'), null);

  console.log('Runtime web: CSP nonce, cache, CORS e protecao de origem aprovados.');
} catch (falha) {
  console.error(saida);
  console.error(erro);
  throw falha;
} finally {
  if (processo.exitCode === null) {
    const encerrou = new Promise((resolvePromise) => processo.once('exit', resolvePromise));
    processo.kill();
    await Promise.race([
      encerrou,
      new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000))
    ]);
  }
}

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  origemMutacaoPermitida,
  validarConfiguracaoSegurancaBff
} from '../lib/server/seguranca-bff';
import { criarNonceCsp, criarPoliticaConteudo } from '../lib/server/csp';

const ambienteOriginal = { ...process.env };

afterEach(() => {
  process.env = { ...ambienteOriginal };
});

function configurarProducaoSegura() {
  process.env = {
    ...process.env,
    NODE_ENV: 'production',
    OCTACLIN_COOKIE_SECURE: 'true',
    OCTACLIN_API_ORIGENS_PERMITIDAS: 'https://api.octaclin.test'
  };
}

test('producao recusa cookies de sessao sem Secure', () => {
  configurarProducaoSegura();
  process.env.OCTACLIN_COOKIE_SECURE = 'false';

  assert.throws(() => validarConfiguracaoSegurancaBff(), /OCTACLIN_COOKIE_SECURE/);
});

test('producao recusa allowlist de API ausente, insegura ou malformada', () => {
  configurarProducaoSegura();
  delete process.env.OCTACLIN_API_ORIGENS_PERMITIDAS;
  assert.throws(() => validarConfiguracaoSegurancaBff(), /OCTACLIN_API_ORIGENS_PERMITIDAS/);

  process.env.OCTACLIN_API_ORIGENS_PERMITIDAS = 'http://api.octaclin.test';
  assert.throws(() => validarConfiguracaoSegurancaBff(), /HTTPS/);

  process.env.OCTACLIN_API_ORIGENS_PERMITIDAS = 'https://api.octaclin.test/v1';
  assert.throws(() => validarConfiguracaoSegurancaBff(), /origens/);
});

test('producao permite HTTP somente para loopback usado pelo smoke local', () => {
  configurarProducaoSegura();
  process.env.OCTACLIN_API_ORIGENS_PERMITIDAS = 'http://localhost:3001,http://127.0.0.1:3001';

  assert.deepEqual(validarConfiguracaoSegurancaBff().origensApiPermitidas, [
    'http://localhost:3001',
    'http://127.0.0.1:3001'
  ]);

  process.env.OCTACLIN_API_ORIGENS_PERMITIDAS = 'http://api.octaclin.test';
  assert.throws(() => validarConfiguracaoSegurancaBff(), /HTTPS/);
});

test('desenvolvimento conserva HTTP local sem exigir configuracao de producao', () => {
  process.env = { ...process.env, NODE_ENV: 'development' };
  delete process.env.OCTACLIN_COOKIE_SECURE;
  delete process.env.OCTACLIN_API_ORIGENS_PERMITIDAS;

  assert.deepEqual(validarConfiguracaoSegurancaBff(), {
    cookieSecure: false,
    origensApiPermitidas: []
  });
});

test('mutacao aceita somente Origin da propria aplicacao', () => {
  const mesmaOrigem = new Request('https://app.octaclin.test/api/pacientes', {
    method: 'POST',
    headers: { Origin: 'https://app.octaclin.test', 'Sec-Fetch-Site': 'same-origin' }
  });
  const origemExterna = new Request('https://app.octaclin.test/api/pacientes', {
    method: 'POST',
    headers: { Origin: 'https://ataque.test', 'Sec-Fetch-Site': 'cross-site' }
  });
  const mesmaSite = new Request('https://app.octaclin.test/api/pacientes', {
    method: 'POST',
    headers: { Origin: 'https://subdominio.octaclin.test', 'Sec-Fetch-Site': 'same-site' }
  });
  const semOrigem = new Request('https://app.octaclin.test/api/pacientes', { method: 'POST' });

  assert.equal(origemMutacaoPermitida(mesmaOrigem), true);
  assert.equal(origemMutacaoPermitida(origemExterna), false);
  assert.equal(origemMutacaoPermitida(mesmaSite), false);
  assert.equal(origemMutacaoPermitida(semOrigem), false);
});

test('leitura segura nao depende de Origin', () => {
  const leitura = new Request('https://app.octaclin.test/api/pacientes', { method: 'GET' });

  assert.equal(origemMutacaoPermitida(leitura), true);
});

test('origem publica explicita suporta proxy e dominio oficial sem aceitar cross-site', () => {
  process.env.OCTACLIN_WEB_ORIGENS_PERMITIDAS = 'https://app.octaclin.com.br';
  const viaProxy = new Request('http://servico-interno:3000/api/pacientes', {
    method: 'PATCH',
    headers: { Origin: 'https://app.octaclin.com.br', 'Sec-Fetch-Site': 'same-origin' }
  });

  assert.equal(origemMutacaoPermitida(viaProxy), true);
});

test('origem publica preservada pelo proxy e aceita por host e protocolo encaminhados', () => {
  const viaProxy = new Request('http://servico-interno:3000/api/pacientes', {
    method: 'PATCH',
    headers: {
      Origin: 'https://app.octaclin.com.br',
      Host: 'app.octaclin.com.br',
      'X-Forwarded-Proto': 'https',
      'Sec-Fetch-Site': 'same-origin'
    }
  });

  assert.equal(origemMutacaoPermitida(viaProxy), true);
});

test('CSP de producao usa nonce imprevisivel e remove unsafe-inline de scripts', () => {
  const nonceA = criarNonceCsp();
  const nonceB = criarNonceCsp();
  const politica = criarPoliticaConteudo(nonceA, 'production');
  const scriptSrc = politica.split(';').find((diretiva) => diretiva.trim().startsWith('script-src')) ?? '';

  assert.match(nonceA, /^[A-Za-z0-9+/_=-]{32,}$/);
  assert.notEqual(nonceA, nonceB);
  assert.match(scriptSrc, new RegExp(`'nonce-${nonceA}'`));
  assert.match(scriptSrc, /'self'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-eval'/);
  assert.match(politica, /style-src 'self' 'nonce-[^']+'/);
  assert.match(politica, /style-src-attr 'unsafe-inline'/);
  assert.match(politica, /object-src 'none'/);
  assert.match(politica, /frame-ancestors 'none'/);
});

test('CSP de desenvolvimento limita unsafe-eval ao script e ainda exige nonce', () => {
  const politica = criarPoliticaConteudo('nonce-sintetico-com-32-caracteres', 'development');
  const scriptSrc = politica.split(';').find((diretiva) => diretiva.trim().startsWith('script-src')) ?? '';

  assert.match(scriptSrc, /'unsafe-eval'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'/);
  assert.match(scriptSrc, /'nonce-nonce-sintetico-com-32-caracteres'/);
});

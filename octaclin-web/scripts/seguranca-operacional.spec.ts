import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  origemMutacaoPermitida,
  validarConfiguracaoSegurancaBff
} from '../lib/server/seguranca-bff';

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

/**
 * Onde o BFF decide de qual backend ele fala.
 *
 * Este spec roda contra o **modulo real**, compilado, e nao contra o texto do
 * arquivo. A parte de estrutura -- que nenhuma rota volte a ler `process.env`
 * por conta propria -- fica em `test-origem-backend-bff.mjs`; as duas metades
 * juntas sao o gate.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { obterApiUrlBff, obterConfiguracaoAcessoBff } from '../lib/server/configuracao-acesso-bff';

const AMBIENTE = { ...process.env };

/**
 * Configuracao minima de seguranca do BFF em producao.
 *
 * `normalizarApiUrlBff` chama `validarConfiguracaoSegurancaBff`, que em producao
 * exige cookie seguro e lista de origens permitidas. Isso nao e ruido de teste:
 * e a prova de que este modulo continua passando pela mesma validacao de sempre
 * -- ele decide **de onde vem** o valor, e nao afrouxa nada do que ja era
 * verificado. A lista abaixo e o que torna `https://backend.exemplo.test` uma
 * origem aceitavel nos casos positivos.
 */
const SEGURANCA_PRODUCAO = {
  OCTACLIN_COOKIE_SECURE: 'true',
  OCTACLIN_API_ORIGENS_PERMITIDAS: 'https://backend.exemplo.test'
};

/** Ambiente de producao com a seguranca do BFF ja satisfeita. */
function producao(valores: Record<string, string | undefined>) {
  return { NODE_ENV: 'production', ...SEGURANCA_PRODUCAO, ...valores };
}

function comAmbiente(valores: Record<string, string | undefined>, executar: () => void) {
  for (const [chave, valor] of Object.entries(valores)) {
    if (valor === undefined) delete process.env[chave];
    else process.env[chave] = valor;
  }
  try {
    executar();
  } finally {
    for (const chave of Object.keys(valores)) {
      if (AMBIENTE[chave] === undefined) delete process.env[chave];
      else process.env[chave] = AMBIENTE[chave];
    }
  }
}

/**
 * O caso que motivou este gate.
 *
 * Em producao, sem `OCTACLIN_BACKEND_URL`, a expressao antiga caia em
 * `NEXT_PUBLIC_API_URL` e, na falta dela, em `http://localhost:3001`. As duas
 * saidas transformavam "configuracao ausente" em outra coisa: a primeira, numa
 * origem decidida por variavel publica; a segunda, numa conexao recusada mais
 * tarde. Agora a ausencia falha na hora e diz o que falta.
 */
test('em producao, sem a variavel, falha fechado', () => {
  comAmbiente(producao({ OCTACLIN_BACKEND_URL: undefined }), () => {
    assert.throws(() => obterApiUrlBff(), /Configuracao de acesso incompleta/);
  });
});

test('em producao, variavel vazia ou so espacos conta como ausente', () => {
  for (const valor of ['', '   ']) {
    comAmbiente(producao({ OCTACLIN_BACKEND_URL: valor }), () => {
      assert.throws(() => obterApiUrlBff(), /Configuracao de acesso incompleta/);
    });
  }
});

// A variavel publica deixou de existir para o servidor. Se ela voltar a ser
// lida, este caso reprova: o valor abaixo seria usado, e nao ignorado.
test('nao ha resgate por NEXT_PUBLIC_API_URL', () => {
  comAmbiente(
    producao({ OCTACLIN_BACKEND_URL: undefined, NEXT_PUBLIC_API_URL: 'https://api.exemplo.test' }),
    () => {
      assert.throws(() => obterApiUrlBff(), /Configuracao de acesso incompleta/);
    }
  );
});

test('fora de producao o padrao de desenvolvimento continua', () => {
  comAmbiente({ NODE_ENV: 'development', OCTACLIN_BACKEND_URL: undefined }, () => {
    assert.equal(obterApiUrlBff(), 'http://localhost:3001');
  });
});

test('a variavel definida vence em qualquer ambiente', () => {
  comAmbiente(producao({ OCTACLIN_BACKEND_URL: 'https://backend.exemplo.test' }), () => {
    assert.equal(obterApiUrlBff(), 'https://backend.exemplo.test');
  });
  comAmbiente({ NODE_ENV: 'development', OCTACLIN_BACKEND_URL: 'https://backend.exemplo.test' }, () => {
    assert.equal(obterApiUrlBff(), 'https://backend.exemplo.test');
  });
});

// `normalizarApiUrlBff` continua sendo quem valida a URL. Esta funcao decide de
// onde vem o valor; ela nao pode ter afrouxado o que ja era verificado.
test('a validacao da URL nao foi afrouxada', () => {
  for (const invalida of ['nao-e-url', 'ftp://backend.exemplo.test', 'https://u:s@backend.exemplo.test', 'https://backend.exemplo.test/?a=1']) {
    comAmbiente(producao({ OCTACLIN_BACKEND_URL: invalida }), () => {
      assert.throws(() => obterApiUrlBff(), `deveria recusar ${invalida}`);
    });
  }
});

test('a barra final e aparada, como antes', () => {
  comAmbiente(producao({ OCTACLIN_BACKEND_URL: 'https://backend.exemplo.test/api/' }), () => {
    assert.equal(obterApiUrlBff(), 'https://backend.exemplo.test/api');
  });
});

/**
 * O tenant continua exigido no fluxo de acesso, e **so** nele.
 *
 * As rotas publicas resolvem o tenant pelo proprio token, no backend. Exigir
 * `OCTACLIN_TENANT_SLUG` delas derrubaria rota que nao usa o valor -- e o
 * inverso, deixar de exigi-lo no login, reabriria o desvio de configuracao de
 * 2026-09-03 pelo outro lado.
 */
test('o fluxo de acesso exige tenant; a origem do backend, nao', () => {
  comAmbiente(
    producao({ OCTACLIN_BACKEND_URL: 'https://backend.exemplo.test', OCTACLIN_TENANT_SLUG: undefined }),
    () => {
      assert.doesNotThrow(() => obterApiUrlBff());
      assert.throws(() => obterConfiguracaoAcessoBff(), /Configuracao de acesso incompleta/);
    }
  );
});

test('com as duas variaveis, o fluxo de acesso devolve origem e tenant', () => {
  comAmbiente(
    producao({ OCTACLIN_BACKEND_URL: 'https://backend.exemplo.test', OCTACLIN_TENANT_SLUG: 'clinica-exemplo' }),
    () => {
      assert.deepEqual(obterConfiguracaoAcessoBff(), {
        apiUrl: 'https://backend.exemplo.test',
        tenantSlug: 'clinica-exemplo'
      });
    }
  );
});

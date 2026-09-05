import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pasta = mkdtempSync(join(tmpdir(), 'octaclin-correlacao-bff-'));

function executar(comando, args, cwd = raiz) {
  const resultado = spawnSync(comando, args, { cwd, stdio: 'inherit' });
  if (resultado.error) console.error(resultado.error.message);
  if (resultado.status !== 0) {
    rmSync(pasta, { recursive: true, force: true });
    process.exit(resultado.status ?? 1);
  }
}

writeFileSync(
  join(pasta, 'tsconfig.json'),
  JSON.stringify(
    {
      extends: join(raiz, 'tsconfig.json'),
      compilerOptions: {
        noEmit: false,
        outDir: pasta,
        rootDir: raiz,
        module: 'commonjs',
        moduleResolution: 'node',
        ignoreDeprecations: '6.0',
        target: 'ES2022'
      },
      // O tsc segue os imports do spec, entao as rotas publicas entram sozinhas.
      // Os modulos de `lib/server` ficam listados porque sao o alvo do teste e
      // precisam ser compilados mesmo que um import futuro deixe de alcanca-los.
      files: [
        'scripts/correlacao-bff.spec.ts',
        // O middleware entra na compilacao para que as asercoes abaixo possam
        // CARREGAR o modulo e ler o `config.matcher` de verdade, em vez de
        // procurar o texto do matcher com regex no arquivo.
        'middleware.ts',
        'lib/server/correlacao-bff.ts',
        'lib/server/correlacao-requisicao-bff.ts',
        'lib/server/agendamento-publico-bff.ts',
        'lib/server/sessao-bff.ts'
      ].map((arquivo) => join(raiz, arquivo))
    },
    null,
    2
  ),
  'utf8'
);
executar(process.execPath, [join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(pasta, 'tsconfig.json')]);

// O mock de `next/headers` expoe tambem os cabecalhos da requisicao: sem isso
// nao da para provar que o id que sai para o backend e o que entrou no web.
const next = join(pasta, 'node_modules', 'next');
mkdirSync(next, { recursive: true });
writeFileSync(
  join(next, 'headers.js'),
  `const armazenamento = new Map(); let cabecalhos = new Headers(); function cookies() { return { get(nome) { const valor = armazenamento.get(nome); return valor === undefined ? undefined : { name: nome, value: valor }; }, set(nome, valor) { armazenamento.set(nome, String(valor)); }, delete(nome) { armazenamento.delete(nome); } }; } function headers() { return cabecalhos; } function __setCookies(entrada) { armazenamento.clear(); for (const [nome, valor] of Object.entries(entrada)) armazenamento.set(nome, String(valor)); } function __clearCookies() { armazenamento.clear(); } function __setCabecalhos(entrada) { cabecalhos = new Headers(entrada); } module.exports = { cookies, headers, __setCookies, __clearCookies, __setCabecalhos };`,
  'utf8'
);

writeFileSync(
  join(next, 'server.js'),
  `class NextResponse extends Response { static json(data, init = {}) { const headers = new Headers(init.headers ?? {}); if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json'); return new NextResponse(JSON.stringify(data), { ...init, headers }); } } class NextRequest extends Request { constructor(input, init) { super(input, init); this.nextUrl = new URL(typeof input === 'string' ? input : input.url); } } module.exports = { NextRequest, NextResponse };`,
  'utf8'
);

// As rotas publicas importam por `@/lib/...`. O alias e resolvido pelo Next em
// producao; aqui ele vira um diretorio real dentro do node_modules temporario.
const alias = join(pasta, 'node_modules', '@', 'lib');
mkdirSync(dirname(alias), { recursive: true });
cpSync(join(pasta, 'lib'), alias, { recursive: true });

executar(process.execPath, ['--test', join(pasta, 'scripts', 'correlacao-bff.spec.js')], pasta);

// O middleware e o unico lugar onde o id nasce para a requisicao inteira.
// Estas asercoes guardam o contrato que os testes acima assumem.
try {
  const middleware = readFileSync(join(raiz, 'middleware.ts'), 'utf8');
  assert.match(
    middleware,
    /criarRequestIdBff\(\)/,
    'Middleware deve emitir o proprio id de correlacao por requisicao.'
  );
  assert.match(
    middleware,
    /requestHeaders\.set\(NOME_CABECALHO_CORRELACAO, requestId\)/,
    'Middleware deve sobrescrever o cabecalho recebido do cliente antes de entregar a requisicao ao BFF.'
  );
  assert.match(
    middleware,
    /requestHeaders\.delete\('x-correlation-id'\)/,
    'Middleware deve apagar `x-correlation-id`: e o fallback que o backend usa quando `x-request-id` falta.'
  );
  assert.match(
    middleware,
    /resposta\.headers\.set\(NOME_CABECALHO_CORRELACAO, requestId\)/,
    'Middleware deve devolver o id na resposta para permitir partir do relato de usuario ate a trilha.'
  );
  assert.doesNotMatch(
    middleware,
    /criarRequestIdBff\(nonce\)|NOME_CABECALHO_CORRELACAO, nonce/,
    'O nonce CSP nao pode ser reaproveitado como id de correlacao.'
  );

  // ---------------------------------------------------------------------------
  // O matcher e onde a garantia inteira repousa.
  //
  // Toda a afirmacao "o cliente nao escolhe o id" depende de o middleware RODAR
  // na rota. Os testes do spec injetam o cabecalho direto pelo mock de
  // `next/headers` e nunca exercitam roteamento: se alguem acrescentar `api/` as
  // exclusoes do matcher, ou estreita-lo, todos eles continuam verdes e o buraco
  // reabre em silencio.
  //
  // O valor e LIDO do modulo compilado, nao procurado com regex no texto, e quem
  // decide se um caminho casa e o proprio Next: `getMiddlewareMatchers` converte
  // a declaracao e `getMiddlewareRouteMatcher` a aplica -- os dois mesmos passos
  // que decidem em producao quais caminhos passam pelo middleware. Assim uma
  // reescrita do matcher em outra sintaxe (`/api/:caminho*`, lista de objetos,
  // condicoes `has`/`missing`) continua sendo avaliada corretamente.
  //
  // Montar `new RegExp(regexp)` a partir do `regexp` devolvido, como esta funcao
  // fazia antes, era pior por duas razoes: reimplementava a semantica de
  // casamento do Next (perdendo `has`/`missing`) e construia expressao regular
  // em tempo de execucao, que o Semgrep sinaliza como ReDoS
  // (detect-non-literal-regexp, CWE-1333). Aqui nao havia entrada de atacante --
  // e um script de teste lendo o proprio middleware do repositorio --, mas a
  // construcao dinamica tambem nao entregava nada que o matcher oficial nao
  // entregue melhor.
  // ---------------------------------------------------------------------------
  const { config } = require(join(pasta, 'middleware.js'));
  const { getMiddlewareMatchers } = require('next/dist/build/analysis/get-page-static-info.js');
  const {
    getMiddlewareRouteMatcher
  } = require('next/dist/shared/lib/router/utils/middleware-route-matcher.js');

  assert.ok(config?.matcher, 'middleware.ts deve exportar `config.matcher`.');
  const casaComOMiddleware = getMiddlewareRouteMatcher(getMiddlewareMatchers(config.matcher, {}));
  const passaPeloMiddleware = (caminho) =>
    casaComOMiddleware(caminho, { headers: {}, nextUrl: { pathname: caminho } }, {});

  // Uma rota por familia coberta pelo spec: sessao, MFA, formulario por token,
  // agendamento publico e convite de acesso. Se o matcher deixar de cobrir
  // qualquer uma, o id daquela familia volta a poder vir do cliente.
  for (const rota of [
    '/api/auth/login',
    '/api/auth/mfa/concluir-login',
    '/api/formularios/token-sintetico',
    '/api/agendamentos-publicos/token-sintetico/solicitacoes',
    '/api/pacientes/convites-acesso/token-sintetico/ativar'
  ]) {
    assert.ok(
      passaPeloMiddleware(rota),
      `O matcher do middleware deixou de cobrir ${rota}: o cliente volta a poder escolher o id gravado na trilha.`
    );
  }

  // Contraprova: o matcher precisa continuar excluindo estatico, senao a
  // asercao acima passaria por um matcher que casa com tudo por acidente.
  assert.equal(
    passaPeloMiddleware('/_next/static/chunk.js'),
    false,
    'O matcher nao deve cobrir `_next/static`; um matcher que casa com tudo tornaria as asercoes acima vazias.'
  );
} finally {
  // O `rmSync` precisa rodar mesmo quando uma asercao acima reprova, senao o
  // diretorio temporario vaza a cada execucao falha.
  rmSync(pasta, { recursive: true, force: true });
}

console.log('Correlacao BFF: id propagado ao backend, valor externo recusado, matcher do middleware cobre `app/api`.');

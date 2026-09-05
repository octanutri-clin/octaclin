/**
 * Gate da origem do backend no BFF.
 *
 * Por que este arquivo existe. Ate 2026-09-05, onze rotas de `app/api` traziam
 * cada uma a sua copia de
 * `OCTACLIN_BACKEND_URL ?? NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'`.
 * Em 2026-09-03 o web de staging estava sem `OCTACLIN_BACKEND_URL`: o login
 * quebrou -- ele passa por `obterConfiguracaoAcessoBff`, que nunca teve
 * fallback -- e as onze rotas publicas continuaram respondendo, porque caiam na
 * variavel legada. Um desvio de configuracao que derruba metade do sistema e
 * deixa a outra verde e mais dificil de diagnosticar do que uma queda inteira.
 *
 * O gate tem duas metades, e as duas sao necessarias:
 *
 * - **estrutura**, aqui: nenhuma rota de `app/api` le `process.env` por conta
 *   propria, e nenhum modulo de servidor decide origem de backend por variavel
 *   `NEXT_PUBLIC_*` -- o prefixo existe para embarcar o valor no bundle do
 *   navegador, e uma decisao de servidor tomada por ele e a fonte errada. A
 *   leitura de `OCTACLIN_BACKEND_URL` fica num ponto so.
 * - **comportamento**, em `origem-backend-bff.spec.ts`: o modulo real,
 *   compilado, falha fechado em producao sem a variavel. Uma asercao de texto
 *   sobre essas cinco linhas seria afirmacao, e nao prova -- e afirmacao sem
 *   nada que a sustente e o defeito que o PR 52 passou tres fases corrigindo.
 */
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FONTE_UNICA = 'lib/server/configuracao-acesso-bff.ts';

function listarArquivos(diretorio, extensoes = ['.ts', '.tsx']) {
  const encontrados = [];
  for (const entrada of readdirSync(diretorio)) {
    const caminho = join(diretorio, entrada);
    if (statSync(caminho).isDirectory()) encontrados.push(...listarArquivos(caminho, extensoes));
    else if (extensoes.some((extensao) => entrada.endsWith(extensao))) encontrados.push(caminho);
  }
  return encontrados;
}

// --- Metade 1: estrutura ----------------------------------------------------

const rotas = listarArquivos(join(raiz, 'app', 'api'));
assert.ok(
  rotas.length >= 40,
  `so ${rotas.length} arquivos lidos em app/api; a varredura provavelmente quebrou e aprovaria o vazio`
);

const lendoAmbiente = rotas.filter((caminho) => /process\.env\b/.test(readFileSync(caminho, 'utf8')));
assert.deepEqual(
  lendoAmbiente.map((caminho) => relative(raiz, caminho)),
  [],
  'rota de app/api lendo process.env diretamente: a configuracao do BFF vem de lib/server, num ponto so'
);

/**
 * Excecoes declaradas, por nome e com justificativa escrita.
 *
 * O criterio nao e "le variavel publica", e sim **o que a variavel decide**. Uma
 * decisao de trafego de servidor tomada por variavel do bundle do navegador e a
 * fonte errada. Um endereco publico exibido a um paciente e, por definicao,
 * publico -- e ali a variavel nao esta fora de lugar.
 *
 * A declaracao e por nome de arquivo justamente para que a excecao custe uma
 * linha e uma justificativa: qualquer outro modulo de servidor que passe a ler
 * `NEXT_PUBLIC_*` reprova, e volta para esta decisao em vez de entrar de
 * carona.
 */
const EXCECOES_VARIAVEL_PUBLICA = new Map([
  [
    'lib/server/agendamento-publico-bff.ts',
    'obterOrigemPublicaAgenda monta o link entregue ao paciente, e nao a origem para onde o servidor manda trafego. O endereco e publico por definicao.'
  ]
]);

const servidor = listarArquivos(join(raiz, 'lib', 'server')).concat(rotas);
const comVariavelPublica = servidor
  .filter((caminho) => {
    // A mencao em comentario e permitida -- e assim que a decisao fica
    // explicada. O que reprova e a leitura.
    return /process\.env\.NEXT_PUBLIC_[A-Z0-9_]+/.test(readFileSync(caminho, 'utf8'));
  })
  .map((caminho) => relative(raiz, caminho).split('\\').join('/'));

assert.deepEqual(
  comVariavelPublica.filter((caminho) => !EXCECOES_VARIAVEL_PUBLICA.has(caminho)),
  [],
  'modulo de servidor lendo variavel NEXT_PUBLIC_*: o prefixo embarca o valor no bundle do navegador e nao pode decidir trafego de servidor'
);

// Excecao declarada que deixou de ser necessaria e excecao que ninguem revisou.
assert.deepEqual(
  [...EXCECOES_VARIAVEL_PUBLICA.keys()].filter((caminho) => !comVariavelPublica.includes(caminho)),
  [],
  'excecao declarada para arquivo que nao le mais variavel publica: remova a declaracao'
);

const leitores = listarArquivos(join(raiz, 'lib'))
  .concat(rotas)
  .filter((caminho) => /process\.env\.OCTACLIN_BACKEND_URL/.test(readFileSync(caminho, 'utf8')))
  .map((caminho) => relative(raiz, caminho).split('\\').join('/'));
assert.deepEqual(
  leitores,
  [FONTE_UNICA],
  `OCTACLIN_BACKEND_URL deve ser lida em ${FONTE_UNICA} e em nenhum outro lugar; duas leituras divergem`
);

// --- Metade 2: comportamento do modulo real ---------------------------------

const pasta = mkdtempSync(join(tmpdir(), 'octaclin-origem-backend-bff-'));

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
      files: [
        'scripts/origem-backend-bff.spec.ts',
        // Alvos do teste, listados mesmo sendo alcancados pelo import do spec:
        // um import futuro que deixe de alcanca-los nao pode tirar os dois da
        // compilacao em silencio.
        'lib/server/configuracao-acesso-bff.ts',
        'lib/server/sessao-bff.ts'
      ].map((arquivo) => join(raiz, arquivo))
    },
    null,
    2
  ),
  'utf8'
);

executar(process.execPath, [join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(pasta, 'tsconfig.json')]);

// `sessao-bff.ts` importa `next/headers` no topo. O modulo sob teste nao usa
// cookie nenhum, mas o require acontece no carregamento.
const next = join(pasta, 'node_modules', 'next');
mkdirSync(next, { recursive: true });
writeFileSync(
  join(next, 'headers.js'),
  'function cookies() { return { get() { return undefined; }, set() {}, delete() {} }; } function headers() { return new Headers(); } module.exports = { cookies, headers };',
  'utf8'
);
writeFileSync(
  join(next, 'server.js'),
  'class NextResponse extends Response {} class NextRequest extends Request {} module.exports = { NextRequest, NextResponse };',
  'utf8'
);

const alias = join(pasta, 'node_modules', '@', 'lib');
mkdirSync(dirname(alias), { recursive: true });
cpSync(join(pasta, 'lib'), alias, { recursive: true });

executar(process.execPath, ['--test', join(pasta, 'scripts', 'origem-backend-bff.spec.js')], pasta);

rmSync(pasta, { recursive: true, force: true });

console.log(
  `Origem do backend no BFF validada: ${rotas.length} rotas de app/api sem leitura propria de ambiente, decisao unica em ${FONTE_UNICA}.`
);

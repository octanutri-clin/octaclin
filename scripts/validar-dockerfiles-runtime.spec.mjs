import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dockerfiles = [
  'octaclin-backend/Dockerfile',
  'octaclin-web/Dockerfile',
  'octaclin-ai-service/Dockerfile',
];

function estagioFinal(conteudo) {
  const normalizado = conteudo.replace(/\r\n/g, '\n');
  const indice = normalizado.lastIndexOf('\nFROM ');
  return indice >= 0 ? normalizado.slice(indice + 1) : normalizado;
}

// Um `FROM` referencia uma imagem remota (que precisa de digest) OU um estagio
// local ja definido (`FROM build AS runtime`), que nao deve exigir digest. Para
// nao marcar estagio local como imagem remota, coletamos os aliases `AS <nome>`
// na ordem em que aparecem e so exigimos digest quando a referencia nao e um
// alias conhecido ate aquele ponto.
function instrucoesFrom(conteudo) {
  const aliases = new Set();
  const remotas = [];
  for (const linha of conteudo.split('\n')) {
    const m = linha.match(/^\s*FROM\s+(--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/i);
    if (!m) continue;
    const referencia = m[2];
    const alias = m[3];
    if (!aliases.has(referencia.toLowerCase())) {
      remotas.push({ referencia, linha: linha.trim() });
    }
    if (alias) aliases.add(alias.toLowerCase());
  }
  return remotas;
}

test('os tres artefatos finais executam sem root e declaram healthcheck', () => {
  for (const caminho of dockerfiles) {
    const runtime = estagioFinal(readFileSync(caminho, 'utf8'));
    const usuario = runtime.match(/^USER\s+([^\s#]+)/m)?.[1];

    assert.ok(usuario, `${caminho}: estagio final precisa declarar USER.`);
    assert.notEqual(usuario.toLowerCase(), 'root', `${caminho}: USER root nao e permitido.`);
    assert.notEqual(usuario, '0', `${caminho}: USER 0 (root numerico) nao e permitido.`);
    assert.match(runtime, /^HEALTHCHECK\s+/m, `${caminho}: estagio final precisa declarar HEALTHCHECK.`);
  }
});

// PR 50: imutabilidade. Toda imagem remota deve ser fixada por digest sha256; a
// tag humana pode permanecer como legibilidade, mas o digest e a ancora real.
test('toda imagem base remota e fixada por digest sha256 imutavel', () => {
  for (const caminho of dockerfiles) {
    const conteudo = readFileSync(caminho, 'utf8');
    for (const { referencia, linha } of instrucoesFrom(conteudo)) {
      assert.match(
        referencia,
        /@sha256:[0-9a-f]{64}$/,
        `${caminho}: base remota sem digest imutavel -> "${linha}". Fixe com @sha256:<64 hex>.`,
      );
    }
  }
});

test('nenhuma base remota usa a tag mutavel latest', () => {
  for (const caminho of dockerfiles) {
    const conteudo = readFileSync(caminho, 'utf8');
    for (const { referencia, linha } of instrucoesFrom(conteudo)) {
      assert.doesNotMatch(referencia, /:latest(@|$)/, `${caminho}: tag latest e proibida -> "${linha}".`);
    }
  }
});

// PR 50: reducao de superficie. Ferramenta de build/instalacao nao deve rodar no
// estagio final. Cada base traz o gerenciador (pnpm/pip) so no estagio de deps.
test('o estagio final nao executa gerenciador de pacotes nem instalacao', () => {
  const proibidos = [
    /\bpnpm\s+install\b/,
    /\bnpm\s+(?:ci|install)\b/,
    /\bcorepack\s+(?:enable|prepare)\b/,
    /\bpip\s+install\b/,
    /\bapk\s+add\b/,
    /\bapt-get\s+install\b/,
  ];
  for (const caminho of dockerfiles) {
    const runtime = estagioFinal(readFileSync(caminho, 'utf8'));
    for (const padrao of proibidos) {
      assert.doesNotMatch(
        runtime,
        padrao,
        `${caminho}: estagio final nao deve executar "${padrao}". Resolva em estagio anterior e copie o artefato.`,
      );
    }
  }
});

// PR 50: sem secrets em layer/history. Bloqueia os vetores obvios de secret
// persistido: ARG/ENV de token/senha, COPY de .env e download-and-run.
test('os Dockerfiles nao introduzem secrets nem download inseguro', () => {
  for (const caminho of dockerfiles) {
    const conteudo = readFileSync(caminho, 'utf8');
    assert.doesNotMatch(
      conteudo,
      /^\s*(?:ARG|ENV)\s+\w*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|PRIVATE_?KEY)\b/im,
      `${caminho}: nao declare secret via ARG/ENV; use BuildKit secret mount se necessario.`,
    );
    assert.doesNotMatch(conteudo, /^\s*COPY\s+[^\n]*\.env\b/im, `${caminho}: nao copie .env para a imagem.`);
    assert.doesNotMatch(conteudo, /curl\s+[^\n|]*\|\s*(?:sh|bash)\b/i, `${caminho}: "curl | sh" e proibido.`);
    assert.doesNotMatch(conteudo, /^\s*ADD\s+https?:\/\//im, `${caminho}: ADD remoto inseguro; use COPY versionado.`);
  }
});

test('healthchecks usam runtimes ja presentes nas imagens, sem instalar curl', () => {
  const backend = estagioFinal(readFileSync('octaclin-backend/Dockerfile', 'utf8'));
  const web = estagioFinal(readFileSync('octaclin-web/Dockerfile', 'utf8'));
  const ia = estagioFinal(readFileSync('octaclin-ai-service/Dockerfile', 'utf8'));

  assert.match(backend, /HEALTHCHECK[^\n]*CMD \["node", "-e"/);
  assert.match(web, /HEALTHCHECK[^\n]*CMD \["node", "-e"/);
  assert.match(ia, /HEALTHCHECK[^\n]*CMD \["python", "-c"/);

  for (const [caminho, runtime] of [
    ['octaclin-backend/Dockerfile', backend],
    ['octaclin-web/Dockerfile', web],
    ['octaclin-ai-service/Dockerfile', ia],
  ]) {
    assert.doesNotMatch(runtime, /\b(?:apk|apt-get)\b[^\n]*\bcurl\b/, `${caminho}: curl nao deve ser adicionado so para o probe.`);
  }
});

test('o runtime web nao depende do cache Corepack preparado como root', () => {
  const web = estagioFinal(readFileSync('octaclin-web/Dockerfile', 'utf8'));

  assert.doesNotMatch(web, /^CMD \["pnpm"/m);
  assert.match(web, /^CMD \["node", "node_modules\/next\/dist\/bin\/next", "start"\]/m);
});

test('o runtime web remove o npm global e as interfaces de package manager', () => {
  const web = estagioFinal(readFileSync('octaclin-web/Dockerfile', 'utf8'));
  const inicioLimpeza = web.indexOf('RUN rm -rf \\\n');
  assert.notEqual(inicioLimpeza, -1, 'octaclin-web/Dockerfile: runtime precisa declarar a limpeza da base oficial.');

  const proximaCopia = web.indexOf('\nCOPY ', inicioLimpeza);
  assert.notEqual(proximaCopia, -1, 'octaclin-web/Dockerfile: limpeza deve ocorrer antes da copia dos artefatos.');
  const limpeza = web.slice(inicioLimpeza, proximaCopia);

  for (const caminho of [
    '/usr/local/lib/node_modules/npm',
    '/usr/local/lib/node_modules/corepack',
    '/usr/local/bin/npm',
    '/usr/local/bin/npx',
    '/usr/local/bin/pnpm',
    '/usr/local/bin/pnpx',
    '/usr/local/bin/corepack',
  ]) {
    assert.ok(limpeza.includes(caminho), `octaclin-web/Dockerfile: runtime ainda nao remove ${caminho}.`);
  }
});

test('o runtime backend remove o npm global e as interfaces de package manager', () => {
  const backend = estagioFinal(readFileSync('octaclin-backend/Dockerfile', 'utf8'));
  const inicioLimpeza = backend.indexOf('RUN rm -rf \\\n');
  assert.notEqual(inicioLimpeza, -1, 'octaclin-backend/Dockerfile: runtime precisa declarar a limpeza da base oficial.');

  const proximaCopia = backend.indexOf('\nCOPY ', inicioLimpeza);
  assert.notEqual(proximaCopia, -1, 'octaclin-backend/Dockerfile: limpeza deve ocorrer antes da copia dos artefatos.');
  const limpeza = backend.slice(inicioLimpeza, proximaCopia);

  for (const caminho of [
    '/usr/local/lib/node_modules/npm',
    '/usr/local/lib/node_modules/corepack',
    '/usr/local/bin/npm',
    '/usr/local/bin/npx',
    '/usr/local/bin/pnpm',
    '/usr/local/bin/pnpx',
    '/usr/local/bin/corepack',
  ]) {
    assert.ok(limpeza.includes(caminho), `octaclin-backend/Dockerfile: runtime ainda nao remove ${caminho}.`);
  }
});

test('o runtime IA remove o pip global e os componentes vendorizados da imagem base', () => {
  const ia = estagioFinal(readFileSync('octaclin-ai-service/Dockerfile', 'utf8'));
  const inicioLimpeza = ia.indexOf('RUN rm -rf \\\n');
  assert.notEqual(inicioLimpeza, -1, 'octaclin-ai-service/Dockerfile: runtime precisa declarar a limpeza do pip da base.');

  const proximaCopia = ia.indexOf('\nCOPY ', inicioLimpeza);
  assert.notEqual(proximaCopia, -1, 'octaclin-ai-service/Dockerfile: limpeza deve ocorrer antes da copia das dependencias.');
  const limpeza = ia.slice(inicioLimpeza, proximaCopia);

  for (const caminho of [
    '/usr/local/bin/pip',
    '/usr/local/bin/pip3',
    '/usr/local/bin/pip3.14',
    '/usr/local/lib/python3.14/site-packages/pip',
    '/usr/local/lib/python3.14/site-packages/pip-*.dist-info',
  ]) {
    assert.ok(limpeza.includes(caminho), `octaclin-ai-service/Dockerfile: runtime ainda nao remove ${caminho}.`);
  }
});

test('o CI prova nos containers que comandos e diretorios globais estao ausentes', () => {
  const harness = readFileSync('scripts/harness-runtime-containers.sh', 'utf8');
  const workflow = readFileSync('.github/workflows/trivy.yml', 'utf8');

  assert.ok(harness.includes('COMANDOS_AUSENTES'), 'harness precisa consumir a lista de comandos ausentes.');
  assert.ok(harness.includes('CAMINHOS_AUSENTES'), 'harness precisa consumir a lista de caminhos ausentes.');
  assert.ok(
    harness.includes(`sh -c 'command -v "$1" >/dev/null 2>&1' sh "$comando"`),
    'harness deve passar o comando como argumento posicional, sem interpolar codigo de shell.',
  );
  assert.ok(
    harness.includes(`sh -c 'test ! -e "$1"' sh "$caminho"`),
    'harness deve passar o caminho como argumento posicional, sem interpolar codigo de shell.',
  );

  const inicioBackend = workflow.indexOf('- nome: backend');
  const inicioWeb = workflow.indexOf('- nome: web', inicioBackend);
  const inicioIa = workflow.indexOf('- nome: ia-service', inicioWeb);
  const fimMatriz = workflow.indexOf('\n    steps:', inicioIa);
  assert.notEqual(inicioBackend, -1, 'matriz backend nao encontrada no workflow Trivy.');
  assert.notEqual(inicioWeb, -1, 'matriz web nao encontrada no workflow Trivy.');
  assert.notEqual(inicioIa, -1, 'limite da matriz web nao encontrado no workflow Trivy.');
  assert.notEqual(fimMatriz, -1, 'limite da matriz IA nao encontrado no workflow Trivy.');
  const backend = workflow.slice(inicioBackend, inicioWeb);
  const web = workflow.slice(inicioWeb, inicioIa);
  const ia = workflow.slice(inicioIa, fimMatriz);
  for (const [nome, matriz] of [['backend', backend], ['web', web]]) {
    assert.ok(matriz.includes('comandos_ausentes: "npm npx pnpm corepack"'), `${nome}: comandos proibidos nao configurados.`);
    assert.ok(
      matriz.includes('caminhos_ausentes: "/usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack"'),
      `${nome}: caminhos proibidos nao configurados.`,
    );
  }
  assert.ok(ia.includes('comandos_ausentes: "pip pip3"'), 'ia-service: comandos pip proibidos nao configurados.');
  assert.ok(
    ia.includes('caminhos_ausentes: "/usr/local/lib/python3.14/site-packages/pip"'),
    'ia-service: pacote global do pip nao configurado como caminho proibido.',
  );
  assert.ok(workflow.includes('COMANDOS_AUSENTES: ${{ matrix.comandos_ausentes }}'));
  assert.ok(workflow.includes('CAMINHOS_AUSENTES: ${{ matrix.caminhos_ausentes }}'));
});

test('builds Node nao desativam a referencia de package manager verificada', () => {
  for (const caminho of ['octaclin-backend/Dockerfile', 'octaclin-web/Dockerfile']) {
    const conteudo = readFileSync(caminho, 'utf8');
    assert.doesNotMatch(
      conteudo,
      /COREPACK_ENABLE_PROJECT_SPEC\s*=\s*0/,
      `${caminho}: nao deve ignorar o packageManager verificado do projeto.`,
    );
  }
});

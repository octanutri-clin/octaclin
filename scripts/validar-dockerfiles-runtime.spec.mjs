import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dockerfiles = [
  'octaclin-backend/Dockerfile',
  'octaclin-web/Dockerfile',
  'octaclin-ai-service/Dockerfile',
];

function estagioFinal(conteudo) {
  const indice = conteudo.lastIndexOf('\nFROM ');
  return indice >= 0 ? conteudo.slice(indice + 1) : conteudo;
}

test('os tres artefatos finais executam sem root e declaram healthcheck', () => {
  for (const caminho of dockerfiles) {
    const runtime = estagioFinal(readFileSync(caminho, 'utf8'));
    const usuario = runtime.match(/^USER\s+([^\s#]+)/m)?.[1];

    assert.ok(usuario, `${caminho}: estagio final precisa declarar USER.`);
    assert.notEqual(usuario.toLowerCase(), 'root', `${caminho}: USER root nao e permitido.`);
    assert.match(runtime, /^HEALTHCHECK\s+/m, `${caminho}: estagio final precisa declarar HEALTHCHECK.`);
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

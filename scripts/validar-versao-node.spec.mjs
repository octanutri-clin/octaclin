/**
 * O que estes casos protegem.
 *
 * O gate existe por causa de um PR concreto: subir a imagem base sem mover o
 * `NODE_VERSION` do CI. Entao o caso central e esse -- e ele precisa reprovar
 * mesmo quando todo o resto esta certo. Os demais cobrem as outras tres formas
 * de a mesma divergencia entrar, e a data da divergencia declarada, que e o que
 * impede a excecao de virar permanente.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  DIVERGENCIA_TYPES_NODE,
  DOCKERFILES,
  MANIFESTS,
  lerNodeDoCi,
  lerNodeDoDockerfile,
  majorDe,
  validarVersaoNode
} from './validar-versao-node.mjs';

function montarRepo({ ci = 22, docker = 22, engines = '>=22.0.0 <23.0.0', tipos = '^26.4.0' } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), 'octaclin-node-'));
  mkdirSync(join(raiz, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(raiz, '.github/workflows/ci.yml'), `env:\n  NODE_VERSION: "${ci}"\n`, 'utf8');

  for (const arquivo of DOCKERFILES) {
    mkdirSync(join(raiz, dirname(arquivo)), { recursive: true });
    writeFileSync(
      join(raiz, arquivo),
      `FROM node:${docker}-alpine@sha256:abc AS deps\nFROM node:${docker}-alpine@sha256:abc AS runtime\n`,
      'utf8'
    );
  }

  for (const arquivo of MANIFESTS) {
    mkdirSync(join(raiz, dirname(arquivo)), { recursive: true });
    const manifesto = { name: arquivo, devDependencies: {} };
    if (engines) manifesto.engines = { node: engines };
    if (tipos && arquivo !== 'package.json') manifesto.devDependencies['@types/node'] = tipos;
    writeFileSync(join(raiz, arquivo), JSON.stringify(manifesto), 'utf8');
  }
  return raiz;
}

function comRepo(opcoes, executar) {
  const raiz = montarRepo(opcoes);
  try {
    return executar(raiz);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
}

const DENTRO_DO_PRAZO = new Date('2026-09-05T00:00:00Z');
const DEPOIS_DO_PRAZO = new Date('2026-10-29T00:00:00Z');

test('le o major do CI, do Dockerfile e de uma faixa de engines', () => {
  assert.equal(lerNodeDoCi('env:\n  NODE_VERSION: "22"\n'), 22);
  assert.equal(lerNodeDoCi('env:\r\n  NODE_VERSION: "26"\r\n'), 26);
  assert.deepEqual(lerNodeDoDockerfile('FROM node:22-alpine@sha256:a AS x\nFROM node:22-alpine@sha256:a AS y\n'), [22]);
  assert.equal(majorDe('>=22.0.0 <23.0.0'), 22);
  assert.equal(majorDe('^26.4.0'), 26);
});

test('leitura fail-closed quando a declaracao nao existe', () => {
  assert.throws(() => lerNodeDoCi('env:\n  OUTRA: 1\n'), /NODE_VERSION nao encontrado/);
  assert.throws(() => lerNodeDoDockerfile('FROM python:3.14-slim\n'), /nenhum FROM node/);
});

/**
 * O caso que motivou o gate: os PRs #180 e #181 mexiam so no Dockerfile.
 * Reprovar aqui e a diferenca entre a imagem publicada ser a imagem testada e
 * nao ser.
 */
test('reprova imagem base fora da versao do CI', () => {
  const { problemas } = comRepo({ ci: 22, docker: 26 }, (raiz) => validarVersaoNode(raiz, DENTRO_DO_PRAZO));
  assert.equal(problemas.length, DOCKERFILES.length);
  for (const problema of problemas) assert.match(problema, /imagem base e node:26 e o CI roda Node 22/);
});

test('reprova engines fora da versao do CI', () => {
  const { problemas } = comRepo({ ci: 22, engines: '>=26.0.0 <27.0.0' }, (raiz) =>
    validarVersaoNode(raiz, DENTRO_DO_PRAZO)
  );
  assert.ok(problemas.length >= MANIFESTS.length);
  assert.ok(problemas.some((p) => /engines`? ?\.?node`? declara/.test(p) || /engines/.test(p)));
});

test('reprova manifest sem engines.node', () => {
  const { problemas } = comRepo({ engines: null }, (raiz) => validarVersaoNode(raiz, DENTRO_DO_PRAZO));
  assert.ok(problemas.some((p) => /sem `engines.node`/.test(p)));
  assert.ok(problemas.some((p) => /comparacao parcial/.test(p)), 'o piso de sanidade deveria acusar');
});

test('aceita o repositorio coerente', () => {
  const { problemas, ci } = comRepo({}, (raiz) => validarVersaoNode(raiz, DENTRO_DO_PRAZO));
  assert.deepEqual(problemas, []);
  assert.equal(ci, 22);
});

// A divergencia de tipos e aceita por ser declarada, e nao por ser tolerada: ela
// tem data, e a data e o que a impede de virar permanente.
test('aceita a divergencia declarada de @types/node dentro do prazo', () => {
  const { problemas } = comRepo({ tipos: '^26.4.0' }, (raiz) => validarVersaoNode(raiz, DENTRO_DO_PRAZO));
  assert.deepEqual(problemas, []);
});

test('reprova a divergencia declarada depois do prazo', () => {
  const { problemas } = comRepo({ tipos: '^26.4.0' }, (raiz) => validarVersaoNode(raiz, DEPOIS_DO_PRAZO));
  assert.ok(problemas.length > 0);
  assert.ok(problemas.some((p) => p.includes(`venceu em ${DIVERGENCIA_TYPES_NODE.ate}`)));
});

// A declaracao cobre um major especifico. Outro qualquer nao entra de carona.
test('reprova divergencia de tipos que nao e a declarada', () => {
  const { problemas } = comRepo({ tipos: '^24.0.0' }, (raiz) => validarVersaoNode(raiz, DENTRO_DO_PRAZO));
  assert.ok(problemas.some((p) => /pode nao existir em runtime/.test(p)));
});

test('o repositorio real esta coerente', () => {
  const { problemas } = validarVersaoNode(undefined, DENTRO_DO_PRAZO);
  assert.deepEqual(problemas, []);
});

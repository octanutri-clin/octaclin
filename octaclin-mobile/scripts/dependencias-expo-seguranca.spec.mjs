import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const requireExpo = createRequire(require.resolve('expo/package.json'));
const requireConfig = createRequire(requireExpo.resolve('@expo/config'));
const requireFingerprint = createRequire(requireExpo.resolve('@expo/fingerprint'));
const { glob, globSync } = requireConfig('glob');
const { minimatch, Minimatch } = requireFingerprint('minimatch');

function projeto(t) {
  const raiz = mkdtempSync(join(tmpdir(), 'octaclin-glob-sintetico-'));
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  mkdirSync(join(raiz, 'src'));
  for (const arquivo of ['app.json', 'src/a.ts', 'src/b.tsx', 'src/ignorado.txt']) {
    writeFileSync(join(raiz, arquivo), '{}');
  }
  return raiz;
}

test('glob usado pelo config Expo preserva assinaturas sync/async, braces e ignore', async t => {
  const cwd = projeto(t);
  const opcoes = { cwd, nodir: true, ignore: ['**/b.tsx'] };
  assert.deepEqual(globSync('**/*.{ts,tsx}', opcoes), ['src/a.ts']);
  assert.deepEqual(await glob('**/*.{ts,tsx}', opcoes), ['src/a.ts']);
  assert.deepEqual((await glob(['app.json', 'src/*.tsx'], { cwd, nodir: true })).sort(), ['app.json', 'src/b.tsx']);
});

test('glob recusa travessia de projeto quando AbortSignal já está cancelado', async t => {
  const cwd = projeto(t);
  const controller = new AbortController();
  const motivo = new Error('cancelamento-sintetico');
  controller.abort(motivo);
  await assert.rejects(glob('**/*', { cwd, signal: controller.signal }), erro => erro === motivo);
});

test('minimatch usado por fingerprint preserva dot/matchBase/extglob e interface de classe', () => {
  assert.equal(minimatch('src/a.ts', '**/*.{ts,tsx}'), true);
  assert.equal(minimatch('src/a.txt', '**/*.{ts,tsx}'), false);
  assert.equal(minimatch('.expo/config.json', '**/*.json'), false);
  assert.equal(minimatch('.expo/config.json', '**/*.json', { dot: true }), true);
  assert.equal(minimatch('src/app.ts', '*.ts', { matchBase: true }), true);
  assert.equal(minimatch('foo.test.ts', '!(*.spec).ts'), true);
  const matcher = new Minimatch('src/*.{ts,tsx}');
  assert.equal(matcher.match('src/a.ts'), true);
  assert.equal(matcher.match('src/a.json'), false);
  assert.equal(matcher.pattern, 'src/*.{ts,tsx}');
  assert.equal(matcher.negate, false);
});


test('fingerprint real mantém regras de exclusão, reintrodução por negação e dotfiles', () => {
  const { isIgnoredPath } = requireFingerprint('./utils/Path');
  assert.equal(isIgnoredPath('src/a.ts', ['**/*.ts']), true);
  assert.equal(isIgnoredPath('src/a.tsx', ['**/*.ts']), false);
  assert.equal(isIgnoredPath('src/keep.ts', ['**/*.ts', '!src/keep.ts']), false);
  assert.equal(isIgnoredPath('src/other.ts', ['**/*.ts', '!src/keep.ts']), true);
  assert.equal(isIgnoredPath('.expo/config.json', ['**/*.json']), true);
});

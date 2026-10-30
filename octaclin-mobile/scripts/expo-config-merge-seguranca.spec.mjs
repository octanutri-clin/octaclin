import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';

const require = createRequire(import.meta.url);
const requireExpo = createRequire(require.resolve('expo/package.json'));
const requireConfig = createRequire(requireExpo.resolve('@expo/config'));

function createProject(t, config) {
  const directory = mkdtempSync(join(tmpdir(), 'octaclin-expo-merge-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(join(directory, 'package.json'), '{"name":"merge-sintetico","version":"1.0.0"}');
  writeFileSync(join(directory, 'app.json'), JSON.stringify(config));
  return directory;
}

test('@expo/config não deve resolver deepmerge na árvore instalada nem no lockfile', () => {
  assert.throws(() => requireConfig.resolve('deepmerge'), { code: 'MODULE_NOT_FOUND' });
  const lock = readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8');
  assert.doesNotMatch(lock, /deepmerge@4\.3\.1/);
});

test('merge da configuração mantém objetos recursivos, concatenação de arrays e chaves especiais como dados', async t => {
  const original = JSON.parse('{"expo":{"name":"Sintético","slug":"merge-sintetico","sdkVersion":"57.0.0","extra":{"base":1,"__proto__":{"origem":true},"constructor":{"origem":true},"prototype":{"origem":true}},"experiments":{"flags":[{"base":true}]}}}');
  const directory = createProject(t, original);
  const modifications = JSON.parse('{"extra":{"novo":2,"__proto__":{"destino":true},"constructor":{"destino":true},"prototype":{"destino":true}},"experiments":{"flags":[{"destino":true}]}}');
  const { modifyConfigAsync } = requireExpo('@expo/config');
  const result = await modifyConfigAsync(directory, modifications, { skipPlugins: true }, { dryRun: true });
  assert.equal(result.type, 'success');
  assert.equal(result.config.extra.base, 1);
  assert.equal(result.config.extra.novo, 2);
  assert.equal(Object.getPrototypeOf(result.config.extra), Object.prototype);
  assert.equal(Object.prototype.origem, undefined);
  assert.equal(Object.prototype.destino, undefined);
  assert.equal(Object.hasOwn(result.config.extra, '__proto__'), true);
  assert.deepEqual(result.config.extra.__proto__, { origem: true, destino: true });
  assert.deepEqual(result.config.extra.constructor, { origem: true, destino: true });
  assert.deepEqual(result.config.extra.prototype, { origem: true, destino: true });
  assert.deepEqual(result.config.experiments.flags, [{ base: true }, { destino: true }]);
  assert.deepEqual(JSON.parse(readFileSync(join(directory, 'app.json'), 'utf8')), original);
});

test('chaves especiais introduzidas apenas pela alteração permanecem dados próprios e seguros', async t => {
  const original = { expo: { name: 'Sintético', slug: 'chaves-especiais', sdkVersion: '57.0.0', extra: { base: true } } };
  const directory = createProject(t, original);
  const modifications = JSON.parse('{"extra":{"__proto__":{"octaclinSintetico":true},"constructor":{"seguro":true},"prototype":{"seguro":true}}}');
  const { modifyConfigAsync } = requireExpo('@expo/config');
  const result = await modifyConfigAsync(directory, modifications, { skipPlugins: true }, { dryRun: true });
  assert.equal(result.type, 'success');
  assert.equal(Object.getPrototypeOf(result.config.extra), Object.prototype);
  assert.equal(Object.prototype.octaclinSintetico, undefined);
  assert.equal(Object.hasOwn(result.config.extra, '__proto__'), true);
  assert.deepEqual(result.config.extra.__proto__, { octaclinSintetico: true });
  assert.deepEqual(result.config.extra.constructor, { seguro: true });
  assert.deepEqual(result.config.extra.prototype, { seguro: true });
});

test('merge de propriedades do mesmo plugin preserva os campos e concatena suas listas', async t => {
  const original = { expo: { name: 'Sintético', slug: 'plugin-sintetico', sdkVersion: '57.0.0', plugins: [['plugin-local', { options: { antes: true }, lista: ['a'] }]] } };
  const directory = createProject(t, original);
  const { modifyConfigAsync } = requireExpo('@expo/config');
  const result = await modifyConfigAsync(directory, { plugins: [['plugin-local', { options: { depois: true }, lista: ['b'] }]] }, { skipPlugins: true }, { dryRun: true });
  assert.equal(result.type, 'success');
  assert.deepEqual(result.config.plugins, [['plugin-local', { options: { antes: true, depois: true }, lista: ['a', 'b'] }]]);
  assert.deepEqual(JSON.parse(readFileSync(join(directory, 'app.json'), 'utf8')), original);
});


test('merge de configuração sem objeto expo preserva a forma e os campos não alterados', async t => {
  const original = { name: 'Sintético', slug: 'sem-expo', sdkVersion: '57.0.0', extra: { anterior: true } };
  const directory = createProject(t, original);
  const { modifyConfigAsync } = requireExpo('@expo/config');
  const result = await modifyConfigAsync(directory, { extra: { novo: true } }, { skipPlugins: true }, { dryRun: true });
  assert.equal(result.type, 'success');
  assert.deepEqual(result.config.extra, { anterior: true, novo: true });
  assert.equal(result.config.slug, 'sem-expo');
  assert.deepEqual(JSON.parse(readFileSync(join(directory, 'app.json'), 'utf8')), original);
});

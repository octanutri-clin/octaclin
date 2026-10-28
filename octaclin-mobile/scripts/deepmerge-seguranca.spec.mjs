import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';

// Resolver pelo consumidor real; não testar uma cópia desligada do grafo Expo.
const require = createRequire(import.meta.url);
const requireExpo = createRequire(require.resolve('expo/package.json'));
const requireConfig = createRequire(requireExpo.resolve('@expo/config'));
const cjsPath = requireConfig.resolve('deepmerge');
const raiz = dirname(dirname(cjsPath));
const variantes = [
  ['Expo/CJS', requireConfig('deepmerge')],
  ['interop import() do CJS', (await import(pathToFileURL(cjsPath).href)).default],
  ['UMD distribuído', require(join(raiz, 'dist/umd.js'))]
];
const vetor = () => JSON.parse('{"__proto__":{"octaclinSintetico":true},"valor":1}');
function prototipoSeguro(resultado) {
  assert.equal(Object.getPrototypeOf(resultado), Object.prototype);
  assert.equal(resultado.octaclinSintetico, undefined);
  assert.equal(Object.prototype.octaclinSintetico, undefined);
}

for (const [nome, merge] of variantes) {
  test(`${nome}: target com __proto__ próprio não altera o protótipo do resultado`, () => {
    const target = vetor();
    const antes = JSON.stringify(target);
    const resultado = merge(target, {});
    prototipoSeguro(resultado);
    assert.equal(Object.hasOwn(resultado, '__proto__'), true);
    assert.deepEqual(Object.getOwnPropertyDescriptor(resultado, '__proto__'), {
      value: { octaclinSintetico: true }, enumerable: true, configurable: true, writable: true
    });
    assert.equal(JSON.stringify(target), antes);
  });
  test(`${nome}: source com target de protótipo nulo permanece dado próprio`, () => {
    const resultado = merge(Object.create(null), vetor());
    prototipoSeguro(resultado);
    assert.equal(Object.hasOwn(resultado, '__proto__'), true);
    assert.deepEqual(resultado.__proto__, { octaclinSintetico: true });
  });
  test(`${nome}: objetos aninhados, clone:false e all também preservam a fronteira`, () => {
    prototipoSeguro(merge({ caixa: vetor() }, { caixa: {} }).caixa);
    prototipoSeguro(merge(vetor(), {}, { clone: false }));
    prototipoSeguro(merge.all([vetor(), {}]));
    const arrays = merge({ itens: [vetor()] }, { itens: [ { normal: true } ] });
    prototipoSeguro(arrays.itens[0]);
    assert.equal(arrays.itens.length, 2);
  });
  test(`${nome}: customMerge conserva callback e não cria setter de protótipo`, () => {
    const chamadas = [];
    const resultado = merge(vetor(), vetor(), { customMerge: chave => {
      chamadas.push(chave);
      return chave === '__proto__' ? () => ({ conferido: true }) : undefined;
    } });
    prototipoSeguro(resultado);
    assert.ok(chamadas.includes('__proto__'));
    assert.deepEqual(Object.getOwnPropertyDescriptor(resultado, '__proto__').value, { conferido: true });
  });
  test(`${nome}: controles legítimos, símbolos e campos constructor/prototype não são eliminados indiscriminadamente`, () => {
    const simbolo = Symbol('sintetico');
    const a = { constructor: { a: 1 }, prototype: { a: 1 }, dados: { primeiro: 1 }, lista: [1], [simbolo]: 2 };
    const b = { constructor: { b: 2 }, prototype: { b: 2 }, dados: { segundo: 2 }, lista: [2], [simbolo]: 3 };
    assert.deepEqual(merge(a, b), { constructor: { a: 1, b: 2 }, prototype: { a: 1, b: 2 },
      dados: { primeiro: 1, segundo: 2 }, lista: [1, 2], [simbolo]: 3 });
    assert.equal(a.lista.length, 1);
    const naoEnumeravel = Object.defineProperty({}, 'restrito', { value: 'original' });
    assert.equal(Object.hasOwn(merge(naoEnumeravel, { restrito: 'novo' }), 'restrito'), false);
  });
  test(`${nome}: getters próprios e arrayMerge conservam o comportamento legítimo`, () => {
    let leituras = 0;
    const origem = Object.defineProperty({}, 'campo', { enumerable: true, get() { leituras++; return 2; } });
    assert.deepEqual(merge({}, origem), { campo: 2 });
    assert.equal(leituras, 1);
    assert.deepEqual(merge([1], [2], { arrayMerge: (_a, b) => b.slice() }), [2]);
  });
}

test('Expo modifyConfigAsync usa o merge resolvido em configuração sintética e dryRun não grava', async t => {
  const pasta = mkdtempSync(join(tmpdir(), 'octaclin-deepmerge-'));
  t.after(() => rmSync(pasta, { recursive: true, force: true }));
  writeFileSync(join(pasta, 'package.json'), '{"name":"controle-sintetico","version":"1.0.0"}');
  const original = '{"expo":{"name":"Controle sintético","slug":"controle-sintetico","sdkVersion":"57.0.0","__proto__":{"octaclinSintetico":true}}}';
  writeFileSync(join(pasta, 'app.json'), original);
  const { modifyConfigAsync } = requireExpo('@expo/config');
  const resultado = await modifyConfigAsync(pasta, { version: '1.2.3' }, { skipPlugins: true }, { dryRun: true });
  assert.equal(resultado.type, 'success');
  prototipoSeguro(resultado.config);
  assert.equal(resultado.config.version, '1.2.3');
  assert.equal(resultado.config.slug, 'controle-sintetico');
  assert.equal(readFileSync(join(pasta, 'app.json'), 'utf8'), original);
});

test('Expo merge de propriedades de plugin existente também não altera protótipo e não grava', async t => {
  const pasta = mkdtempSync(join(tmpdir(), 'octaclin-deepmerge-plugin-'));
  t.after(() => rmSync(pasta, { recursive: true, force: true }));
  writeFileSync(join(pasta, 'package.json'), '{"name":"controle-sintetico","version":"1.0.0"}');
  const original = '{"expo":{"name":"Controle","slug":"controle","sdkVersion":"57.0.0","plugins":[["plugin-sintetico",{"__proto__":{"octaclinSintetico":true},"original":1}]]}}';
  writeFileSync(join(pasta, 'app.json'), original);
  const { modifyConfigAsync } = requireExpo('@expo/config');
  const resultado = await modifyConfigAsync(pasta, { plugins: [['plugin-sintetico', { novo: 2 }]] }, { skipPlugins: true }, { dryRun: true });
  assert.equal(resultado.type, 'success');
  const props = resultado.config.plugins[0][1];
  prototipoSeguro(props);
  assert.equal(props.original, 1);
  assert.equal(props.novo, 2);
  assert.equal(resultado.config.plugins.length, 1);
  assert.equal(readFileSync(join(pasta, 'app.json'), 'utf8'), original);
});

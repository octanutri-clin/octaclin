import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const tailwindRequire = createRequire(require.resolve('tailwindcss'));
const nested = tailwindRequire('postcss-nested');

test('Tailwind e postcss-nested usam o parser de seletores corrigido', () => {
  for (const parent of ['tailwindcss', 'postcss-nested']) {
    const dependency = createRequire(tailwindRequire.resolve(parent));
    assert.equal(dependency('postcss-selector-parser/package.json').version, '7.1.6');
  }
});

test('o parser preserva escapes, atributos, namespaces e pseudos aninhados', () => {
  const dependency = createRequire(require.resolve('tailwindcss'));
  const parser = dependency('postcss-selector-parser');
  const selectors = [
    '.md\\:hover\\:bg-blue-500:hover',
    '[data-label="a,b > c"]:not(:is(.a, .b))',
    'svg|a[href^="https://"] > .icone',
    '.grupo:has(> .filho):where(:focus-visible, :hover)',
  ];
  for (const selector of selectors) {
    assert.equal(parser().processSync(selector), selector);
  }
});

test('postcss-nested expande nesting sem alterar atributos e pseudos', async () => {
  const result = await postcss([nested]).process(
    '.card { &[data-label="a,b"]:not(.hidden) { color: red } > .item { display: block } }',
    { from: undefined },
  );
  assert.match(result.css, /\.card\[data-label="a,b"\]:not\(\.hidden\)/);
  assert.match(result.css, /\.card > \.item/);
  assert.doesNotMatch(result.css, /&/);
});

test('Tailwind gera utilitarios, variantes e seletores arbitrarios', async () => {
  const result = await postcss([tailwind({
    content: [{ raw: '<div class="flex hover:bg-blue-500 md:p-4 [&>span]:font-bold"></div>' }],
    corePlugins: { preflight: false },
  })]).process('@tailwind utilities;', { from: undefined });
  assert.match(result.css, /display: flex/);
  assert.match(result.css, /\.hover\\:bg-blue-500:hover/);
  assert.match(result.css, /@media \(min-width: 768px\)/);
  assert.match(result.css, /font-weight: 700/);
  assert.match(result.css, />span/);
});

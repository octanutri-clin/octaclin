/**
 * O que estes casos protegem.
 *
 * O gate existe porque uma lista por nome envelhece em silencio. Ele so cumpre
 * isso se reprovar nas duas direcoes -- dependencia `0.x` que entrou e ninguem
 * excluiu, e exclusao que sobrou de um pacote que ja chegou a `1.0`. A terceira
 * falha possivel e a leitura parar de funcionar e o gate aprovar o vazio; e o
 * que o piso de sanidade cobre.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COMPONENTES, dependenciasVersaoZero, lerExclusoes, validarGrupos } from './validar-grupos-dependabot.mjs';

function montarConfig(exclusoesPorGrupo) {
  return COMPONENTES.map(({ grupo }) => {
    const lista = exclusoesPorGrupo[grupo] ?? [];
    const bloco = lista.length
      ? `        exclude-patterns:\n${lista.map((p) => `          - "${p}"\n`).join('')}`
      : '';
    return `    groups:\n      ${grupo}:\n        update-types:\n          - minor\n          - patch\n${bloco}`;
  }).join('\n');
}

function montarRepo(deps, exclusoesPorGrupo) {
  const raiz = mkdtempSync(join(tmpdir(), 'octaclin-grupos-'));
  mkdirSync(join(raiz, '.github'), { recursive: true });
  writeFileSync(join(raiz, '.github', 'dependabot.yml'), montarConfig(exclusoesPorGrupo), 'utf8');
  for (const { diretorio } of COMPONENTES) {
    mkdirSync(join(raiz, diretorio), { recursive: true });
    writeFileSync(join(raiz, diretorio, 'package.json'), JSON.stringify({ dependencies: deps[diretorio] ?? {} }), 'utf8');
  }
  return raiz;
}

test('reconhece 0.x em dependencies e devDependencies, e ignora o resto', () => {
  const zero = dependenciasVersaoZero({
    dependencies: { 'react-native': '^0.86.2', react: '^19.2.3', exata: '0.10.1' },
    devDependencies: { '@react-native/metro-config': '0.86.2', typescript: '^6.0.3' }
  });
  assert.deepEqual(zero, ['@react-native/metro-config', 'exata', 'react-native']);
});

// `1.0.0` e a fronteira da especificacao: dali em diante minor nao quebra por
// contrato, e a atualizacao volta a ser rotina.
test('1.x nao e tratado como 0.x', () => {
  assert.deepEqual(dependenciasVersaoZero({ dependencies: { a: '^1.0.0', b: '~10.0.0', c: '^0.9.9' } }), ['c']);
});

test('le exclude-patterns do grupo pedido', () => {
  const config = montarConfig({ 'mobile-minor-patch': ['react-native', 'react-native-web'] });
  assert.deepEqual(lerExclusoes(config, 'mobile-minor-patch'), ['react-native', 'react-native-web']);
  assert.deepEqual(lerExclusoes(config, 'backend-minor-patch'), []);
});

// Fail-closed: grupo que a leitura nao encontra nao pode virar lista vazia, que
// aprovaria tudo.
test('grupo ausente lanca, em vez de devolver lista vazia', () => {
  assert.throws(() => lerExclusoes('version: 2\n', 'backend-minor-patch'), /nao encontrado/);
});

// Achado ao rebasear o proprio commit deste gate: o repositorio e editado em
// Windows e o git entrega CRLF na arvore de trabalho, entao uma leitura
// ancorada em fim de linha Unix passaria no CI, que e Linux, e falharia na
// maquina de quem escreveu.
test('le igual com CRLF e com LF', () => {
  const lf = montarConfig({ 'mobile-minor-patch': ['react-native'] });
  const crlf = lf.split('\n').join('\r\n');
  assert.deepEqual(lerExclusoes(crlf, 'mobile-minor-patch'), ['react-native']);
  assert.deepEqual(lerExclusoes(lf, 'mobile-minor-patch'), ['react-native']);
});

test('reprova 0.x que pode ser agrupada', () => {
  const raiz = montarRepo({ 'octaclin-mobile': { 'react-native': '^0.86.2' } }, {});
  try {
    const { problemas } = validarGrupos(raiz);
    assert.equal(problemas.length, 1);
    assert.match(problemas[0], /react-native.*esta em 0\.x e pode ser agrupada/);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('aprova quando a 0.x esta excluida', () => {
  const raiz = montarRepo(
    { 'octaclin-mobile': { 'react-native': '^0.86.2', react: '^19.2.3' } },
    { 'mobile-minor-patch': ['react-native'] }
  );
  try {
    assert.deepEqual(validarGrupos(raiz).problemas, []);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

// A direcao que uma lista mantida na mao sempre esquece: o pacote chegou a 1.0
// e a exclusao continua la, segurando fora do grupo uma atualizacao que voltou
// a ser rotina.
test('reprova exclusao ociosa de pacote que saiu do 0.x', () => {
  // A outra 0.x, ja excluida, existe so para o piso de sanidade nao disparar
  // junto e mascarar qual asercao esta sendo feita aqui.
  const raiz = montarRepo(
    { 'octaclin-mobile': { 'react-native': '^1.0.0', 'react-native-worklets': '0.10.1' } },
    { 'mobile-minor-patch': ['react-native', 'react-native-worklets'] }
  );
  try {
    const { problemas } = validarGrupos(raiz);
    assert.equal(problemas.length, 1);
    assert.match(problemas[0], /nao e mais uma dependencia 0\.x/);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('o piso de sanidade reprova a leitura que nao achou nada', () => {
  const raiz = montarRepo({}, {});
  try {
    const { problemas } = validarGrupos(raiz);
    assert.ok(problemas.some((p) => /Nenhuma dependencia 0\.x/.test(p)));
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('o repositorio esta em conformidade', () => {
  const { problemas, totalZero } = validarGrupos();
  assert.deepEqual(problemas, []);
  assert.ok(totalZero >= 5, `dependencias 0.x encontradas: ${totalZero}`);
});

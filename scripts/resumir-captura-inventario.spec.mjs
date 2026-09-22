/**
 * O que estes casos protegem.
 *
 * O eco existe para atravessar um canal estreito: o log do job. Um eco que
 * "quase" funciona e pior que nenhum, porque entrega JSON truncado com cara de
 * completo. Por isso os casos cobrem a propriedade que importa -- remontar os
 * blocos devolve exatamente o texto original -- e o detector de adulteracao: o
 * sha256 publicado tem que bater com o do conteudo, e mudar um byte tem que
 * quebrar a conferencia.
 *
 * O resumo cobre o outro risco: contar errado e ninguem perceber. O delta
 * contra o inventario vigente e o que diz se a recaptura mexeu em alguma
 * coisa, entao ele precisa distinguir alerta que entrou de alerta que saiu.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { blocosDoEco, delta, remontarEco, resumirSnapshot } from './resumir-captura-inventario.mjs';

function snapshot(numeros, extras = {}) {
  return {
    capturadoEm: '2026-09-22T12:00:00.000Z',
    commitBase: 'abc123',
    snapshot: {
      codeScanning: {
        total: numeros.length,
        alertas: numeros.map((n) => ({ numero: n, severidade: 'high', ferramenta: 'Trivy' })),
      },
      dependabot: { total: 0, alertas: [] },
      secretScanning: { total: 0 },
      ...extras,
    },
  };
}

test('o eco remonta byte a byte o texto original', () => {
  const texto = JSON.stringify(snapshot([1, 2, 3]));
  const { blocos } = blocosDoEco(texto, { largura: 16 });

  assert.ok(blocos.length > 1, 'o caso precisa exercitar mais de um bloco');
  assert.equal(remontarEco(blocos), texto);
});

test('bloco unico tambem remonta', () => {
  const texto = 'curto';
  const { blocos } = blocosDoEco(texto, { largura: 4096 });

  assert.equal(blocos.length, 1);
  assert.equal(remontarEco(blocos), texto);
});

test('cada bloco leva indice, e a remontagem respeita a ordem e nao a chegada', () => {
  const texto = JSON.stringify(snapshot([1, 2, 3, 4, 5]));
  const { blocos } = blocosDoEco(texto, { largura: 8 });

  const embaralhados = [...blocos].reverse();
  assert.equal(remontarEco(embaralhados), texto, 'a ordem vem do indice, nao da posicao na lista');
});

test('o sha256 publicado e o do conteudo original', () => {
  const texto = JSON.stringify(snapshot([7]));
  const { sha256 } = blocosDoEco(texto, { largura: 16 });

  assert.equal(sha256, createHash('sha256').update(texto, 'utf8').digest('hex'));
});

test('remontagem com bloco faltando reprova em vez de devolver JSON truncado', () => {
  const texto = JSON.stringify(snapshot([1, 2, 3]));
  const { blocos } = blocosDoEco(texto, { largura: 16 });

  assert.throws(() => remontarEco(blocos.slice(1)), /bloco/i);
});

test('remontagem com indice repetido reprova', () => {
  const texto = JSON.stringify(snapshot([1, 2, 3]));
  const { blocos } = blocosDoEco(texto, { largura: 16 });

  assert.throws(() => remontarEco([blocos[0], blocos[0], ...blocos.slice(2)]), /bloco/i);
});

test('resumo conta por ferramenta e por severidade', () => {
  const capturado = {
    capturadoEm: '2026-09-22T12:00:00.000Z',
    commitBase: 'abc123',
    snapshot: {
      codeScanning: {
        total: 3,
        alertas: [
          { numero: 1, severidade: 'critical', ferramenta: 'Trivy' },
          { numero: 2, severidade: 'high', ferramenta: 'Trivy' },
          { numero: 3, severidade: 'high', ferramenta: 'CodeQL' },
        ],
      },
      dependabot: { total: 0, alertas: [] },
      secretScanning: { total: 0 },
    },
  };

  const resumo = resumirSnapshot(capturado);

  assert.equal(resumo.codeScanning.total, 3);
  assert.deepEqual(resumo.codeScanning.porSeveridade, { critical: 1, high: 2 });
  assert.deepEqual(resumo.codeScanning.porFerramenta, { Trivy: 2, CodeQL: 1 });
});

test('delta separa alerta que entrou de alerta que saiu', () => {
  const vigente = snapshot([1, 2, 3]);
  const capturado = snapshot([2, 3, 4]);

  const d = delta(capturado, vigente);

  assert.deepEqual(d.novos, [4]);
  assert.deepEqual(d.fechados, [1]);
  assert.deepEqual(d.mantidos, [2, 3]);
});

test('delta sem inventario vigente trata tudo como novo em vez de quebrar', () => {
  const d = delta(snapshot([1, 2]), null);

  assert.deepEqual(d.novos, [1, 2]);
  assert.deepEqual(d.fechados, []);
});

test('piso de sanidade: captura sem codeScanning reprova em vez de resumir zero', () => {
  assert.throws(() => resumirSnapshot({ snapshot: {} }), /codeScanning/);
  assert.throws(() => resumirSnapshot(null), /codeScanning/);
});

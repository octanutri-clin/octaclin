/**
 * O que estes casos protegem.
 *
 * O inventario venceu em 2026-09-20 e travou `main` e 15 PRs de uma vez. Nada
 * avisou antes: `validarInventario` reprova no dia seguinte ao `revisarEm`, e
 * ate la o check fica verde. Este alerta existe para gastar a folga que ainda
 * existe, avisando enquanto ainda da tempo de recapturar.
 *
 * Os casos cobrem as tres formas de ele falhar em silencio: nao avisar dentro
 * da janela, avisar pelo motivo errado (causa ja vencida contada como "no
 * prazo"), e aprovar o vazio quando a leitura quebra. O par dentro/fora da
 * janela existe de proposito -- so ele prova que a fronteira e a data, e nao
 * um retorno fixo.
 *
 * Este alerta NUNCA renova `revisarEm`. Renovar sozinho produziria exatamente
 * o falso verde que o inventario existe para impedir: a data avancaria sem que
 * ninguem olhasse os alertas. Ele so informa.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { causasPorVencer, formatarAviso } from './alertar-vencimento-inventario.mjs';

function inventario(causas) {
  return { causas };
}

function causa(id, revisarEm, extras = {}) {
  return { id, revisarEm, severidadeContextual: 'critical', disposicao: 'mitigado', ...extras };
}

test('avisa a causa que vence dentro da janela', () => {
  const achados = causasPorVencer(inventario([causa('SQ-1', '2026-09-25')]), {
    hoje: new Date('2026-09-22T00:00:00.000Z'),
    dias: 7,
  });

  assert.equal(achados.length, 1);
  assert.equal(achados[0].id, 'SQ-1');
  assert.equal(achados[0].diasRestantes, 3);
  assert.equal(achados[0].vencida, false);
});

test('ignora a causa que vence depois da janela', () => {
  const achados = causasPorVencer(inventario([causa('SQ-1', '2026-09-30')]), {
    hoje: new Date('2026-09-22T00:00:00.000Z'),
    dias: 7,
  });

  assert.deepEqual(achados, []);
});

test('a fronteira e inclusiva: o ultimo dia da janela ainda avisa', () => {
  const dentro = causasPorVencer(inventario([causa('SQ-1', '2026-09-29')]), {
    hoje: new Date('2026-09-22T00:00:00.000Z'),
    dias: 7,
  });
  const fora = causasPorVencer(inventario([causa('SQ-1', '2026-09-30')]), {
    hoje: new Date('2026-09-22T00:00:00.000Z'),
    dias: 7,
  });

  assert.equal(dentro.length, 1, 'exatamente na janela deve avisar');
  assert.equal(fora.length, 0, 'um dia alem da janela nao deve avisar');
});

test('a causa ja vencida aparece marcada, nao some da lista', () => {
  const achados = causasPorVencer(inventario([causa('SQ-1', '2026-09-20')]), {
    hoje: new Date('2026-09-22T00:00:00.000Z'),
    dias: 7,
  });

  assert.equal(achados.length, 1);
  assert.equal(achados[0].vencida, true);
  assert.equal(achados[0].diasRestantes, -2);
});

test('ordena pela urgencia, nao pela ordem do arquivo', () => {
  const achados = causasPorVencer(
    inventario([causa('SQ-TARDE', '2026-09-27'), causa('SQ-CEDO', '2026-09-23')]),
    { hoje: new Date('2026-09-22T00:00:00.000Z'), dias: 7 },
  );

  assert.deepEqual(
    achados.map((a) => a.id),
    ['SQ-CEDO', 'SQ-TARDE'],
  );
});

test('inventario sem causas nao inventa aviso', () => {
  assert.deepEqual(causasPorVencer(inventario([]), { hoje: new Date('2026-09-22T00:00:00.000Z'), dias: 7 }), []);
});

test('piso de sanidade: inventario ilegivel reprova em vez de aprovar o vazio', () => {
  for (const ruim of [null, undefined, {}, { causas: 'nao e lista' }]) {
    assert.throws(
      () => causasPorVencer(ruim, { hoje: new Date('2026-09-22T00:00:00.000Z'), dias: 7 }),
      /causas/,
      `deveria recusar ${JSON.stringify(ruim)}`,
    );
  }
});

test('causa sem revisarEm legivel reprova em vez de ser ignorada', () => {
  assert.throws(
    () => causasPorVencer(inventario([causa('SQ-1', 'nao e data')]), {
      hoje: new Date('2026-09-22T00:00:00.000Z'),
      dias: 7,
    }),
    /SQ-1/,
  );
});

test('o aviso nomeia a causa, o prazo e o que fazer', () => {
  const texto = formatarAviso([
    { id: 'SQ-2026-004', revisarEm: '2026-09-23', diasRestantes: 1, vencida: false, severidadeContextual: 'critical' },
  ]);

  assert.match(texto, /SQ-2026-004/);
  assert.match(texto, /2026-09-23/);
  assert.match(texto, /capturar-inventario-security-quality/);
});

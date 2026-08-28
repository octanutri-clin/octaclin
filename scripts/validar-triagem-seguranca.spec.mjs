import assert from 'node:assert/strict';
import test from 'node:test';

import { carregarEValidarTriagem, validarTriagem } from './validar-triagem-seguranca.mjs';

function casoValido() {
  return {
    schemaVersion: 1,
    repositorio: 'organizacao/repositorio',
    commitBase: 'a'.repeat(40),
    capturadoEm: '2026-08-28T00:00:00Z',
    snapshot: {
      codeScanning: { total: 1, alertas: [10], porFerramenta: { Scanner: 1 } },
      dependabot: { total: 1, alertas: [20] },
      secretScanning: { total: 0 },
    },
    casos: [
      {
        id: 'SEC-001',
        titulo: 'Achado sintetico',
        disposicao: 'confirmado',
        severidade: 'high',
        alertas: [
          { ref: 'code-scanning:10', papel: 'primario' },
          { ref: 'dependabot:20', papel: 'duplicado', duplicadoDe: 'code-scanning:10' },
        ],
        evidencia: { fontes: ['entrada sintetica'], sink: 'efeito sintetico' },
        preCondicoes: ['pre-condicao sintetica'],
        mitigacoes: ['controle parcial sintetico'],
        impacto: 'impacto sintetico',
        conclusao: 'cadeia sintetica confirmada',
        prRemediacao: 'PR 38',
      },
    ],
  };
}

test('aceita ledger completo com duplicata rastreada', () => {
  assert.match(validarTriagem(casoValido()), /2 alertas cobertos/);
});

test('rejeita achado confirmado sem cadeia e PR de remediacao', () => {
  const triagem = casoValido();
  triagem.casos[0].evidencia.sink = '';
  delete triagem.casos[0].prRemediacao;

  assert.throws(() => validarTriagem(triagem), /evidencia\.sink/);
});

test('rejeita alerta omitido no ledger', () => {
  const triagem = casoValido();
  triagem.casos[0].alertas.pop();

  assert.throws(() => validarTriagem(triagem), /cobertura de alertas divergente/);
});

test('rejeita duplicata sem referencia primaria existente', () => {
  const triagem = casoValido();
  triagem.casos[0].alertas[1].duplicadoDe = 'code-scanning:999';

  assert.throws(() => validarTriagem(triagem), /duplicadoDe inexistente/);
});

test('valida o ledger canonico do repositorio', () => {
  assert.match(carregarEValidarTriagem(), /Triagem valida/);
});

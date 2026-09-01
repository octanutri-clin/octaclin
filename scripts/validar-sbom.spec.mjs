import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ECOSSISTEMAS_ESPERADOS,
  compararInventarios,
  normalizarSbom,
  verificarCobertura,
} from './validar-sbom.mjs';

function sbom({ serial = 'urn:uuid:1', timestamp = '2026-09-01T00:00:00Z', componentes }) {
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    serialNumber: serial,
    metadata: { timestamp, tools: [{ name: 'trivy', version: '0.68.0' }] },
    components: componentes,
    dependencies: [{ ref: 'a', dependsOn: ['b'] }],
  };
}

const COMPONENTES = [
  { name: 'next', version: '16.3.3', purl: 'pkg:npm/next@16.3.3', licenses: [{ license: { id: 'MIT' } }] },
  { name: '@nestjs/core', version: '11.2.3', purl: 'pkg:npm/%40nestjs/core@11.2.3' },
  { name: 'fastapi', version: '0.141.1', purl: 'pkg:pypi/fastapi@0.141.1' },
  { name: 'expo', version: '57.0.15', purl: 'pkg:npm/expo@57.0.15' },
];

test('normaliza campos nao deterministicos', () => {
  const a = normalizarSbom(sbom({ serial: 'urn:uuid:1', timestamp: '2026-09-01T00:00:00Z', componentes: COMPONENTES }));
  const b = normalizarSbom(sbom({ serial: 'urn:uuid:2', timestamp: '2026-09-02T10:11:12Z', componentes: COMPONENTES }));
  assert.deepEqual(a, b);
});

test('normalizacao independe da ordem dos componentes', () => {
  const a = normalizarSbom(sbom({ componentes: COMPONENTES }));
  const b = normalizarSbom(sbom({ componentes: [...COMPONENTES].reverse() }));
  assert.deepEqual(a, b);
});

test('duas execucoes com o mesmo inventario sao consideradas reproduziveis', () => {
  const resultado = compararInventarios(sbom({ componentes: COMPONENTES }), sbom({ serial: 'urn:uuid:9', componentes: COMPONENTES }));
  assert.equal(resultado.reproduzivel, true);
});

test('diferenca semantica reprova a reproducao', () => {
  const outros = [...COMPONENTES.slice(1), { name: 'next', version: '16.3.4', purl: 'pkg:npm/next@16.3.4' }];
  const resultado = compararInventarios(sbom({ componentes: COMPONENTES }), sbom({ componentes: outros }));
  assert.equal(resultado.reproduzivel, false);
  assert.match(resultado.mensagem, /next/);
});

test('mudanca de licenca conhecida tambem reprova', () => {
  const outros = COMPONENTES.map((c) =>
    c.name === 'next' ? { ...c, licenses: [{ license: { id: 'Apache-2.0' } }] } : c
  );
  assert.equal(compararInventarios(sbom({ componentes: COMPONENTES }), sbom({ componentes: outros })).reproduzivel, false);
});

test('cobertura exige um componente conhecido de cada ecossistema', () => {
  assert.equal(verificarCobertura(sbom({ componentes: COMPONENTES })).aprovado, true);
});

test('desaparecimento de um ecossistema inteiro reprova a cobertura', () => {
  const semPython = COMPONENTES.filter((c) => !c.purl.startsWith('pkg:pypi/'));
  const resultado = verificarCobertura(sbom({ componentes: semPython }));
  assert.equal(resultado.aprovado, false);
  assert.match(resultado.mensagem, /ai-service/);
});

test('os ecossistemas esperados cobrem backend, web, mobile e ai-service', () => {
  assert.deepEqual(
    ECOSSISTEMAS_ESPERADOS.map((e) => e.componente).sort(),
    ['octaclin-ai-service', 'octaclin-backend', 'octaclin-mobile', 'octaclin-web']
  );
});

test('sbom sem componentes reprova', () => {
  assert.equal(verificarCobertura(sbom({ componentes: [] })).aprovado, false);
});

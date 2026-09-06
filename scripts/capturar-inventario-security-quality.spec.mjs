import assert from 'node:assert/strict';
import test from 'node:test';

import {
  capturarInventario,
  consultarPaginasGh,
  criarSnapshot,
  normalizarCodeScanning,
  normalizarDependabot,
} from './capturar-inventario-security-quality.mjs';

test('normaliza Code Scanning sem copiar mensagem ou help inseguro', () => {
  const [alerta] = normalizarCodeScanning([{
    number: 396,
    tool: { name: 'Trivy' },
    rule: { id: 'CVE-2026-78410', security_severity_level: 'high', severity: 'error' },
    most_recent_instance: {
      category: 'trivy-imagem-ia-service',
      location: { path: 'library/octaclin-ia-service' },
      message: { text: 'Package: util-linux\nInstalled Version: 2.41.5\nFixed Version: ' },
    },
  }]);

  assert.deepEqual(alerta, {
    numero: 396,
    ferramenta: 'Trivy',
    regra: 'CVE-2026-78410',
    categoria: 'trivy-imagem-ia-service',
    caminho: 'library/octaclin-ia-service',
    pacote: 'util-linux',
    versaoInstalada: '2.41.5',
    versaoCorrigida: null,
    severidade: 'high',
    severidadeQualidade: 'error',
  });
  assert.equal('message' in alerta, false);
  assert.equal('help' in alerta, false);
});

test('normaliza Dependabot com a primeira versao corrigida, sem campos extras', () => {
  const [alerta] = normalizarDependabot([{
    number: 42,
    dependency: {
      package: { ecosystem: 'npm', name: 'image-size' },
      manifest_path: 'octaclin-mobile/pnpm-lock.yaml',
    },
    security_advisory: { ghsa_id: 'GHSA-aaaa-bbbb-cccc', description: 'detalhe descartado' },
    security_vulnerability: {
      severity: 'high',
      first_patched_version: { identifier: '1.2.3' },
    },
  }]);

  assert.deepEqual(alerta, {
    numero: 42,
    advisory: 'GHSA-aaaa-bbbb-cccc',
    severidade: 'high',
    ecossistema: 'npm',
    pacote: 'image-size',
    manifesto: 'octaclin-mobile/pnpm-lock.yaml',
    versaoCorrigida: '1.2.3',
  });
  assert.equal('description' in alerta, false);
});

test('usa null para detalhes de pacote fora do formato Trivy e patch ausente', () => {
  const [codeScanning] = normalizarCodeScanning([{
    number: 8,
    tool: { name: 'Semgrep OSS' },
    rule: { id: 'regra', security_severity_level: 'none', severity: 'warning' },
    most_recent_instance: {
      category: 'semgrep',
      location: { path: 'src/exemplo.ts' },
      message: { text: 'conteudo que nao pode ser copiado' },
    },
  }]);
  const [dependabot] = normalizarDependabot([{
    number: 7,
    dependency: { package: { ecosystem: 'npm', name: 'sem-patch' }, manifest_path: 'pnpm-lock.yaml' },
    security_advisory: { ghsa_id: 'GHSA-dddd-eeee-ffff' },
    security_vulnerability: { severity: 'medium', first_patched_version: null },
  }]);

  assert.deepEqual(
    { pacote: codeScanning.pacote, versaoInstalada: codeScanning.versaoInstalada, versaoCorrigida: codeScanning.versaoCorrigida },
    { pacote: null, versaoInstalada: null, versaoCorrigida: null },
  );
  assert.equal(dependabot.versaoCorrigida, null);
});

test('ordena alertas por numero crescente e agrupa por ferramenta', () => {
  const snapshot = criarSnapshot({
    codeScanning: [
      { numero: 20, ferramenta: 'Semgrep OSS' },
      { numero: 10, ferramenta: 'Trivy' },
      { numero: 11, ferramenta: 'Trivy' },
    ],
    dependabot: [
      { numero: 9 },
      { numero: 2 },
    ],
    secretScanning: [],
    commitBase: 'a'.repeat(40),
    capturadoEm: '2026-09-06T12:00:00.000Z',
  });

  assert.deepEqual(snapshot.codeScanning.alertas.map(({ numero }) => numero), [10, 11, 20]);
  assert.deepEqual(snapshot.codeScanning.porFerramenta, { 'Semgrep OSS': 1, Trivy: 2 });
  assert.deepEqual(snapshot.dependabot.alertas.map(({ numero }) => numero), [2, 9]);
});

test('secret scanning persiste somente o total', () => {
  const snapshot = criarSnapshot({
    codeScanning: [],
    dependabot: [],
    secretScanning: [],
    commitBase: 'a'.repeat(40),
    capturadoEm: '2026-09-06T12:00:00.000Z',
  });

  assert.deepEqual(snapshot.secretScanning, { total: 0 });
});

test('secret scanning ativo interrompe sem serializar segredo', () => {
  assert.throws(
    () => criarSnapshot({
      codeScanning: [],
      dependabot: [],
      secretScanning: [{ number: 9, secret: 'valor-que-nao-pode-sair' }],
      commitBase: 'a'.repeat(40),
      capturadoEm: '2026-09-06T12:00:00.000Z',
    }),
    (erro) => erro.message.includes('1 alerta de Secret Scanning') && !erro.message.includes('valor-que-nao-pode-sair'),
  );
});

test('captura imprime o envelope sem causas e deixa metadados fora do snapshot', () => {
  const respostas = new Map([
    ['/repos/octanutri-clin/octaclin/branches/main', [{ commit: { sha: 'a'.repeat(40) } }]],
    ['/repos/octanutri-clin/octaclin/code-scanning/alerts?state=open&per_page=100', []],
    ['/repos/octanutri-clin/octaclin/dependabot/alerts?state=open&per_page=100', []],
    ['/repos/octanutri-clin/octaclin/secret-scanning/alerts?state=open&per_page=100', []],
  ]);
  const envelope = capturarInventario({
    executar(_comando, argumentos) {
      return { status: 0, stdout: JSON.stringify([respostas.get(argumentos.at(-1))]) };
    },
    agora: () => '2026-09-06T12:00:00.000Z',
  });

  assert.deepEqual(envelope, {
    schemaVersion: 1,
    repositorio: 'octanutri-clin/octaclin',
    commitBase: 'a'.repeat(40),
    capturadoEm: '2026-09-06T12:00:00.000Z',
    snapshot: {
      codeScanning: { total: 0, alertas: [], porFerramenta: {} },
      dependabot: { total: 0, alertas: [] },
      secretScanning: { total: 0 },
    },
  });
  assert.equal('causas' in envelope, false);
});

test('consulta paginas por argumentos separados e sem shell', () => {
  const endpoint = '/repos/octanutri-clin/octaclin/code-scanning/alerts?state=open&per_page=100';
  let chamada;
  const resultado = consultarPaginasGh(endpoint, {
    executar(comando, argumentos, opcoes) {
      chamada = { comando, argumentos, opcoes };
      return { status: 0, stdout: '[[{"number": 1}], [{"number": 2}]]' };
    },
  });

  assert.deepEqual(chamada, {
    comando: 'gh',
    argumentos: ['api', '--paginate', '--slurp', endpoint],
    opcoes: { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  });
  assert.deepEqual(resultado, [{ number: 1 }, { number: 2 }]);
});

test('rejeita endpoint fora da allowlist antes de executar gh', () => {
  assert.throws(
    () => consultarPaginasGh('/user', { executar: () => assert.fail('nao deve executar') }),
    /endpoint nao permitido/,
  );
});

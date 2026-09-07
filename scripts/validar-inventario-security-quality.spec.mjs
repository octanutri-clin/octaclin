import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { carregarEValidarInventario, validarInventario } from './validar-inventario-security-quality.mjs';

const HOJE = new Date('2026-09-06T00:00:00.000Z');

function inventarioValido() {
  return {
    schemaVersion: 1,
    repositorio: 'octanutri-clin/octaclin',
    commitBase: 'a'.repeat(40),
    capturadoEm: '2026-09-06T12:00:00.000Z',
    snapshot: {
      codeScanning: {
        total: 2,
        alertas: [
          { numero: 10, ferramenta: 'Trivy', regra: 'CVE-2026-0001', categoria: 'trivy-imagem-web', caminho: 'library/octaclin-web', pacote: 'libssl3', versaoInstalada: '1.0.0', versaoCorrigida: '1.0.1', severidade: 'high' },
          { numero: 11, ferramenta: 'Semgrep OSS', regra: 'javascript.lang.security.audit.example', categoria: 'semgrep', caminho: 'src/exemplo.spec.ts', pacote: null, versaoInstalada: null, versaoCorrigida: null, severidade: 'none' },
        ],
        porFerramenta: { Trivy: 1, 'Semgrep OSS': 1 },
      },
      dependabot: {
        total: 1,
        alertas: [{ numero: 20, advisory: 'GHSA-aaaa-bbbb-cccc', severidade: 'high', ecossistema: 'npm', pacote: 'image-size', manifesto: 'octaclin-mobile/pnpm-lock.yaml', versaoCorrigida: null }],
      },
      secretScanning: { total: 0 },
    },
    causas: [
      { id: 'SQ-2026-001', titulo: 'Base Alpine com OpenSSL corrigivel', alertas: ['code-scanning:10'], disposicao: 'corrigir', severidadeContextual: 'high', owner: 'octanutri-clin/octaclin', revisarEm: '2026-09-13', ondaDestino: 'SQ-1A', evidencia: ['Dockerfile da imagem final e mensagem do Trivy'], preCondicoes: ['a imagem final contem o pacote vulneravel'], mitigacoes: ['runtime non-root e read-only'], impacto: 'biblioteca vulneravel presente no artefato final', condicaoSaida: 'novo scan da main fecha todos os alertas agrupados' },
      { id: 'SQ-2026-002', titulo: 'Regra Semgrep exige analise fonte-sink', alertas: ['code-scanning:11'], disposicao: 'investigar', severidadeContextual: 'informational', owner: 'octanutri-clin/octaclin', revisarEm: '2026-09-13', ondaDestino: 'SQ-3', evidencia: ['alerta Semgrep no arquivo e linha informados'], preCondicoes: ['entrada precisa ser controlavel para existir cadeia'], mitigacoes: ['nenhuma conclusao antes da leitura do call site'], impacto: 'nao classificado nesta onda; SQ-3 mede alcance antes de qualquer encerramento', condicaoSaida: 'corrigir com teste negativo ou classificar com evidencia' },
      { id: 'SQ-2026-003', titulo: 'image-size sem patch no Mobile bloqueado', alertas: ['dependabot:20'], disposicao: 'aguardando_upstream', severidadeContextual: 'high', owner: 'octanutri-clin/octaclin', revisarEm: '2026-12-01', ondaDestino: 'SQ-3', excecao: 'SC-2026-005', evidencia: ['advisory sem first patched version'], preCondicoes: ['asset malicioso precisa entrar no Metro em build'], mitigacoes: ['Mobile NO-GO para distribuicao'], impacto: 'negacao de servico do toolchain Mobile', condicaoSaida: 'upstream publica versao corrigida alcancavel pelo Metro' },
    ],
  };
}

test('aceita inventario com cobertura exata e destinos revisaveis', () => {
  assert.match(validarInventario(inventarioValido(), { hoje: HOJE }), /3 alertas cobertos/);
});

test('rejeita alerta omitido', () => {
  const inventario = inventarioValido();
  inventario.causas[0].alertas = [];
  assert.throws(() => validarInventario(inventario, { hoje: HOJE }), /cobertura/);
});

test('rejeita alerta atribuido a duas causas', () => {
  const inventario = inventarioValido();
  inventario.causas[1].alertas.push('code-scanning:10');
  assert.throws(() => validarInventario(inventario, { hoje: HOJE }), /mais de uma causa/);
});

test('rejeita causa sem owner, destino ou revisao vigente', () => {
  for (const campo of ['owner', 'ondaDestino', 'revisarEm']) {
    const inventario = inventarioValido();
    inventario.causas[0][campo] = '';
    assert.throws(() => validarInventario(inventario, { hoje: HOJE }), new RegExp(campo));
  }
  const vencido = inventarioValido();
  vencido.causas[0].revisarEm = '2026-09-05';
  assert.throws(() => validarInventario(vencido, { hoje: HOJE }), /vencida/);
});

test('secret scanning ativo exige incidente e nao entra no inventario', () => {
  const inventario = inventarioValido();
  inventario.snapshot.secretScanning.total = 1;
  assert.throws(() => validarInventario(inventario, { hoje: HOJE }), /resposta a incidente/);
});

for (const fonte of ['codeScanning', 'dependabot']) {
  test(`rejeita total divergente em ${fonte}`, () => {
    const inventario = inventarioValido();
    inventario.snapshot[fonte].total += 1;
    assert.throws(() => validarInventario(inventario, { hoje: HOJE }), /total precisa ser igual/);
  });
}

for (const porFerramenta of [
  { Trivy: 2, 'Semgrep OSS': 1 },
  { Trivy: 1 },
  { Trivy: 1, 'Semgrep OSS': 1, Desconhecida: 0 },
  { Trivy: 1, Desconhecida: 1 },
]) {
  test(`rejeita porFerramenta divergente: ${JSON.stringify(porFerramenta)}`, () => {
    const inventario = inventarioValido();
    inventario.snapshot.codeScanning.porFerramenta = porFerramenta;
    assert.throws(() => validarInventario(inventario, { hoje: HOJE }), /porFerramenta nao corresponde/);
  });
}

test('rejeita IDs de causas duplicados mesmo com alertas distintos', () => {
  const inventario = inventarioValido();
  inventario.causas[1].id = inventario.causas[0].id;
  assert.throws(() => validarInventario(inventario, { hoje: HOJE }), /id duplicado/);
});

for (const data of ['2027-02-29', '2026-09-31', '2026-13-01']) {
  test(`rejeita data de revisao impossivel: ${data}`, () => {
    const inventario = inventarioValido();
    inventario.causas[0].revisarEm = data;
    assert.throws(() => validarInventario(inventario, { hoje: HOJE }), /revisarEm contem data invalida/);
  });
}

test('aguardando_upstream rejeita alerta que ja possui versao corrigida', () => {
  const inventario = inventarioValido();
  inventario.snapshot.dependabot.alertas[0].versaoCorrigida = '2.0.0';
  assert.throws(() => validarInventario(inventario, { hoje: HOJE }), /aguardando_upstream exige versaoCorrigida: null/);
});

for (const justificativa of [undefined, null, '', '   ', 123]) {
  test(`corrigir sem patch rejeita correcaoSemBump invalida: ${JSON.stringify(justificativa)}`, () => {
    const inventario = inventarioValido();
    inventario.snapshot.codeScanning.alertas[0].versaoCorrigida = null;
    inventario.causas[0].correcaoSemBump = justificativa;
    assert.throws(() => validarInventario(inventario, { hoje: HOJE }), /corrigir exige versao corrigida ou justificativa correcaoSemBump/);
  });
}

test('corrigir sem patch aceita justificativa de remocao da superficie', () => {
  const inventario = inventarioValido();
  inventario.snapshot.codeScanning.alertas[0].versaoCorrigida = null;
  inventario.causas[0].correcaoSemBump = 'Remover o componente vulneravel da imagem final.';
  assert.match(validarInventario(inventario, { hoje: HOJE }), /3 alertas cobertos/);
});

test('rejeita campos incompletos ou com tipo errado em Code Scanning', () => {
  for (const campo of ['numero', 'ferramenta', 'regra', 'categoria', 'caminho', 'severidade']) {
    const inventario = inventarioValido();
    inventario.snapshot.codeScanning.alertas[0][campo] = null;
    assert.throws(() => validarInventario(inventario, { hoje: HOJE }), new RegExp(campo));
  }
  for (const campo of ['pacote', 'versaoInstalada', 'versaoCorrigida']) {
    const inventario = inventarioValido();
    inventario.snapshot.codeScanning.alertas[0][campo] = 123;
    assert.throws(() => validarInventario(inventario, { hoje: HOJE }), new RegExp(campo));
  }
});

test('rejeita campos incompletos ou com tipo errado em Dependabot', () => {
  for (const campo of ['numero', 'advisory', 'severidade', 'ecossistema', 'pacote', 'manifesto']) {
    const inventario = inventarioValido();
    inventario.snapshot.dependabot.alertas[0][campo] = null;
    assert.throws(() => validarInventario(inventario, { hoje: HOJE }), new RegExp(campo));
  }
  const inventario = inventarioValido();
  inventario.snapshot.dependabot.alertas[0].versaoCorrigida = 123;
  assert.throws(() => validarInventario(inventario, { hoje: HOJE }), /versaoCorrigida/);
});

const INVENTARIO_REAL = new URL('../docs/governance/inventario-security-quality.json', import.meta.url);

test('valida estrutura e cobertura do inventario real na data da captura', () => {
  assert.match(carregarEValidarInventario(undefined, { hoje: HOJE }), /240 alertas cobertos/);
});

for (const [data, status, mensagem] of [
  ['2026-09-13T23:59:59.999Z', 0, /240 alertas cobertos/],
  ['2026-09-14T00:00:00.000Z', 1, /SQ-2026-139 esta com revisao vencida/],
]) {
  test(`CLI do gate de CI aplica o relogio corrente em ${data}`, () => {
    const pacote = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const comando = 'node scripts/validar-inventario-security-quality.mjs';
    assert.ok(pacote.scripts['test:inventario-security-quality'].split(' && ').includes(comando),
      'o comando consumido pelo CI precisa executar a CLI com o relogio corrente');
    const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
    assert.match(workflow, /run: pnpm test:inventario-security-quality\s/);
    const relogio = `import { mock } from 'node:test'; mock.timers.enable({ apis: ['Date'], now: new Date('${data}') });`;
    const resultado = spawnSync(process.execPath, [
      '--import', `data:text/javascript,${encodeURIComponent(relogio)}`,
      comando.slice('node '.length),
    ], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
    assert.ifError(resultado.error);
    assert.equal(resultado.signal, null);
    assert.equal(resultado.status, status, resultado.stderr);
    assert.match(status === 0 ? resultado.stdout : resultado.stderr, mensagem);
  });
}

for (const [mutacao, mensagem] of [
  ['omissao', /cobertura de alertas precisa ser exata/],
  ['duplicacao', /alerta em mais de uma causa/],
]) {
  test(`arquivo real com ${mutacao} falha em processo separado`, () => {
    const original = readFileSync(INVENTARIO_REAL, 'utf8');
    const inventario = JSON.parse(original);
    if (mutacao === 'omissao') inventario.causas[0].alertas.pop();
    else inventario.causas[1].alertas.push(inventario.causas[0].alertas[0]);

    const diretorio = mkdtempSync(join(tmpdir(), 'octaclin-sq0-mutacao-'));
    const caminho = join(diretorio, 'inventario.json');
    try {
      writeFileSync(caminho, JSON.stringify(inventario), 'utf8');
      const modulo = new URL('./validar-inventario-security-quality.mjs', import.meta.url).href;
      const resultado = spawnSync(process.execPath, [
        '--input-type=module', '-e',
        `import { carregarEValidarInventario } from ${JSON.stringify(modulo)};
         carregarEValidarInventario(process.argv[1], { hoje: new Date('2026-09-06T00:00:00.000Z') });`,
        caminho,
      ], { encoding: 'utf8' });
      assert.ifError(resultado.error);
      assert.equal(resultado.signal, null);
      assert.equal(resultado.status, 1, resultado.stderr);
      assert.match(resultado.stderr, mensagem);
    } finally {
      unlinkSync(caminho);
      rmdirSync(diretorio);
    }
    assert.equal(readFileSync(INVENTARIO_REAL, 'utf8'), original, 'inventario canonico preservado');
  });
}

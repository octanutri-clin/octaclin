import assert from 'node:assert/strict';
import test from 'node:test';

import { validarInventario } from './validar-inventario-security-quality.mjs';

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

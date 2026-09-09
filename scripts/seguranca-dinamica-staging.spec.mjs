import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  LIMITE_REQUISICOES_ATIVAS,
  criarOrcamentoRequisicoes,
  resumirRelatorioZap,
  validarAutorizacaoStaging,
  validarFalsosPositivos,
} from './seguranca-dinamica-staging.mjs';

const autorizacaoValida = {
  webUrl: 'http://127.0.0.1:3000',
  apiUrl: 'http://127.0.0.1:3001',
  confirmacao: 'DAST-FUZZ-STAGING-DESCARTAVEL',
  confirmarRemoto: 'SIM',
  eventoGithub: 'workflow_dispatch',
};

test('aceita somente a execucao manual contra os dois alvos loopback esperados', () => {
  assert.deepEqual(validarAutorizacaoStaging(autorizacaoValida), {
    apiOrigin: 'http://127.0.0.1:3001',
    webOrigin: 'http://127.0.0.1:3000',
  });
});

for (const alteracao of [
  { webUrl: 'https://app.octaclin.example' },
  { apiUrl: 'http://localhost:3001' },
  { apiUrl: 'http://127.0.0.1:3001/admin' },
  { confirmacao: 'SIM' },
  { confirmarRemoto: 'NAO' },
  { eventoGithub: 'push' },
]) {
  test(`falha fechada para alvo ou autorizacao divergente: ${JSON.stringify(alteracao)}`, () => {
    assert.throws(
      () => validarAutorizacaoStaging({ ...autorizacaoValida, ...alteracao }),
      /execucao dinamica recusada/i,
    );
  });
}

test('orcamento impede exceder o teto e mantem execucao serial', () => {
  const orcamento = criarOrcamentoRequisicoes(2);
  assert.equal(orcamento.consumir('primeira'), 1);
  assert.equal(orcamento.consumir('segunda'), 2);
  assert.throws(() => orcamento.consumir('terceira'), /orcamento de requisicoes excedido/i);
  assert.equal(orcamento.usadas, 2);
  assert.equal(LIMITE_REQUISICOES_ATIVAS, 30);
});

test('rejeita pedido de orcamento acima do limite global', () => {
  assert.throws(
    () => criarOrcamentoRequisicoes(LIMITE_REQUISICOES_ATIVAS + 1),
    /orcamento invalido/i,
  );
});

const relatorioSemAlto = {
  site: [{
    '@name': 'http://127.0.0.1:3000',
    alerts: [
      {
        pluginid: '10038',
        name: 'Content Security Policy Header Not Set',
        riskcode: '2',
        confidence: '2',
        instances: [{
          uri: 'http://127.0.0.1:3000/login?token=segredo-que-nao-pode-sair',
          method: 'GET',
          evidence: 'cabecalho sensivel',
          attack: '<script>alert(1)</script>',
          param: 'token',
        }],
      },
    ],
  }],
};

test('sanitiza o relatorio ZAP e aprova quando nao ha high', () => {
  const resumo = resumirRelatorioZap(relatorioSemAlto, { schemaVersion: 1, exceptions: [] });
  assert.equal(resumo.aprovado, true);
  assert.deepEqual(resumo.totais, { informativo: 0, baixo: 0, medio: 1, alto: 0 });
  assert.deepEqual(resumo.alertas, [{
    alertaId: '10038',
    nome: 'Content Security Policy Header Not Set',
    risco: 'medio',
    confianca: '2',
    ocorrencias: 1,
    decisao: 'triagem_pendente',
  }]);
  const serializado = JSON.stringify(resumo);
  for (const proibido of ['segredo-que-nao-pode-sair', '"evidence":', '"attack":', '"param":', '"uri":']) {
    assert.equal(serializado.includes(proibido), false, `resumo nao pode conter ${proibido}`);
  }
});

test('reprova quando o ZAP encontra alerta high sem decisao documentada', () => {
  const relatorio = structuredClone(relatorioSemAlto);
  relatorio.site[0].alerts[0].riskcode = '3';
  const resumo = resumirRelatorioZap(relatorio, { schemaVersion: 1, exceptions: [] });
  assert.equal(resumo.aprovado, false);
  assert.equal(resumo.bloqueios.length, 1);
  assert.equal(resumo.bloqueios[0].alertaId, '10038');
});

test('falso positivo high exige correspondencia exata, evidencia, owner e prazo vigente', () => {
  const relatorio = structuredClone(relatorioSemAlto);
  relatorio.site[0].alerts[0].riskcode = '3';
  const ledger = {
    schemaVersion: 1,
    exceptions: [{
      id: 'FP-PR54-001',
      zapPluginId: '10038',
      path: '/login',
      decision: 'false_positive',
      justification: 'O cabecalho e aplicado pelo proxy depois desta camada de teste.',
      evidence: 'docs/governance/RELATORIO_SEGURANCA_PR54_2026-09-08.md#falsos-positivos',
      owner: '@octanutri-clin/security',
      expiresOn: '2026-10-08',
    }],
  };
  assert.doesNotThrow(() => validarFalsosPositivos(ledger, new Date('2026-09-08T00:00:00Z')));
  const resumo = resumirRelatorioZap(relatorio, ledger, new Date('2026-09-08T00:00:00Z'));
  assert.equal(resumo.aprovado, true);
  assert.equal(resumo.alertas[0].decisao, 'falso_positivo_documentado');
  assert.deepEqual(resumo.alertas[0].excecoesIds, ['FP-PR54-001']);
});

test('nao suprime um alerta inteiro quando apenas parte dos caminhos tem evidencia', () => {
  const relatorio = structuredClone(relatorioSemAlto);
  relatorio.site[0].alerts[0].riskcode = '3';
  relatorio.site[0].alerts[0].instances.push({ uri: 'http://127.0.0.1:3000/area-interna' });
  const ledger = {
    schemaVersion: 1,
    exceptions: [{
      id: 'FP-PR54-001',
      zapPluginId: '10038',
      path: '/login',
      decision: 'false_positive',
      justification: 'O cabecalho e aplicado pelo proxy depois desta camada de teste.',
      evidence: 'docs/governance/RELATORIO_SEGURANCA_PR54_2026-09-08.md#falsos-positivos',
      owner: '@octanutri-clin/security',
      expiresOn: '2026-10-08',
    }],
  };
  const resumo = resumirRelatorioZap(relatorio, ledger, new Date('2026-09-08T00:00:00Z'));
  assert.equal(resumo.aprovado, false);
  assert.equal(resumo.alertas[0].decisao, 'triagem_pendente');
});

test('rejeita falso positivo expirado ou sem justificativa verificavel', () => {
  const ledger = {
    schemaVersion: 1,
    exceptions: [{
      id: 'FP-PR54-001',
      zapPluginId: '10038',
      path: '/login',
      decision: 'false_positive',
      justification: 'curta',
      evidence: 'sem-evidencia',
      owner: '',
      expiresOn: '2026-09-01',
    }],
  };
  assert.throws(
    () => validarFalsosPositivos(ledger, new Date('2026-09-08T00:00:00Z')),
    /ledger de falsos positivos invalido/i,
  );
});

test('falha fechada para relatorio ZAP malformado', () => {
  assert.throws(
    () => resumirRelatorioZap({ site: 'invalido' }, { schemaVersion: 1, exceptions: [] }),
    /relatorio ZAP invalido/i,
  );
});

test('workflow mantem ZAP passivo, versionado por digest e publica apenas resumos sanitizados', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/staging-e2e-mutavel.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /executar_seguranca_dinamica:/);
  assert.match(workflow, /DAST-FUZZ-STAGING-DESCARTAVEL/);
  assert.match(
    workflow,
    /ghcr\.io\/zaproxy\/zaproxy:2\.17\.0@sha256:[0-9a-f]{64}/,
  );
  assert.match(workflow, /zap-baseline\.py[^\n]*-t "\$E2E_WEB_URL" -m 1 -T 5 -I/);
  assert.doesNotMatch(workflow, /zap-full-scan|zap-api-scan/);
  assert.match(workflow, /ZAP_WORK_DIR="\$RUNNER_TEMP\/pr54-zap-\$GITHUB_RUN_ID"/);
  assert.match(workflow, /install -d -m 0777 "\$ZAP_WORK_DIR"/);
  assert.match(workflow, /-v "\$ZAP_WORK_DIR:\/zap\/wrk\/:rw"/);
  assert.doesNotMatch(workflow, /-v "\$PWD:\/zap\/wrk/);
  assert.match(workflow, /"\$ZAP_WORK_DIR\/\.pr54-zap-report\.json"/);
  assert.match(workflow, /path: artifacts\/security/);
  assert.doesNotMatch(workflow, /path:[^\n]*\.pr54-zap-report\.json/);
});

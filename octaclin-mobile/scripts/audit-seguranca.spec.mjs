import assert from 'node:assert/strict';
import test from 'node:test';

import { avaliarAuditoria } from './audit-seguranca-lib.mjs';

function advisory({ id, ghsa, versao = '1.2.1', modulo = 'image-size' }) {
  return {
    id,
    github_advisory_id: ghsa,
    module_name: modulo,
    severity: 'high',
    patched_versions: '<0.0.0',
    recommendation: 'None',
    findings: [{ version: versao, paths: [`. > metro@0.84.4 > ${modulo}@${versao}`] }],
  };
}

function relatorioPermitido() {
  return {
    advisories: {
      1138808: advisory({ id: 1138808, ghsa: 'GHSA-w3rx-r6r6-pgpr' }),
      1138809: advisory({ id: 1138809, ghsa: 'GHSA-5p2g-fcmc-qvqq' }),
    },
    muted: [],
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 2, critical: 0 } },
  };
}

test('aprova auditoria sem vulnerabilidades', () => {
  const relatorio = {
    advisories: {},
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 } },
  };
  assert.equal(avaliarAuditoria(relatorio).aprovado, true);
});

test('reprova relatorio malformado ou erro de rede', () => {
  assert.equal(avaliarAuditoria({ advisories: {} }).aprovado, false);
  assert.equal(avaliarAuditoria({ error: { message: 'indisponivel' } }).aprovado, false);
});

test('aprova somente as duas excecoes upstream exatas', () => {
  const resultado = avaliarAuditoria(relatorioPermitido());
  assert.equal(resultado.aprovado, true);
  assert.deepEqual(resultado.excecoes.sort(), ['GHSA-5p2g-fcmc-qvqq', 'GHSA-w3rx-r6r6-pgpr']);
});

test('reprova vulnerabilidade nova', () => {
  const relatorio = relatorioPermitido();
  relatorio.advisories.nova = advisory({ id: 999999, ghsa: 'GHSA-nova-vulnerabilidade' });
  relatorio.metadata.vulnerabilities.high = 3;
  assert.equal(avaliarAuditoria(relatorio).aprovado, false);
});

test('reprova mudanca de versao ou caminho da excecao', () => {
  const relatorio = relatorioPermitido();
  relatorio.advisories[1138808].findings[0].version = '1.2.2';
  assert.equal(avaliarAuditoria(relatorio).aprovado, false);
});

test('reprova avisos silenciados', () => {
  const relatorio = relatorioPermitido();
  relatorio.muted = [{ id: 123 }];
  assert.equal(avaliarAuditoria(relatorio).aprovado, false);
});

import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { classificarImpacto, parseNameStatus } from './classificar-impacto-pr.mjs';

const mapping = {
  'rollout-seguro': true,
  'operacao-lancamento': true,
  governanca: true,
  backend: 'backend',
  web: 'web',
  mobile: 'mobile',
  'ai-service': 'ai',
  'demo-smoke': 'demo'
};

export function validarPrGate(impact, results, independentlyChangedFiles) {
  const errors = [];
  const rows = [];
  if (!impact || typeof impact !== 'object' || typeof results !== 'object' || !results) return { ok: false, errors: ['Classificacao ou resultados ausentes'], rows };
  for (const key of ['backend', 'web', 'mobile', 'ai', 'demo', 'full', 'governance', 'security', 'dependency_review']) {
    if (typeof impact[key] !== 'boolean') errors.push(`Classificacao invalida: ${key}`);
  }
  if (!Array.isArray(impact.files) || !Array.isArray(impact.rules) || !Array.isArray(impact.unrecognized)) errors.push('Metadados da classificacao ausentes');
  if (independentlyChangedFiles !== undefined) {
    if (!Array.isArray(independentlyChangedFiles) || !Array.isArray(impact.files)) errors.push('Diff independente indisponivel');
    else {
      const expectedFiles = [...new Set(independentlyChangedFiles)].sort();
      const reportedFiles = [...new Set(impact.files)].sort();
      if (JSON.stringify(expectedFiles) !== JSON.stringify(reportedFiles)) errors.push('Lista de arquivos difere do diff independente');
    }
  }
  if (Array.isArray(impact.files)) {
    const expected = classificarImpacto(impact.files);
    for (const key of ['backend', 'web', 'mobile', 'ai', 'demo', 'full', 'governance', 'security', 'dependency_review']) {
      if (impact[key] !== expected[key]) errors.push(`Classificacao inconsistente com arquivos: ${key}`);
    }
    if (JSON.stringify(impact.unrecognized) !== JSON.stringify(expected.unrecognized)) errors.push('Arquivos nao reconhecidos inconsistentes');
  }
  if (results['detectar-impacto'] !== 'success') errors.push(`detectar-impacto: ${results['detectar-impacto'] ?? 'ausente'}`);
  for (const job of Object.keys(results)) {
    if (job !== 'detectar-impacto' && !Object.hasOwn(mapping, job)) errors.push(`Job nao previsto no PR Gate: ${job}`);
  }
  for (const [job, flag] of Object.entries(mapping)) {
    const required = flag === true || impact.full === true || impact[flag] === true;
    const actual = results[job];
    rows.push({ job, required, actual: actual ?? 'ausente' });
    if (required && actual !== 'success') errors.push(`${job} necessario: ${actual ?? 'ausente'}`);
    if (!required && actual !== 'skipped') errors.push(`${job} N/A deveria ser skipped: ${actual ?? 'ausente'}`);
  }
  if (impact.demo && !impact.web) errors.push('Demo exige Web');
  if (impact.full && ['backend', 'web', 'mobile', 'ai', 'demo'].some((key) => !impact[key])) errors.push('full incompleto');
  return { ok: errors.length === 0, errors, rows };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const event = process.env.EVENT_NAME;
    if (!['pull_request', 'push', 'workflow_dispatch'].includes(event)) throw new Error('Evento GitHub ausente ou desconhecido');
    const impact = JSON.parse(process.env.CLASSIFICATION_JSON ?? 'null');
    const needs = JSON.parse(process.env.NEEDS_JSON ?? 'null');
    const results = Object.fromEntries(Object.entries(needs ?? {}).map(([job, value]) => [job, value?.result]));
    let changedFiles;
    if (event === 'pull_request') {
      const base = process.env.BASE_SHA ?? '';
      const head = process.env.HEAD_SHA ?? '';
      if (!/^[a-f0-9]{40}$/.test(base) || !/^[a-f0-9]{40}$/.test(head)) throw new Error('SHA base/head ausente ou invalido no PR Gate');
      changedFiles = parseNameStatus(execFileSync('git', ['diff', '--name-status', '-z', '--find-renames', base, head, '--'], { maxBuffer: 16 * 1024 * 1024 }));
    } else if (impact?.full !== true) throw new Error('Push ou dispatch exige full=true');
    const verdict = validarPrGate(impact, results, changedFiles);
    const summary = `### PR Gate: ${verdict.ok ? 'PASS' : 'FAIL'}\n\n| Job | Required | Result |\n| --- | --- | --- |\n${verdict.rows.map((row) => `| ${row.job} | ${row.required ? 'YES' : 'N/A'} | ${row.actual} |`).join('\n')}\n\n${verdict.errors.map((e) => `- ${e}`).join('\n')}\n`;
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
    console.log(summary);
    if (!verdict.ok) process.exitCode = 1;
  } catch (error) {
    console.error(`PR Gate falhou fechado: ${error.message}`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### PR Gate: FAIL\n\nFalha antes da avaliacao dos jobs. Consulte o log do PR Gate.\n');
    process.exitCode = 1;
  }
}
